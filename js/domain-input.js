// Naam — parsing & validation for the manual domain search.
// Pure functions (no DOM, no network) so every edge case can be unit-tested.

export const MAX_DOMAINS = 10;
export const MAX_INPUT_LENGTH = 2000;

// RFC 6761 / 6762 / 7686 / 8375 / 9476 special-use names, plus names ICANN has
// said will never be delegated. None can ever be registered.
export const SPECIAL_USE_TLDS = {
  test: 'reserved for testing (RFC 6761)',
  example: 'reserved for documentation (RFC 6761)',
  invalid: 'reserved as always-invalid (RFC 6761)',
  localhost: 'reserved for the local machine (RFC 6761)',
  local: 'reserved for local-network multicast DNS (RFC 6762)',
  onion: 'reserved for Tor onion services (RFC 7686)',
  alt: 'reserved for non-DNS naming systems (RFC 9476)',
  arpa: 'reserved for internet infrastructure',
  internal: 'reserved by ICANN for private networks',
  home: 'never delegated by ICANN (name collision risk)',
  corp: 'never delegated by ICANN (name collision risk)',
  mail: 'never delegated by ICANN (name collision risk)',
  lan: 'commonly used on private networks and not a public extension',
  intranet: 'commonly used on private networks and not a public extension',
};

// Second-level domains reserved by RFC 2606.
export const RESERVED_DOMAINS = new Set(['example.com', 'example.net', 'example.org', 'example.edu']);

// Common multi-part public suffixes, so "shop.naam.co.uk" reduces to "naam.co.uk"
// and not "co.uk". (A subset of the Public Suffix List, enough for common cases.)
export const MULTI_PART_SUFFIXES = new Set([
  'co.uk', 'org.uk', 'me.uk', 'ltd.uk', 'plc.uk', 'net.uk', 'ac.uk', 'gov.uk', 'sch.uk',
  'com.au', 'net.au', 'org.au', 'id.au', 'asn.au', 'edu.au', 'gov.au',
  'co.nz', 'org.nz', 'net.nz', 'kiwi.nz', 'school.nz', 'govt.nz',
  'co.in', 'net.in', 'org.in', 'firm.in', 'gen.in', 'ind.in', 'ac.in', 'gov.in', 'edu.in',
  'co.jp', 'ne.jp', 'or.jp', 'ac.jp', 'go.jp',
  'com.br', 'net.br', 'org.br', 'gov.br', 'com.mx', 'org.mx', 'gob.mx', 'com.ar', 'com.co', 'com.pe', 'com.ve', 'com.ec', 'com.uy',
  'com.sg', 'org.sg', 'edu.sg', 'gov.sg', 'com.hk', 'org.hk', 'com.cn', 'net.cn', 'org.cn', 'gov.cn', 'com.tw', 'org.tw',
  'co.kr', 'or.kr', 'co.id', 'or.id', 'com.my', 'com.ph', 'com.vn', 'co.th', 'in.th', 'com.pk', 'com.bd', 'com.np', 'com.lk',
  'co.za', 'org.za', 'gov.za', 'com.ng', 'co.ke', 'com.eg', 'co.tz', 'co.ug', 'com.gh',
  'com.tr', 'co.il', 'org.il', 'com.sa', 'com.qa', 'com.kw', 'co.ae',
  'com.ua', 'co.at', 'or.at', 'com.pl', 'co.it', 'com.es', 'com.pt', 'com.gr', 'com.cy', 'com.mt',
]);

// Extensions with registration restrictions people often don't expect.
export const ELIGIBILITY = {
  us: 'Requires a US nexus: a US citizen or resident, or an organisation incorporated or active in the US.',
  ca: 'Requires Canadian presence: a citizen, permanent resident, or a company incorporated in Canada.',
  eu: 'Restricted to residents, citizens or organisations of the EU/EEA.',
  fr: 'Restricted to individuals and organisations in the EU/EEA, Iceland, Liechtenstein, Norway or Switzerland.',
  it: 'Restricted to individuals and organisations in the EU/EEA.',
  jp: 'Requires a local address in Japan.',
  cn: 'Requires real-name verification under Chinese regulations.',
  au: 'Requires an Australian presence (e.g. an ABN or ACN for business domains).',
  'com.au': 'Requires an Australian ABN or ACN and a close connection to the name.',
  nyc: 'Requires a New York City address.',
  bank: 'Restricted to verified, regulated banks (fTLD Registry).',
  insurance: 'Restricted to verified, licensed insurers (fTLD Registry).',
  pharmacy: 'Restricted to verified, licensed pharmacies (NABP).',
  cpa: 'Restricted to licensed CPA firms (AICPA).',
  law: 'Restricted to verified law firms, lawyers and legal organisations.',
  abogado: 'Restricted to verified lawyers and law firms.',
  gov: 'Restricted to US government entities.',
  edu: 'Restricted to accredited US post-secondary institutions.',
  mil: 'Restricted to the US military.',
  int: 'Restricted to international treaty organisations.',
  coop: 'Restricted to cooperatives.',
  museum: 'Restricted to museums and museum professionals.',
  aero: 'Restricted to the aviation industry.',
  travel: 'Intended for travel-industry businesses.',
};

const SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
const EMOJI = /\p{Extended_Pictographic}/u;
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

// Converts a Unicode hostname to its ASCII (Punycode) form using the
// WHATWG URL parser, which implements UTS #46 in browsers and Node alike.
export function toAscii(host) {
  try {
    const out = new URL(`http://${host}/`).hostname;
    return out || null;
  } catch {
    return null;
  }
}

// Scripts used in a label, for spotting look-alike (homograph) domains.
function scriptsIn(label) {
  const found = new Set();
  for (const ch of label) {
    if (/[0-9-]/.test(ch)) continue;
    if (/\p{Script=Latin}/u.test(ch)) found.add('Latin');
    else if (/\p{Script=Cyrillic}/u.test(ch)) found.add('Cyrillic');
    else if (/\p{Script=Greek}/u.test(ch)) found.add('Greek');
    else if (/\p{Script=Han}/u.test(ch)) found.add('Han');
    else if (/\p{Script=Arabic}/u.test(ch)) found.add('Arabic');
    else if (/\p{Script=Hebrew}/u.test(ch)) found.add('Hebrew');
    else if (/\p{Script=Devanagari}/u.test(ch)) found.add('Devanagari');
    else found.add('Other');
  }
  return found;
}

export function registrableDomain(labels) {
  if (labels.length <= 2) return { domain: labels.join('.'), suffix: labels[labels.length - 1] };
  const lastTwo = labels.slice(-2).join('.');
  if (MULTI_PART_SUFFIXES.has(lastTwo)) {
    return { domain: labels.slice(-3).join('.'), suffix: lastTwo };
  }
  return { domain: labels.slice(-2).join('.'), suffix: labels[labels.length - 1] };
}

/**
 * Normalises one user-typed domain.
 * Returns { raw, domain, display, tld, suffix, notes[], warnings[], error }.
 * `domain` is the ASCII registrable domain to look up; `error` is set when it can't be checked.
 */
export function normalizeDomain(raw, { defaultTld = 'com' } = {}) {
  const result = { raw: String(raw ?? ''), domain: '', display: '', tld: '', suffix: '', notes: [], warnings: [], error: '' };
  let s = result.raw.normalize('NFC').trim();
  if (!s) { result.error = 'Empty entry.'; return result; }

  // Pasted URL: strip scheme, credentials, path, query, fragment and port.
  if (SCHEME.test(s)) { s = s.replace(SCHEME, ''); result.notes.push('Removed the web address prefix.'); }
  else if (s.startsWith('//')) s = s.slice(2);
  const cut = s.search(/[/?#\\]/);
  if (cut !== -1) { s = s.slice(0, cut); result.notes.push('Ignored the page path.'); }
  if (s.includes('@')) { s = s.slice(s.lastIndexOf('@') + 1); result.notes.push('Used the domain part of the email address.'); }
  if (/^\[.*\]/.test(s)) { result.error = 'That\'s an IP address, not a domain name.'; return result; }
  const port = s.match(/:(\d*)$/);
  if (port) { s = s.slice(0, port.index); result.notes.push('Ignored the port number.'); }

  s = s.replace(/[。．｡]/g, '.'); // full-width dots (IDNA treats them as separators)
  s = s.replace(/^\.+/, '').replace(/\.+$/, '');
  s = s.toLowerCase();

  if (!s) { result.error = 'No domain name found.'; return result; }
  if (/\s/.test(s)) {
    result.error = `Domain names can't contain spaces. Did you mean "${s.replace(/\s+/g, '')}"?`;
    return result;
  }
  if (s.includes('_')) {
    result.error = `Underscores aren't allowed in domain names. Try "${s.replace(/_/g, '-')}" or "${s.replace(/_/g, '')}".`;
    return result;
  }
  if (/\.\./.test(s)) { result.error = 'Contains an empty part (two dots in a row).'; return result; }
  if (IPV4.test(s)) { result.error = 'That\'s an IP address, not a domain name.'; return result; }

  if (!s.includes('.')) {
    s = `${s}.${defaultTld}`;
    result.notes.push(`No extension given, so checked .${defaultTld}.`);
  }

  const hasUnicode = /[^\x00-\x7f]/.test(s);
  if (EMOJI.test(s)) {
    result.error = 'Emoji domains can\'t be registered in .com or most other extensions (ICANN standards forbid them).';
    return result;
  }
  const ascii = hasUnicode ? toAscii(s) : s;
  if (!ascii) { result.error = 'Contains characters that aren\'t valid in a domain name.'; return result; }

  let labels = ascii.split('.');
  // Leading "www." is a website prefix, not part of the registrable name.
  if (labels[0] === 'www' && labels.length > 2) {
    labels = labels.slice(1);
    result.notes.push('Removed "www." (it\'s a website prefix, not part of the domain).');
  }

  for (const label of labels) {
    if (!label) { result.error = 'Contains an empty part.'; return result; }
    if (label.length > 63) { result.error = `"${label.slice(0, 20)}…" is ${label.length} characters; each part of a domain can be at most 63.`; return result; }
    if (!/^[a-z0-9-]+$/.test(label)) { result.error = `"${label}" contains characters that aren't allowed (only letters, digits and hyphens).`; return result; }
    if (label.startsWith('-') || label.endsWith('-')) { result.error = `"${label}" can't start or end with a hyphen.`; return result; }
    if (label.slice(2, 4) === '--' && !label.startsWith('xn--')) { result.error = `"${label}" has hyphens in the 3rd and 4th positions, which are reserved for internationalised names.`; return result; }
  }
  if (ascii.length > 253) { result.error = 'Too long: a full domain name can be at most 253 characters.'; return result; }

  const tld = labels[labels.length - 1];
  if (/^\d+$/.test(tld)) { result.error = 'Extensions can\'t be all numbers.'; return result; }
  if (tld.length < 2) { result.error = 'Extensions are at least two letters long.'; return result; }

  const lastTwo = labels.slice(-2).join('.');
  if (SPECIAL_USE_TLDS[tld]) { result.error = `.${tld} is ${SPECIAL_USE_TLDS[tld]}, so it can never be registered.`; return result; }
  if (lastTwo === 'home.arpa') { result.error = 'home.arpa is reserved for home networks (RFC 8375).'; return result; }

  if (labels.length === 2 && MULTI_PART_SUFFIXES.has(lastTwo)) {
    result.error = `"${lastTwo}" is an extension on its own. Add a name in front, e.g. "naam.${lastTwo}".`;
    return result;
  }

  const reg = registrableDomain(labels);
  if (reg.domain !== labels.join('.')) {
    result.notes.push(`Subdomains can't be registered on their own, so checked ${reg.domain}.`);
  }
  if (RESERVED_DOMAINS.has(reg.domain)) { result.error = `${reg.domain} is permanently reserved for documentation (RFC 2606).`; return result; }

  result.domain = reg.domain;
  result.tld = tld;
  result.suffix = reg.suffix;

  // Display form: keep the user's Unicode spelling for internationalised names.
  if (hasUnicode) {
    const uLabels = s.split('.');
    const offset = (uLabels[0] === 'www' && uLabels.length > 2) ? 1 : 0;
    const uReg = uLabels.slice(offset).slice(-reg.domain.split('.').length).join('.');
    result.display = uReg;
    result.notes.push(`Internationalised name. Registries store it as ${reg.domain}.`);
    for (const l of uLabels) {
      const scripts = scriptsIn(l);
      if (scripts.size > 1) {
        result.warnings.push(`Mixes ${[...scripts].join(' and ')} letters, which can look identical. Many registries refuse mixed-script names, and browsers may show this one as ${reg.domain} to protect against look-alike scams.`);
        break;
      }
    }
  } else {
    result.display = reg.domain;
    if (reg.domain.startsWith('xn--') || reg.domain.includes('.xn--')) result.notes.push('Internationalised name (Punycode).');
  }

  const sld = reg.domain.split('.')[0];
  if (sld.length === 1) result.warnings.push('Single-character names are usually reserved by the registry or sold at premium prices.');
  else if (sld.length === 2 && tld === 'com') result.warnings.push('Two-letter .com names are all registered; buying one means a high-priced resale.');
  if (sld.includes('--') && !sld.startsWith('xn--')) result.warnings.push('Double hyphens are easy to mistype.');
  if (/^\d+$/.test(sld)) result.warnings.push('All-number names are hard to brand and often already taken.');

  const elig = ELIGIBILITY[reg.suffix] || ELIGIBILITY[tld];
  if (elig) result.warnings.push(`.${reg.suffix}: ${elig}`);
  return result;
}

/**
 * Splits free text into domains: commas, semicolons, new lines, or spaces
 * between entries that each look like a domain.
 */
export function splitDomainList(text) {
  const str = String(text ?? '').slice(0, MAX_INPUT_LENGTH);
  const chunks = str.split(/[,;\n\r\t]+/).map(c => c.trim()).filter(Boolean);
  const out = [];
  for (const c of chunks) {
    const parts = c.split(/\s+/);
    // "a.com b.io" → two domains, but keep "naam labs" together so we can suggest "naamlabs".
    if (parts.length > 1 && parts.every(p => p.includes('.') || SCHEME.test(p))) out.push(...parts);
    else out.push(c);
  }
  return out;
}

/**
 * Parses the manual-search box.
 * Returns { items: [normalized], invalid: [normalized with error], duplicates, truncated }.
 */
export function parseDomainList(text, { max = MAX_DOMAINS, defaultTld = 'com' } = {}) {
  const raw = splitDomainList(text);
  const items = [];
  const invalid = [];
  const seen = new Set();
  let duplicates = 0;
  let truncated = 0;
  for (const r of raw) {
    const n = normalizeDomain(r, { defaultTld });
    if (n.error) { invalid.push(n); continue; }
    if (seen.has(n.domain)) { duplicates++; continue; }
    if (items.length >= max) { truncated++; continue; }
    seen.add(n.domain);
    items.push(n);
  }
  return { items, invalid, duplicates, truncated };
}
