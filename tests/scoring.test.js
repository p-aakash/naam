import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analyzeName, totalScore, grade, parseName, registryForm, tokenize, countSyllables,
  levenshtein, scoreDomains, domainCandidates, WEIGHTS,
} from '../js/scoring.js';
import { STATES, ENTITY_TYPES, INDUSTRIES } from '../js/data.js';

const run = (name, opts = {}) => {
  const a = analyzeName({ name, industry: 'tech', entity: 'llc', state: 'DE', ...opts });
  return { a, ...totalScore(a.categories) };
};
const checks = a => a.categories.flatMap(c => c.checks);
const has = (a, status, re) => checks(a).some(c => c.status === status && re.test(c.title));

test('weights add up to 100', () => {
  assert.equal(Object.values(WEIGHTS).reduce((s, w) => s + w, 0), 100);
});

test('data integrity: 50 states + DC, all with https search links', () => {
  assert.equal(Object.keys(STATES).length, 51);
  for (const [code, s] of Object.entries(STATES)) {
    assert.match(s.search, /^https:\/\//, code);
    assert.ok(s.name, code);
  }
  for (const [k, e] of Object.entries(ENTITY_TYPES)) {
    assert.ok(e.label && e.note, k);
    for (const sfx of e.suffixes) assert.ok(!e.forbidden.includes(sfx), `${k}: ${sfx} both allowed and forbidden`);
  }
  for (const [k, i] of Object.entries(INDUSTRIES)) assert.equal(i.ideal.length, 2, k);
});

test('tokenize splits camelCase, digits and punctuation', () => {
  assert.deepEqual(tokenize('NaamAI'), ['naam', 'ai']);
  assert.deepEqual(tokenize('Smith & Jones'), ['smith', 'and', 'jones']);
  assert.deepEqual(tokenize('Kwik Flickr 4U'), ['kwik', 'flickr', '4', 'u']);
  assert.deepEqual(tokenize('the-best.co'), ['the', 'best', 'co']);
});

test('syllables and edit distance helpers', () => {
  assert.equal(countSyllables('naam'), 1);
  assert.equal(countSyllables('zentrova'), 3);
  assert.equal(levenshtein('gooogle', 'google'), 1);
  assert.equal(levenshtein('naam', 'naam'), 0);
});

test('parseName strips valid and invalid suffixes', () => {
  const p = parseName('Naam, L.L.C.', 'llc');
  assert.equal(p.core, 'Naam');
  assert.equal(p.suffixes[0].valid, true);
  const q = parseName('Naam LLC Inc.', 'llc');
  assert.equal(q.core, 'Naam');
  assert.equal(q.suffixes.length, 2);
  assert.equal(q.suffixes.find(s => /inc/i.test(s.text)).valid, false);
  // "Foundation" is part of the name for an LLC, not a designator
  assert.equal(parseName('Naam Foundation', 'llc').core, 'Naam Foundation');
});

test('registryForm ignores articles, punctuation and suffixes', () => {
  assert.equal(registryForm('The Naam Co-op, LLC'), 'naamcoop');
  assert.equal(registryForm('Naam & Sons'), 'naamsons');
});

test('a clean coined name scores well and gets the right legal name', () => {
  const { a, score, blocked } = run('Zentrova');
  assert.equal(blocked, false);
  assert.ok(score >= 85, `score ${score}`);
  assert.equal(a.legalName, 'Zentrova LLC');
});

test('wrong suffix for the entity type blocks the name', () => {
  const { a, blocked, score } = run('Naam Inc.', { entity: 'llc' });
  assert.equal(blocked, true);
  assert.ok(score <= 35);
  assert.equal(a.legalName, 'Naam LLC');
});

test('sole proprietors may not use LLC/Inc', () => {
  const { blocked } = run('Naam LLC', { entity: 'sole' });
  assert.equal(blocked, true);
  assert.equal(run('Naam', { entity: 'sole' }).blocked, false);
});

test('S-corp explains it is a tax election and accepts LLC', () => {
  const { a, blocked } = run('Naam LLC', { entity: 'scorp' });
  assert.equal(blocked, false);
  assert.ok(has(a, 'info', /tax status/i));
});

test('restricted and reserved words are flagged', () => {
  assert.ok(has(run('Naam Bank').a, 'fail', /bank/i));
  assert.ok(has(run('Naam University').a, 'fail', /university/i));
  const olympic = run('Olympic Fitness', { industry: 'fitness' });
  assert.equal(olympic.blocked, true);
  assert.ok(has(run('Federal Naam').a, 'fail', /federal/i));
});

test('state-specific rules apply to the chosen states', () => {
  assert.ok(has(run('Naam Trust LLC', { state: 'CA' }).a, 'fail', /California/));
  assert.ok(!has(run('Naam Trust LLC', { state: 'DE' }).a, 'fail', /California/));
  assert.ok(has(run('Lotto Kings', { state: 'TX' }).a, 'fail', /Texas/));
  // operating state rules also apply, and a foreign-qualification note is shown
  const both = run('Naam Trust LLC', { state: 'DE', opState: 'CA' }).a;
  assert.ok(has(both, 'fail', /California/));
  assert.ok(has(both, 'info', /Also check California/));
});

test('famous brands: exact, embedded, and typo variants', () => {
  assert.equal(run('Google').blocked, true);
  assert.equal(run('Google Consulting', { industry: 'consulting' }).blocked, true);
  assert.ok(has(run('Gooogle').a, 'fail', /One letter away/));
  // common-word brands only warn
  const target = run('Target Roofing', { industry: 'construction' });
  assert.equal(target.blocked, false);
  assert.ok(has(target.a, 'warn', /target/i));
});

test('generic and descriptive names are penalised', () => {
  const { a, score } = run('Best Software Solutions');
  assert.ok(has(a, 'warn', /descriptive/i) || has(a, 'fail', /generic/i));
  assert.ok(score < 70, `score ${score}`);
  assert.ok(has(run('Software Solutions').a, 'fail', /generic/i));
});

test('hidden words across word boundaries are caught', () => {
  assert.ok(has(run('Experts Exchange').a, 'fail', /"sex"/));
  assert.ok(has(run('Pen Island', { industry: 'ecommerce' }).a, 'fail', /"penis"/));
  assert.ok(has(run('Therapist Finder', { industry: 'healthcare' }).a, 'warn', /"rapist"/));
});

test('innocent words are not flagged as hidden words', () => {
  for (const name of ['Classic Glass', 'Assist Analytics', 'Sussex Shell', 'Butterfly Button', 'Cocktail Constitution']) {
    const a = run(name).a;
    assert.ok(!checks(a).some(c => /Hidden word|offensive/.test(c.title) && (c.status === 'warn' || c.status === 'fail')), name);
  }
});

test('explicit profanity blocks the name', () => {
  assert.equal(run('Shit Happens').blocked, true);
});

test('foreign meanings are flagged', () => {
  assert.ok(has(run('Mist Coffee', { industry: 'food' }).a, 'warn', /German/));
  assert.ok(has(run('Gift Box').a, 'warn', /German/));
});

test('pronunciation, digits, hyphens, length', () => {
  assert.ok(has(run('Strtgx').a, 'fail', /pronounce/i));
  assert.ok(has(run('Naam 4 U').a, 'warn', /digits/i));
  assert.ok(has(run('Naam-Works').a, 'warn', /hyphen/i));
  assert.ok(has(run('Extraordinarilylongcompanynamehere').a, 'fail', /Too long/));
});

test('creative spellings are flagged', () => {
  assert.ok(has(run('Kwik Flickr').a, 'warn', /Creative spelling/));
});

test('industry clichés and licences', () => {
  assert.ok(has(run('Naamify', { industry: 'tech' }).a, 'warn', /Common in/));
  assert.ok(!has(run('Simplify', { industry: 'tech' }).a, 'warn', /-ify/));
  // licensed word in its own industry is informational, not a penalty
  assert.ok(has(run('Smith Law', { industry: 'legal', entity: 'pllc' }).a, 'info', /licence/));
});

test('social handles respect platform limits', () => {
  const social = run('Supercalifragilistic').a.categories.find(c => c.id === 'social');
  const x = social.platforms.find(p => p.id === 'x');
  assert.equal(x.ok, false);
  assert.match(x.reason, /max 15/);
  const short = run('Naam').a.categories.find(c => c.id === 'social');
  assert.ok(short.platforms.every(p => p.ok));
});

test('domain candidates include core TLDs, industry TLDs and variants', () => {
  const p = parseName('Naam Labs', 'llc');
  const list = domainCandidates(p, 'tech').map(d => d.domain);
  assert.ok(list.includes('naamlabs.com'));
  assert.ok(list.includes('naamlabs.io'));
  assert.ok(list.includes('getnaamlabs.com'));
  assert.equal(new Set(list).size, list.length);
});

test('domain scoring', () => {
  const base = [
    { domain: 'naam.com', kind: 'exact', tld: 'com', status: 'available' },
    { domain: 'naam.io', kind: 'exact', tld: 'io', status: 'taken' },
  ];
  assert.equal(scoreDomains(base).score, 1);
  const taken = scoreDomains([{ ...base[0], status: 'taken' }, { ...base[1], status: 'available' }]);
  assert.ok(taken.score < 1 && taken.score > 0.3);
  const none = scoreDomains([{ ...base[0], status: 'taken' }, { ...base[1], status: 'taken' }]);
  assert.ok(none.score < taken.score);
  assert.equal(scoreDomains([{ ...base[0], status: 'pending' }]).score, null);
});

test('pending domain category is excluded from the total, not counted as zero', () => {
  const a = analyzeName({ name: 'Zentrova', industry: 'tech', entity: 'llc', state: 'DE' });
  const withPending = totalScore([...a.categories, scoreDomains([{ domain: 'zentrova.com', kind: 'exact', tld: 'com', status: 'pending' }])]);
  assert.equal(withPending.partial, true);
  assert.ok(withPending.score >= 85);
});

test('grades', () => {
  assert.equal(grade(90, false).label, 'Excellent');
  assert.equal(grade(75, false).label, 'Strong');
  assert.equal(grade(60, false).label, 'Fair');
  assert.equal(grade(45, false).label, 'Risky');
  assert.equal(grade(10, false).label, 'Poor');
  assert.equal(grade(99, true).label, 'Blocked');
});

test('empty and suffix-only names do not crash', () => {
  assert.equal(run('LLC').blocked, true);
  assert.doesNotThrow(() => run('   '));
  assert.doesNotThrow(() => run('🚀🚀'));
  assert.doesNotThrow(() => run('Café Société'));
});
