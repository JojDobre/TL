'use strict';

/* ======================= Pomocníci ======================= */

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'vars') for (const [n, val] of Object.entries(v)) el.style.setProperty(n, val);
    else if (k === 'html') el.innerHTML = v; // len statické ikony
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
const $ = (s) => document.querySelector(s);
const { t, tp, locale: LOCALE, lang: LANG, routes: ROUTES } = window.I18N;

const IMPACT_COLOR = { critical: '#dc2626', serious: 'var(--bad)', moderate: 'var(--ok)', minor: 'var(--info)' };
const IMPACT = Object.fromEntries(Object.entries(IMPACT_COLOR).map(([k, color]) => [k, { label: t('impact')[k], color }]));
const PRINCIPLE_ICON = { 1: '👁', 2: '⌨', 3: '💡', 4: '⚙' };
const scoreColor = (s) => (s >= 90 ? 'var(--good)' : s >= 65 ? 'var(--ok)' : s >= 50 ? 'var(--meh)' : 'var(--bad)');

function ring(score, size = 180, stroke = 14) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  svg.setAttribute('aria-hidden', 'true');
  const mk = (cl) => {
    const e = document.createElementNS(ns, 'circle');
    for (const [k, v] of Object.entries({ cx: size / 2, cy: size / 2, r, fill: 'none', 'stroke-width': stroke, class: cl })) e.setAttribute(k, v);
    return e;
  };
  const bar = mk('bar');
  bar.setAttribute('stroke-dasharray', c);
  bar.setAttribute('stroke-dashoffset', c);
  svg.append(mk('track'), bar);
  requestAnimationFrame(() => requestAnimationFrame(() => bar.setAttribute('stroke-dashoffset', c * (1 - score / 100))));
  const num = h('div', { class: 'ring-num' }, String(score));
  return h('div', { class: 'ring', vars: { '--sc': scoreColor(score) }, role: 'img', 'aria-label': t('scoreAria', { n: score }) },
    svg, h('div', { class: 'ring-label' }, num, h('div', { class: 'ring-of' }, t('of100'))));
}

async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  const data = await res.json().catch(() => ({ error: t('badResponse') }));
  if (!res.ok || data.error) throw new Error(data.error || t('errorStatus', { n: res.status }));
  return data;
}

function showError(msg) {
  const e = $('#error');
  e.textContent = msg;
  e.hidden = !msg;
}

/* ======================= Stav ======================= */

const state = { config: null, preview: null };

/* ======================= Cenník ======================= */

function renderTiers() {
  const ready = !!state.preview;
  document.querySelectorAll('#tiers [data-tier]').forEach((b) => { b.textContent = ready ? t('orderFor', { n: b.dataset.price }) : t('testFirst'); });
  const mb = $('#tiers [data-monitor]');
  if (mb) mb.textContent = ready ? t('subscribeFor', { n: mb.dataset.price }) : t('testFirst');
  $('#demoBanner').hidden = !state.config || state.config.paymentMode !== 'demo';
}

function bindTiers() {
  document.querySelectorAll('#tiers [data-tier]').forEach((b) => b.addEventListener('click', () => buy(b.dataset.tier, b)));
  const form = $('#monitorForm');
  if (form) form.addEventListener('submit', (e) => { e.preventDefault(); subscribe(form.querySelector('button')); });
}

function consentOk() {
  const c = $('#consent');
  if (c.checked) { $('#consentBox').classList.remove('invalid'); return true; }
  $('#consentBox').classList.add('invalid');
  c.focus();
  return false;
}

function needPreview() {
  if (state.preview) return false;
  $('#url').focus();
  $('#hero').scrollIntoView({ behavior: 'smooth' });
  showError(t('needPreview'));
  return true;
}

async function withButton(btn, fn) {
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = t('redirecting');
  try { await fn(); } catch (e) {
    btn.disabled = false;
    btn.textContent = label;
    alert(e.message);
  }
}

async function buy(tier, btn) {
  if (needPreview() || !consentOk()) return;
  await withButton(btn, async () => {
    const r = await api('/api/a11y/checkout', { method: 'POST', body: JSON.stringify({ previewId: state.preview.id, tier, consent: true, lang: LANG }) });
    location.href = r.redirect;
  });
}

async function subscribe(btn) {
  if (needPreview()) return;
  const email = $('#subEmail');
  if (!email.checkValidity()) { email.reportValidity(); return; }
  if (!consentOk()) return;
  await withButton(btn, async () => {
    const r = await api('/api/a11y/subscribe', { method: 'POST', body: JSON.stringify({ previewId: state.preview.id, email: email.value, consent: true, lang: LANG }) });
    location.href = r.redirect;
  });
}

/* ======================= Bezplatný test ======================= */

const STEPS = t('loader');
let timer;

async function runPreview(url) {
  showError('');
  $('#preview').hidden = true;
  $('#info').hidden = true;
  $('#loading').hidden = false;
  $('#hero').classList.add('compact');
  $('#go').disabled = true;
  let i = 0;
  $('#loaderText').textContent = STEPS[0];
  clearInterval(timer);
  timer = setInterval(() => { i = Math.min(i + 1, STEPS.length - 1); $('#loaderText').textContent = STEPS[i]; }, 1800);
  try {
    state.preview = await api('/api/a11y/preview', { method: 'POST', body: JSON.stringify({ url, lang: LANG }) });
    const q = new URL(location.href);
    q.search = '';
    q.searchParams.set('url', url);
    history.replaceState(null, '', q);
    renderPreview(state.preview);
    renderTiers();
  } catch (e) {
    $('#loading').hidden = true;
    $('#info').hidden = false;
    $('#hero').classList.remove('compact');
    showError(e.message);
  } finally {
    clearInterval(timer);
    $('#go').disabled = false;
  }
}

function renderPreview(p) {
  const out = $('#preview');
  out.replaceChildren();
  const statusColor = p.conformance.key === 'fail' ? 'var(--bad)' : p.conformance.key === 'partial' ? 'var(--ok)' : 'var(--good)';
  const total = p.counts.critical + p.counts.serious + p.counts.moderate + p.counts.minor;

  // 1. Skóre
  out.append(h('article', { class: 'card span-4 row-2 score-card', vars: { '--sc': scoreColor(p.score) } },
    ring(p.score),
    h('div', { class: 'grade', vars: { '--sc': statusColor } }, p.conformance.label),
    h('p', { class: 'score-url' }, p.host),
    h('p', { class: 'sub center' }, t('homepageTest'), h('b', {}, tp('pagesFound', p.discoveredPages)), t('pagesFoundTail')),
    p.keyboard ? h('p', { class: 'sub center small' }, t('kbdInfo', { n: p.keyboard.tabStops }) + (p.consent?.dismissed ? t('cookieTested') : '')) : null,
  ));

  // 2. Závažnosť
  out.append(h('article', { class: 'card span-8' },
    h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, h('span', { class: 'ico', 'aria-hidden': 'true' }, '!'), t('issuesFound')),
      h('span', { class: 'chip' }, tp('occurrences', p.totalNodes))),
    h('p', { class: 'verdict-text' }, p.conformance.text),
    h('div', { class: 'sev-grid' }, Object.entries(IMPACT).map(([k, v]) => h('div', { class: 'sev-tile' + (p.counts[k] ? '' : ' zero'), vars: { '--sev': v.color } },
      h('b', {}, String(p.counts[k])), h('span', {}, v.label)))),
  ));

  // 3. Princípy
  out.append(h('article', { class: 'card span-8' },
    h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, h('span', { class: 'ico', 'aria-hidden': 'true' }, '◎'), t('principles')),
      h('span', { class: 'chip' }, tp('criteriaFailed', p.criteria.fail))),
    h('div', { class: 'principle-grid' }, Object.entries(p.principles).map(([k, pr]) => h('div', { class: 'principle ' + (pr.issues ? 'bad' : 'good') },
      h('span', { class: 'p-ico', 'aria-hidden': 'true' }, PRINCIPLE_ICON[k]),
      h('b', {}, pr.name),
      h('span', {}, pr.issues ? tp('problems', pr.issues) : t('noErrors'))))),
  ));

  // 4. Zoznam problémov (časť zamknutá)
  const locked = p.issues.filter((i) => i.locked).length;
  out.append(h('article', { class: 'card span-12' },
    h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, h('span', { class: 'ico', 'aria-hidden': 'true' }, '≡'), t('sample')),
      h('span', { class: 'chip' }, tp('issueTypes', p.issues.length))),
    total ? h('ul', { class: 'issue-list' }, p.issues.map((i) => i.locked
      ? h('li', { class: 'issue-row locked', vars: { '--sev': IMPACT[i.impact].color }, 'aria-label': t('lockedAria') },
        h('span', { class: 'sev-pill' }, IMPACT[i.impact].label),
        h('div', { class: 'blur', 'aria-hidden': 'true' }, h('b', {}, t('lockedTitle')), h('p', {}, t('lockedText'))),
        h('span', { class: 'lock', 'aria-hidden': 'true' }, '🔒'))
      : h('li', { class: 'issue-row', vars: { '--sev': IMPACT[i.impact].color } },
        h('span', { class: 'sev-pill' }, IMPACT[i.impact].label),
        h('div', {},
          h('b', {}, i.title),
          h('div', { class: 'tags' }, i.sc.map((s) => h('span', { class: 'chip' }, `WCAG ${s.id} · ${s.level}`)), h('span', { class: 'chip' }, t('onPage', { n: i.nodeCount })), i.custom ? h('span', { class: 'chip chip-accent' }, t('simulated')) : null),
          h('p', {}, i.fix)))))
      : h('p', { class: 'empty' }, t('noIssues')),
    h('div', { class: 'unlock' },
      h('div', {},
        h('b', {}, locked ? tp('locked', locked) : t('getFull')),
        h('p', { class: 'sub' }, t('fullText'))),
      h('a', { class: 'cta', href: '#pricing' }, t('showPlans'))),
  ));

  $('#loading').hidden = true;
  out.hidden = false;
}

/* ======================= Objednávka ======================= */

let pollTimer;
async function showOrder(id, token) {
  $('#hero').hidden = true;
  $('#info').hidden = true;
  $('#pricing').hidden = true;
  const out = $('#order');
  out.hidden = false;
  out.replaceChildren(h('article', { class: 'card span-12 skel short' }, h('div', { class: 'loader-ring' })));

  const tick = async () => {
    try {
      const o = await api(`/api/a11y/orders/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`);
      renderOrder(o, id, token);
      if (['pending_payment', 'paid', 'scanning'].includes(o.status)) pollTimer = setTimeout(tick, o.status === 'pending_payment' ? 2500 : 1500);
    } catch (e) {
      out.replaceChildren(h('article', { class: 'card span-12' }, h('p', { class: 'error' }, e.message), h('a', { class: 'cta', href: ROUTES.audit }, t('backToTest'))));
    }
  };
  tick();
}

function renderOrder(o, id, token) {
  const out = $('#order');
  const p = o.progress || {};
  const steps = [
    [t('stepPay'), o.status !== 'pending_payment'],
    [`${t('stepScan')}${p.phase === 'scan' && p.total ? ` (${p.done}/${p.total})` : ''}`, ['done'].includes(o.status) || p.phase === 'pdf'],
    [t('stepPdf'), o.status === 'done'],
  ];
  const current = steps.findIndex((s) => !s[1]);
  const pct = o.status === 'done' ? 100 : o.status === 'pending_payment' ? 5 : p.phase === 'pdf' ? 92 : p.total ? 10 + Math.round((p.done / p.total) * 80) : 10;
  const reportUrl = `/api/a11y/orders/${encodeURIComponent(id)}/report.pdf?token=${encodeURIComponent(token)}`;

  const title = t('orderTitle')[o.status === 'scanning' && p.phase === 'pdf' ? 'pdf' : o.status];

  const main = h('article', { class: 'card span-8 order-card' },
    h('div', { class: 'card-head' },
      h('h2', { class: 'card-title' }, h('span', { class: 'ico', 'aria-hidden': 'true' }, o.status === 'done' ? '✓' : o.status === 'failed' ? '!' : '…'), title),
      h('span', { class: 'chip' }, `${o.tierName} · ${o.price} €`, o.demo ? ' · DEMO' : '')),
    h('p', { class: 'sub' }, o.url),
    h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct), 'aria-label': t('progressAria') },
      h('i', { vars: { '--w': pct + '%' } })),
    h('ol', { class: 'order-steps' }, steps.map(([label, done], idx) => h('li', { class: done ? 'done' : idx === current && o.status !== 'failed' ? 'active' : '' },
      h('span', { 'aria-hidden': 'true' }, done ? '✓' : String(idx + 1)), label))),
    p.phase === 'scan' && p.url && o.status === 'scanning' ? h('p', { class: 'sub mono small ellipsis' }, t('now'), p.url) : null,
    o.status === 'failed' ? h('div', {},
      h('p', { class: 'error' }, o.error || t('unknownError')),
      h('button', { class: 'cta', type: 'button', onclick: async () => { await api(`/api/a11y/orders/${id}/retry?token=${encodeURIComponent(token)}`, { method: 'POST' }); showOrder(id, token); } }, t('retry'))) : null,
    o.status === 'done' ? h('div', { class: 'download' },
      h('a', { class: 'cta big', href: reportUrl, download: '' }, t('download')),
      h('a', { class: 'ghost-btn', href: reportUrl + '&inline=1', target: '_blank', rel: 'noopener' }, t('openInBrowser'))) : null,
  );

  const side = h('article', { class: 'card span-4' },
    o.summary
      ? h('div', { class: 'score-card plain' }, ring(o.summary.score, 150, 12),
        h('div', { class: 'grade', vars: { '--sc': scoreColor(o.summary.score) } }, o.summary.conformance),
        h('p', { class: 'sub center' }, `${tp('pagesFound', o.summary.pages)} · ${tp('issueTypes', o.summary.issues)}`))
      : h('div', {},
        h('h3', { class: 'card-title' }, t('saveLink')),
        h('p', { class: 'sub' }, t('saveLinkText')),
        h('button', { class: 'ghost-btn', type: 'button', onclick: (e) => { navigator.clipboard?.writeText(location.href); e.currentTarget.textContent = t('copied'); } }, t('copyLink'))),
  );

  out.replaceChildren(main, side);
}

/* ======================= Predplatné ======================= */

const SUB_COLOR = { pending_payment: 'var(--ok)', active: 'var(--good)', past_due: 'var(--bad)', canceled: 'var(--info)' };
const fmtDate = (d) => new Date(d).toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', year: 'numeric' });

let subTimer;
async function showSubscription(id, token) {
  $('#hero').hidden = true;
  $('#info').hidden = true;
  $('#pricing').hidden = true;
  const out = $('#order');
  out.hidden = false;
  out.replaceChildren(h('article', { class: 'card span-12 skel short' }, h('div', { class: 'loader-ring' })));
  const tick = async () => {
    clearTimeout(subTimer);
    try {
      const sub = await api(`/api/a11y/subscriptions/${encodeURIComponent(id)}?token=${encodeURIComponent(token)}`);
      renderSubscription(sub, id, token);
      if (sub.status === 'pending_payment' || sub.runs.some((r) => r.status === 'running')) subTimer = setTimeout(tick, 4000);
    } catch (e) {
      out.replaceChildren(h('article', { class: 'card span-12' }, h('p', { class: 'error' }, e.message)));
    }
  };
  tick();
}

function renderSubscription(sub, id, token) {
  const out = $('#order');
  const label = t('subStatus')[sub.status] || sub.status, color = SUB_COLOR[sub.status] || 'var(--info)';
  const latest = sub.runs.find((r) => r.status === 'done');
  const q = `?token=${encodeURIComponent(token)}`;

  const actions = h('div', { class: 'download' },
    sub.status !== 'canceled' && !sub.demo ? h('button', { class: 'cta', type: 'button', onclick: async (e) => {
      e.currentTarget.disabled = true;
      try { location.href = (await api(`/api/a11y/subscriptions/${id}/portal${q}`, { method: 'POST' })).redirect; } catch (err) { alert(err.message); e.currentTarget.disabled = false; }
    } }, t('manage')) : null,
    sub.status !== 'canceled' && sub.demo ? h('button', { class: 'ghost-btn', type: 'button', onclick: async () => {
      if (!confirm(t('cancelConfirm'))) return;
      await api(`/api/a11y/subscriptions/${id}/cancel${q}`, { method: 'POST' });
      showSubscription(id, token);
    } }, t('cancelSub')) : null,
    h('button', { class: 'ghost-btn', type: 'button', onclick: (e) => { navigator.clipboard?.writeText(location.href); e.currentTarget.textContent = t('pageCopied'); } }, t('copyPage')));

  const main = h('article', { class: 'card span-8' },
    h('div', { class: 'card-head' },
      h('h2', { class: 'card-title' }, h('span', { class: 'ico', 'aria-hidden': 'true' }, '↻'), t('monitoring')),
      h('span', { class: 'chip' }, h('span', { class: 'dot', vars: { '--dc': color } }), label, sub.demo ? ' · DEMO' : '')),
    h('p', { class: 'sub' }, sub.url),
    h('dl', { class: 'kv' },
      h('dt', {}, t('email')), h('dd', {}, sub.email),
      h('dt', {}, t('price')), h('dd', {}, t('perMonth', { n: sub.price })),
      h('dt', {}, t('nextRun')), h('dd', {}, sub.nextRunAt ? fmtDate(sub.nextRunAt) : '—'),
      h('dt', {}, t('since')), h('dd', {}, fmtDate(sub.createdAt))),
    sub.mailMode === 'outbox' ? h('p', { class: 'demo-banner left' }, t('outbox')) : null,
    sub.status === 'pending_payment' ? h('p', { class: 'sub' }, t('waitingPayment')) : null,
    actions);

  const side = h('article', { class: 'card span-4' },
    latest
      ? h('div', { class: 'score-card plain' }, ring(latest.score, 150, 12),
        h('p', { class: 'sub center' }, t('lastAudit', { n: fmtDate(latest.date) })),
        latest.delta != null ? h('div', { class: 'grade', vars: { '--sc': latest.delta >= 0 ? 'var(--good)' : 'var(--bad)' } }, t('vsLast', { n: `${latest.delta > 0 ? '+' : ''}${latest.delta}` })) : null)
      : h('div', {}, h('h3', { class: 'card-title' }, t('firstAudit')), h('p', { class: 'sub' }, sub.status === 'active' ? t('firstRunning') : t('firstAfterPay'))));

  const history = h('article', { class: 'card span-12' },
    h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, h('span', { class: 'ico', 'aria-hidden': 'true' }, '≡'), t('history')), h('span', { class: 'chip' }, String(sub.runs.length))),
    sub.runs.length ? h('ul', { class: 'issue-list' }, sub.runs.map((r) => h('li', { class: 'issue-row run-row' },
      h('span', { class: 'sev-pill', vars: { '--sev': r.status === 'done' ? scoreColor(r.score) : r.status === 'failed' ? 'var(--bad)' : 'var(--accent)' } },
        r.status === 'done' ? String(r.score) : r.status === 'failed' ? t('runError') : t('runRunning')),
      h('div', { class: 'run-main' },
        h('b', {}, fmtDate(r.date)),
        h('p', {}, r.status === 'done'
          ? [r.delta != null ? t('scoreChange', { n: `${r.delta > 0 ? '+' : ''}${r.delta}` }) : t('firstAudit'), r.fixedIssues != null ? t('fixedNew', { f: r.fixedIssues, n: r.newIssues }) : '', r.emailed ? t('emailed') : ''].join('')
          : r.status === 'failed' ? t('runFailed') : t('runInProgress'))),
      r.reportUrl ? h('a', { class: 'ghost-btn', href: r.reportUrl, download: '' }, '⬇ PDF') : h('a', { class: 'ghost-btn', href: r.statusUrl }, t('detail')))))
      : h('p', { class: 'empty' }, t('noRuns')));

  out.replaceChildren(main, side, history);
}

/* ======================= Init ======================= */

$('#form').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('#url').value.trim();
  if (v) runPreview(v);
});

(async () => {
  bindTiers();
  try { state.config = await api(`/api/a11y/config?lang=${LANG}`); } catch { state.config = { paymentMode: 'demo' }; }
  renderTiers();
  const q = new URLSearchParams(location.search);
  if (q.get('order') && q.get('token')) return showOrder(q.get('order'), q.get('token'));
  if (q.get('sub') && q.get('token')) return showSubscription(q.get('sub'), q.get('token'));
  if (q.get('url')) { $('#url').value = q.get('url'); await runPreview(q.get('url')); }
  if (q.get('canceled')) showError(t('canceled'));
})();
