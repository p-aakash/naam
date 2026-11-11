import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Mock fetch: a tiny fake registry world.
const REGISTERED = new Set(['taken.com', 'taken.io']);
let calls = [];
globalThis.fetch = async (url) => {
  calls.push(url);
  const u = new URL(url);
  if (u.href === 'https://data.iana.org/rdap/dns.json') {
    return Response.json({ services: [[['com', 'net'], ['https://rdap.example/com/']], [['ai'], ['https://rdap.example/ai/']]] });
  }
  if (u.hostname === 'rdap.example') {
    const name = u.pathname.split('/').pop();
    if (name.startsWith('ratelimited')) return new Response('', { status: 429 });
    return REGISTERED.has(name) ? Response.json({ ldhName: name, events: [{ eventAction: 'expiration', eventDate: '2030-01-01T00:00:00Z' }] }) : new Response('', { status: 404 });
  }
  if (u.hostname === 'dns.google') {
    const name = u.searchParams.get('name');
    return Response.json({ Status: REGISTERED.has(name) ? 0 : 3 });
  }
  return new Response('', { status: 500 });
};

const { checkDomain, checkDomains } = await import('../js/domains.js');

beforeEach(() => { calls = []; });

test('RDAP 404 means available, 200 means taken', async () => {
  assert.equal((await checkDomain('free.com')).status, 'available');
  const t = await checkDomain('taken.com');
  assert.equal(t.status, 'taken');
  assert.match(t.detail, /2030-01-01/);
});

test('TLDs without RDAP fall back to DNS', async () => {
  assert.equal((await checkDomain('free.io')).status, 'likely');
  assert.equal((await checkDomain('taken.io')).status, 'taken');
  assert.ok(calls.some(c => c.includes('dns.google')));
});

test('RDAP errors (rate limits) fall back to DNS instead of guessing', async () => {
  const r = await checkDomain('ratelimited.com');
  assert.equal(r.source, 'DNS');
});

test('requests are simple GETs (no custom headers → no CORS preflight)', async () => {
  const seen = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, opts = {}) => { seen.push(opts); return orig(url, opts); };
  await checkDomain('another.com');
  globalThis.fetch = orig;
  assert.ok(seen.every(o => !o.headers));
});

test('checkDomains reports every domain', async () => {
  const got = [];
  await checkDomains(['a.com', 'taken.com', 'b.io', 'c.ai'].map(domain => ({ domain })), r => got.push(r));
  assert.equal(got.length, 4);
  assert.deepEqual(Object.fromEntries(got.map(r => [r.domain, r.status])), { 'a.com': 'available', 'taken.com': 'taken', 'b.io': 'likely', 'c.ai': 'available' });
});
