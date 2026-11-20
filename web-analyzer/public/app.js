'use strict';

/* ======================= Pomocníci ======================= */

/** Vytvorí element bezpečne (texty cez textContent – dáta z cudzích webov nikdy nejdú do innerHTML). */
function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'vars') for (const [n, val] of Object.entries(v)) el.style.setProperty(n, val);
    else if (k === 'html') el.innerHTML = v; // len pre statické SVG ikony definované nižšie
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
const $ = (s) => document.querySelector(s);

const ICONS = {
  security: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/></svg>',
  seo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  performance: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/></svg>',
  accessibility: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="4.5" r="1.8"/><path d="M5 8.5l7 1.5 7-1.5M12 10v5m0 0-3 6m3-6 3 6"/></svg>',
  social: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>',
  tech: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 6-6 6 6 6M16 6l6 6-6 6"/></svg>',
  bulb: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3Z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  route: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/></svg>',
  server: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
  pass: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M12 6v7M12 18h.01"/></svg>',
  fail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M7 7l10 10M17 7 7 17"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M12 11v6M12 7h.01"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>',
  print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z"/></svg>',
};

const CAT_COLOR = { security: 'var(--c-security)', seo: 'var(--c-seo)', performance: 'var(--c-performance)', accessibility: 'var(--c-accessibility)', social: 'var(--c-social)' };
const STATUS_COLOR = { pass: 'var(--good)', warn: 'var(--ok)', fail: 'var(--bad)', info: 'var(--info)' };
const STATUS_LABEL = { pass: 'OK', warn: 'Upozornenia', fail: 'Chyby', info: 'Info' };

const scoreColor = (s) => (s >= 90 ? 'var(--good)' : s >= 65 ? 'var(--ok)' : s >= 50 ? 'var(--meh)' : 'var(--bad)');
const verdict = (s) => (s >= 90 ? 'Výborný web' : s >= 80 ? 'Veľmi dobrý stav' : s >= 65 ? 'Dobrý základ, je čo zlepšiť' : s >= 50 ? 'Priemer – potrebuje prácu' : 'Vážne nedostatky');
const fmtBytes = (n) => (n == null ? '—' : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`);
const statusCodeColor = (c) => (c < 300 ? 'var(--good)' : c < 400 ? 'var(--ok)' : 'var(--bad)');

function ring(score, size = 190, stroke = 14, cls = 'ring') {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
  const mk = (cl) => {
    const e = document.createElementNS(ns, 'circle');
    e.setAttribute('cx', size / 2); e.setAttribute('cy', size / 2); e.setAttribute('r', r);
    e.setAttribute('fill', 'none'); e.setAttribute('stroke-width', stroke); e.setAttribute('class', cl);
    return e;
  };
  const bar = mk('bar');
  bar.setAttribute('stroke-dasharray', c);
  bar.setAttribute('stroke-dashoffset', c);
  svg.append(mk('track'), bar);
  requestAnimationFrame(() => requestAnimationFrame(() => bar.setAttribute('stroke-dashoffset', c * (1 - score / 100))));
  return h('div', { class: cls, vars: { '--sc': scoreColor(score) } }, svg);
}

function countUp(el, to, dur = 1100) {
  const t0 = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function cardHead(title, icon, color, extra) {
  return h('div', { class: 'card-head' },
    h('h2', { class: 'card-title', vars: color ? { '--c': color } : null }, h('span', { class: 'ico', html: ICONS[icon] }), title),
    extra || null);
}

/* ======================= Téma ======================= */

const root = document.documentElement;
function initTheme() {
  let t = null;
  try { t = localStorage.getItem('wa-theme'); } catch { /* storage nedostupný */ }
  root.dataset.theme = t || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  $('#themeToggle').addEventListener('click', () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('wa-theme', root.dataset.theme); } catch { /* ignore */ }
  });
}

/* ======================= Analýza ======================= */

const LOADER_STEPS = ['Načítavam stránku…', 'Kontrolujem HTTPS a certifikát…', 'Čítam bezpečnostné hlavičky…', 'Analyzujem SEO a obsah…', 'Hľadám robots.txt a sitemap…', 'Detegujem technológie…', 'Počítam skóre…'];
let loaderTimer;

async function run(url, fresh = false) {
  const err = $('#error');
  err.hidden = true;
  $('#results').hidden = true;
  $('#loading').hidden = false;
  $('#hero').classList.add('compact');
  $('#go').disabled = true;
  let i = 0;
  $('#loaderText').textContent = LOADER_STEPS[0];
  clearInterval(loaderTimer);
  loaderTimer = setInterval(() => { i = Math.min(i + 1, LOADER_STEPS.length - 1); $('#loaderText').textContent = LOADER_STEPS[i]; }, 1300);

  try {
    const res = await fetch(`/api/analyze?url=${encodeURIComponent(url)}${fresh ? '&fresh=1' : ''}`);
    const data = await res.json().catch(() => ({ error: 'Neočakávaná odpoveď servera.' }));
    if (!res.ok || data.error) throw new Error(data.error || `Chyba ${res.status}`);
    const q = new URL(location.href);
    q.searchParams.set('url', url);
    history.replaceState(null, '', q);
    render(data);
  } catch (e) {
    $('#loading').hidden = true;
    $('#hero').classList.remove('compact');
    err.textContent = e.message || 'Analýza zlyhala.';
    err.hidden = false;
  } finally {
    clearInterval(loaderTimer);
    $('#go').disabled = false;
  }
}

/* ======================= Render ======================= */

function render(d) {
  const out = $('#results');
  out.replaceChildren();
  const o = d.overview;
  const cats = d.categories;

  if (o.status >= 400) {
    out.append(h('div', { class: 'notice' }, `Web vrátil HTTP ${o.status}. Môže blokovať automatické požiadavky (ochrana proti botom), preto výsledky nemusia zodpovedať tomu, čo vidí bežný návštevník.`));
  }

  /* --- 1. Celkové skóre --- */
  const num = h('div', { class: 'ring-num' }, '0');
  const scoreRing = ring(d.overall);
  scoreRing.append(h('div', { class: 'ring-label' }, num, h('div', { class: 'ring-of' }, 'zo 100')));
  countUp(num, d.overall);
  out.append(h('article', { class: 'card span-4 row-2 score-card', vars: { '--sc': scoreColor(d.overall) } },
    scoreRing,
    h('div', { class: 'grade' }, `Známka ${d.grade}`),
    h('p', { class: 'verdict' }, verdict(d.overall)),
    h('div', { class: 'score-url' }, d.url),
    h('div', { class: 'score-actions' },
      h('button', { class: 'ghost-btn', type: 'button', html: ICONS.refresh + '<span>Znova</span>', onclick: () => run(d.inputUrl, true) }),
      h('button', { class: 'ghost-btn', type: 'button', html: ICONS.share + '<span>Kopírovať odkaz</span>', onclick: (e) => copyLink(e.currentTarget) }),
      h('button', { class: 'ghost-btn', type: 'button', html: ICONS.print + '<span>Tlačiť</span>', onclick: () => window.print() }),
    ),
  ));

  /* --- 2. Náhľad vo vyhľadávaní --- */
  const fav = o.favicon ? h('img', { src: o.favicon, alt: '', referrerpolicy: 'no-referrer', loading: 'lazy' }) : null;
  const favFallback = h('div', { class: 'fav-fallback' }, (o.host[0] || '?').toUpperCase());
  if (fav) fav.addEventListener('error', () => fav.replaceWith(favFallback));
  const ogImg = h('div', { class: 'og-img' }, o.ogImage ? '' : 'bez obrázka');
  if (o.ogImage) {
    const probe = new Image();
    probe.referrerPolicy = 'no-referrer';
    probe.onload = () => ogImg.style.setProperty('background-image', `url("${o.ogImage.replace(/["\\\n\r()]/g, encodeURIComponent)}")`);
    probe.onerror = () => { ogImg.textContent = 'nedá sa načítať'; };
    probe.src = o.ogImage;
  }
  out.append(h('article', { class: 'card span-5 row-2' },
    cardHead('Náhľad vo vyhľadávaní', 'eye', 'var(--c-seo)'),
    h('div', { class: 'site-id' }, fav || favFallback,
      h('div', {}, h('div', { class: 'host' }, o.host), h('div', { class: 'sub' }, [o.ip, o.server].filter(Boolean).join(' · ') || '—'))),
    h('div', { class: 'serp' },
      h('div', { class: 'serp-url' }, d.url.replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/\//g, ' › ')),
      h('div', { class: 'serp-title' + (o.title ? '' : ' serp-missing') }, o.title || 'Chýba titulok stránky'),
      h('div', { class: 'serp-desc' + (o.description ? '' : ' serp-missing') }, o.description || 'Chýba meta popis – Google si vyberie text sám.'),
    ),
    h('div', { class: 'og' }, ogImg,
      h('div', { class: 'sub' }, h('b', {}, 'Zdieľanie na sociálnych sieťach'), h('br'), o.ogImage ? 'Obrázok og:image je nastavený.' : 'Chýba og:image – zdieľaný odkaz bude bez náhľadu.')),
  ));

  /* --- 3. Rýchle metriky --- */
  const stat = (k, v, small, color) => h('div', { class: 'stat' }, h('div', { class: 'k' }, k),
    h('div', { class: 'v' }, color ? h('span', { class: 'dot', vars: { '--dc': color } }) : null, v, small ? h('small', {}, small) : null));
  out.append(h('article', { class: 'card span-3 row-2' },
    h('div', { class: 'stats' },
      stat('Odozva (TTFB)', o.ttfb, 'ms', o.ttfb < 600 ? 'var(--good)' : o.ttfb < 1500 ? 'var(--ok)' : 'var(--bad)'),
      stat('HTTP status', o.status, null, statusCodeColor(o.status)),
      stat('Veľkosť HTML', fmtBytes(o.htmlBytes)),
      stat('Kompresia', o.compression || 'žiadna', null, o.compression ? 'var(--good)' : 'var(--bad)'),
      stat('Skripty', o.scripts),
      stat('Obrázky', o.images),
    )));

  /* --- 4. Kategórie --- */
  const catWrap = h('div', { class: 'cats' });
  for (const [key, c] of Object.entries(cats)) {
    const counts = { pass: 0, warn: 0, fail: 0 };
    c.checks.forEach((x) => { if (counts[x.status] != null) counts[x.status]++; });
    const meterBar = h('i');
    requestAnimationFrame(() => requestAnimationFrame(() => { meterBar.style.width = c.score + '%'; }));
    catWrap.append(h('button', {
      class: 'card cat', type: 'button', 'data-cat': key, vars: { '--c': CAT_COLOR[key], '--sc': scoreColor(c.score) },
      onclick: () => { selectTab(key); $('#checksCard').scrollIntoView({ behavior: 'smooth', block: 'start' }); },
    },
    h('div', { class: 'cat-top' }, h('span', { class: 'cat-name' }, c.title), h('span', { class: 'card-title' }, h('span', { class: 'ico', html: ICONS[key] }))),
    h('div', { class: 'cat-score' }, String(c.score), h('small', {}, ' /100')),
    h('div', { class: 'meter' }, meterBar),
    h('div', { class: 'cat-counts' },
      h('span', {}, h('span', { class: 'dot', vars: { '--dc': 'var(--good)' } }), counts.pass),
      h('span', {}, h('span', { class: 'dot', vars: { '--dc': 'var(--ok)' } }), counts.warn),
      h('span', {}, h('span', { class: 'dot', vars: { '--dc': 'var(--bad)' } }), counts.fail)),
    ));
  }
  out.append(catWrap);

  /* --- 5. Odporúčania --- */
  out.append(h('article', { class: 'card span-7 row-2' },
    cardHead('Najdôležitejšie odporúčania', 'bulb', 'var(--ok)', h('span', { class: 'chip' }, `${d.recommendations.length} úloh`)),
    d.recommendations.length
      ? h('ol', { class: 'recs' }, d.recommendations.map((r) => h('li', { class: 'rec', vars: { '--sev': STATUS_COLOR[r.status], '--c': CAT_COLOR[r.cat] } },
        h('span', { class: 'sev', html: ICONS[r.status] }),
        h('div', {}, h('div', { class: 'tag' }, r.catTitle), h('b', {}, r.label), h('p', {}, r.fix)))))
      : h('p', { class: 'empty' }, 'Bez výhrad – skvelá práca! 🎉'),
  ));

  /* --- 6. Technológie --- */
  const groups = {};
  d.tech.forEach((t) => (groups[t.category] ||= []).push(t.name));
  out.append(h('article', { class: 'card span-5' },
    cardHead('Použité technológie', 'tech', 'var(--accent)', h('span', { class: 'chip' }, String(d.tech.length))),
    d.tech.length
      ? h('div', { class: 'tech-groups' }, Object.entries(groups).map(([g, names]) => h('div', { class: 'tech-group' },
        h('div', { class: 'k' }, g), h('div', { class: 'chips' }, names.map((n) => h('span', { class: 'chip' }, n))))))
      : h('p', { class: 'sub' }, 'Nepodarilo sa rozpoznať žiadne známe technológie.'),
  ));

  /* --- 7. Obsah --- */
  out.append(h('article', { class: 'card span-5' },
    cardHead('Obsah stránky', 'doc', 'var(--c-seo)'),
    h('dl', { class: 'kv' },
      h('dt', {}, 'Počet slov'), h('dd', {}, o.words.toLocaleString('sk-SK')),
      h('dt', {}, 'Interné odkazy'), h('dd', {}, o.links.internal),
      h('dt', {}, 'Externé odkazy'), h('dd', {}, o.links.external),
      h('dt', {}, 'CSS súbory'), h('dd', {}, o.stylesheets),
      h('dt', {}, 'Jazyk'), h('dd', {}, o.lang || '—'),
      h('dt', {}, 'Typ obsahu'), h('dd', { class: 'mono' }, o.contentType || '—'),
    )));

  /* --- 8. Certifikát --- */
  const cert = d.certificate;
  out.append(h('article', { class: 'card span-4' },
    cardHead('SSL certifikát', 'lock', 'var(--c-security)', cert ? h('span', { class: 'chip' }, h('span', { class: 'dot', vars: { '--dc': cert.authorized && cert.daysLeft > 14 ? 'var(--good)' : cert.daysLeft > 0 && cert.authorized ? 'var(--ok)' : 'var(--bad)' } }), cert.authorized ? 'Platný' : 'Problém') : null),
    cert
      ? h('dl', { class: 'kv' },
        h('dt', {}, 'Vydavateľ'), h('dd', {}, cert.issuer || '—'),
        h('dt', {}, 'Pre'), h('dd', {}, cert.subject || '—'),
        h('dt', {}, 'Platný do'), h('dd', {}, new Date(cert.validTo).toLocaleDateString('sk-SK')),
        h('dt', {}, 'Zostáva'), h('dd', {}, `${cert.daysLeft} dní`),
        h('dt', {}, 'Protokol'), h('dd', {}, cert.protocol || '—'))
      : h('p', { class: 'sub' }, d.url.startsWith('https') ? 'Detaily certifikátu sa nepodarilo získať.' : 'Web nepoužíva HTTPS.'),
  ));

  /* --- 9. Presmerovania --- */
  out.append(h('article', { class: 'card span-4' },
    cardHead('Cesta požiadavky', 'route', 'var(--c-performance)', h('span', { class: 'chip' }, `${d.redirects.length - 1} presm.`)),
    h('div', { class: 'chain' }, d.redirects.map((r) => h('div', { class: 'hop', vars: { '--hc': statusCodeColor(r.status) } },
      h('span', { class: 'code' }, r.status), h('span', { class: 'u mono', title: r.url }, r.url)))),
  ));

  /* --- 10. Server --- */
  out.append(h('article', { class: 'card span-4' },
    cardHead('Server', 'server', 'var(--c-accessibility)'),
    h('dl', { class: 'kv' },
      h('dt', {}, 'IP adresa'), h('dd', { class: 'mono' }, o.ip || '—'),
      h('dt', {}, 'Softvér'), h('dd', {}, o.server || 'skrytý'),
      h('dt', {}, 'Celkový čas'), h('dd', {}, `${o.totalTime} ms`),
      h('dt', {}, 'Trvanie auditu'), h('dd', {}, `${(d.durationMs / 1000).toFixed(1)} s`),
      h('dt', {}, 'Analyzované'), h('dd', {}, new Date(d.analyzedAt).toLocaleString('sk-SK') + (d.cached ? ' (cache)' : ''))),
  ));

  /* --- 11. Detailné kontroly --- */
  out.append(checksCard(cats));

  /* --- 12. HTTP hlavičky --- */
  out.append(h('article', { class: 'card span-12' },
    cardHead('HTTP hlavičky odpovede', 'list', 'var(--info)', h('span', { class: 'chip' }, String(d.headers.length))),
    h('div', { class: 'headers' }, h('table', {}, h('tbody', {}, d.headers.map((x) => h('tr', {}, h('td', { class: 'mono' }, x.name), h('td', { class: 'mono' }, x.value))))))));

  $('#loading').hidden = true;
  out.hidden = false;
  selectTab(state.tab in cats ? state.tab : 'security');
}

/* ---------- karta s detailnými kontrolami (taby + filter) ---------- */

const state = { tab: 'security', filter: 'all', cats: null };

function checksCard(cats) {
  state.cats = cats;
  const tabs = h('div', { class: 'tabs', role: 'tablist' }, Object.entries(cats).map(([k, c]) =>
    h('button', { class: 'tab', role: 'tab', type: 'button', 'data-tab': k, vars: { '--c': CAT_COLOR[k] }, onclick: () => selectTab(k) },
      c.title, h('span', { class: 'n' }, c.score))));
  const filters = h('div', { class: 'filters' }, ['all', 'fail', 'warn', 'pass'].map((f) =>
    h('button', { type: 'button', 'data-filter': f, 'aria-pressed': String(state.filter === f), onclick: () => { state.filter = f; drawChecks(); } },
      f === 'all' ? 'Všetko' : STATUS_LABEL[f])));
  return h('article', { class: 'card span-12', id: 'checksCard' },
    cardHead('Detailné kontroly', 'list', 'var(--accent)', filters),
    tabs,
    h('div', { class: 'checks', id: 'checks', role: 'tabpanel' }));
}

function selectTab(k) {
  state.tab = k;
  document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === k)));
  document.querySelectorAll('.cat').forEach((t) => t.classList.toggle('active', t.dataset.cat === k));
  drawChecks();
}

function drawChecks() {
  document.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === state.filter)));
  const order = { fail: 0, warn: 1, pass: 2, info: 3 };
  const list = state.cats[state.tab].checks
    .filter((c) => state.filter === 'all' || c.status === state.filter)
    .sort((a, b) => order[a.status] - order[b.status] || b.weight - a.weight);
  const box = $('#checks');
  box.replaceChildren(...(list.length ? list.map((c) =>
    h('details', { class: 'check' },
      h('summary', {},
        h('span', { class: 'st', vars: { '--stc': STATUS_COLOR[c.status] }, html: ICONS[c.status], 'aria-label': STATUS_LABEL[c.status] }),
        h('span', { class: 'lbl' }, c.label),
        c.value ? h('span', { class: 'val' }, c.value) : null),
      h('div', { class: 'body' },
        c.detail ? h('p', {}, c.detail) : null,
        c.fix && c.status !== 'pass' ? h('p', { class: 'fix' }, '💡 ', c.fix) : null,
        !c.detail && !(c.fix && c.status !== 'pass') ? h('p', {}, 'Bez ďalších detailov.') : null)))
    : [h('p', { class: 'empty' }, 'V tejto kategórii nie sú žiadne položky s týmto stavom.')]));
}

async function copyLink(btn) {
  try {
    await navigator.clipboard.writeText(location.href);
    const span = btn.querySelector('span');
    span.textContent = 'Skopírované!';
    setTimeout(() => { span.textContent = 'Kopírovať odkaz'; }, 1800);
  } catch { prompt('Skopíruj odkaz:', location.href); }
}

/* ======================= Init ======================= */

initTheme();
$('#form').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('#url').value.trim();
  if (v) run(v);
});
document.querySelectorAll('[data-ex]').forEach((b) => b.addEventListener('click', () => { $('#url').value = b.dataset.ex; run(b.dataset.ex); }));

const initial = new URLSearchParams(location.search).get('url');
if (initial) { $('#url').value = initial; run(initial); }
