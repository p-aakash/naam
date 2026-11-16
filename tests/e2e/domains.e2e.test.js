// End-to-end tests for the Domains card (suggestions + manual search).
// Runs the real page in Chromium with every external request mocked, so results
// are deterministic and we can assert exactly which hosts the page contacts.
//
//   npm install && npx playwright install chromium && npm run test:e2e

import { test, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };

// ---- fake internet -------------------------------------------------------
const TAKEN = new Set(['taken.com', 'naamlabs.com', 'taken.io']);
const ALLOWED_HOSTS = new Set(['127.0.0.1', 'data.iana.org', 'rdap.mock', 'cloudflare-dns.com', 'dns.google']);
const TLDS = ['COM', 'NET', 'ORG', 'IO', 'CO', 'AI', 'APP', 'DEV', 'TECH', 'DE', 'UK', 'US', 'XN--P1AI', ...Array.from({ length: 600 }, (_, i) => `FILLER${i}`)];

let server, base, browser;
let rdapDelayMs = 0;

before(async () => {
  server = createServer(async (req, res) => {
    try {
      const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
      const file = join(ROOT, path.endsWith('/') ? `${path}index.html` : path);
      if (!file.startsWith(ROOT)) throw new Error('outside root');
      const body = await readFile(file);
      res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404); res.end('not found');
    }
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch();
});
after(async () => {
  await browser?.close();
  await new Promise(r => server.close(r));
});

let ctx, page, hosts, pageErrors, dnsHits = [];
async function openPage(opts = {}) {
  ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, ...opts });
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: base.slice(0, -1) });
  hosts = new Set();
  pageErrors = [];
  dnsHits = [];
  await ctx.route('**/*', async route => {
    const url = new URL(route.request().url());
    hosts.add(url.hostname);
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    if (url.hostname === '127.0.0.1') return route.continue();
    if (url.href === 'https://data.iana.org/rdap/dns.json') {
      return json({ services: [[['com', 'net', 'org'], ['https://rdap.mock/com/']], [['ai', 'app', 'dev', 'tech'], ['https://rdap.mock/gtld/']]] });
    }
    if (url.href === 'https://data.iana.org/TLD/tlds-alpha-by-domain.txt') {
      return route.fulfill({ status: 200, contentType: 'text/plain', headers: { 'access-control-allow-origin': '*' }, body: `# Version 1\n${TLDS.join('\n')}\n` });
    }
    if (url.hostname === 'rdap.mock') {
      if (rdapDelayMs) await new Promise(r => setTimeout(r, rdapDelayMs));
      const name = url.pathname.split('/').pop();
      if (name === 'expiring.com') return json({ ldhName: name, status: ['pending delete'] });
      return TAKEN.has(name) ? json({ ldhName: name }) : json({ errorCode: 404 }, 404);
    }
    if (url.hostname === 'cloudflare-dns.com' || url.hostname === 'dns.google') {
      const headers = await route.request().allHeaders();
      // Mirror the real Cloudflare API: 400 without the dns-json Accept header.
      if (url.hostname === 'cloudflare-dns.com' && headers.accept !== 'application/dns-json') return json({ error: 'bad request' }, 400);
      dnsHits.push(url.hostname);
      const name = url.searchParams.get('name');
      return json({ Status: TAKEN.has(name) ? 0 : 3 });
    }
    return route.abort(); // fonts, ICANN pop-ups, anything else
  });
  page = await ctx.newPage();
  page.on('pageerror', e => pageErrors.push(e.message));
}
beforeEach(() => { rdapDelayMs = 0; });
afterEach(async () => { await ctx?.close(); });

async function analyse(name = 'Naam Labs') {
  await page.goto(`${base}?n=${encodeURIComponent(name)}&i=tech&e=llc&s=DE`);
  await page.waitForSelector('#results:not([hidden])');
  await page.waitForFunction(() => document.querySelector('#partial').hidden === true, null, { timeout: 15000 });
}
async function manual(text) {
  await page.click('#tab-manual');
  await page.fill('#manual-input', text);
  await page.click('#manual-submit');
  await page.waitForFunction(() => /^(Done|Nothing valid|Enter at least|You appear)/.test(document.querySelector('#manual-message').textContent), null, { timeout: 15000 });
}
const rowFor = domain => page.locator(`#manual-results li.domain[data-domain="${domain}"]`);
const statusOf = domain => rowFor(domain).locator('.status').textContent();

// ---- tests ----------------------------------------------------------------
test('suggestions tab shows live results from the mocked registry', async () => {
  await openPage();
  await analyse('Naam Labs');
  assert.equal(await page.locator('#tab-suggested').getAttribute('aria-selected'), 'true');
  const first = page.locator('#domains > li.domain').first();
  assert.equal(await first.locator('.domain-name').textContent(), 'naamlabs.com');
  assert.equal(await first.locator('.status').textContent(), 'Taken');
  // available suggestions offer verification, never a registrar
  const verifyHrefs = await page.locator('#domains a.verify').evaluateAll(as => as.map(a => a.href));
  assert.ok(verifyHrefs.length > 0);
  for (const h of verifyHrefs) assert.match(new URL(h).hostname, /(^|\.)(icann|iana)\.org$/);
  assert.deepEqual(pageErrors, []);
});

test('tabs work with mouse and keyboard (ARIA tabs pattern)', async () => {
  await openPage();
  await analyse();
  assert.equal(await page.isHidden('#panel-manual'), true);
  await page.focus('#tab-suggested');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('#tab-manual').getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('#tab-suggested').getAttribute('tabindex'), '-1');
  assert.equal(await page.isVisible('#panel-manual'), true);
  assert.equal(await page.isHidden('#panel-suggested'), true);
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.locator('#tab-suggested').getAttribute('aria-selected'), 'true');
  await page.keyboard.press('End');
  assert.equal(await page.locator('#tab-manual').getAttribute('aria-selected'), 'true');
  await page.keyboard.press('Home');
  assert.equal(await page.locator('#tab-suggested').getAttribute('aria-selected'), 'true');
});

test('manual search: mixed valid, invalid, duplicate and international input', async () => {
  await openPage();
  await analyse();
  await manual('https://www.Naam.com/about, NAAM.COM, taken.com, naam.io, foo_bar.com, naam.notarealtld, naam.test, bücher.de, shop.naam.co.uk');
  assert.equal(await statusOf('naam.com'), 'Available');
  assert.equal(await statusOf('taken.com'), 'Taken');
  assert.equal(await statusOf('naam.io'), 'Likely free');                 // no RDAP → DNS
  assert.ok(dnsHits.length && dnsHits.every(h => h === 'cloudflare-dns.com'), `DNS answered by Cloudflare, not a fallback: ${dnsHits}`);
  assert.match(await rowFor('naam.io').textContent(), /via DNS/);
  assert.match(await rowFor('naam.com').textContent(), /via Registry \(RDAP\)/);
  assert.equal(await statusOf('foo_bar.com'), 'Invalid');
  assert.match(await rowFor('foo_bar.com').textContent(), /foo-bar\.com/);
  assert.equal(await statusOf('naam.notarealtld'), 'Invalid');
  assert.match(await rowFor('naam.notarealtld').textContent(), /IANA/);
  assert.equal(await statusOf('naam.test'), 'Invalid');
  const idn = rowFor('xn--bcher-kva.de');
  assert.match(await idn.locator('.domain-name').textContent(), /bücher\.de/);
  assert.match(await idn.locator('.domain-name').textContent(), /xn--bcher-kva\.de/);
  assert.match(await rowFor('naam.co.uk').textContent(), /Subdomains/);
  assert.match(await rowFor('naam.com').textContent(), /Removed "www\."/);
  const msg = await page.textContent('#manual-message');
  assert.match(msg, /1 duplicate skipped/);
  assert.match(msg, /3 invalid/);
  assert.deepEqual(pageErrors, []);
});

test('manual search: empty input and limit of 10', async () => {
  await openPage();
  await analyse();
  await manual('   ');
  assert.match(await page.textContent('#manual-message'), /Enter at least one domain/);
  assert.equal(await page.getAttribute('#manual-message', 'data-tone'), 'error');
  await manual(Array.from({ length: 14 }, (_, i) => `brand${i}.com`).join(', '));
  assert.equal(await page.locator('#manual-results li.domain').count(), 10);
  assert.match(await page.textContent('#manual-message'), /only the first 10 are checked; 4 skipped/);
});

test('manual search: bare name defaults to .com; expiring domains are labelled', async () => {
  await openPage();
  await analyse();
  await manual('zentrova, expiring.com');
  assert.equal(await statusOf('zentrova.com'), 'Available');
  assert.match(await rowFor('zentrova.com').textContent(), /checked \.com/);
  assert.equal(await statusOf('expiring.com'), 'Expiring');
  assert.match(await rowFor('expiring.com').textContent(), /Pending deletion/);
});

test('manual search: button is disabled while checking and a new search replaces the old', async () => {
  await openPage();
  await analyse();
  rdapDelayMs = 1500;
  await page.click('#tab-manual');
  await page.fill('#manual-input', 'slow-one.com');
  await page.click('#manual-submit');
  await page.waitForFunction(() => document.querySelector('#manual-submit').disabled);
  // Enter re-submits with new input: earlier results must not reappear
  await page.fill('#manual-input', 'second.com');
  await page.evaluate(() => document.querySelector('#manual-form').requestSubmit());
  await page.waitForFunction(() => /^Done/.test(document.querySelector('#manual-message').textContent), null, { timeout: 15000 });
  assert.equal(await page.locator('#manual-results li.domain').count(), 1);
  assert.equal(await statusOf('second.com'), 'Available');
  assert.equal(await page.isDisabled('#manual-submit'), false);
});

test('"Verify on ICANN Lookup" copies the domain and links to ICANN', async () => {
  await openPage();
  await analyse();
  await manual('naam.com');
  const link = rowFor('naam.com').locator('a.verify', { hasText: 'ICANN' });
  assert.equal(await link.getAttribute('href'), 'https://lookup.icann.org/en/lookup');
  assert.equal(await link.getAttribute('target'), '_blank');
  assert.match(await link.getAttribute('rel'), /noopener/);
  await link.click();
  await page.waitForFunction(() => document.querySelector('#copy-toast').textContent.includes('naam.com'));
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'naam.com');
  // DNS-only TLDs get the IANA registry page instead of ICANN Lookup
  await manual('naam.io');
  const ioLinks = await rowFor('naam.io').locator('a.verify').evaluateAll(as => as.map(a => a.href));
  assert.deepEqual(ioLinks, ['https://www.iana.org/domains/root/db/io.html']);
});

test('privacy: the page only contacts the registry, IANA and DNS resolvers', async () => {
  await openPage();
  await analyse('Naam Labs');
  await manual('naam.com, naam.io, naam.ai, bücher.de');
  const unexpected = [...hosts].filter(h => !ALLOWED_HOSTS.has(h) && !/fonts\.(googleapis|gstatic)\.com$/.test(h));
  assert.deepEqual(unexpected, []);
  for (const registrar of ['namecheap.com', 'porkbun.com', 'godaddy.com', 'domains.cloudflare.com']) {
    assert.ok(![...hosts].some(h => h.endsWith(registrar)), registrar);
  }
  // no registrar links anywhere in the rendered page
  const hrefs = await page.locator('a[href]').evaluateAll(as => as.map(a => a.href));
  assert.ok(!hrefs.some(h => /namecheap|porkbun|godaddy|domains\.cloudflare/.test(h)));
});

test('offline: a clear message instead of failed lookups', async () => {
  await openPage();
  await analyse();
  await ctx.setOffline(true);
  await manual('naam.com');
  assert.match(await page.textContent('#manual-message'), /offline/i);
  await ctx.setOffline(false);
});

test('phone layout: no horizontal scrolling with long manual results', async () => {
  await openPage({ ...devices['iPhone 13'] });
  await analyse();
  await manual(`${'a'.repeat(63)}.com, bücher.de, naam.us, foo_bar.com`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  assert.equal(overflow, false);
  assert.match(await rowFor('naam.us').textContent(), /US nexus/);
});
