// Naam — UI wiring.
import { ENTITY_TYPES, INDUSTRIES, STATES } from './data.js';
import { analyzeName, scoreDomains, totalScore, grade, CATEGORY_LABELS } from './scoring.js';
import { checkDomains, registrarLinks, loadBootstrap } from './domains.js';

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
const STATUS_TEXT = { available: 'Available', likely: 'Likely free', taken: 'Taken', unknown: 'Unknown', pending: 'Checking…' };
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
  return [...current.analysis.categories, domainCat];
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
  const pending = [...current.domainResults.values()].some(r => r.status === 'pending');
  $('#partial').hidden = !pending;

  const bars = $('#bars');
  bars.replaceChildren(...cats.map(c => {
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
  wrap.replaceChildren(...cats.filter(c => c.id !== 'domain' || c.checks.length).map(c => {
    const pct = c.score === null ? '…' : `${Math.round(c.score * 100)}%`;
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

function renderDomains() {
  const list = $('#domains');
  const results = [...current.domainResults.values()];
  const row = r => el('li', { class: 'domain' },
    el('span', { class: 'domain-name', text: r.domain }),
    el('span', { class: `status status-${r.status}`, text: STATUS_TEXT[r.status] || r.status }),
    (r.detail || r.status === 'available' || r.status === 'likely')
      ? el('span', { class: 'domain-meta' },
        r.detail ? el('span', { text: r.detail }) : null,
        (r.status === 'available' || r.status === 'likely') ? registrarLinks(r.domain).slice(0, 2).map(l => externalLink(l.url, `${l.label} ↗`)) : null)
      : null);
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

function renderRegistration(a) {
  const { state, opState } = a.input;
  const box = $('#registration');
  const block = code => {
    const s = STATES[code];
    return el('div', { class: 'reg-block' },
      el('h3', { text: s.name }),
      el('a', { class: 'reg-link', href: s.search, target: '_blank', rel: 'noopener noreferrer' }, el('span', {}, `Search ${s.name} business names`, el('br'), el('small', { text: new URL(s.search).hostname })), el('span', { class: 'arrow', text: '↗' })),
      s.tip ? el('p', { text: s.tip }) : null,
      s.reservation ? el('p', { text: s.reservation }) : null,
      el('p', { text: `Search for “${a.registryForm || a.parsed.core}” without the suffix. Registries ignore suffixes, punctuation and “The”.` }));
  };
  const sorted = Object.entries(STATES).sort((x, y) => x[1].name.localeCompare(y[1].name));
  box.replaceChildren(...[
    el('p', { class: 'card-note', text: 'No US state offers an open API to websites, so check availability on the official search. Most states let you reserve a name for 60–120 days for a small fee.' }),
    block(state),
    opState && opState !== state ? block(opState) : null,
    el('details', { class: 'all-states' },
      el('summary', { text: 'All 50 states + DC' }),
      el('ul', { class: 'state-grid' }, sorted.map(([, s]) => el('li', {}, externalLink(s.search, s.name))))),
  ].filter(Boolean));
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
  const steps = [
    `Search ${st.name}'s business registry for “${a.registryForm || a.parsed.core}”${a.input.opState && a.input.opState !== a.input.state ? ` and repeat in ${STATES[a.input.opState].name}` : ''}.`,
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
  requestAnimationFrame(() => { renderQueued = false; renderSummary(); renderDomains(); });
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
  current = { analysis, domainResults: new Map(analysis.domains.map(d => [d.domain, { ...d, status: 'pending' }])) };

  $('#legal-name').textContent = analysis.legalName;
  $('#registry-form').textContent = analysis.registryForm || '—';
  $('#handle').textContent = analysis.categories.find(c => c.id === 'social').handle ? `@${analysis.categories.find(c => c.id === 'social').handle}` : '—';
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
}

function init() {
  fillSelects();
  loadBootstrap(); // warm the RDAP directory

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
