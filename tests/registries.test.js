import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// ---- mocked Socrata --------------------------------------------------------
const DATA = {
  'data.ny.gov': [
    { dos_id: '1', current_entity_name: 'NAAM GROUP INC', entity_type: 'DOMESTIC BUSINESS CORPORATION', initial_dos_filing_date: '2020-03-13T00:00:00.000' },
    { dos_id: '2', current_entity_name: 'NAAM CONSTRUCTION CORP.', entity_type: 'DOMESTIC BUSINESS CORPORATION', initial_dos_filing_date: '2014-05-09T00:00:00.000' },
    { dos_id: '3', current_entity_name: 'THE NAAM GROUPS, L.L.C.', entity_type: 'FOREIGN LIMITED LIABILITY COMPANY', initial_dos_filing_date: '2021-01-01T00:00:00.000' },
  ],
  'data.ct.gov': [
    { accountnumber: '10', name: 'Naam Group LLC', business_type: null, status: 'Reserved', citizenship: null, date_registration: '0001-01-01T00:00:00.000' },
    { accountnumber: '11', name: 'Naam Group, Inc.', business_type: 'Stock', status: 'Dissolved', citizenship: 'Domestic', date_registration: '2001-02-03T00:00:00.000' },
  ],
  'data.texas.gov': [
    { taxpayer_number: '20', taxpayer_name: 'NAAM GROUP', taxpayer_organizational_type: 'PB', record_type_code: 'X', sos_status_code: '' },
    { taxpayer_number: '21', taxpayer_name: 'NAAM GROOP LLC', taxpayer_organizational_type: 'CL', record_type_code: 'U', sos_status_code: 'A', sos_charter_date: '2019-01-01T00:00:00.000' },
  ],
  'data.colorado.gov': [
    { entityid: '30', entityname: 'Naam Group, Dissolved March 1, 2001', entitystatus: 'Voluntarily Dissolved', entitytype: 'DPC', entityformdate: '1999-01-01T00:00:00.000' },
    { entityid: '31', entityname: 'Naam Group LLC', entitystatus: 'Delinquent', entitytype: 'DLLC', entityformdate: '2015-01-01T00:00:00.000' },
  ],
  'data.oregon.gov': [
    { registry_number: '40', business_name: 'NAAM GROUP', entity_type: 'ASSUMED BUSINESS NAME', registry_date: '2022-01-01T00:00:00.000' },
    { registry_number: '40', business_name: 'NAAM GROUP', entity_type: 'ASSUMED BUSINESS NAME', registry_date: '2022-01-01T00:00:00.000' },
  ],
};
let calls = [];
let failHost = '';
let bigHost = '';
globalThis.fetch = async (url, opts = {}) => {
  calls.push({ url, opts });
  const u = new URL(url);
  if (u.hostname === failHost) return new Response('', { status: 503 });
  if (u.pathname.startsWith('/api/views/')) return Response.json({ rowsUpdatedAt: 1794845356 });
  const where = u.searchParams.get('$where') || '';
  const limit = Number(u.searchParams.get('$limit'));
  const prefixes = [...where.matchAll(/'([^']*)'/g)].map(m => m[1]);
  const field = { 'data.ny.gov': 'current_entity_name', 'data.ct.gov': 'name', 'data.texas.gov': 'taxpayer_name', 'data.colorado.gov': 'entityname', 'data.oregon.gov': 'business_name' }[u.hostname];
  let rows = (DATA[u.hostname] || []).filter(r => prefixes.some(p => String(r[field]).toUpperCase().startsWith(p)));
  if (u.hostname === bigHost && limit === 1000) {
    // a very common first word: 1000 unrelated rows, the real match is cut off
    rows = Array.from({ length: 1000 }, (_, i) => ({ dos_id: `x${i}`, current_entity_name: `NAAM ${String(i).padStart(4, '0')} HOLDINGS`, entity_type: 'DOMESTIC LIMITED LIABILITY COMPANY' }));
  }
  return Response.json(rows.slice(0, limit));
};
try { globalThis.sessionStorage?.clear(); } catch { /* no web storage */ }

const R = await import('../js/registries.js');
const { normalizeEntityName, nameTokens, matchLevel, searchPrefixes, buildQueryUrl, friendlyType, processRows, summarize, searchState, scoreRegistry, REGISTRIES, LIVE_STATES, TX_TYPES } = R;
const { totalScore } = await import('../js/scoring.js');

beforeEach(() => { calls = []; failHost = ''; bigHost = ''; try { globalThis.sessionStorage?.clear(); } catch { /* none */ } });

test('live states have complete config', () => {
  assert.deepEqual(LIVE_STATES, ['NY', 'CT', 'TX', 'CO', 'OR']);
  for (const [code, r] of Object.entries(REGISTRIES)) {
    assert.match(r.host, /^data\.[a-z]+\.gov$/, code);
    assert.match(r.id, /^[a-z0-9]{4}-[a-z0-9]{4}$/, code);
    assert.ok(r.select.includes(r.field), code);
  }
});

test('normalisation ignores designators, articles, punctuation and &', () => {
  const same = ['Naam Group', 'NAAM GROUP INC', 'The Naam Group, L.L.C.', 'Naam Group Limited Liability Company', 'naam-group corp.', 'NAAM GROUP CO', 'Naam Group, Ltd.', 'Naam Group P.C.', 'Naam Group PLLC'];
  for (const n of same) assert.equal(normalizeEntityName(n), 'naamgroup', n);
  assert.equal(normalizeEntityName('Naam & Sons'), normalizeEntityName('Naam and Sons'));
  assert.equal(normalizeEntityName("Naam's Café"), 'naamscafe');
  assert.deepEqual(nameTokens('A1 Roofing, LLC'), ['a1', 'roofing']);
  assert.equal(normalizeEntityName('LLC'), '');
});

test('match levels', () => {
  assert.equal(matchLevel('naamgroup', 'naamgroup'), 'exact');
  assert.equal(matchLevel('naamgroup', 'naamgroups'), 'near');   // plural
  assert.equal(matchLevel('naamgroup', 'naamgroop'), 'near');    // one letter
  assert.equal(matchLevel('naamstudios', 'naamstudio'), 'near');
  assert.equal(matchLevel('naam', 'naan'), 'prefix');            // too short for fuzzy
  assert.equal(matchLevel('naam', 'naamconstruction'), 'prefix');
  assert.equal(matchLevel('', 'x'), 'none');
});

test('search prefixes: first word, two words when short, plus "The"', () => {
  assert.deepEqual(searchPrefixes('Naam Group LLC').broad, ['NAAM', 'THE NAAM']);
  assert.deepEqual(searchPrefixes('The Naam Group').broad, ['NAAM', 'THE NAAM']);
  assert.deepEqual(searchPrefixes('A1 Roofing').broad, ['A1 ROOFING', 'THE A1 ROOFING']);
  assert.ok(searchPrefixes('Naam Group').narrow.includes('NAAMGROUP'));
  assert.deepEqual(searchPrefixes('LLC'), { broad: [], narrow: [] });
});

test('query URL is a safe, indexed starts_with search', () => {
  const url = new URL(buildQueryUrl(REGISTRIES.NY, ["O'NEIL"]));
  assert.equal(url.hostname, 'data.ny.gov');
  assert.match(url.searchParams.get('$where'), /starts_with\(upper\(current_entity_name\), 'O''NEIL'\)/);
  assert.equal(url.searchParams.get('$limit'), '1000');
});

test('entity types map to friendly kinds, including codes', () => {
  assert.equal(friendlyType('DOMESTIC LIMITED LIABILITY COMPANY').label, 'LLC');
  assert.equal(friendlyType('FOREIGN LIMITED LIABILITY COMPANY').label, 'LLC (out-of-state)');
  assert.equal(friendlyType('DOMESTIC PROFESSIONAL SERVICE LIMITED LIABILITY COMPANY').kind, 'Professional LLC');
  assert.equal(friendlyType('DOMESTIC NOT-FOR-PROFIT CORPORATION').kind, 'Nonprofit');
  assert.equal(friendlyType('Non-Stock').kind, 'Nonprofit');
  assert.equal(friendlyType('Stock').kind, 'Corporation');
  assert.equal(friendlyType('ASSUMED BUSINESS NAME').kind, 'Assumed name (DBA)');
  assert.equal(friendlyType('DOMESTIC REGISTERED LIMITED LIABILITY PARTNERSHIP').kind, 'LLP');
  assert.equal(friendlyType('DOMESTIC LIMITED LIABILITY LIMITED PARTNERSHIP').kind, 'LLLP');
  assert.equal(friendlyType(TX_TYPES.CL).kind, 'LLC');
  assert.equal(friendlyType(TX_TYPES.CF).label, 'Corporation (out-of-state)');
  assert.equal(friendlyType(TX_TYPES.CN).kind, 'Nonprofit');
  assert.equal(friendlyType('').kind, 'Unknown');
});

test('state row mapping: statuses that do and do not hold a name', () => {
  const ct = processRows('CT', DATA['data.ct.gov'], 'Naam Group');
  assert.equal(ct.find(m => m.id === '10').status, 'reserved');
  assert.equal(ct.find(m => m.id === '10').type, 'Name reservation');
  assert.equal(ct.find(m => m.id === '11').status, 'inactive');
  const tx = processRows('TX', DATA['data.texas.gov'], 'Naam Group');
  assert.equal(tx.find(m => m.id === '20').status, 'taxonly');           // record type X: not on SOS registry
  assert.equal(tx.find(m => m.id === '21').status, 'active');
  const co = processRows('CO', DATA['data.colorado.gov'], 'Naam Group');
  assert.equal(co.find(m => m.id === '31').status, 'active');            // delinquent still holds the name
  assert.equal(co.find(m => m.id === '30').status, 'inactive');
  assert.equal(co.find(m => m.id === '30').name, 'Naam Group');          // ", Dissolved …" suffix removed
  const or = processRows('OR', DATA['data.oregon.gov'], 'Naam Group');
  assert.equal(or.length, 1);                                            // de-duplicated
  assert.equal(or[0].status, 'dba');
});

test('verdicts per state', () => {
  const v = code => summarize(processRows(code, DATA[REGISTRIES[code].host], 'Naam Group')).verdict;
  assert.equal(v('NY'), 'taken');    // active exact match
  assert.equal(v('CT'), 'taken');    // reserved name blocks
  assert.equal(v('TX'), 'similar');  // exact is tax-only; "NAAM GROOP" is a near match
  assert.equal(v('CO'), 'taken');    // delinquent LLC still holds it
  assert.equal(v('OR'), 'similar');  // only an assumed business name
  assert.equal(summarize(processRows('NY', DATA['data.ny.gov'], 'Zentrova')).verdict, 'clear');
  const ny = summarize(processRows('NY', DATA['data.ny.gov'], 'Naam Group'));
  assert.equal(ny.nearBlocking[0].name, 'THE NAAM GROUPS, L.L.C.');
  assert.ok(ny.related.some(m => m.name === 'NAAM CONSTRUCTION CORP.'));
  assert.deepEqual(ny.kinds.sort(), ['Corporation', 'LLC (out-of-state)']);
});

test('searchState end-to-end (mocked): results, freshness, privacy', async () => {
  const r = await searchState('NY', 'Naam Group LLC');
  assert.equal(r.ok, true);
  assert.equal(r.summary.verdict, 'taken');
  assert.equal(r.updated, '2026-11-16');
  for (const c of calls) {
    assert.equal(c.opts.credentials, 'omit');
    assert.equal(c.opts.referrerPolicy, 'no-referrer');
    assert.ok(!c.opts.headers);
    assert.match(new URL(c.url).hostname, /^data\.[a-z]+\.gov$/);
  }
});

test('common first word: exact match is found even past the row limit', async () => {
  bigHost = 'data.ny.gov';
  const r = await searchState('NY', 'Naam Group');
  assert.equal(r.truncated, true);
  assert.equal(r.summary.verdict, 'taken');
  assert.equal(calls.filter(c => c.url.includes('/resource/')).length, 2);
});

test('service failure reports an error instead of "available"', async () => {
  failHost = 'data.ct.gov';
  const r = await searchState('CT', 'Naam Group');
  assert.equal(r.ok, false);
  assert.match(r.error, /Couldn't reach/);
  assert.equal(r.summary.verdict, 'clear'); // but ok=false, so the UI shows "Couldn't check"
});

test('results are cached per state and name', async () => {
  if (!globalThis.sessionStorage) return; // Node without web storage
  await searchState('CO', 'Naam Group');
  const before = calls.length;
  const again = await searchState('CO', 'The Naam Group, Inc.');
  assert.equal(again.cached, true);
  assert.equal(calls.filter(c => c.url.includes('/resource/')).length, calls.slice(0, before).filter(c => c.url.includes('/resource/')).length);
});

test('aborting a search rejects (so stale results are never shown)', async () => {
  const ctrl = new AbortController();
  ctrl.abort();
  await assert.rejects(searchState('TX', 'Something New', ctrl.signal));
});

test('scoring: conflict in the formation state blocks; elsewhere informs', async () => {
  const results = await Promise.all(LIVE_STATES.map(s => searchState(s, 'Naam Group')));
  const formNY = scoreRegistry(results, { state: 'NY' });
  assert.equal(formNY.blocker, true);
  assert.equal(formNY.weight, 0);
  assert.ok(formNY.checks.some(c => c.status === 'fail' && /New York/.test(c.title)));
  const formDE = scoreRegistry(results, { state: 'DE' });
  assert.equal(formDE.blocker, false);
  assert.ok(formDE.checks.every(c => c.status === 'info'));
  const opNY = scoreRegistry(results, { state: 'DE', opState: 'NY' });
  assert.equal(opNY.blocker, false);
  assert.ok(opNY.checks.some(c => c.status === 'fail' && /DBA/.test(c.detail)));
  const formTX = scoreRegistry(results, { state: 'TX' });
  assert.ok(formTX.checks.some(c => c.status === 'warn' && /Texas/.test(c.title)));
  // weight-0 category: blocks via cap, never dilutes the average
  const base = [{ id: 'a', weight: 100, score: 1, checks: [] }];
  assert.equal(totalScore([...base, formDE]).score, 100);
  assert.ok(totalScore([...base, formNY]).score <= 35);
});
