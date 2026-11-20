'use strict';

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'vars') for (const [n, val] of Object.entries(v)) el.style.setProperty(n, val);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
const $ = (s) => document.querySelector(s);

let token = '';
try { token = sessionStorage.getItem('wa-admin') || ''; } catch { /* ignore */ }

async function api(path, opts = {}) {
  const res = await fetch(path, { ...opts, headers: { authorization: `Bearer ${token}`, ...(opts.headers || {}) } });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { logout(); throw new Error(data.error || 'Neplatný kľúč.'); }
  if (!res.ok) throw new Error(data.error || `Chyba ${res.status}`);
  return data;
}

function logout() {
  token = '';
  try { sessionStorage.removeItem('wa-admin'); } catch { /* ignore */ }
  $('#dash').hidden = true;
  $('#logout').hidden = true;
  $('#login').hidden = false;
}

const STATUS = {
  pending_payment: ['Čaká na platbu', 'var(--ok)'], paid: ['Zaplatené', 'var(--accent)'], scanning: ['Prebieha', 'var(--accent)'],
  done: ['Hotovo', 'var(--good)'], failed: ['Chyba', 'var(--bad)'], active: ['Aktívne', 'var(--good)'],
  past_due: ['Neuhradené', 'var(--bad)'], canceled: ['Zrušené', 'var(--info)'],
};
const pill = (s) => { const [l, c] = STATUS[s] || [s, 'var(--info)']; return h('span', { class: 'status-pill', vars: { '--sc': c } }, l); };
const dt = (d) => (d ? new Date(d).toLocaleString('sk-SK', { day: 'numeric', month: 'numeric', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const action = (label, fn) => h('button', { class: 'ghost-btn', type: 'button', onclick: async (e) => {
  e.currentTarget.disabled = true;
  try { await fn(); await load(); } catch (err) { alert(err.message); e.currentTarget.disabled = false; }
} }, label);

let refresh;
async function load() {
  clearTimeout(refresh);
  const d = await api('/api/admin/overview');
  const s = d.stats;
  const stat = (k, v, sub) => h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v), sub ? h('div', { class: 'sub small' }, sub) : null);

  const out = $('#dash');
  out.replaceChildren(
    h('article', { class: 'card span-12' },
      h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, 'Prehľad'),
        h('span', { class: 'chip' }, `Platby: ${d.paymentMode === 'demo' ? 'DEMO' : 'Stripe'} · E-maily: ${d.mailMode === 'outbox' ? 'outbox (neodosielajú sa)' : 'Resend'}`)),
      h('div', { class: 'stat-grid' },
        stat('Tržby celkom', `${s.revenue} €`, `tento mesiac ${s.revenueMonth} €`),
        stat('Jednorazové objednávky', s.orders, s.demoOrders ? `z toho demo ${s.demoOrders}` : null),
        stat('Aktívne predplatné', s.activeSubs, `MRR ${s.mrr} €`),
        stat('Neúspešné audity', s.failed, s.avgScore != null ? `priemerné skóre ${s.avgScore}` : null))),

    h('article', { class: 'card span-12' },
      h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, 'Predplatné'), h('span', { class: 'chip' }, String(d.subscriptions.length))),
      d.subscriptions.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'admin-table' },
        h('thead', {}, h('tr', {}, ['Web', 'E-mail', 'Stav', 'Audity', 'Posledné skóre', 'Ďalší audit', 'Vytvorené', ''].map((t) => h('th', {}, t)))),
        h('tbody', {}, d.subscriptions.map((x) => {
          const last = x.runs.find((r) => r.status === 'done');
          return h('tr', {},
            h('td', { class: 'url', title: x.url }, x.host),
            h('td', {}, x.email),
            h('td', {}, pill(x.status), x.cancelAtPeriodEnd ? h('span', { class: 'sub small' }, ' · končí') : null, x.demo ? h('span', { class: 'sub small' }, ' · demo') : null),
            h('td', {}, String(x.runs.length)),
            h('td', {}, last ? String(last.score) : '—'),
            h('td', {}, dt(x.nextRunAt)),
            h('td', {}, dt(x.createdAt)),
            h('td', {}, h('a', { class: 'ghost-btn', href: x.pageUrl, target: '_blank', rel: 'noopener' }, 'Stránka'), ' ',
              x.status === 'active' ? action('Spustiť audit', () => api(`/api/admin/subscriptions/${x.id}/run`, { method: 'POST' })) : null, ' ',
              x.status !== 'canceled' ? action('Zrušiť', async () => { if (!confirm(`Zrušiť predplatné ${x.host}?`)) throw new Error('Zrušené používateľom'); await api(`/api/admin/subscriptions/${x.id}/cancel`, { method: 'POST' }); }) : null));
        })))) : h('p', { class: 'empty' }, 'Zatiaľ žiadne predplatné.')),

    h('article', { class: 'card span-12' },
      h('div', { class: 'card-head' }, h('h2', { class: 'card-title' }, 'Audity a objednávky'), h('span', { class: 'chip' }, String(d.orders.length))),
      d.orders.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'admin-table' },
        h('thead', {}, h('tr', {}, ['Vytvorené', 'Web', 'Typ', 'Cena', 'Stav', 'Skóre', 'E-mail', ''].map((t) => h('th', {}, t)))),
        h('tbody', {}, d.orders.map((o) => h('tr', {},
          h('td', {}, dt(o.createdAt)),
          h('td', { class: 'url', title: o.url }, o.host),
          h('td', {}, o.kind === 'monitor' ? 'Monitoring' : o.tierName),
          h('td', {}, o.kind === 'monitor' ? '—' : `${o.price} €${o.paymentMode === 'demo' ? ' (demo)' : ''}`),
          h('td', {}, pill(o.status), o.error ? h('div', { class: 'sub small' }, o.error) : null),
          h('td', {}, o.summary ? String(o.summary.score) : '—'),
          h('td', {}, o.email || '—'),
          h('td', {},
            o.reportUrl ? h('a', { class: 'ghost-btn', href: o.reportUrl + '&inline=1', target: '_blank', rel: 'noopener' }, 'PDF') : null, ' ',
            h('a', { class: 'ghost-btn', href: o.statusUrl, target: '_blank', rel: 'noopener' }, 'Detail'), ' ',
            o.status === 'failed' ? action('Zopakovať', () => api(`/api/admin/orders/${o.id}/retry`, { method: 'POST' })) : null)))))) : h('p', { class: 'empty' }, 'Zatiaľ žiadne objednávky.')),
  );
  out.hidden = false;
  $('#login').hidden = true;
  $('#logout').hidden = false;
  refresh = setTimeout(() => load().catch(() => {}), 20000);
}

$('#login').addEventListener('submit', async (e) => {
  e.preventDefault();
  token = $('#token').value.trim();
  try {
    await load();
    try { sessionStorage.setItem('wa-admin', token); } catch { /* ignore */ }
    $('#loginError').hidden = true;
  } catch (err) {
    $('#login').hidden = false;
    $('#loginError').textContent = err.message;
    $('#loginError').hidden = false;
  }
});
$('#logout').addEventListener('click', (e) => { e.preventDefault(); logout(); });

if (token) load().catch(() => logout()); else $('#login').hidden = false;
