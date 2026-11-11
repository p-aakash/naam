// Naam — scoring engine.
// Pure functions only (no DOM, no network) so they can be unit-tested in Node.

import {
  ENTITY_TYPES, ALL_SUFFIXES, INDUSTRIES, RESTRICTED_WORDS, RESERVED_WORDS, FAMOUS_BRANDS,
  HIDDEN_WORDS, HIDDEN_WORD_ALLOWLIST, FOREIGN_MEANINGS, TRENDY_WORDS, GEO_WORDS, FIRST_NAMES,
  SURNAME_HINTS, ARTICLES, STATES, SOCIAL_PLATFORMS, CORE_TLDS, DOMAIN_PREFIXES, DOMAIN_SUFFIXES,
} from './data.js';

export const WEIGHTS = {
  legal: 20,        // entity suffix, restricted & reserved words, state rules
  distinct: 20,     // trademark strength & collision risk
  linguistic: 15,   // say it, spell it, remember it
  industry: 10,     // fit with the chosen industry
  domain: 20,       // live domain availability (filled in asynchronously)
  social: 5,        // handle usability
  safety: 10,       // hidden words, foreign meanings, slurs
};

export const CATEGORY_LABELS = {
  legal: 'Legal & entity rules',
  distinct: 'Distinctiveness & trademark',
  linguistic: 'Pronunciation & memorability',
  industry: 'Industry fit',
  domain: 'Domain availability',
  social: 'Social handles',
  safety: 'Hidden meanings & safety',
};

// Words that clearly mark a legal entity type. If one of these trails the name
// but isn't valid for the chosen entity type, it is a mistake, not part of the name.
const STRONG_MARKERS = new Set([
  'llc', 'l.l.c.', 'lc', 'l.c.', 'limited liability company', 'limited liability co.', 'ltd. liability co.', 'ltd. liability company',
  'inc', 'inc.', 'incorporated', 'corp', 'corp.', 'corporation', 'ltd', 'ltd.', 'limited',
  'llp', 'l.l.p.', 'rllp', 'r.l.l.p.', 'limited liability partnership', 'lp', 'l.p.', 'limited partnership',
  'pllc', 'p.l.l.c.', 'professional limited liability company', 'professional llc',
  'pc', 'p.c.', 'professional corporation', 'prof. corp.', 'p.a.', 'professional association',
  'pbc', 'p.b.c.', 'public benefit corporation', 'nfp',
]);
const MIDDLE_MARKERS = new Set(['llc', 'inc', 'incorporated', 'corp', 'corporation', 'llp', 'pllc', 'ltd']);

const STRICT_PROFANITY = new Set(['fuck', 'shit', 'cunt', 'porn', 'nazi', 'rape', 'rapist', 'slut', 'kkk', 'cock', 'dick', 'piss', 'whore', 'penis', 'twat', 'wank', 'anus']);
const MILD_HIDDEN = new Set(['poo', 'pee', 'hell', 'kill', 'dead', 'die', 'scam', 'fraud', 'loser', 'nut', 'nuts', 'weed', 'drug', 'jerk', 'damn', 'puke', 'vomit', 'isis']);
const HIDDEN_LIST = [...new Set([...HIDDEN_WORDS, 'whore', 'penis', 'anus', 'boob', 'wank', 'twat', 'cunt'])];
const ALLOW = new Set(HIDDEN_WORD_ALLOWLIST);

// Famous brands that are also everyday English words: using them in an unrelated
// industry is often legitimate, so they warn instead of fail.
const COMMON_WORD_BRANDS = new Set(['target', 'apple', 'square', 'signal', 'notion', 'slack', 'zoom', 'gap', 'visa', 'subway', 'booking', 'canon', 'meta',
  'ford', 'dell', 'amazon', 'oracle', 'shell', 'puma', 'windows', 'alexa', 'kindle', 'fidelity', 'vanguard', 'discord', 'telegram', 'twitch', 'stripe',
  'patagonia', 'yeti', 'hermes', 'marvel', 'subway', 'coke', 'hm', 'hp', 'amd', 'ibm', 'kfc', 'jira', 'canva', 'figma', 'lego', 'sony', 'dove', 'mercedes']);

const SHORT_BRANDS = new Set(['hm', 'hp', 'amd', 'ibm', 'kfc', 'dhl', 'bmw', 'pwc', 'ups', 'gap']);

const LY_ALLOW = new Set(['family', 'daily', 'italy', 'only', 'early', 'ally', 'holy', 'lily', 'fly', 'july', 'supply', 'apply', 'reply', 'assembly', 'rally',
  'belly', 'jelly', 'bully', 'friendly', 'lovely', 'weekly', 'monthly', 'yearly', 'quarterly', 'likely', 'ugly', 'rely', 'jolly', 'polly', 'molly',
  'kelly', 'billy', 'sally', 'emily', 'beverly', 'firefly', 'butterfly', 'dragonfly', 'anomaly', 'homily', 'wholly', 'folly', 'gully', 'tally', 'valley',
  'dolly', 'holly', 'hilly', 'silly', 'chilly', 'curly', 'burly', 'surly', 'unruly', 'reilly', 'healthy']);
const IFY_ALLOW = new Set(['amplify', 'simplify', 'verify', 'clarify', 'unify', 'modify', 'identify', 'certify', 'justify', 'classify', 'quantify', 'gratify',
  'notify', 'specify', 'qualify', 'magnify', 'diversify', 'intensify', 'fortify', 'purify', 'beautify', 'electrify', 'exemplify', 'solidify', 'rectify',
  'signify', 'glorify', 'terrify', 'satisfy', 'testify', 'edify', 'codify', 'nullify', 'mystify', 'personify']);

const VOWELS = 'aeiouy';

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */
const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const lc = s => s.toLowerCase();
const uniq = a => [...new Set(a)];

export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

export function countSyllables(word) {
  const w = lc(word).replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|[^laeiouy]ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

function maxConsonantRun(s) {
  let max = 0, run = 0;
  for (const ch of s) {
    if (/[a-z]/.test(ch) && !VOWELS.includes(ch)) { run++; max = Math.max(max, run); } else run = 0;
  }
  return max;
}

// Words in the name, split on spaces/punctuation, camelCase and letter/digit boundaries.
export function tokenize(text) {
  return text
    .replace(/&/g, ' and ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .split(/[^A-Za-z0-9À-ɏ]+/)
    .filter(Boolean)
    .map(lc);
}

// Finds `phrase` as whole word(s) in the token list.
function hasPhrase(tokens, phrase) {
  const parts = phrase.split(/\s+/);
  for (let i = 0; i + parts.length <= tokens.length; i++) {
    if (parts.every((p, k) => tokens[i + k] === p)) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Name parsing                                                        */
/* ------------------------------------------------------------------ */
export function parseName(raw, entityKey) {
  const entity = ENTITY_TYPES[entityKey] || ENTITY_TYPES.llc;
  const original = (raw || '').replace(/\s+/g, ' ').trim();
  let rest = original;
  const found = [];
  // Strip trailing entity words, repeatedly ("Naam LLC Inc." → two suffixes).
  for (let guard = 0; guard < 4; guard++) {
    let matched = null;
    for (const sfx of ALL_SUFFIXES) {
      const re = new RegExp(`(^|[\\s,]+)(${escapeRe(sfx)})\\.?\\s*$`, 'i');
      const m = rest.match(re);
      if (!m) continue;
      const isValid = entity.suffixes.some(s => lc(s) === lc(sfx));
      const isForbidden = entity.forbidden.some(s => lc(s) === lc(sfx));
      if (isValid || isForbidden || STRONG_MARKERS.has(lc(sfx))) {
        matched = { text: m[2], valid: isValid && !isForbidden, index: m.index };
        break;
      }
    }
    if (!matched) break;
    found.unshift(matched);
    rest = rest.slice(0, matched.index).replace(/[\s,]+$/, '');
  }
  const core = rest;
  const tokens = tokenize(core);
  const joined = tokens.join('');
  const letters = joined.replace(/[^a-z]/g, '');
  return { original, core, suffixes: found, tokens, joined, letters, entity };
}

// How a Secretary of State typically compares names for "distinguishability":
// case, punctuation, spaces, articles and entity designators are ignored.
export function registryForm(core) {
  const t = tokenize(core).filter(w => !ARTICLES.includes(w) && !STRONG_MARKERS.has(w));
  return t.join('');
}

/* ------------------------------------------------------------------ */
/* Category builders                                                   */
/* ------------------------------------------------------------------ */
function category(id) {
  return { id, label: CATEGORY_LABELS[id], weight: WEIGHTS[id], checks: [], score: 1, blocker: false };
}
function add(cat, status, title, detail = '', penalty = 0, opts = {}) {
  cat.checks.push({ status, title, detail, penalty, ...opts });
  if (opts.blocker) cat.blocker = true;
}
function finalize(cat) {
  const total = cat.checks.reduce((s, c) => s + (c.penalty || 0), 0);
  cat.score = Math.max(0, Math.min(1, 1 - total));
  const order = { fail: 0, warn: 1, info: 2, pass: 3 };
  cat.checks.sort((a, b) => order[a.status] - order[b.status]);
  return cat;
}

function legalChecks(p, input) {
  const cat = category('legal');
  const { entity, tokens } = p;
  const entityKey = input.entity in ENTITY_TYPES ? input.entity : 'llc';

  if (!p.core.trim()) {
    add(cat, 'fail', 'The name is only an entity designator', `"${p.original}" has no distinctive part before the suffix.`, 1, { blocker: true });
    return { ...finalize(cat), registryForm: '' };
  }

  // Entity designator
  const valid = p.suffixes.filter(s => s.valid);
  const wrong = p.suffixes.filter(s => !s.valid);
  if (wrong.length) {
    const list = wrong.map(s => `"${s.text}"`).join(', ');
    add(cat, 'fail', `${list} isn't allowed for a${/^[aeiou]/i.test(entity.short) ? 'n' : ''} ${entity.short}`,
      `${entity.note}${entity.suffixes.length ? ` Use one of: ${entity.suffixes.slice(0, 5).join(', ')}.` : ''}`, 0.45, { blocker: true });
  }
  if (valid.length > 1) {
    add(cat, 'warn', 'More than one entity designator', `"${valid.map(s => s.text).join('" and "')}". Keep just one.`, 0.1);
  }
  if (!p.suffixes.length) {
    if (entity.required) {
      add(cat, 'info', `Add "${entity.preferred}" when you file`, `Your legal name will be "${p.core} ${entity.preferred}". ${entity.note}`, 0);
    } else {
      add(cat, 'pass', `No designator needed for a ${entity.short}`, entity.note, 0);
    }
  } else if (valid.length && !wrong.length) {
    add(cat, 'pass', `"${valid[0].text}" is a valid designator for a ${entity.short}`, entity.note, 0);
  }
  if (entityKey === 'scorp') {
    add(cat, 'info', 'S-Corp is a tax status, not an entity', ENTITY_TYPES.scorp.note, 0);
  }

  // Entity words in the middle of the name ("Naam LLC Studios")
  const middle = tokens.filter(t => MIDDLE_MARKERS.has(t));
  if (middle.length) {
    add(cat, 'warn', `Entity word "${middle[0].toUpperCase()}" inside the name`, 'Designators belong at the end of the name. Many states reject names with them in the middle, and they confuse people.', 0.2);
  }

  // Reserved / government words
  const reservedHits = Object.keys(RESERVED_WORDS).filter(w => hasPhrase(tokens, w) || (w.includes('-') && lc(p.core).includes(w)));
  for (const w of reservedHits) {
    const federal = /U\.S\.C\.|federal law|Federally chartered/i.test(RESERVED_WORDS[w]);
    add(cat, 'fail', `"${w}" is a reserved or government-implying word`, RESERVED_WORDS[w], federal ? 0.6 : 0.4, { blocker: federal });
  }

  // Restricted words requiring regulator approval
  const restrictedHits = Object.keys(RESTRICTED_WORDS).filter(w => hasPhrase(tokens, w) || lc(p.core).includes(' ' + w + ' ') || (w.includes('-') && lc(p.core).includes(w)));
  const soft = new Set(['trust', 'savings', 'cooperative', 'co-op', 'accredited', 'casino', 'mortgage', 'medical', 'medicine', 'doctor']);
  for (const w of uniq(restrictedHits)) {
    const isSoft = soft.has(w);
    add(cat, isSoft ? 'warn' : 'fail', `"${w}" needs approval or a licence`, RESTRICTED_WORDS[w], isSoft ? 0.15 : 0.3);
  }
  if (!reservedHits.length && !restrictedHits.length) {
    add(cat, 'pass', 'No restricted or government-reserved words', 'None of the commonly regulated words (Bank, Insurance, Federal, University, Engineering, …) appear in the name.', 0);
  }

  // Characters
  const odd = [...p.core].filter(ch => !/[A-Za-z0-9 &'.,!@#$%()\-+/:?]/.test(ch));
  if (odd.length) {
    add(cat, 'warn', `Unusual characters: ${uniq(odd).join(' ')}`, 'Most state registries only accept standard English letters, digits and basic punctuation. Accents, emoji and symbols are often stripped or rejected, and they cannot appear in .com domains.', 0.2);
  }
  if (/^\d/.test(p.core)) {
    add(cat, 'info', 'Starts with a number', 'Allowed in most states, but some registries and directories sort or search numeric names unpredictably.', 0.02);
  }
  if (p.original.length > 80) {
    add(cat, 'warn', 'Very long legal name', `${p.original.length} characters. Some registries and bank forms truncate long names.`, 0.1);
  }

  // Distinguishability preview
  const reg = registryForm(p.core);
  if (tokens[0] === 'the') {
    add(cat, 'info', 'Leading "The" is ignored by registries', `States treat "The ${p.core.replace(/^the\s+/i, '')}" and "${p.core.replace(/^the\s+/i, '')}" as the same name.`, 0);
  }
  if (tokens.length && /s$/.test(tokens[tokens.length - 1]) && tokens[tokens.length - 1].length > 3) {
    add(cat, 'info', 'Plural forms usually don\'t make a name distinct', 'Most states treat singular and plural versions (e.g. "Widget" vs "Widgets") as the same name when checking for conflicts.', 0);
  }

  // State-specific rules
  const states = uniq([input.state, input.opState].filter(s => s && STATES[s]));
  for (const code of states) {
    const st = STATES[code];
    for (const rule of st.rules || []) {
      if ((rule.applies === '*' || rule.applies.includes(entityKey)) && rule.re.test(p.original)) {
        add(cat, rule.level, `${st.name} rule`, rule.text, rule.level === 'fail' ? 0.35 : 0.12);
      }
    }
  }
  if (input.opState && input.state && input.opState !== input.state && STATES[input.opState]) {
    add(cat, 'info', `Also check ${STATES[input.opState].name}`, `If you form in ${STATES[input.state]?.name} but do business in ${STATES[input.opState].name}, you must register there as a foreign entity, and the name must be available in both states (or you'll need a DBA in ${STATES[input.opState].name}).`, 0);
  }

  return { ...finalize(cat), registryForm: reg };
}

function distinctChecks(p, input) {
  const cat = category('distinct');
  const { tokens, joined } = p;
  const industry = INDUSTRIES[input.industry] || INDUSTRIES.other;
  if (!joined) return finalize(cat);

  // Famous brand collisions
  let brandHit = false;
  for (const brand of uniq(FAMOUS_BRANDS)) {
    const common = COMMON_WORD_BRANDS.has(brand);
    if (joined === brand) {
      brandHit = true;
      add(cat, common ? 'warn' : 'fail', `Identical to the famous brand "${brand}"`,
        common ? `"${brand}" is also an ordinary word, but famous marks are protected against "dilution" even in unrelated industries. Expect a trademark objection if your field overlaps.`
          : 'Famous marks are protected across all industries. Using this name is very likely to draw a cease-and-desist.', common ? 0.45 : 0.9, { blocker: !common });
    } else if (tokens.includes(brand) && (brand.length >= 3 || SHORT_BRANDS.has(brand))) {
      brandHit = true;
      add(cat, common ? 'warn' : 'fail', `Contains the brand "${brand}"`,
        common ? `"${brand}" is a common word but also a famous mark. Fine in unrelated contexts, risky if it suggests a connection.`
          : 'Using a famous brand inside your name suggests an affiliation and invites trademark action.', common ? 0.2 : 0.55, { blocker: !common });
    } else if (brand.length >= 5 && joined.includes(brand)) {
      brandHit = true;
      add(cat, 'warn', `Contains "${brand}"`, `The string "${brand}" (a famous brand) is embedded in the name. Make sure it doesn't read as a reference to them.`, 0.2);
    } else if (brand.length >= 5 && Math.abs(joined.length - brand.length) <= 1 && levenshtein(joined, brand) === 1) {
      brandHit = true;
      add(cat, 'fail', `One letter away from "${brand}"`, 'Names that look like a misspelling of a famous brand are treated as confusingly similar, and their domains look like typosquatting.', 0.6);
    }
  }
  if (!brandHit) add(cat, 'pass', 'No clash with well-known brands', `Checked against ${uniq(FAMOUS_BRANDS).length} famous marks. This is not a full trademark search.`, 0);

  // Generic / descriptive
  const genericSet = new Set([...(industry.generic || []), ...INDUSTRIES.other.generic, ...ARTICLES]);
  const geoSet = new Set(GEO_WORDS);
  const meaningful = tokens.filter(t => !ARTICLES.includes(t));
  const genericCount = meaningful.filter(t => genericSet.has(t) || geoSet.has(t)).length;
  if (meaningful.length && genericCount === meaningful.length) {
    add(cat, 'fail', 'Entirely generic or descriptive', `"${p.core}" only describes what the business does or where it is. That makes it nearly impossible to trademark and easy to confuse with competitors.`, 0.6);
  } else if (meaningful.length >= 2 && genericCount / meaningful.length >= 0.5) {
    add(cat, 'warn', 'Mostly descriptive words', `${genericCount} of ${meaningful.length} words are generic for ${industry.label.toLowerCase()}. The distinctive part ("${meaningful.filter(t => !genericSet.has(t) && !geoSet.has(t)).join(' ')}") carries the brand. Make sure it's strong.`, 0.2);
  } else {
    add(cat, 'pass', 'Has a distinctive element', 'Coined, arbitrary or suggestive words are the easiest to protect as trademarks.', 0);
  }

  // Geography
  const geoHits = GEO_WORDS.filter(g => hasPhrase(tokens, g));
  if (geoHits.length) {
    add(cat, 'warn', `Geographic term: "${geoHits[0]}"`, 'Place names are "geographically descriptive", so they\'re hard to trademark and can limit you if you expand beyond the area.', 0.15);
  }

  // Personal names
  const personal = (FIRST_NAMES.includes(tokens[0]) && tokens.length > 1) || tokens.some(t => SURNAME_HINTS.includes(t));
  if (personal) {
    add(cat, 'info', 'Looks like a personal name', 'Surname-based names are weak trademarks until they gain recognition, and can complicate selling the business or a partner leaving.', 0.08);
  }

  // Acronyms / initials
  const initials = p.core.split(/\s+/).filter(w => /^[A-Z]{2,4}$/.test(w.replace(/[.&]/g, '')) && !STRONG_MARKERS.has(lc(w)) && !TRENDY_WORDS.includes(lc(w)));
  if (initials.length || /^([A-Z]\.){2,}/.test(p.core)) {
    add(cat, 'warn', 'Initials or acronym', 'Initials ("ABC Solutions") are forgettable, hard to trademark until famous, and hard to find a domain for.', 0.15);
  }

  // Trendy words
  const trendy = TRENDY_WORDS.filter(t => tokens.includes(t));
  if (trendy.length) {
    add(cat, 'warn', `Trend word: "${trendy[0]}"`, 'Hype words date a name quickly and crowd the trademark register with near-identical marks.', 0.12);
  }

  // Years / numbers
  if (/\b(19|20)\d{2}\b/.test(p.core)) {
    add(cat, 'warn', 'Contains a year', 'Years make a brand look dated over time.', 0.1);
  }
  return finalize(cat);
}

function linguisticChecks(p) {
  const cat = category('linguistic');
  const { tokens, joined, letters } = p;
  if (!joined) return finalize(cat);
  const len = letters.length;

  // Length
  if (len < 3) add(cat, 'warn', `Very short (${len} letters)`, 'Very short names are usually taken everywhere and hard to trademark.', 0.25);
  else if (len <= 10) add(cat, 'pass', `Good length (${len} letters)`, 'Short names are easier to remember, type and fit on a logo.', 0);
  else if (len <= 15) add(cat, 'warn', `A bit long (${len} letters)`, 'Still workable, but shorter names are easier to recall and type.', 0.1);
  else if (len <= 20) add(cat, 'warn', `Long (${len} letters)`, 'Long names get shortened by customers anyway, and make long domains and handles.', 0.22);
  else add(cat, 'fail', `Too long (${len} letters)`, 'Over 20 letters is hard to remember, type or fit on a social handle.', 0.35);

  // Word count
  const words = tokens.filter(t => !ARTICLES.includes(t)).length;
  if (words > 4) add(cat, 'warn', `${words} words`, 'One to three words is the sweet spot for recall.', 0.12);

  // Syllables
  const syll = tokens.reduce((s, t) => s + countSyllables(t), 0);
  if (syll > 5) add(cat, 'warn', `${syll} syllables`, 'Two to four syllables is easiest to say and remember.', 0.12);
  else if (syll >= 1) add(cat, 'pass', `${syll} syllable${syll > 1 ? 's' : ''}`, 'Easy to say in one breath.', 0);

  // Pronounceability
  const run = Math.max(...tokens.map(t => maxConsonantRun(t)), 0);
  const vowelRatio = letters.length ? [...letters].filter(c => VOWELS.includes(c)).length / letters.length : 0;
  if (run >= 5 || (letters.length > 3 && vowelRatio < 0.15)) {
    add(cat, 'fail', 'Hard to pronounce', `There's a cluster of ${run} consonants in a row. People won't know how to say it.`, 0.3);
  } else if (run === 4 || (letters.length > 4 && (vowelRatio < 0.22 || vowelRatio > 0.72))) {
    add(cat, 'warn', 'Pronunciation may be unclear', 'Unusual consonant clusters or vowel balance can leave people unsure how to say it.', 0.12);
  } else {
    add(cat, 'pass', 'Pronounceable', 'Balanced vowels and consonants.', 0);
  }

  // Digits & hyphens (radio test)
  if (/\d/.test(p.core)) {
    add(cat, 'warn', 'Contains digits', 'Fails the "radio test": hearing "Five Star" or "5 Star", nobody knows which to type. Consider registering both domains.', 0.15);
  }
  if (/-/.test(p.core)) {
    add(cat, 'warn', 'Contains a hyphen', 'Hyphens are easily forgotten when people type the domain, and are awkward to say out loud.', 0.12);
  }
  if (/&/.test(p.core)) {
    add(cat, 'info', 'Contains "&"', 'Domains and handles can\'t contain "&". Decide between "and" or dropping it, and consider registering both.', 0.05);
  }

  // Intentional misspellings
  const misspell = [];
  for (const t of tokens) {
    if (t.length >= 5 && /[bcdfghjklmnpqstvwxz][lmn]?r$/.test(t) && !/(?:er|or|ar|ir|ur|yr|our|eer|air|oor)$/.test(t)) misspell.push(`${t} (dropped vowel)`);
    if (/^(kw|kwik|kool|kut|kandy|kreat|klean|krisp|kraft)/.test(t) && !['kraft'].includes(t)) misspell.push(`${t} (K for C)`);
    if (/^x(press|treme|cel|pert|change)/.test(t)) misspell.push(`${t} (X for Ex)`);
    if (/^(u|r|ur|2|4|b|c|y|n)$/.test(t) && tokens.length > 1) misspell.push(`"${t}" (text-speak)`);
    if (/(?:z)$/.test(t) && /[aeiouy]z$/.test(t) === false && /[bdgkmnprtvy]z$/.test(t) && t.length >= 4 && !/(tz|zz|ritz|blitz|quartz|waltz)$/.test(t)) misspell.push(`${t} (Z for S)`);
  }
  if (misspell.length) {
    add(cat, 'warn', 'Creative spelling', `${misspell.slice(0, 3).join(', ')}. People who hear the name will type the normal spelling, so you'll need that domain too.`, 0.12);
  }

  // Boundary double letters when joined
  const doubles = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    const a = tokens[i], b = tokens[i + 1];
    if (a.slice(-1) === b[0] && /[a-z]/.test(b[0])) doubles.push(`${a}${b}`);
  }
  if (doubles.length) {
    add(cat, 'info', 'Doubled letter when written as one word', `"${doubles[0]}" is easy to mistype as a domain or handle. Consider also registering the single-letter version.`, 0.05);
  }

  // Triple letters
  if (/(.)\1\1/.test(joined)) add(cat, 'warn', 'Three identical letters in a row', 'Easy to mistype, hard to read.', 0.1);

  // Ambiguous letter combos (spelling uncertainty)
  const ambiguous = [];
  if (/ph/.test(joined)) ambiguous.push('ph/f');
  if (/(ei|ie)/.test(joined)) ambiguous.push('ei/ie');
  if (/q(?!u)/.test(joined)) ambiguous.push('q without u');
  if (/(ck|kk)/.test(joined) && /c(?!k)/.test(joined)) ambiguous.push('c/ck/k');
  if (ambiguous.length >= 2) {
    add(cat, 'warn', 'Several spelling ambiguities', `${ambiguous.join(', ')}. Listeners may guess the spelling wrong.`, 0.1);
  } else if (ambiguous.length === 1) {
    add(cat, 'info', `Spelling ambiguity: ${ambiguous[0]}`, 'Some listeners may guess the spelling wrong.', 0.03);
  }

  // Domain length
  if (joined.length > 20) add(cat, 'warn', 'Long domain', `${joined}.com is ${joined.length + 4} characters. Long domains are mistyped more often.`, 0.08);

  return finalize(cat);
}

function industryChecks(p, input) {
  const cat = category('industry');
  const industry = INDUSTRIES[input.industry] || INDUSTRIES.other;
  const { tokens, letters } = p;
  if (!letters) return finalize(cat);

  const [lo, hi] = industry.ideal;
  if (letters.length >= lo && letters.length <= hi) {
    add(cat, 'pass', `Length suits ${industry.label}`, `Names in this space typically run ${lo}–${hi} letters.`, 0);
  } else {
    const off = letters.length < lo ? lo - letters.length : letters.length - hi;
    add(cat, 'warn', `Length is unusual for ${industry.label}`, `Names in this space typically run ${lo}–${hi} letters; yours is ${letters.length}.`, Math.min(0.25, 0.05 * off));
  }

  // Tone
  const tone = (industry.tone || []).filter(t => tokens.some(tok => tok === t || (t.length >= 4 && tok.includes(t))));
  if (tone.length) add(cat, 'pass', 'Signals the right space', `"${tone[0]}" fits the tone expected in ${industry.label.toLowerCase()}.`, 0);

  // Clichés
  const cliches = [];
  for (const c of industry.cliches || []) {
    if (tokens.includes(c)) cliches.push(c);
    else if (c === 'ly' && tokens.some(t => t.length >= 5 && t.endsWith('ly') && !LY_ALLOW.has(t))) cliches.push('-ly');
    else if (c === 'ify' && tokens.some(t => t.length >= 6 && t.endsWith('ify') && !IFY_ALLOW.has(t))) cliches.push('-ify');
    else if (c === 'io' && tokens.some(t => t.length >= 5 && t.endsWith('io') && !/(?:studio|radio|ratio|patio|audio|portfolio|rio|polio)$/.test(t))) cliches.push('-io');
  }
  if (cliches.length) {
    add(cat, 'warn', `Common in ${industry.label}: ${uniq(cliches).slice(0, 3).map(c => `"${c}"`).join(', ')}`, 'These are some of the most overused naming patterns in this industry. Your name may blend in.', Math.min(0.3, 0.12 * uniq(cliches).length));
  } else {
    add(cat, 'pass', 'Avoids the industry\'s most common clichés', '', 0);
  }

  // Industry-specific regulated words (beyond the global restricted list)
  const reg = (industry.regulated || []).filter(w => !(w in RESTRICTED_WORDS) && !(w in RESERVED_WORDS) && hasPhrase(tokens, w));
  for (const w of reg) {
    add(cat, 'info', `"${w}" requires a licence`, `Fine if you hold the relevant licence. ${industry.advice}`, 0.03);
  }

  // Mismatch: name signals a different regulated industry
  const finWords = ['bank', 'capital', 'finance', 'financial', 'pay', 'fund', 'invest', 'wealth'];
  const medWords = ['medical', 'clinic', 'health', 'pharma', 'rx', 'dental', 'care'];
  const signals = [];
  if (!['finance', 'insurance', 'crypto'].includes(input.industry) && tokens.some(t => finWords.includes(t))) signals.push('finance');
  if (!['healthcare', 'biotech', 'fitness'].includes(input.industry) && tokens.some(t => medWords.includes(t))) signals.push('healthcare');
  if (signals.length) {
    add(cat, 'warn', `Name suggests ${signals.join(' / ')}`, `Customers may assume you're in ${signals.join(' or ')}, not ${industry.label.toLowerCase()}. Regulators can also take an interest.`, 0.15);
  }

  add(cat, 'info', `${industry.label} naming tip`, industry.advice, 0);
  return finalize(cat);
}

function safetyChecks(p) {
  const cat = category('safety');
  const { tokens, joined } = p;
  if (!joined) return finalize(cat);

  // Token boundary positions in the joined string
  const bounds = [];
  let pos = 0;
  for (const t of tokens) { pos += t.length; bounds.push(pos); }
  const tokenAt = i => { let start = 0; for (const t of tokens) { if (i < start + t.length) return { t, start }; start += t.length; } return null; };

  const hits = [];
  for (const w of HIDDEN_LIST) {
    let idx = joined.indexOf(w);
    while (idx !== -1) {
      const end = idx + w.length;
      const spans = bounds.some(b => b > idx && b < end);
      const host = tokenAt(idx);
      const whole = host && host.t === w;
      const strict = STRICT_PROFANITY.has(w);
      const allowed = !spans && host && ALLOW.has(host.t);
      if (!allowed) {
        if (whole && strict) hits.push({ w, level: 'fail', why: 'explicit' });
        else if (spans) hits.push({ w, level: MILD_HIDDEN.has(w) ? 'info' : (strict || ['sex', 'ass', 'anal', 'cum', 'tit', 'butt', 'boob'].includes(w) ? 'fail' : 'warn'), why: 'spans' });
        else if (!whole && !MILD_HIDDEN.has(w) && (strict || w.length >= 4)) hits.push({ w, level: 'warn', why: 'inside' });
        else if (!whole && !MILD_HIDDEN.has(w) && w.length <= 3 && host && (host.t.startsWith(w) || host.t.endsWith(w))) hits.push({ w, level: 'info', why: 'inside' });
      }
      idx = joined.indexOf(w, idx + 1);
    }
  }
  const seen = new Set();
  for (const h of hits) {
    if (seen.has(h.w)) continue;
    seen.add(h.w);
    if (h.level === 'fail' && h.why === 'explicit') add(cat, 'fail', `Contains an offensive word ("${h.w}")`, 'This will be rejected by many platforms, ad networks and some registries.', 0.9, { blocker: true });
    else if (h.level === 'fail') add(cat, 'fail', `Hidden word across words: "${h.w}"`, `Written as one word ("${joined}"), as in a domain or handle, it reads as "${h.w}". This is the classic "expertsexchange.com" / "penisland.net" problem. People will notice, and many will screenshot it.`, 0.7);
    else add(cat, h.level, `Hidden word: "${h.w}"`, `Written as one word ("${joined}"), it can be read as "${h.w}". This is the classic "expertsexchange.com" problem. Consider using capital letters or a hyphen in the logo and domain.`, h.level === 'warn' ? 0.35 : 0.08);
  }

  // Foreign meanings
  for (const f of FOREIGN_MEANINGS) {
    const hit = f.exact ? (tokens.includes(f.word) || joined === f.word) : joined.includes(f.word);
    if (hit) add(cat, f.word === 'nova' ? 'info' : 'warn', `"${f.word}" in ${f.lang}`, `Means ${f.meaning}. Matters if you sell in those markets.`, f.word === 'nova' ? 0.02 : 0.3);
  }

  if (!cat.checks.length) add(cat, 'pass', 'No hidden or offensive meanings found', 'Checked hidden English words when written as one word, and common problem words in Spanish, French, German, Italian, Dutch, Japanese and Mandarin.', 0);
  return finalize(cat);
}

export function handleFor(p) {
  return p.joined.normalize('NFKD').replace(/[^a-z0-9]/g, '');
}

function socialChecks(p) {
  const cat = category('social');
  const handle = handleFor(p);
  const platforms = SOCIAL_PLATFORMS.map(pl => {
    const ok = handle.length >= pl.min && handle.length <= pl.max && pl.re.test(handle);
    return { ...pl, url: pl.url(handle), ok, reason: ok ? '' : handle.length > pl.max ? `Too long (max ${pl.max})` : handle.length < pl.min ? `Too short (min ${pl.min})` : 'Invalid characters' };
  });
  const bad = platforms.filter(x => !x.ok);
  if (!handle) {
    add(cat, 'fail', 'No usable handle', 'The name has no letters or digits to build a handle from.', 1);
  } else if (!bad.length) {
    add(cat, 'pass', `@${handle} is a valid handle on every major platform`, 'Availability can only be confirmed by opening each profile link below. Platforms block automated checks.', 0);
  } else {
    for (const b of bad) add(cat, 'warn', `${b.label}: ${b.reason}`, `@${handle} can't be used as-is on ${b.label}. You'll need a shorter or variant handle there.`, b.id === 'x' || b.id === 'instagram' ? 0.3 : 0.12);
  }
  if (handle.length > 12 && !bad.length) add(cat, 'info', 'Long handle', 'Handles over 12 characters are harder to say and type. Consider a shorter variant for social media.', 0.1);
  return { ...finalize(cat), handle, platforms };
}

/* ------------------------------------------------------------------ */
/* Domains                                                             */
/* ------------------------------------------------------------------ */
export function domainCandidates(p, industryKey) {
  const base = handleFor(p);
  if (!base) return [];
  const industry = INDUSTRIES[industryKey] || INDUSTRIES.other;
  const tlds = uniq([...CORE_TLDS, ...(industry.tlds || [])]);
  const list = tlds.map(t => ({ domain: `${base}.${t}`, kind: 'exact', tld: t }));
  const variants = [];
  for (const pre of DOMAIN_PREFIXES) variants.push(`${pre}${base}`);
  for (const suf of DOMAIN_SUFFIXES) variants.push(`${base}${suf}`);
  if (base.includes('and')) variants.push(base.replace(/and/g, ''));
  if (/(.)\1/.test(base)) variants.push(base.replace(/(.)\1/g, '$1'));
  for (const v of uniq(variants)) if (v !== base && v.length <= 63) list.push({ domain: `${v}.com`, kind: 'variant', tld: 'com' });
  return list.filter(d => d.domain.split('.')[0].length <= 63);
}

// results: [{domain, kind, tld, status: 'available'|'likely'|'taken'|'unknown'|'pending'}]
export function scoreDomains(results) {
  const cat = category('domain');
  if (!results || !results.length) { cat.score = null; return cat; }
  const pending = results.filter(r => r.status === 'pending').length;
  const com = results.find(r => r.kind === 'exact' && r.tld === 'com');
  const free = r => r.status === 'available' || r.status === 'likely';
  const exactFree = results.filter(r => r.kind === 'exact' && free(r));
  const variantFree = results.filter(r => r.kind === 'variant' && free(r));

  if (com && com.status === 'pending') { cat.score = null; cat.pending = pending; return cat; }

  if (com && free(com)) {
    add(cat, 'pass', `${com.domain} looks available`, com.status === 'likely' ? 'No DNS records found. Confirm with a registrar.' : 'The .com registry has no record of it. Register it before you announce the name; premium pricing may apply.', 0);
  } else if (com && com.status === 'taken') {
    let pen = 0.45;
    let detail = 'Someone already owns the exact .com.';
    if (exactFree.length) { detail += ` Available alternatives: ${exactFree.slice(0, 4).map(r => r.domain).join(', ')}.`; pen -= 0.1; }
    if (variantFree.length) { detail += ` Available .com variants: ${variantFree.slice(0, 3).map(r => r.domain).join(', ')}.`; pen -= 0.1; }
    if (!exactFree.length && !variantFree.length && !pending) { pen = 0.8; detail += ' No alternatives found either.'; }
    add(cat, 'warn', `${com.domain} is taken`, `${detail} Owners sometimes sell parked domains, so check the site.`, pen);
  } else if (com) {
    add(cat, 'info', `Couldn't confirm ${com.domain}`, 'The lookup failed (rate limit, network or registry outage). Check it manually with a registrar.', 0.1);
  }
  const otherTaken = results.filter(r => r.kind === 'exact' && r.tld !== 'com' && r.status === 'taken').map(r => r.domain);
  if (otherTaken.length >= 4) add(cat, 'info', 'Name is in active use online', `${otherTaken.length} other extensions are registered (${otherTaken.slice(0, 4).join(', ')}…). Someone may already be operating under this name.`, 0.1);
  cat.pending = pending;
  return finalize(cat);
}

/* ------------------------------------------------------------------ */
/* Top-level                                                           */
/* ------------------------------------------------------------------ */
export function analyzeName(input) {
  const entityKey = input.entity in ENTITY_TYPES ? input.entity : 'llc';
  const p = parseName(input.name, entityKey);
  const legal = legalChecks(p, { ...input, entity: entityKey });
  const categories = [
    legal,
    distinctChecks(p, input),
    linguisticChecks(p),
    industryChecks(p, input),
    safetyChecks(p),
    socialChecks(p),
  ];
  const entity = ENTITY_TYPES[entityKey];
  const legalName = p.suffixes.some(s => s.valid) && !p.suffixes.some(s => !s.valid)
    ? `${p.core} ${p.suffixes.find(s => s.valid).text}`.trim()
    : `${p.core}${entity.preferred ? ` ${entity.preferred}` : ''}`.trim();
  return {
    input: { ...input, entity: entityKey },
    parsed: p,
    legalName,
    registryForm: legal.registryForm,
    categories,
    domains: domainCandidates(p, input.industry),
  };
}

export function totalScore(categories) {
  let sum = 0, weight = 0;
  for (const c of categories) {
    if (c.score === null || c.score === undefined) continue;
    sum += c.score * c.weight;
    weight += c.weight;
  }
  if (!weight) return { score: 0, blocked: false, partial: true };
  let score = (sum / weight) * 100;
  // Problems compound: each failed check costs extra points on top of its category,
  // and any failure caps the name below "Strong" until it's fixed.
  const checks = categories.flatMap(c => c.checks || []);
  const fails = checks.filter(c => c.status === 'fail').length;
  const warns = checks.filter(c => c.status === 'warn').length;
  score -= Math.min(35, fails * 5 + warns * 3);
  if (fails) score = Math.min(score, 64);
  const blocked = categories.some(c => c.blocker);
  if (blocked) score = Math.min(score, 35);
  score = Math.max(0, Math.round(score));
  return { score, blocked, fails, warns, partial: weight < Object.values(WEIGHTS).reduce((a, b) => a + b, 0) };
}

export function grade(score, blocked) {
  if (blocked) return { label: 'Blocked', tone: 'fail', summary: 'At least one issue would stop registration or invite legal trouble. Fix the red items first.' };
  if (score >= 85) return { label: 'Excellent', tone: 'pass', summary: 'A strong, distinctive and usable name. Run the official searches below and secure it.' };
  if (score >= 70) return { label: 'Strong', tone: 'pass', summary: 'A good name with a few things to tidy up.' };
  if (score >= 55) return { label: 'Fair', tone: 'warn', summary: 'Usable, but several issues could hold the brand back.' };
  if (score >= 40) return { label: 'Risky', tone: 'warn', summary: 'Significant problems. Consider a variation or a different name.' };
  return { label: 'Poor', tone: 'fail', summary: 'This name has serious problems. Try another direction.' };
}
