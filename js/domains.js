// Naam — live domain availability, entirely in the browser.
//
// 1. RDAP (the modern WHOIS). IANA publishes which registry serves each TLD;
//    we query that registry directly. 404 = not registered, 200 = registered.
// 2. DNS-over-HTTPS fallback for TLDs without RDAP (.io, .co, .us, …):
//    NXDOMAIN means no one has delegated the name, so it is *likely* free.
//
// Front-running protection: lookups go straight from the visitor's browser to the
// registry (the same RDAP servers ICANN Lookup queries) or to a public DNS resolver.
// They never touch a registrar, a reseller, a "domain suggestion" site or a Naam
// server, so nobody who sells domains sees what was searched.
//
// All endpoints used here send `Access-Control-Allow-Origin: *`, and every request
// is a "simple" GET (only the CORS-safelisted Accept header), so no preflight is needed.

const BOOTSTRAP_URL = 'https://data.iana.org/rdap/dns.json';
const TLD_LIST_URL = 'https://data.iana.org/TLD/tlds-alpha-by-domain.txt';
// Cloudflare first: its resolver policy commits to not selling query data and to
// deleting logs within 25 hours. Google is the fallback.
// Cloudflare's JSON API requires `Accept: application/dns-json` (it answers 400
// without it). Accept is a CORS-safelisted header, so this stays a simple
// request with no preflight. Google's JSON API needs no header.
const DOH = [
  { url: name => `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=NS`, headers: { accept: 'application/dns-json' } },
  { url: name => `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=NS` },
];
export const ICANN_LOOKUP_URL = 'https://lookup.icann.org/en/lookup';
export const ICANN_REGISTRARS_URL = 'https://www.icann.org/en/contracted-parties/accredited-registrars/list-of-accredited-registrars';
const TIMEOUT_MS = 9000;
const CONCURRENCY = 4;
const CACHE_KEY = 'naam.rdap.bootstrap.v1';
const TLD_CACHE_KEY = 'naam.tlds.v1';

let bootstrapPromise = null;
let tldPromise = null;

function storageGet(key) {
  try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; }
}
function storageSet(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode etc. */ }
}

async function fetchWithTimeout(url, signal, headers) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const opts = { signal: ctrl.signal, credentials: 'omit', referrerPolicy: 'no-referrer' };
    if (headers) opts.headers = headers;
    return await fetch(url, opts);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export function loadBootstrap(signal) {
  if (bootstrapPromise) return bootstrapPromise;
  const cached = storageGet(CACHE_KEY);
  if (cached && cached.at > Date.now() - 24 * 3600e3) {
    bootstrapPromise = Promise.resolve(cached.map);
    return bootstrapPromise;
  }
  bootstrapPromise = fetchWithTimeout(BOOTSTRAP_URL, signal)
    .then(r => (r.ok ? r.json() : Promise.reject(new Error(`bootstrap ${r.status}`))))
    .then(json => {
      const map = {};
      for (const [tlds, urls] of json.services || []) {
        const url = (urls || []).find(u => u.startsWith('https://')) || urls?.[0];
        if (url) for (const t of tlds) map[t.toLowerCase()] = url.endsWith('/') ? url : `${url}/`;
      }
      storageSet(CACHE_KEY, { at: Date.now(), map });
      return map;
    })
    .catch(() => {
      bootstrapPromise = null; // allow a retry next time
      return {};
    });
  return bootstrapPromise;
}

// Official list of every delegated top-level domain. Resolves to a Set of
// lowercase TLDs, or an empty Set if it couldn't be loaded (callers then skip
// the existence check rather than wrongly rejecting a real extension).
export function loadTldList(signal) {
  if (tldPromise) return tldPromise;
  const cached = storageGet(TLD_CACHE_KEY);
  if (cached && cached.at > Date.now() - 24 * 3600e3 && Array.isArray(cached.tlds)) {
    tldPromise = Promise.resolve(new Set(cached.tlds));
    return tldPromise;
  }
  tldPromise = fetchWithTimeout(TLD_LIST_URL, signal)
    .then(r => (r.ok ? r.text() : Promise.reject(new Error(`tlds ${r.status}`))))
    .then(text => {
      const tlds = text.split('\n').map(l => l.trim().toLowerCase()).filter(l => l && !l.startsWith('#'));
      if (tlds.length < 500) throw new Error('tld list looks truncated');
      storageSet(TLD_CACHE_KEY, { at: Date.now(), tlds });
      return new Set(tlds);
    })
    .catch(() => {
      tldPromise = null;
      return new Set();
    });
  return tldPromise;
}

// true / false, or null when the official list couldn't be loaded.
export async function tldExists(tld, signal) {
  const set = await loadTldList(signal);
  if (!set.size) return null;
  return set.has(String(tld).toLowerCase());
}

export async function hasRdap(tld, signal) {
  const map = await loadBootstrap(signal);
  return Boolean(map[String(tld).toLowerCase()]);
}

function describeStatus(statuses) {
  const st = statuses.map(s => s.toLowerCase());
  if (st.some(s => s.includes('pending delete'))) return { expiring: true, text: 'Pending deletion: may become available within days' };
  if (st.some(s => s.includes('redemption'))) return { expiring: true, text: 'Expired (redemption period): the owner can still renew it' };
  if (st.some(s => s.includes('server hold') || s.includes('client hold') || s.includes('inactive'))) return { expiring: false, text: 'Registered but suspended or inactive' };
  return null;
}

async function viaRdap(domain, base, signal) {
  const res = await fetchWithTimeout(`${base}domain/${encodeURIComponent(domain)}`, signal);
  if (res.status === 404) return { status: 'available', source: 'RDAP' };
  if (res.ok) {
    let detail = '';
    let expiring = false;
    try {
      const data = await res.json();
      const st = describeStatus(data.status || []);
      if (st) { detail = st.text; expiring = st.expiring; }
      const exp = (data.events || []).find(e => e.eventAction === 'expiration');
      if (exp?.eventDate && !detail) detail = `Registered until ${exp.eventDate.slice(0, 10)}`;
    } catch { /* body not needed */ }
    return { status: 'taken', source: 'RDAP', detail, expiring };
  }
  throw new Error(`rdap ${res.status}`);
}

async function viaDoh(domain, signal) {
  for (const resolver of DOH) {
    try {
      const res = await fetchWithTimeout(resolver.url(domain), signal, resolver.headers);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.Status === 3) return { status: 'likely', source: 'DNS', detail: 'No DNS records found; confirm with the registry' };
      if (data.Status === 0) return { status: 'taken', source: 'DNS', detail: (data.Answer || data.Authority || []).length ? 'Has DNS records' : 'Exists in DNS' };
    } catch (e) {
      if (signal?.aborted) throw e;
    }
  }
  return { status: 'unknown', source: '', detail: 'Couldn\'t reach a lookup service. Check with the official registry below' };
}

export async function checkDomain(domain, signal) {
  const tld = domain.split('.').pop();
  const map = await loadBootstrap(signal);
  const base = map[tld];
  if (base) {
    try { return await viaRdap(domain, base, signal); } catch (e) { if (signal?.aborted) throw e; }
  }
  return viaDoh(domain, signal);
}

// Runs checks with limited concurrency, reporting each result as it lands.
export async function checkDomains(list, onResult, signal) {
  const queue = [...list];
  const worker = async () => {
    while (queue.length && !signal?.aborted) {
      const item = queue.shift();
      let result;
      try { result = await checkDomain(item.domain, signal); } catch { result = { status: signal?.aborted ? 'pending' : 'unknown', detail: 'Lookup failed' }; }
      if (signal?.aborted) return;
      onResult({ ...item, ...result });
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
}

// Neutral, non-commercial places to double-check a result. Deliberately no
// registrar search links: searching at a registrar before you're ready to buy is
// how domain front-running happens.
// - ICANN Lookup queries the same registry RDAP servers we do (but it has no
//   deep-link support, so the UI copies the domain for the user to paste).
// - IANA's root-zone page names the official registry for every extension,
//   including ccTLDs like .io and .co that have no RDAP.
export function verifyLinks(domain, { rdap = true } = {}) {
  const tld = domain.split('.').pop();
  const links = [];
  if (rdap) links.push({ id: 'icann', label: 'Verify on ICANN Lookup', url: ICANN_LOOKUP_URL, copy: domain });
  links.push({ id: 'iana', label: `.${tld} registry (IANA)`, url: `https://www.iana.org/domains/root/db/${encodeURIComponent(tld)}.html` });
  return links;
}
