import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDomain, parseDomainList, splitDomainList, registrableDomain, toAscii, MAX_DOMAINS } from '../js/domain-input.js';

const ok = (input, domain, opts) => {
  const r = normalizeDomain(input, opts);
  assert.equal(r.error, '', `${input} → unexpected error: ${r.error}`);
  assert.equal(r.domain, domain, input);
  return r;
};
const bad = (input, re) => {
  const r = normalizeDomain(input);
  assert.ok(r.error, `${input} should be rejected`);
  if (re) assert.match(r.error, re, input);
  assert.equal(r.domain, '');
  return r;
};

test('plain domains, case and whitespace', () => {
  ok('naam.com', 'naam.com');
  ok('  NAAM.COM  ', 'naam.com');
  ok('Naam.Io', 'naam.io');
  ok('my-brand.co', 'my-brand.co');
  ok('123naam.com', '123naam.com');
});

test('no extension defaults to .com (or the given default)', () => {
  const r = ok('naam', 'naam.com');
  assert.ok(r.notes.some(n => /\.com/.test(n)));
  ok('naam', 'naam.io', { defaultTld: 'io' });
});

test('pasted URLs: scheme, www, path, query, fragment, port, credentials', () => {
  ok('https://naam.com', 'naam.com');
  ok('http://www.naam.com/about?x=1#top', 'naam.com');
  ok('HTTPS://WWW.NAAM.COM/', 'naam.com');
  ok('//naam.com/path', 'naam.com');
  ok('naam.com:8080', 'naam.com');
  ok('https://user:pass@naam.com/', 'naam.com');
  ok('ftp://files.naam.io', 'naam.io');
  ok('naam.com\\path', 'naam.com');
});

test('email addresses use the domain part', () => {
  const r = ok('hello@naam.com', 'naam.com');
  assert.ok(r.notes.some(n => /email/i.test(n)));
});

test('trailing and leading dots, full-width dots', () => {
  ok('naam.com.', 'naam.com');
  ok('.naam.com', 'naam.com');
  ok('naam。com', 'naam.com');
});

test('www. is only stripped when it is a prefix, not the name', () => {
  ok('www.naam.com', 'naam.com');
  ok('www.com', 'www.com');
});

test('subdomains reduce to the registrable domain', () => {
  const r = ok('shop.blog.naam.com', 'naam.com');
  assert.ok(r.notes.some(n => /Subdomains/.test(n)));
  ok('shop.naam.co.uk', 'naam.co.uk');
  ok('naam.co.uk', 'naam.co.uk');
  ok('a.naam.com.au', 'naam.com.au');
  assert.deepEqual(registrableDomain(['x', 'naam', 'co', 'in']), { domain: 'naam.co.in', suffix: 'co.in' });
});

test('a bare multi-part suffix is not a domain', () => {
  bad('co.uk', /extension on its own/);
  bad('com.au', /extension on its own/);
});

test('invalid characters, spaces and underscores give helpful suggestions', () => {
  assert.match(bad('naam labs.com').error, /naamlabs\.com/);
  assert.match(bad('naam_labs.com').error, /naam-labs\.com/);
  bad('naam!.com', /aren't allowed/);
  bad('naam$.com');
  bad('na am.com', /spaces/);
});

test('hyphen rules', () => {
  bad('-naam.com', /hyphen/);
  bad('naam-.com', /hyphen/);
  bad('ab--naam.com', /3rd and 4th/);
  ok('xn--bcher-kva.com', 'xn--bcher-kva.com');
  const r = ok('naam--labs.com', 'naam--labs.com');
  assert.ok(r.warnings.some(w => /Double hyphens/.test(w)));
});

test('length limits: 63 per label, 253 total', () => {
  ok(`${'a'.repeat(63)}.com`, `${'a'.repeat(63)}.com`);
  bad(`${'a'.repeat(64)}.com`, /63/);
  const long = Array.from({ length: 5 }, () => 'a'.repeat(60)).join('.') + '.com';
  bad(long, /253/);
});

test('empty parts and empty input', () => {
  bad('', /Empty/);
  bad('   ', /Empty/);
  bad('naam..com', /two dots|empty/i);
  bad('...', /No domain/);
  bad('https://', /No domain/);
});

test('IP addresses are rejected', () => {
  bad('192.168.0.1', /IP address/);
  bad('http://10.0.0.1/admin', /IP address/);
  bad('[::1]', /IP address/);
});

test('extension rules: numeric, single letter', () => {
  bad('naam.123', /numbers/);
  bad('naam.c', /two letters/);
});

test('special-use and reserved names can never be registered', () => {
  for (const tld of ['test', 'example', 'invalid', 'localhost', 'local', 'onion', 'internal', 'alt', 'home', 'corp']) {
    bad(`naam.${tld}`, /never be registered|reserved|never delegated/);
  }
  bad('example.com', /RFC 2606/);
  bad('www.example.org', /RFC 2606/);
  bad('router.home.arpa', /reserved/);
});

test('internationalised names are converted to Punycode, keeping the display form', () => {
  const r = ok('bücher.de', 'xn--bcher-kva.de');
  assert.equal(r.display, 'bücher.de');
  assert.ok(r.notes.some(n => /Internationalised/.test(n)));
  ok('BÜCHER.DE', 'xn--bcher-kva.de');
  ok('münchen.com', 'xn--mnchen-3ya.com');
  ok('例え.jp', toAscii('例え.jp'));
});

test('mixed-script look-alikes are flagged (homograph protection)', () => {
  const r = ok('pаypal.com', toAscii('pаypal.com')); // Cyrillic "а"
  assert.ok(r.warnings.some(w => /Cyrillic/.test(w) && /Latin/.test(w)));
  const pure = ok('пример.рф', toAscii('пример.рф'));
  assert.ok(!pure.warnings.some(w => /Mixes/.test(w)));
});

test('emoji domains are rejected with an explanation', () => {
  bad('🍕.com', /Emoji/);
  bad('i❤️naam.com', /Emoji/);
});

test('eligibility restrictions are surfaced', () => {
  assert.ok(ok('naam.us', 'naam.us').warnings.some(w => /US nexus/.test(w)));
  assert.ok(ok('naam.ca', 'naam.ca').warnings.some(w => /Canadian/.test(w)));
  assert.ok(ok('naam.bank', 'naam.bank').warnings.some(w => /banks/.test(w)));
  assert.ok(ok('naam.com.au', 'naam.com.au').warnings.some(w => /ABN/.test(w)));
  assert.equal(ok('naam.com', 'naam.com').warnings.length, 0);
});

test('premium / unusual name warnings', () => {
  assert.ok(ok('x.com', 'x.com').warnings.some(w => /Single-character/.test(w)));
  assert.ok(ok('ab.com', 'ab.com').warnings.some(w => /Two-letter/.test(w)));
  assert.ok(ok('12345.com', '12345.com').warnings.some(w => /All-number/.test(w)));
});

test('splitDomainList handles commas, semicolons, newlines and space-separated domains', () => {
  assert.deepEqual(splitDomainList('a.com, b.io;c.co\nd.ai'), ['a.com', 'b.io', 'c.co', 'd.ai']);
  assert.deepEqual(splitDomainList('a.com b.io  c.co'), ['a.com', 'b.io', 'c.co']);
  // words without dots stay together so we can suggest joining them
  assert.deepEqual(splitDomainList('naam labs'), ['naam labs']);
  assert.deepEqual(splitDomainList(' , ,, '), []);
});

test('parseDomainList: de-duplicates after normalising', () => {
  const r = parseDomainList('naam.com, NAAM.COM, https://www.naam.com/, naam');
  assert.equal(r.items.length, 1);
  assert.equal(r.duplicates, 3);
});

test('parseDomainList: caps the number of lookups', () => {
  const many = Array.from({ length: 15 }, (_, i) => `naam${i}.com`).join(',');
  const r = parseDomainList(many);
  assert.equal(r.items.length, MAX_DOMAINS);
  assert.equal(r.truncated, 15 - MAX_DOMAINS);
});

test('parseDomainList: separates invalid entries without dropping valid ones', () => {
  const r = parseDomainList('naam.com, foo_bar.com, naam.test, naam.io');
  assert.deepEqual(r.items.map(i => i.domain), ['naam.com', 'naam.io']);
  assert.equal(r.invalid.length, 2);
});

test('parseDomainList: very long input is bounded', () => {
  const r = parseDomainList('a'.repeat(100000));
  assert.equal(r.items.length + r.invalid.length, 1);
});

test('non-string input does not throw', () => {
  assert.doesNotThrow(() => normalizeDomain(undefined));
  assert.doesNotThrow(() => normalizeDomain(null));
  assert.doesNotThrow(() => parseDomainList(undefined));
  assert.equal(parseDomainList(null).items.length, 0);
});
