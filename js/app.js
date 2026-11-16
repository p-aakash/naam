// Naam — UI wiring.
import { ENTITY_TYPES, INDUSTRIES, STATES } from './data.js';
import { analyzeName, scoreDomains, totalScore, grade, CATEGORY_LABELS } from './scoring.js';
import { checkDomains, verifyLinks, loadBootstrap, loadTldList, tldExists, hasRdap } from './domains.js';
import { parseDomainList, MAX_DOMAINS } from './domain-input.js';
import { REGISTRIES, LIVE_STATES, searchState, scoreRegistry, summarize } from './registries.js';

const $ = sel => document.querySelector(sel);
const el = (tag, attrs = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('data-')) node.setAttribute(k, v);
    else if (k in node) node[k] = v;
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) node.append(c.nodeType ? c : document.createTextNode(String(c)));
  return node;
};
const ICON = { pass: '✓', warn: '!', fail: '✕', info: 'i' };
const STATUS_TEXT = { available: 'Available', likely: 'Likely free', taken: 'Taken', unknown: 'Unknown', pending: 'Checking…', invalid: 'Invalid', expiring: 'Expiring' };
const externalLink = (href, ...children) => el('a', { href, target: '_blank', rel: 'noopener noreferrer' }, ...children);

/* ------------------------------------------------------------------ */
/* Form setup                                                          */
/* ------------------------------------------------------------------ */
function fillSelects() {
  const ind = $('#industry');
  for (const [k, v] of Object.entries(INDUSTRIES)) ind.append(el('option', { value: k, text: v.label }));
  ind.value = 'tech';

  const ent = $('#entity');
  for (const [k, v] of Object.entries(ENTITY_TYPES)) ent.append(el('option', { value: k, text: v.label }));
  ent.value = 'llc';

  const sorted = Object.entries(STATES).sort((a, b) => a[1].name.localeCompare(b[1].name));
  const popular = sorted.filter(([, s]) => s.popular);
  const st = $('#state');
  const pg = el('optgroup', { label: 'Popular' });
  for (const [k, s] of popular) pg.append(el('option', { value: k, text: s.name }));
  const ag = el('optgroup', { label: 'All states' });
  for (const [k, s] of sorted) ag.append(el('option', { value: k, text: s.name }));
  st.append(pg, ag);
  st.value = 'DE';

  const op = $('#opState');
  op.append(el('option', { value: '', text: 'Same as formation' }));
  for (const [k, s] of sorted) op.append(el('option', { value: k, text: s.name }));
}

function readForm() {
  return {
    name: $('#name').value.trim(),
    industry: $('#industry').value,
    entity: $('#entity').value,
    state: $('#state').value,
    opState: $('#opState').value,
  };
}

function writeForm(v) {
  if (v.name !== undefined) $('#name').value = v.name;
  if (v.industry && INDUSTRIES[v.industry]) $('#industry').value = v.industry;
  if (v.entity && ENTITY_TYPES[v.entity]) $('#entity').value = v.entity;
  if (v.state && STATES[v.state]) $('#state').value = v.state;
  $('#opState').value = v.opState && STATES[v.opState] ? v.opState : '';
}

function shareUrl(v) {
  const u = new URL(location.href);
  u.search = '';
  u.hash = '';
  u.searchParams.set('n', v.name);
  u.searchParams.set('i', v.industry);
  u.searchParams.set('e', v.entity);
  u.searchParams.set('s', v.state);
  if (v.opState) u.searchParams.set('o', v.opState);
  return u.toString();
}

/* ------------------------------------------------------------------ */
/* Rendering                                                           */
/* ------------------------------------------------------------------ */
let current = null;     // { analysis, domainResults: Map }
let controller = null;  // AbortController for in-flight domain checks

function allCategories() {
  const domainCat = scoreDomains([...current.domainResults.values()]);
  const registryCat = scoreRegistry([...current.registryResults.values()], current.analysis.input);
  return [...current.analysis.categories, domainCat, registryCat];
}

function toneFor(score01) {
  if (score01 === null || score01 === undefined) return 'pending';
  if (score01 >= 0.8) return 'pass';
  if (score01 >= 0.5) return 'warn';
  return 'fail';
}

// Width via CSSOM: the Content-Security-Policy forbids inline style attributes.
function fill(pct) {
  const span = el('span');
  span.style.width = `${pct}%`;
  return span;
}

function renderSummary() {
  const cats = allCategories();
  const t = totalScore(cats);
  const g = grade(t.score, t.blocked);
  $('#score').textContent = t.score;
  const ring = $('.ring');
  ring.dataset.tone = g.tone;
  ring.querySelector('.ring-value').setAttribute('stroke-dasharray', `${t.score} 100`);
  ring.setAttribute('aria-label', `Score ${t.score} out of 100: ${g.label}`);
  const gl = $('#score-label');
  gl.textContent = g.label;
  gl.dataset.tone = g.tone;
  $('#grade-summary').textContent = g.summary;
  const pending = [...current.domainResults.values()].some(r => r.status === 'pending')
    || [...current.registryResults.values()].some(r => r.pending);
  $('#partial').hidden = !pending;

  const bars = $('#bars');
  bars.replaceChildren(...cats.filter(c => c.weight > 0).map(c => {
    const pct = c.score === null ? null : Math.round(c.score * 100);
    return el('li', { class: 'bar-row' },
      el('span', { class: 'bar-label' }, el('a', { href: `#cat-${c.id}`, text: c.label })),
      el('span', { class: 'bar-val', text: pct === null ? 'checking…' : `${pct}% · weight ${c.weight}` }),
      el('div', { class: 'bar', 'data-tone': toneFor(c.score), role: 'presentation' }, fill(pct ?? 0)));
  }));

  renderDetails(cats);
}

function renderDetails(cats) {
  const wrap = $('#details');
  wrap.replaceChildren(...cats.filter(c => (c.id !== 'domain' && c.id !== 'registry') || c.checks.length).map(c => {
    const pct = c.id === 'registry' ? 'live' : c.score === null ? '…' : `${Math.round(c.score * 100)}%`;
    return el('section', { class: 'card', id: `cat-${c.id}`, 'aria-labelledby': `cat-${c.id}-h` },
      el('div', { class: 'cat-head' },
        el('h2', { id: `cat-${c.id}-h`, text: c.label }),
        el('span', { class: 'cat-score', text: pct })),
      el('ul', { class: 'checks' }, c.checks.map(ch =>
        el('li', { class: `check check-${ch.status}` },
          el('span', { class: 'check-icon', 'aria-hidden': 'true', text: ICON[ch.status] }),
          el('div', {},
            el('p', { class: 'check-title' }, el('span', { class: 'sr-only', text: `${ch.status}: ` }), ch.title),
            ch.detail ? el('p', { class: 'check-detail', text: ch.detail }) : null)))));
  }));
}

// One result row, shared by the Suggestions and Search tabs.
// opts.verifyAlways: show verification links for every finished result (manual search).
function domainRow(r, { verifyAlways = false } = {}) {
  const free = r.status === 'available' || r.status === 'likely';
  const statusKey = r.status === 'taken' && r.expiring ? 'expiring' : r.status;
  const done = !['pending', 'invalid'].includes(r.status);
  const showVerify = done && (verifyAlways || free);
  const source = r.source === 'RDAP' ? 'Registry (RDAP)' : r.source === 'DNS' ? 'DNS' : '';
  const notes = [
    ...(r.error ? [{ cls: 'err', text: r.error }] : []),
    ...(r.warnings || []).map(text => ({ cls: 'warn', text })),
    ...(r.notes || []).map(text => ({ cls: '', text })),
  ];
  return el('li', { class: 'domain', 'data-domain': r.domain || r.raw || '' },
    el('span', { class: 'domain-name' }, r.display || r.domain || r.raw,
      r.display && r.domain && r.display !== r.domain ? el('span', { class: 'domain-sub', text: r.domain }) : null),
    el('span', { class: `status status-${statusKey}`, text: STATUS_TEXT[statusKey] || statusKey }),
    (r.detail || showVerify || source)
      ? el('span', { class: 'domain-meta' },
        r.detail ? el('span', { text: r.detail }) : null,
        done && source ? el('span', { text: `via ${source}` }) : null,
        showVerify ? verifyLinks(r.domain, { rdap: r.rdap !== false && r.source !== 'DNS' }).map(l =>
          el('a', { class: 'verify', href: l.url, target: '_blank', rel: 'noopener noreferrer', 'data-copy': l.copy || '' }, `${l.label} ↗`)) : null)
      : null,
    notes.length ? el('ul', { class: 'domain-notes' }, notes.map(n => el('li', { class: n.cls, text: n.text }))) : null);
}

function renderDomains() {
  const list = $('#domains');
  const results = [...current.domainResults.values()];
  const row = r => domainRow(r);
  const exact = results.filter(r => r.kind === 'exact');
  const variants = results.filter(r => r.kind === 'variant');
  const freeVariants = variants.filter(r => r.status === 'available' || r.status === 'likely').length;
  const checking = variants.some(r => r.status === 'pending');
  const open = $('#domains details')?.open || false;
  list.replaceChildren(...exact.map(row));
  if (variants.length) {
    list.append(el('li', { class: 'domain-variants' },
      el('details', { open },
        el('summary', { text: `.com variations: ${checking ? 'checking…' : `${freeVariants} of ${variants.length} available`}` }),
        el('ul', { class: 'domains' }, variants.map(row)))));
  }
}

const VERDICT = {
  taken: { text: 'Taken', cls: 'taken' },
  similar: { text: 'Similar names', cls: 'warn' },
  clear: { text: 'No conflict found', cls: 'available' },
  error: { text: "Couldn't check", cls: 'unknown' },
  pending: { text: 'Checking…', cls: 'pending' },
  manual: { text: 'Check manually', cls: 'info' },
};
const fmtDate = iso => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
};
const yearOf = iso => (iso && /^\d{4}/.test(iso) ? iso.slice(0, 4) : '');

// Order: formation state, operating state, then the remaining live states.
function registryOrder(input) {
  return [...new Set([input.state, input.opState, ...LIVE_STATES].filter(Boolean))];
}

function matchItem(m) {
  const since = yearOf(m.date);
  return el('li', { class: `reg-match reg-${m.status}` },
    el('span', { class: 'reg-match-name', text: m.name }),
    el('span', { class: 'reg-match-meta', text: [m.type, m.statusText, since && since !== '0001' ? `since ${since}` : ''].filter(Boolean).join(' · ') }));
}

function registryRow(code, a) {
  const s = STATES[code];
  const live = REGISTRIES[code];
  const role = code === a.input.state ? 'Formation state' : code === a.input.opState ? 'Operating state' : '';
  if (!live) {
    return el('li', { class: 'reg-row' },
      el('div', { class: 'reg-row-head' },
        el('span', { class: 'reg-state' }, s.name, role ? el('small', { text: role }) : null),
        el('span', { class: `status status-${VERDICT.manual.cls}`, text: VERDICT.manual.text })),
      el('p', { class: 'reg-line' }, `${s.name} doesn't publish open data, so search the official site for “${a.parsed.core}” (leave off LLC, Inc. and “The”). `,
        externalLink(s.search, `Open ${s.name} search ↗`)),
      s.reservation ? el('p', { class: 'reg-line', text: s.reservation }) : null);
  }
  const r = current.registryResults.get(code) || { pending: true };
  const key = r.pending ? 'pending' : !r.ok ? 'error' : r.summary.verdict;
  const v = VERDICT[key];
  let line = '';
  if (r.pending) line = `Searching the ${live.name} registry…`;
  else if (!r.ok) line = `${r.error} Use the official search instead.`;
  else if (key === 'taken') {
    const m = r.summary.exactBlocking[0];
    const more = r.summary.exactBlocking.length - 1;
    line = `${m.name}: ${m.type}, ${m.statusText.toLowerCase()}${yearOf(m.date) ? ` since ${yearOf(m.date)}` : ''}.${more ? ` Plus ${more} more with the same name.` : ''} Not available for any entity type.`;
  } else if (key === 'similar') {
    const m = r.summary.nearBlocking[0] || r.summary.exactOther[0];
    line = r.summary.nearBlocking.length
      ? `Close match: ${m.name} (${m.type}, ${m.statusText.toLowerCase()}). ${live.name} may reject your name as too similar.`
      : `Used before: ${m.name} (${m.statusText.toLowerCase()}). Usually available again, but some states protect names of recently dissolved entities.`;
  } else line = 'No identical or confusingly similar name on the registry. Looks available for any entity type.';

  const groups = !r.ok || r.pending ? [] : [
    ['Same name', r.summary.exactBlocking],
    ['Very similar', r.summary.nearBlocking],
    ['Same name, inactive or not on the entity registry', r.summary.exactOther],
    [`Other names starting the same way${r.summary.related.length > 15 ? ` (first 15 of ${r.summary.related.length}${r.truncated ? '+' : ''})` : ''}`, r.summary.related.slice(0, 15)],
  ].filter(([, list]) => list.length);

  return el('li', { class: 'reg-row', 'data-state': code, 'data-verdict': key },
    el('div', { class: 'reg-row-head' },
      el('span', { class: 'reg-state' }, s.name, role ? el('small', { text: role }) : null),
      el('span', { class: `status status-${v.cls}`, text: v.text })),
    el('p', { class: 'reg-line', text: line }),
    groups.length ? el('details', { class: 'reg-details' },
      el('summary', { text: `Show ${groups.reduce((n, [, l]) => n + l.length, 0)} matching record${groups.reduce((n, [, l]) => n + l.length, 0) === 1 ? '' : 's'}` }),
      groups.map(([title, list]) => el('div', { class: 'reg-group' }, el('h4', { text: title }), el('ul', { class: 'reg-matches' }, list.map(matchItem))))) : null,
    el('p', { class: 'reg-source' },
      `Source: ${live.dataset}`, r.updated ? `, updated ${fmtDate(r.updated)}` : '', '. ',
      externalLink(s.search, 'Official search ↗')));
}

function renderRegistration(a) {
  const box = $('#registration');
  const rows = registryOrder(a.input).map(code => registryRow(code, a));
  const sorted = Object.entries(STATES).sort((x, y) => x[1].name.localeCompare(y[1].name));
  const liveNames = LIVE_STATES.map(c => STATES[c].name).join(', ');
  box.replaceChildren(
    el('p', { class: 'card-note' },
      `Live search of official state registries (${liveNames}), straight from your browser. States compare names regardless of LLC, Inc. or Corp., so each result applies to every entity type. `,
      `Compared as “${a.registryForm || a.parsed.core}”, the way registries see it.`),
    el('ul', { class: 'reg-rows' }, rows),
    el('p', { class: 'card-note reg-caveat', text: 'No conflict found ≠ approved: the state decides when you file. Name reservations, filings still being processed, and county-level DBAs may not appear. Reserve the name (usually 60–120 days, small fee) if you aren\'t filing right away.' }),
    el('details', { class: 'all-states' },
      el('summary', { text: 'Official name search for all 50 states + DC' }),
      el('ul', { class: 'state-grid' }, sorted.map(([code, st]) => el('li', {}, externalLink(st.search, st.name), REGISTRIES[code] ? el('span', { class: 'live-dot', title: 'Checked live above', text: ' • live' }) : null)))));
}

function renderTrademarks(a) {
  const q = encodeURIComponent(a.parsed.core);
  const exact = encodeURIComponent(`"${a.parsed.core}"`);
  const items = [
    { label: 'USPTO Trademark Search', note: 'Official US federal register: search the name, then check similar spellings', url: 'https://tmsearch.uspto.gov/search/search-information' },
    { label: 'WIPO Global Brand Database', note: 'International & national trademark registers', url: 'https://branddb.wipo.int/en/similarname' },
    { label: 'EUIPO TMview', note: 'EU and participating national registers', url: 'https://www.tmdn.org/tmview/' },
    { label: 'Web search for the exact name', note: 'Unregistered businesses still have common-law rights', url: `https://www.google.com/search?q=${exact}` },
    { label: 'OpenCorporates', note: 'Companies with this name worldwide', url: `https://opencorporates.com/companies?q=${q}` },
  ];
  $('#trademarks').replaceChildren(...items.map(i => el('li', {}, externalLink(i.url, el('span', {}, i.label, el('br'), el('small', { text: i.note })), el('span', { class: 'arrow', text: '↗' })))));
}

function renderSocial(a) {
  const social = a.categories.find(c => c.id === 'social');
  $('#social').replaceChildren(...social.platforms.map(p => el('li', {},
    el('span', { class: 'social-name' }, p.label, el('small', { text: p.ok ? `@${social.handle}` : p.reason })),
    p.ok ? externalLink(p.url, 'Check ↗') : el('span', { class: 'status status-warn', text: 'Too long' }))));
}

function renderNextSteps(a) {
  const st = STATES[a.input.state];
  const liveNote = REGISTRIES[a.input.state] ? ' (Naam checked its open data above. Confirm on the official search, which also shows filings from the last few days)' : '';
  const steps = [
    `Search ${st.name}'s business registry for “${a.registryForm || a.parsed.core}”${liveNote}${a.input.opState && a.input.opState !== a.input.state ? `, and repeat in ${STATES[a.input.opState].name}` : ''}.`,
    'Run a USPTO trademark search, including similar spellings and sound-alikes in your class of goods or services.',
    'Register the best available domain now. It costs about $10–20 a year and someone else could take it.',
    'Claim the handle on the platforms you\'ll use, even if you won\'t post yet.',
    `Reserve the name with ${st.name} if you aren't filing within a few weeks.`,
    `File formation documents with the full legal name “${a.legalName}”.`,
    'Consider filing a federal trademark application once you start using the name in commerce.',
  ];
  $('#next-steps').replaceChildren(...steps.map(s => el('li', { text: s })));
}

/* ------------------------------------------------------------------ */
/* Run                                                                 */
/* ------------------------------------------------------------------ */
let renderQueued = false;
function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; renderSummary(); renderDomains(); renderRegistration(current.analysis); });
}

function run(values, { updateUrl = true, scroll = true } = {}) {
  const err = $('#form-error');
  if (!values.name) {
    err.textContent = 'Enter a company name to check.';
    err.hidden = false;
    $('#name').focus();
    return;
  }
  if (!/[A-Za-z0-9]/.test(values.name)) {
    err.textContent = 'The name needs at least one letter or number.';
    err.hidden = false;
    return;
  }
  err.hidden = true;

  controller?.abort();
  controller = new AbortController();

  const analysis = analyzeName(values);
  current = {
    analysis,
    domainResults: new Map(analysis.domains.map(d => [d.domain, { ...d, status: 'pending' }])),
    registryResults: new Map(LIVE_STATES.map(code => [code, { state: code, pending: true }])),
  };

  $('#legal-name').textContent = analysis.legalName;
  $('#registry-form').textContent = analysis.registryForm || '—';
  $('#handle').textContent = analysis.categories.find(c => c.id === 'social').handle ? `@${analysis.categories.find(c => c.id === 'social').handle}` : '—';
  const h = analysis.categories.find(c => c.id === 'social').handle;
  if (h) $('#manual-input').placeholder = `${h}.com, ${h}hq.io, get${h}.co`;
  renderRegistration(analysis);
  renderTrademarks(analysis);
  renderSocial(analysis);
  renderNextSteps(analysis);
  renderSummary();
  renderDomains();

  const results = $('#results');
  results.hidden = false;
  if (updateUrl) history.replaceState(null, '', shareUrl(values));
  document.title = `${values.name}: Naam`;
  if (scroll) results.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });

  const signal = controller.signal;
  const mine = current;
  checkDomains(analysis.domains, r => {
    if (current !== mine) return;
    current.domainResults.set(r.domain, r);
    queueRender();
  }, signal).then(() => { if (current === mine) queueRender(); });

  // Live state registries: all in parallel, each row fills in as it answers.
  if (analysis.parsed.core) {
    for (const code of LIVE_STATES) {
      searchState(code, analysis.parsed.core, signal).then(r => {
        if (current !== mine) return;
        current.registryResults.set(code, r);
        queueRender();
      }).catch(() => { /* aborted by a newer search */ });
    }
  } else {
    for (const code of LIVE_STATES) current.registryResults.set(code, { state: code, ok: false, error: 'There\'s no name to search for.', matches: [], summary: summarize([]) });
  }
}

/* ------------------------------------------------------------------ */
/* Domain tabs                                                         */
/* ------------------------------------------------------------------ */
function selectTab(tab, { focus = false } = {}) {
  for (const t of document.querySelectorAll('.tabs [role="tab"]')) {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    $(`#${t.getAttribute('aria-controls')}`).hidden = !on;
  }
  if (focus) tab.focus();
  // On click, jump into the empty search box. Keyboard users arrowing through
  // the tabs keep focus on the tab list (ARIA tabs pattern).
  else if (tab.id === 'tab-manual' && !$('#manual-input').value) $('#manual-input').focus();
}

function initTabs() {
  const tabs = [...document.querySelectorAll('.tabs [role="tab"]')];
  for (const t of tabs) {
    t.addEventListener('click', () => selectTab(t));
    t.addEventListener('keydown', e => {
      const i = tabs.indexOf(t);
      const next = { ArrowRight: tabs[(i + 1) % tabs.length], ArrowLeft: tabs[(i - 1 + tabs.length) % tabs.length], Home: tabs[0], End: tabs[tabs.length - 1] }[e.key];
      if (next) { e.preventDefault(); selectTab(next, { focus: true }); }
    });
  }
}

/* ------------------------------------------------------------------ */
/* Manual domain search                                                */
/* ------------------------------------------------------------------ */
let manualController = null;

function manualMessage(text, tone = '') {
  const m = $('#manual-message');
  m.textContent = text;
  if (tone) m.dataset.tone = tone; else delete m.dataset.tone;
}

async function runManual(text) {
  manualController?.abort();
  const controller = new AbortController();
  manualController = controller;
  const { signal } = controller;
  const list = $('#manual-results');
  const button = $('#manual-submit');

  const { items, invalid, duplicates, truncated } = parseDomainList(text);
  if (!items.length && !invalid.length) {
    list.replaceChildren();
    manualMessage('Enter at least one domain, e.g. naam.com', 'error');
    $('#manual-input').focus();
    return;
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    manualMessage('You appear to be offline. Connect to the internet and try again.', 'error');
    return;
  }

  const rows = new Map(); // key → result
  for (const n of items) rows.set(n.domain, { ...n, status: 'pending' });
  invalid.forEach((n, i) => rows.set(`invalid:${i}`, { ...n, status: 'invalid' }));
  const render = () => {
    if (manualController !== controller) return;
    list.replaceChildren(...[...rows.values()].map(r => domainRow(r, { verifyAlways: true })));
  };
  render();

  const extra = [];
  if (duplicates) extra.push(`${duplicates} duplicate${duplicates > 1 ? 's' : ''} skipped`);
  if (truncated) extra.push(`only the first ${MAX_DOMAINS} are checked; ${truncated} skipped`);
  manualMessage(items.length ? `Checking ${items.length} domain${items.length > 1 ? 's' : ''}…${extra.length ? ` (${extra.join('; ')})` : ''}` : 'Nothing valid to check. See the notes below.', items.length ? '' : 'error');
  if (!items.length) return;

  button.disabled = true;
  list.setAttribute('aria-busy', 'true');
  try {
    // Reject extensions that don't exist in the IANA root zone before any lookup.
    const toCheck = [];
    for (const n of items) {
      const exists = await tldExists(n.tld, signal);
      if (signal.aborted) return;
      if (exists === false) {
        rows.set(n.domain, { ...n, status: 'invalid', error: `.${n.tld} isn't a real extension: it's not in the official IANA list of top-level domains.` });
        continue;
      }
      const rdap = await hasRdap(n.tld, signal);
      rows.set(n.domain, { ...rows.get(n.domain), rdap });
      toCheck.push({ ...n, rdap });
    }
    render();
    await checkDomains(toCheck, r => {
      if (signal.aborted) return;
      rows.set(r.domain, { ...rows.get(r.domain), ...r, rdap: r.rdap });
      render();
    }, signal);
    if (signal.aborted) return;
    const vals = [...rows.values()];
    const free = vals.filter(r => r.status === 'available' || r.status === 'likely').length;
    const taken = vals.filter(r => r.status === 'taken').length;
    const unknown = vals.filter(r => r.status === 'unknown').length;
    const bad = vals.filter(r => r.status === 'invalid').length;
    const parts = [`${free} available`, `${taken} taken`];
    if (unknown) parts.push(`${unknown} couldn't be checked`);
    if (bad) parts.push(`${bad} invalid`);
    manualMessage(`Done: ${parts.join(', ')}.${extra.length ? ` (${extra.join('; ')})` : ''} Checked ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`);
  } finally {
    if (manualController === controller) {
      button.disabled = false;
      list.removeAttribute('aria-busy');
    }
  }
}

// "Verify on ICANN Lookup" copies the domain first, because ICANN Lookup
// can't be opened with a domain pre-filled.
function initCopyLinks() {
  document.addEventListener('click', async e => {
    const a = e.target.closest('a[data-copy]');
    if (!a || !a.dataset.copy) return;
    const toast = $('#copy-toast');
    try {
      await navigator.clipboard.writeText(a.dataset.copy);
      toast.textContent = `Copied ${a.dataset.copy}. Paste it into ICANN Lookup's search box.`;
    } catch {
      toast.textContent = `Search for ${a.dataset.copy} in ICANN Lookup's search box.`;
    }
    clearTimeout(initCopyLinks.timer);
    initCopyLinks.timer = setTimeout(() => { toast.textContent = ''; }, 8000);
  });
}

function init() {
  fillSelects();
  loadBootstrap(); // warm the RDAP directory
  loadTldList();   // and the official TLD list
  initTabs();
  initCopyLinks();
  $('#manual-form').addEventListener('submit', e => { e.preventDefault(); runManual($('#manual-input').value); });

  $('#form').addEventListener('submit', e => { e.preventDefault(); run(readForm()); });
  for (const chip of document.querySelectorAll('[data-example]')) {
    chip.addEventListener('click', () => {
      const [name, industry, entity, state] = chip.dataset.example.split('|');
      writeForm({ name, industry, entity, state, opState: '' });
      run(readForm());
    });
  }
  $('#share').addEventListener('click', async () => {
    const url = shareUrl(readForm());
    const status = $('#share-status');
    try {
      await navigator.clipboard.writeText(url);
      status.textContent = 'Link copied';
    } catch {
      status.textContent = url;
    }
    setTimeout(() => { status.textContent = ''; }, 4000);
  });

  const q = new URLSearchParams(location.search);
  if (q.get('n')) {
    writeForm({ name: q.get('n'), industry: q.get('i'), entity: q.get('e'), state: q.get('s'), opState: q.get('o') });
    run(readForm(), { updateUrl: false, scroll: false });
  }
}

init();
