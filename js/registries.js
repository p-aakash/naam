// Naam — live state business-registry search (Phase 1: states with open data).
//
// Five states publish their business-entity registry on Socrata open-data
// portals that allow cross-origin requests, so the visitor's browser can query
// them directly. There's no Naam server in between, same as the domain checks.
//
// Within a state, name availability is decided across *all* entity types, and
// entity designators (LLC, Inc., Co.…), punctuation, "The" and "and/&" are
// ignored. So one search per state answers the question for every entity type.

/* ------------------------------------------------------------------ */
/* Entity-type codes                                                   */
/* ------------------------------------------------------------------ */
// Colorado entity type codes (data.colorado.gov "Business Entities in Colorado").
const CO_TYPES = {
  DLLC: 'DOMESTIC LIMITED LIABILITY COMPANY', FLLC: 'FOREIGN LIMITED LIABILITY COMPANY',
  DPC: 'DOMESTIC PROFIT CORPORATION', FPC: 'FOREIGN PROFIT CORPORATION',
  DNC: 'DOMESTIC NONPROFIT CORPORATION', FNC: 'FOREIGN NONPROFIT CORPORATION',
  DLP: 'DOMESTIC LIMITED PARTNERSHIP', FLP: 'FOREIGN LIMITED PARTNERSHIP',
  DLLP: 'DOMESTIC LIMITED LIABILITY PARTNERSHIP', FLLP: 'FOREIGN LIMITED LIABILITY PARTNERSHIP',
  DLLLP: 'DOMESTIC LIMITED LIABILITY LIMITED PARTNERSHIP', FLLLP: 'FOREIGN LIMITED LIABILITY LIMITED PARTNERSHIP',
  GP: 'GENERAL PARTNERSHIP', FO: 'FOREIGN OTHER', DCOOP: 'COOPERATIVE', COOP: 'COOPERATIVE',
};

// Texas Comptroller "Taxpayer Organizational Type" codes, from the dataset's
// published record layout (Franchise Layout.docx on data.texas.gov).
export const TX_TYPES = {
  AB: 'TEXAS BUSINESS ASSOCIATION', AC: 'FOREIGN BUSINESS ASSOCIATION', AF: 'FOREIGN PROFESSIONAL ASSOCIATION',
  AP: 'TEXAS PROFESSIONAL ASSOCIATION', AR: 'OTHER ASSOCIATION', C: 'CORPORATION', CF: 'FOREIGN PROFIT CORPORATION',
  CI: 'FOREIGN LIMITED LIABILITY COMPANY', CL: 'TEXAS LIMITED LIABILITY COMPANY', CM: 'FOREIGN NON-PROFIT CORPORATION',
  CN: 'TEXAS NON-PROFIT CORPORATION', CP: 'TEXAS PROFESSIONAL CORPORATION', CR: 'TEXAS INSURANCE CORPORATION',
  CS: 'FOREIGN INSURANCE CORPORATION', CT: 'TEXAS PROFIT CORPORATION', CU: 'FOREIGN PROFESSIONAL CORPORATION',
  CW: 'TEXAS RAILROAD CORPORATION', CX: 'FOREIGN RAILROAD CORPORATION', HF: 'FOREIGN HOLDING COMPANY',
  L: 'LIMITED LIABILITY COMPANY', M: 'LIMITED LIABILITY PARTNERSHIP', P: 'GENERAL PARTNERSHIP',
  PB: 'GENERAL PARTNERSHIP', PF: 'FOREIGN LIMITED PARTNERSHIP', PI: 'GENERAL PARTNERSHIP', PL: 'TEXAS LIMITED PARTNERSHIP',
  PV: 'TEXAS JOINT VENTURE', PW: 'FOREIGN JOINT VENTURE', PX: 'TEXAS LIMITED LIABILITY PARTNERSHIP',
  PY: 'FOREIGN LIMITED LIABILITY PARTNERSHIP', S: 'SOLE PROPRIETORSHIP', IS: 'SOLE PROPRIETORSHIP',
  SF: 'FOREIGN JOINT STOCK COMPANY', ST: 'TEXAS JOINT STOCK COMPANY', TF: 'FOREIGN BUSINESS TRUST',
  TH: 'TEXAS REAL ESTATE INVESTMENT TRUST', TI: 'FOREIGN REAL ESTATE INVESTMENT TRUST', TR: 'TRUST',
};

// Maps any state's raw entity-type text to a friendly kind.
export function friendlyType(raw) {
  const t = String(raw || '').toUpperCase();
  const foreign = /\bFOREIGN\b|\bFRGN\b|\bOOS\b/.test(t);
  let kind = 'Other';
  if (!t.trim()) kind = 'Unknown';
  else if (/ASSUMED BUSINESS NAME|TRADE ?NAME|\bDBA\b/.test(t)) kind = 'Assumed name (DBA)';
  else if (/RESERV/.test(t)) kind = 'Name reservation';
  else if (/PROFESSIONAL.*LIMITED LIABILITY COMPANY|PROFESSIONAL SERVICE LIMITED LIABILITY|\bPLLC\b/.test(t)) kind = 'Professional LLC';
  else if (/LIMITED LIABILITY COMPANY|\bLLC\b/.test(t)) kind = 'LLC';
  else if (/LIMITED LIABILITY LIMITED PARTNERSHIP|\bLLLP\b/.test(t)) kind = 'LLLP';
  else if (/LIMITED LIABILITY PARTNERSHIP|\bLLP\b/.test(t)) kind = 'LLP';
  else if (/LIMITED PARTNERSHIP|^LP$/.test(t)) kind = 'Limited partnership';
  else if (/NOT-FOR-PROFIT|NON-?PROFIT|NON-STOCK|RELIGIOUS|CEMETERY/.test(t)) kind = 'Nonprofit';
  else if (/PROFESSIONAL/.test(t)) kind = 'Professional corp.';
  else if (/CORPORATION|\bSTOCK\b|\bCORP\b|SPECIAL CHARTERED/.test(t)) kind = 'Corporation';
  else if (/PARTNERSHIP|JOINT VENTURE/.test(t)) kind = 'Partnership';
  else if (/COOPERATIVE/.test(t)) kind = 'Cooperative';
  else if (/TRUST/.test(t)) kind = 'Trust';
  else if (/SOLE PROPRIETOR/.test(t)) kind = 'Sole proprietorship';
  else if (/ASSOCIATION/.test(t)) kind = 'Association';
  return { kind, foreign, label: foreign && !/DBA|reservation/i.test(kind) ? `${kind} (out-of-state)` : kind };
}

/* ------------------------------------------------------------------ */
/* Registries                                                          */
/* ------------------------------------------------------------------ */
// status → 'active' | 'reserved' | 'inactive' | 'dba' | 'taxonly'
export const REGISTRIES = {
  NY: {
    name: 'New York',
    host: 'data.ny.gov', id: 'n9v6-gdp6', field: 'current_entity_name',
    select: ['dos_id', 'current_entity_name', 'entity_type', 'initial_dos_filing_date'],
    dataset: 'Active Corporations (NY Department of State)',
    coverage: 'All active entities filed with the NY Department of State: corporations, LLCs, nonprofits, partnerships, including out-of-state entities registered in NY.',
    row: r => ({ id: r.dos_id, name: r.current_entity_name, rawType: r.entity_type, date: r.initial_dos_filing_date, status: 'active', statusText: 'Active' }),
  },
  CT: {
    name: 'Connecticut',
    host: 'data.ct.gov', id: 'n7gp-d28j', field: 'name',
    select: ['accountnumber', 'name', 'business_type', 'status', 'citizenship', 'date_registration'],
    dataset: 'Connecticut Business Registry (Secretary of the State)',
    coverage: 'All entities on the CT business registry, including dissolved ones and current name reservations.',
    row: r => {
      const st = String(r.status || '');
      let status = 'inactive';
      if (/^reserved$/i.test(st)) status = 'reserved';
      else if (/^(active|registered|recorded|pending|active - pending)/i.test(st)) status = 'active';
      const rawType = r.business_type || (status === 'reserved' || /reserv/i.test(st) ? 'NAME RESERVATION' : '');
      const date = r.date_registration && !r.date_registration.startsWith('0001') ? r.date_registration : '';
      return { id: r.accountnumber, name: r.name, rawType: `${r.citizenship === 'Foreign' ? 'FOREIGN ' : ''}${rawType}`, date, status, statusText: st || 'Unknown' };
    },
  },
  TX: {
    name: 'Texas',
    host: 'data.texas.gov', id: '9cir-efmm', field: 'taxpayer_name',
    select: ['taxpayer_number', 'taxpayer_name', 'taxpayer_organizational_type', 'record_type_code', 'sos_charter_date', 'sos_status_code', 'responsibility_beginning_date'],
    dataset: 'Active Franchise Taxpayers (Texas Comptroller)',
    coverage: 'Entities registered for Texas franchise tax: nearly every for-profit entity formed in or registered to do business in Texas. Some nonprofits may be missing.',
    row: r => {
      const code = String(r.sos_status_code || '').trim();
      const rec = String(r.record_type_code || '').trim();
      let status = 'inactive';
      let statusText = { A: 'Active', R: 'Reinstated', D: 'Dissolved', F: 'Forfeited (franchise tax)', M: 'Merged', W: 'Withdrawn', T: 'Terminated', E: 'Expired', C: 'Converted', B: 'Consolidated' }[code] || (code ? `Status ${code}` : 'Active taxpayer');
      if (rec === 'X') { status = 'taxonly'; statusText = 'Tax registration only (not on the Secretary of State registry)'; }
      else if (code === 'A' || code === 'R') status = 'active';
      return { id: r.taxpayer_number, name: r.taxpayer_name, rawType: TX_TYPES[String(r.taxpayer_organizational_type || '').trim()] || r.taxpayer_organizational_type, date: r.sos_charter_date || r.responsibility_beginning_date, status, statusText };
    },
  },
  CO: {
    name: 'Colorado',
    host: 'data.colorado.gov', id: '4ykn-tg5h', field: 'entityname',
    select: ['entityid', 'entityname', 'entitystatus', 'entitytype', 'entityformdate'],
    dataset: 'Business Entities in Colorado (Secretary of State)',
    coverage: 'Every entity ever registered with the Colorado Secretary of State, active and inactive.',
    row: r => {
      const st = String(r.entitystatus || '');
      // Delinquent / noncompliant entities still exist and keep their names in Colorado.
      const status = /^(good standing|delinquent|noncompliant|exists|registered agent resigned)$/i.test(st) ? 'active' : 'inactive';
      return { id: r.entityid, name: String(r.entityname || '').replace(/,\s*(dissolved|withdrawn|merged|converted)\b.*$/i, ''), rawType: CO_TYPES[r.entitytype] || r.entitytype, date: r.entityformdate, status, statusText: st || 'Unknown' };
    },
  },
  OR: {
    name: 'Oregon',
    host: 'data.oregon.gov', id: 'tckn-sxa6', field: 'business_name',
    select: ['registry_number', 'business_name', 'entity_type', 'registry_date'],
    dataset: 'Active Businesses (Oregon Secretary of State)',
    coverage: 'All active Oregon business registrations, including assumed business names (DBAs).',
    row: r => {
      const dba = /ASSUMED BUSINESS NAME/i.test(r.entity_type || '');
      return { id: r.registry_number, name: r.business_name, rawType: r.entity_type, date: r.registry_date, status: dba ? 'dba' : 'active', statusText: dba ? 'Active assumed name' : 'Active' };
    },
  },
};
export const LIVE_STATES = Object.keys(REGISTRIES);

/* ------------------------------------------------------------------ */
/* Name normalisation (how registries compare names)                   */
/* ------------------------------------------------------------------ */
const DESIGNATOR_PHRASES = [
  'professional limited liability company', 'limited liability limited partnership', 'limited liability partnership',
  'limited liability company', 'limited liability co', 'ltd liability company', 'ltd liability co',
  'public benefit corporation', 'professional corporation', 'professional association', 'limited partnership',
  'registered limited liability partnership',
];
const DESIGNATOR_WORDS = new Set([
  'llc', 'lc', 'pllc', 'inc', 'incorporated', 'corp', 'corporation', 'co', 'company', 'ltd', 'limited',
  'lp', 'llp', 'lllp', 'rllp', 'pc', 'pa', 'pbc', 'plc', 'nfp', 'the', 'a', 'an', 'and', 'of',
]);

// Lower-case words with designators, articles and punctuation removed.
export function nameTokens(name) {
  let s = String(name || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '');
  s = s.replace(/&/g, ' and ').replace(/\b([a-z])\.(?=[a-z]\.)/g, '$1').replace(/\b([a-z])\.(?=\s|$|,)/g, '$1'); // L.L.C. → llc
  s = s.replace(/['’]/g, '').replace(/[^a-z0-9]+/g, ' ');
  for (const phrase of DESIGNATOR_PHRASES) s = s.replace(new RegExp(`\\b${phrase}\\b`, 'g'), ' ');
  return s.split(/\s+/).filter(w => w && !DESIGNATOR_WORDS.has(w));
}
export const normalizeEntityName = name => nameTokens(name).join('');

function levenshtein(a, b) {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}
const singular = s => s.replace(/(ies)$/, 'y').replace(/(?<=[^s])s$/, '');

// 'exact' = registries would treat it as the same name.
// 'near'  = likely to be refused as "not distinguishable" / "confusingly similar".
// 'prefix' = merely starts with the same word.
export function matchLevel(inputNorm, recordNorm) {
  if (!inputNorm || !recordNorm) return 'none';
  if (inputNorm === recordNorm) return 'exact';
  if (singular(inputNorm) === singular(recordNorm)) return 'near';
  const min = Math.min(inputNorm.length, recordNorm.length);
  const d = Math.abs(inputNorm.length - recordNorm.length) <= 2 ? levenshtein(inputNorm, recordNorm) : 99;
  if ((min >= 5 && d <= 1) || (min >= 10 && d <= 2)) return 'near';
  return 'prefix';
}

/* ------------------------------------------------------------------ */
/* Queries                                                             */
/* ------------------------------------------------------------------ */
export const ROW_LIMIT = 1000;

// Prefixes to search with: the first meaningful word (or first two words
// if the first is very short), plus the whole name for common words.
export function searchPrefixes(core) {
  const tokens = nameTokens(core);
  if (!tokens.length) return { broad: [], narrow: [] };
  const first = tokens[0].length < 3 && tokens[1] ? `${tokens[0]} ${tokens[1]}` : tokens[0];
  const full = tokens.join(' ');
  const joined = tokens.join('');
  const up = s => s.toUpperCase().replace(/[^A-Z0-9 ]/g, '');
  return {
    broad: [up(first), `THE ${up(first)}`],
    narrow: [...new Set([up(full), up(joined), `THE ${up(full)}`])],
  };
}

export function buildQueryUrl(reg, prefixes, limit = ROW_LIMIT) {
  const f = reg.field;
  const where = prefixes.map(p => `starts_with(upper(${f}), '${p.replace(/'/g, "''")}')`).join(' OR ');
  const params = new URLSearchParams({ $select: reg.select.join(','), $where: where, $order: f, $limit: String(limit) });
  return `https://${reg.host}/resource/${reg.id}.json?${params}`;
}

/* ------------------------------------------------------------------ */
/* Results                                                             */
/* ------------------------------------------------------------------ */
// Turns raw dataset rows into de-duplicated, classified matches.
export function processRows(stateCode, rows, core) {
  const reg = REGISTRIES[stateCode];
  const inputNorm = normalizeEntityName(core);
  const seen = new Set();
  const out = [];
  for (const raw of rows) {
    const r = reg.row(raw);
    if (!r.name) continue;
    const key = `${r.id}|${r.name}`;
    if (seen.has(key)) continue; // Oregon lists each entity once per address type
    seen.add(key);
    const level = matchLevel(inputNorm, normalizeEntityName(r.name));
    if (level === 'none') continue;
    const type = friendlyType(r.rawType);
    out.push({ ...r, type: type.label, kind: type.kind, foreign: type.foreign, level, date: r.date ? String(r.date).slice(0, 10) : '' });
  }
  const order = { exact: 0, near: 1, prefix: 2 };
  const statusOrder = { active: 0, reserved: 1, dba: 2, taxonly: 3, inactive: 4 };
  out.sort((a, b) => order[a.level] - order[b.level] || statusOrder[a.status] - statusOrder[b.status] || a.name.localeCompare(b.name));
  return out;
}

const BLOCKING = new Set(['active', 'reserved']);

// verdict: 'taken' | 'similar' | 'clear'
export function summarize(matches) {
  const exactBlocking = matches.filter(m => m.level === 'exact' && BLOCKING.has(m.status));
  const nearBlocking = matches.filter(m => m.level === 'near' && BLOCKING.has(m.status));
  const exactOther = matches.filter(m => m.level === 'exact' && !BLOCKING.has(m.status));
  const related = matches.filter(m => m.level === 'prefix');
  let verdict = 'clear';
  if (exactBlocking.length) verdict = 'taken';
  else if (nearBlocking.length || exactOther.length) verdict = 'similar';
  return {
    verdict,
    exactBlocking, nearBlocking, exactOther, related,
    kinds: [...new Set([...exactBlocking, ...nearBlocking].map(m => m.type))],
  };
}

/* ------------------------------------------------------------------ */
/* Network                                                             */
/* ------------------------------------------------------------------ */
const TIMEOUT_MS = 20000;

async function getJson(url, signal) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  const onAbort = () => ctrl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, { signal: ctrl.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

function cacheGet(key) {
  try {
    const v = JSON.parse(sessionStorage.getItem(key));
    return v && v.at > Date.now() - 3600e3 ? v.value : null;
  } catch { return null; }
}
function cacheSet(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), value })); } catch { /* storage unavailable */ }
}

// When the dataset was last refreshed (ISO date), or '' if unknown.
export async function datasetUpdated(stateCode, signal) {
  const reg = REGISTRIES[stateCode];
  const key = `naam.reg.updated.${stateCode}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  try {
    const meta = await getJson(`https://${reg.host}/api/views/${reg.id}.json`, signal);
    const ts = meta.rowsUpdatedAt || meta.dataUpdatedAt;
    const iso = ts ? new Date(typeof ts === 'number' ? ts * 1000 : ts).toISOString().slice(0, 10) : '';
    if (iso) cacheSet(key, iso);
    return iso;
  } catch {
    return '';
  }
}

/**
 * Searches one state. Resolves to
 * { state, ok, matches, summary, truncated, updated, error }.
 */
export async function searchState(stateCode, core, signal) {
  const reg = REGISTRIES[stateCode];
  if (!reg) throw new Error(`No live registry for ${stateCode}`);
  const { broad, narrow } = searchPrefixes(core);
  const updatedP = datasetUpdated(stateCode, signal);
  if (!broad.length) return { state: stateCode, ok: false, error: 'The name has no letters or numbers to search for.', matches: [], summary: summarize([]) };
  const abortError = () => Object.assign(new Error('Aborted'), { name: 'AbortError' });
  if (signal?.aborted) throw abortError();
  const key = `naam.reg.${stateCode}.${normalizeEntityName(core)}`;
  const cached = cacheGet(key);
  if (cached) return { ...cached, updated: await updatedP, cached: true };
  try {
    let rows = await getJson(buildQueryUrl(reg, broad), signal);
    let truncated = rows.length >= ROW_LIMIT;
    if (truncated) {
      // Very common first word: make sure exact and near matches aren't cut off.
      const exactRows = await getJson(buildQueryUrl(reg, narrow, 500), signal);
      rows = [...exactRows, ...rows];
    }
    if (signal?.aborted) throw abortError();
    const matches = processRows(stateCode, rows, core);
    const result = { state: stateCode, ok: true, matches, summary: summarize(matches), truncated };
    cacheSet(key, result);
    return { ...result, updated: await updatedP };
  } catch (e) {
    if (signal?.aborted) throw e;
    return { state: stateCode, ok: false, error: 'Couldn\'t reach the state\'s open-data service.', matches: [], summary: summarize([]), updated: await updatedP };
  }
}

/* ------------------------------------------------------------------ */
/* Score                                                               */
/* ------------------------------------------------------------------ */
// A zero-weight category: it doesn't dilute the other scores, but a live
// conflict in the formation state is a hard blocker, and one in the operating
// state is a failure (you'd need a different name or a DBA there).
export function scoreRegistry(results, { state, opState } = {}) {
  const cat = { id: 'registry', label: 'State registry', weight: 0, score: null, checks: [], blocker: false };
  for (const r of results) {
    if (!r || !r.ok) continue;
    const name = REGISTRIES[r.state].name;
    const top = r.summary.exactBlocking[0];
    if (r.summary.verdict === 'taken') {
      if (r.state === state) {
        cat.checks.push({ status: 'fail', title: `Already registered in ${name}`, detail: `"${top.name}" (${top.type}) is ${top.statusText.toLowerCase()} in ${name}. The state will refuse an identical name, whatever the suffix.`, penalty: 0 });
        cat.blocker = true;
      } else if (r.state === opState) {
        cat.checks.push({ status: 'fail', title: `Already registered in ${name}`, detail: `"${top.name}" is ${top.statusText.toLowerCase()} in ${name}, where you plan to operate. You'd have to register there under a different name (a DBA).`, penalty: 0 });
      } else {
        cat.checks.push({ status: 'info', title: `In use in ${name}`, detail: `"${top.name}" (${top.type}). This doesn't stop you forming elsewhere, but it's a trademark and confusion risk if you trade there.`, penalty: 0 });
      }
    } else if (r.summary.verdict === 'similar' && (r.state === state || r.state === opState)) {
      const m = r.summary.nearBlocking[0] || r.summary.exactOther[0];
      cat.checks.push({ status: 'warn', title: `Similar name in ${name}`, detail: `"${m.name}" (${m.statusText.toLowerCase()}). ${name} may consider it too similar.`, penalty: 0 });
    }
  }
  return cat;
}
