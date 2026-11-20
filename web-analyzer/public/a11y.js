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

const IMPACT = {
  critical: { label: 'Kritické', color: '#dc2626' },
  serious: { label: 'Závažné', color: 'var(--bad)' },
  moderate: { label: 'Stredné', color: 'var(--ok)' },
  minor: { label: 'Nízke', color: 'var(--info)' },
};
const PRINCIPLE_ICON = { 1: '👁', 2: '⌨', 3: '💡', 4: '⚙' };
const scoreColor = (s) => (s >= 90 ? 'var(--good)' : s >= 65 ? 'var(--ok)' : s >= 50 ? 'var(--meh)' : 'var(--bad)');
const plural = (n, one, few, many) => (n === 1 ? one : n >= 2 && n <= 4 ? few : many);

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
  return h('div', { class: 'ring', vars: { '--sc': scoreColor(score) }, role: 'img', 'aria-label': `Skóre prístupnosti ${score} zo 100` },
    svg, h('div', { class: 'ring-label' }, num, h('div', { class: 'ring-of' }, 'zo 100')));
}

async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  const data = await res.json().catch(() => ({ error: 'Neočakávaná odpoveď servera.' }));
  if (!res.ok || data.error) throw new Error(data.error || `Chyba ${res.status}`);
  return data;
}

function showError(msg) {
  const e = $('#error');
  e.textContent = msg;
  e.hidden = !msg;
}

/* ======================= Téma ======================= */

(function initTheme() {
  const root = document.documentElement;
  let t = null;
  try { t = localStorage.getItem('wa-theme'); } catch { /* ignore */ }
  root.dataset.theme = t || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  $('#themeToggle').addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('wa-theme', root.dataset.theme); } catch { /* ignore */ }
  });
})();

/* ======================= Stav ======================= */

const state = { config: null, preview: null };

/* ======================= Cenník ======================= */

function renderTiers() {
  const box = $('#tiers');
  box.replaceChildren(...state.config.tiers.map((t) => h('article', { class: 'card price-card' + (t.popular ? ' popular' : '') },
    t.popular ? h('span', { class: 'popular-tag' }, 'Najobľúbenejší') : null,
    h('h3', {}, t.name),
    h('p', { class: 'sub' }, t.tagline),
    h('div', { class: 'price' }, h('b', {}, `${t.price} €`), h('span', {}, ' jednorazovo')),
    h('ul', { class: 'ticks' }, t.features.map((f) => h('li', {}, f))),
    h('button', { class: 'buy' + (t.popular ? ' primary' : ''), type: 'button', 'data-tier': t.key, onclick: (e) => buy(t.key, e.currentTarget) },
      state.preview ? `Objednať za ${t.price} €` : 'Najprv otestuj web'),
  )));
  $('#demoBanner').hidden = state.config.paymentMode !== 'demo';
}

async function buy(tier, btn) {
  if (!state.preview) {
    $('#url').focus();
    $('#hero').scrollIntoView({ behavior: 'smooth' });
    showError('Najprv zadaj adresu webu a spusti bezplatný test.');
    return;
  }
  const label = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Presmerúvam na platbu…';
  try {
    const r = await api('/api/a11y/checkout', { method: 'POST', body: JSON.stringify({ previewId: state.preview.id, tier }) });
    location.href = r.redirect;
  } catch (e) {
    btn.disabled = false;
    btn.textContent = label;
    alert(e.message);
  }
}

/* ======================= Bezplatný test ======================= */

const STEPS = ['Otváram stránku v prehliadači…', 'Čakám na vykreslenie obsahu…', 'Kontrolujem kontrast farieb…', 'Overujem formuláre a tlačidlá…', 'Testujem ARIA atribúty…', 'Mapujem na WCAG a EN 301 549…'];
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
    state.preview = await api('/api/a11y/preview', { method: 'POST', body: JSON.stringify({ url }) });
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
    h('p', { class: 'sub center' }, 'Test úvodnej stránky · ', h('b', {}, `${p.discoveredPages} ${plural(p.discoveredPages, 'podstránka', 'podstránky', 'podstránok')}`), ' nájdených na ďalší audit'),
  ));

  // 2. Závažnosť
  out.append(h('article', { class: 'card span-8' },
    h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, h('span', { class: 'ico', 'aria-hidden': 'true' }, '!'), 'Zistené problémy'),
      h('span', { class: 'chip' }, `${p.totalNodes} ${plural(p.totalNodes, 'výskyt', 'výskyty', 'výskytov')}`)),
    h('p', { class: 'verdict-text' }, p.conformance.text),
    h('div', { class: 'sev-grid' }, Object.entries(IMPACT).map(([k, v]) => h('div', { class: 'sev-tile' + (p.counts[k] ? '' : ' zero'), vars: { '--sev': v.color } },
      h('b', {}, String(p.counts[k])), h('span', {}, v.label)))),
  ));

  // 3. Princípy
  out.append(h('article', { class: 'card span-8' },
    h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, h('span', { class: 'ico', 'aria-hidden': 'true' }, '◎'), 'Princípy WCAG'),
      h('span', { class: 'chip' }, `${p.criteria.fail} ${plural(p.criteria.fail, 'kritérium porušené', 'kritériá porušené', 'kritérií porušených')}`)),
    h('div', { class: 'principle-grid' }, Object.entries(p.principles).map(([k, pr]) => h('div', { class: 'principle ' + (pr.issues ? 'bad' : 'good') },
      h('span', { class: 'p-ico', 'aria-hidden': 'true' }, PRINCIPLE_ICON[k]),
      h('b', {}, pr.name),
      h('span', {}, pr.issues ? `${pr.issues} ${plural(pr.issues, 'problém', 'problémy', 'problémov')}` : 'Bez chýb')))),
  ));

  // 4. Zoznam problémov (časť zamknutá)
  const locked = p.issues.filter((i) => i.locked).length;
  out.append(h('article', { class: 'card span-12' },
    h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, h('span', { class: 'ico', 'aria-hidden': 'true' }, '≡'), 'Ukážka nálezov'),
      h('span', { class: 'chip' }, `${p.issues.length} ${plural(p.issues.length, 'typ', 'typy', 'typov')} problémov`)),
    total ? h('ul', { class: 'issue-list' }, p.issues.map((i) => i.locked
      ? h('li', { class: 'issue-row locked', vars: { '--sev': IMPACT[i.impact].color }, 'aria-label': 'Zamknutý nález – dostupný v plnej správe' },
        h('span', { class: 'sev-pill' }, IMPACT[i.impact].label),
        h('div', { class: 'blur', 'aria-hidden': 'true' }, h('b', {}, 'Názov problému je skrytý v ukážke'), h('p', {}, 'Podrobný popis, dotknuté prvky a postup opravy nájdete v PDF správe.')),
        h('span', { class: 'lock', 'aria-hidden': 'true' }, '🔒'))
      : h('li', { class: 'issue-row', vars: { '--sev': IMPACT[i.impact].color } },
        h('span', { class: 'sev-pill' }, IMPACT[i.impact].label),
        h('div', {},
          h('b', {}, i.title),
          h('div', { class: 'tags' }, i.sc.map((s) => h('span', { class: 'chip' }, `WCAG ${s.id} · ${s.level}`)), h('span', { class: 'chip' }, `${i.nodeCount}× na stránke`)),
          h('p', {}, i.fix)))))
      : h('p', { class: 'empty' }, 'Automatický test úvodnej stránky nenašiel žiadne chyby. 🎉 Plný audit preverí ďalšie podstránky a pripraví podklady pre manuálne testovanie a vyhlásenie o prístupnosti.'),
    h('div', { class: 'unlock' },
      h('div', {},
        h('b', {}, locked ? `${locked} ${plural(locked, 'ďalší nález je zamknutý', 'ďalšie nálezy sú zamknuté', 'ďalších nálezov je zamknutých')}` : 'Získaj kompletný audit celého webu'),
        h('p', { class: 'sub' }, `Plná správa preverí až 40 podstránok, ukáže presné miesta v kóde a postup opravy.`)),
      h('a', { class: 'cta', href: '#pricing' }, 'Zobraziť balíky →')),
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
      out.replaceChildren(h('article', { class: 'card span-12' }, h('p', { class: 'error' }, e.message), h('a', { class: 'cta', href: '/pristupnost.html' }, 'Späť na test')));
    }
  };
  tick();
}

function renderOrder(o, id, token) {
  const out = $('#order');
  const p = o.progress || {};
  const steps = [
    ['Platba', o.status !== 'pending_payment'],
    [`Skenovanie podstránok${p.phase === 'scan' && p.total ? ` (${p.done}/${p.total})` : ''}`, ['done'].includes(o.status) || p.phase === 'pdf'],
    ['Generovanie PDF správy', o.status === 'done'],
  ];
  const current = steps.findIndex((s) => !s[1]);
  const pct = o.status === 'done' ? 100 : o.status === 'pending_payment' ? 5 : p.phase === 'pdf' ? 92 : p.total ? 10 + Math.round((p.done / p.total) * 80) : 10;
  const reportUrl = `/api/a11y/orders/${encodeURIComponent(id)}/report.pdf?token=${encodeURIComponent(token)}`;

  const title = {
    pending_payment: 'Čakáme na potvrdenie platby…',
    paid: 'Platba prijatá, spúšťame audit…',
    scanning: p.phase === 'pdf' ? 'Pripravujeme PDF správu…' : 'Prebieha audit webu…',
    done: 'Správa je pripravená',
    failed: 'Audit sa nepodarilo dokončiť',
  }[o.status];

  const main = h('article', { class: 'card span-8 order-card' },
    h('div', { class: 'card-head' },
      h('h2', { class: 'card-title' }, h('span', { class: 'ico', 'aria-hidden': 'true' }, o.status === 'done' ? '✓' : o.status === 'failed' ? '!' : '…'), title),
      h('span', { class: 'chip' }, `${o.tierName} · ${o.price} €`, o.demo ? ' · DEMO' : '')),
    h('p', { class: 'sub' }, o.url),
    h('div', { class: 'progress', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pct), 'aria-label': 'Priebeh auditu' },
      h('i', { vars: { '--w': pct + '%' } })),
    h('ol', { class: 'order-steps' }, steps.map(([label, done], idx) => h('li', { class: done ? 'done' : idx === current && o.status !== 'failed' ? 'active' : '' },
      h('span', { 'aria-hidden': 'true' }, done ? '✓' : String(idx + 1)), label))),
    p.phase === 'scan' && p.url && o.status === 'scanning' ? h('p', { class: 'sub mono small ellipsis' }, 'Práve: ', p.url) : null,
    o.status === 'failed' ? h('div', {},
      h('p', { class: 'error' }, o.error || 'Neznáma chyba.'),
      h('button', { class: 'cta', type: 'button', onclick: async () => { await api(`/api/a11y/orders/${id}/retry?token=${encodeURIComponent(token)}`, { method: 'POST' }); showOrder(id, token); } }, 'Skúsiť znova')) : null,
    o.status === 'done' ? h('div', { class: 'download' },
      h('a', { class: 'cta big', href: reportUrl, download: '' }, '⬇ Stiahnuť PDF správu'),
      h('a', { class: 'ghost-btn', href: reportUrl + '&inline=1', target: '_blank', rel: 'noopener' }, 'Otvoriť v prehliadači')) : null,
  );

  const side = h('article', { class: 'card span-4' },
    o.summary
      ? h('div', { class: 'score-card plain' }, ring(o.summary.score, 150, 12),
        h('div', { class: 'grade', vars: { '--sc': scoreColor(o.summary.score) } }, o.summary.conformance),
        h('p', { class: 'sub center' }, `${o.summary.pages} ${plural(o.summary.pages, 'podstránka', 'podstránky', 'podstránok')} · ${o.summary.issues} ${plural(o.summary.issues, 'typ', 'typy', 'typov')} problémov`))
      : h('div', {},
        h('h3', { class: 'card-title' }, 'Ulož si tento odkaz'),
        h('p', { class: 'sub' }, 'Správa je dostupná na tejto adrese. Odkaz obsahuje tajný kľúč, nezdieľaj ho verejne.'),
        h('button', { class: 'ghost-btn', type: 'button', onclick: (e) => { navigator.clipboard?.writeText(location.href); e.currentTarget.textContent = 'Skopírované ✓'; } }, 'Kopírovať odkaz')),
  );

  out.replaceChildren(main, side);
}

/* ======================= Init ======================= */

$('#form').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('#url').value.trim();
  if (v) runPreview(v);
});

(async () => {
  try { state.config = await api('/api/a11y/config'); } catch { state.config = { tiers: [], paymentMode: 'demo' }; }
  renderTiers();
  const q = new URLSearchParams(location.search);
  if (q.get('order') && q.get('token')) return showOrder(q.get('order'), q.get('token'));
  if (q.get('url')) { $('#url').value = q.get('url'); await runPreview(q.get('url')); }
  if (q.get('canceled')) showError('Platba bola zrušená. Môžeš si vybrať iný balík alebo to skúsiť znova.');
})();
