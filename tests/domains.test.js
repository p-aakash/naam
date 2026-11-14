import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Mock fetch: a tiny fake registry world.
const REGISTERED = new Set(['taken.com', 'taken.io']);
const STATUS = { 'dying.com': ['active', 'pending delete'], 'redeem.com': ['redemption period'], 'held.com': ['server hold'] };
let calls = [];
let tldListOk = true;
let cloudflareUp = true;
globalThis.fetch = async (url, opts = {}) => {
  calls.push({ url, opts });
  const u = new URL(url);
  if (u.href === 'https://data.iana.org/rdap/dns.json') {
    return Response.json({ services: [[['com', 'net'], ['https://rdap.example/com/']], [['ai'], ['https://rdap.example/ai/']]] });
  }
  if (u.href === 'https://data.iana.org/TLD/tlds-alpha-by-domain.txt') {
    if (!tldListOk) return new Response('', { status: 503 });
    const filler = Array.from({ length: 600 }, (_, i) => `FAKE${i}`).join('\n');
    return new Response(`# Version 2026111400\nCOM\nNET\nIO\nAI\nCO\nXN--P1AI\n${filler}\n`);
  }
  if (u.hostname === 'rdap.example') {
    const name = u.pathname.split('/').pop();
    if (name.startsWith('ratelimited')) return new Response('', { status: 429 });
    if (STATUS[name]) return Response.json({ ldhName: name, status: STATUS[name] });
    return REGISTERED.has(name) ? Response.json({ ldhName: name, events: [{ eventAction: 'expiration', eventDate: '2030-01-01T00:00:00Z' }] }) : new Response('', { status: 404 });
  }
  if (u.hostname === 'cloudflare-dns.com') {
    if (!cloudflareUp) throw new TypeError('network error');
    const name = u.searchParams.get('name');
    return Response.json({ Status: REGISTERED.has(name) ? 0 : 3, Answer: REGISTERED.has(name) ? [{}] : undefined });
  }
  if (u.hostname === 'dns.google') {
    const name = u.searchParams.get('name');
    return Response.json({ Status: REGISTERED.has(name) ? 0 : 3 });
  }
  return new Response('', { status: 500 });
};

const { checkDomain, checkDomains, verifyLinks, tldExists, hasRdap, loadTldList, ICANN_LOOKUP_URL } = await import('../js/domains.js');

beforeEach(() => { calls = []; cloudflareUp = true; });

test('RDAP 404 means available, 200 means taken', async () => {
  assert.equal((await checkDomain('free.com')).status, 'available');
  const t = await checkDomain('taken.com');
  assert.equal(t.status, 'taken');
  assert.match(t.detail, /2030-01-01/);
});

test('expiring, redemption and suspended domains are reported as taken with detail', async () => {
  const d = await checkDomain('dying.com');
  assert.equal(d.status, 'taken');
  assert.equal(d.expiring, true);
  assert.match(d.detail, /Pending deletion/);
  const r = await checkDomain('redeem.com');
  assert.equal(r.expiring, true);
  assert.match(r.detail, /redemption/i);
  const h = await checkDomain('held.com');
  assert.equal(h.expiring, false);
  assert.match(h.detail, /suspended/i);
});

test('TLDs without RDAP fall back to DNS, Cloudflare first', async () => {
  assert.equal((await checkDomain('free.io')).status, 'likely');
  assert.equal((await checkDomain('taken.io')).status, 'taken');
  const dns = calls.filter(c => /cloudflare-dns|dns\.google/.test(c.url));
  assert.match(dns[0].url, /cloudflare-dns\.com/);
  assert.ok(!calls.some(c => /dns\.google/.test(c.url)), 'Google should not be needed when Cloudflare answers');
});

test('falls back to Google DNS when Cloudflare is unreachable', async () => {
  cloudflareUp = false;
  assert.equal((await checkDomain('free.io')).status, 'likely');
  assert.ok(calls.some(c => /dns\.google/.test(c.url)));
});

test('RDAP errors (rate limits) fall back to DNS instead of guessing', async () => {
  const r = await checkDomain('ratelimited.com');
  assert.equal(r.source, 'DNS');
});

test('privacy: no custom headers, no credentials, no referrer, never a registrar', async () => {
  await checkDomains(['x1.com', 'x2.io', 'x3.ai'].map(domain => ({ domain })), () => {});
  assert.ok(calls.length > 0);
  for (const c of calls) {
    assert.ok(!c.opts.headers, 'no custom headers (keeps requests CORS-simple)');
    assert.equal(c.opts.credentials, 'omit');
    assert.equal(c.opts.referrerPolicy, 'no-referrer');
    const host = new URL(c.url).hostname;
    assert.ok(['data.iana.org', 'rdap.example', 'cloudflare-dns.com', 'dns.google'].includes(host), `unexpected host ${host}`);
  }
});

test('checkDomains reports every domain', async () => {
  const got = [];
  await checkDomains(['a.com', 'taken.com', 'b.io', 'c.ai'].map(domain => ({ domain })), r => got.push(r));
  assert.equal(got.length, 4);
  assert.deepEqual(Object.fromEntries(got.map(r => [r.domain, r.status])), { 'a.com': 'available', 'taken.com': 'taken', 'b.io': 'likely', 'c.ai': 'available' });
});

test('checkDomains stops reporting after abort', async () => {
  const ctrl = new AbortController();
  const got = [];
  const p = checkDomains(Array.from({ length: 12 }, (_, i) => ({ domain: `n${i}.com` })), r => { got.push(r); if (got.length === 2) ctrl.abort(); }, ctrl.signal);
  await p;
  assert.ok(got.length < 12, `got ${got.length}`);
});

test('official TLD list: real, fake and IDN extensions', async () => {
  assert.equal(await tldExists('com'), true);
  assert.equal(await tldExists('IO'), true);
  assert.equal(await tldExists('xn--p1ai'), true);
  assert.equal(await tldExists('notarealtld'), false);
  assert.equal(await hasRdap('com'), true);
  assert.equal(await hasRdap('io'), false);
});

test('verify links point to ICANN and IANA only, never to a registrar', () => {
  const links = verifyLinks('naam.com');
  assert.equal(links[0].url, ICANN_LOOKUP_URL);
  assert.equal(links[0].copy, 'naam.com');
  assert.match(links[1].url, /^https:\/\/www\.iana\.org\/domains\/root\/db\/com\.html$/);
  const noRdap = verifyLinks('naam.io', { rdap: false });
  assert.equal(noRdap.length, 1);
  assert.match(noRdap[0].url, /iana\.org/);
  for (const l of [...links, ...noRdap]) {
    assert.match(new URL(l.url).hostname, /(^|\.)(icann|iana)\.org$/);
  }
});

test('if the TLD list cannot load, existence is unknown (null), not false', async () => {
  // Fresh module instance with a failing list.
  tldListOk = false;
  try { globalThis.sessionStorage?.clear(); } catch { /* no web storage in this Node */ }
  const mod = await import(`../js/domains.js?fail=${Date.now()}`);
  assert.equal(await mod.tldExists('com'), null);
  tldListOk = true;
  assert.ok((await loadTldList()).size > 500);
});
