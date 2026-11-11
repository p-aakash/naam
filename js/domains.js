// Naam — live domain availability, entirely in the browser.
//
// 1. RDAP (the modern WHOIS). IANA publishes which registry serves each TLD;
//    we query that registry directly. 404 = not registered, 200 = registered.
// 2. DNS-over-HTTPS fallback for TLDs without RDAP (.io, .co, .us, …):
//    NXDOMAIN means no one has delegated the name, so it is *likely* free.
//
// All endpoints used here send `Access-Control-Allow-Origin: *`, and every request
// is a "simple" GET with no custom headers, so no CORS preflight is needed.

const BOOTSTRAP_URL = 'https://data.iana.org/rdap/dns.json';
const DOH = [
  name => `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=NS`,
  name => `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=NS&ct=application/dns-json`,
];
const TIMEOUT_MS = 9000;
const CONCURRENCY = 4;
const CACHE_KEY = 'naam.rdap.bootstrap.v1';

let bootstrapPromise = null;

function storageGet(key) {
  try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; }
}
function storageSet(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode etc. */ }
}

async function fetchWithTimeout(url, signal) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    return await fetch(url, { signal: ctrl.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
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

async function viaRdap(domain, base, signal) {
  const res = await fetchWithTimeout(`${base}domain/${encodeURIComponent(domain)}`, signal);
  if (res.status === 404) return { status: 'available', source: 'RDAP' };
  if (res.ok) {
    let detail = '';
    try {
      const data = await res.json();
      const st = (data.status || []).map(s => s.toLowerCase());
      if (st.some(s => s.includes('redemption') || s.includes('pending delete'))) detail = 'Expiring: may drop soon';
      const exp = (data.events || []).find(e => e.eventAction === 'expiration');
      if (exp?.eventDate) detail = detail || `Registered until ${exp.eventDate.slice(0, 10)}`;
    } catch { /* body not needed */ }
    return { status: 'taken', source: 'RDAP', detail };
  }
  throw new Error(`rdap ${res.status}`);
}

async function viaDoh(domain, signal) {
  for (const make of DOH) {
    try {
      const res = await fetchWithTimeout(make(domain), signal);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.Status === 3) return { status: 'likely', source: 'DNS', detail: 'No DNS delegation found' };
      if (data.Status === 0) return { status: 'taken', source: 'DNS', detail: 'Has DNS records' };
    } catch (e) {
      if (signal?.aborted) throw e;
    }
  }
  return { status: 'unknown', source: '', detail: 'Lookup failed' };
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

export function registrarLinks(domain) {
  const d = encodeURIComponent(domain);
  return [
    { label: 'Namecheap', url: `https://www.namecheap.com/domains/registration/results/?domain=${d}` },
    { label: 'Porkbun', url: `https://porkbun.com/checkout/search?q=${d}` },
    { label: 'Cloudflare', url: 'https://domains.cloudflare.com/' },
  ];
}
