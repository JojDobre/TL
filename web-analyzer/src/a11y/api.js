'use strict';

const orders = require('./orders');
const subs = require('./subscriptions');
const { TIERS, MONITORING, localizeTier } = require('./tiers');
const { list, load, save, PublicError, safeEqual } = require('./store');
const { PAYMENT_MODE } = require('./stripe');
const { MAIL_MODE } = require('./mailer');
const { routePath } = require('../site/i18n');

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
if (ADMIN_TOKEN && ADMIN_TOKEN.length < 24) console.warn('[admin] ADMIN_TOKEN je príliš krátky – použi aspoň 24 náhodných znakov.');

/* ---------- pomocné ---------- */

function sendJson(res, status, data, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(JSON.stringify(data));
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new PublicError('Príliš veľká požiadavka.', 'Request too large.', 413)); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
const readJson = async (req) => JSON.parse((await readBody(req, 8 * 1024)) || '{}');

function baseUrl(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/+$/, '');
  const proto = process.env.TRUST_PROXY && req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  return `${proto}://${req.headers.host || 'localhost'}`;
}

function config(lang) {
  const pick = (t) => { const { key, name, price, pages, tagline, features, popular, interval } = localizeTier(t, lang); return { key, name, price, pages, tagline, features, popular: !!popular, interval: interval || null }; };
  return { paymentMode: PAYMENT_MODE, mailMode: MAIL_MODE, tiers: Object.values(TIERS).map(pick), monitoring: pick(MONITORING) };
}

/* ---------- admin ---------- */

function isAdmin(req) {
  const h = String(req.headers.authorization || '');
  return ADMIN_TOKEN && h.startsWith('Bearer ') && safeEqual(h.slice(7), ADMIN_TOKEN);
}

async function adminOverview() {
  const all = (await list('orders')).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const allSubs = (await list('subscriptions')).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const single = all.filter((o) => o.kind !== 'monitor');
  const paidReal = single.filter((o) => o.payment.mode === 'stripe' && ['paid', 'scanning', 'done', 'failed'].includes(o.status));
  const byStatus = {};
  for (const o of all) byStatus[o.status] = (byStatus[o.status] || 0) + 1;
  const done = all.filter((o) => o.summary);
  const activeSubs = allSubs.filter((s) => s.status === 'active');
  const month = new Date().toISOString().slice(0, 7);
  return {
    paymentMode: PAYMENT_MODE,
    mailMode: MAIL_MODE,
    stats: {
      orders: single.length,
      revenue: paidReal.reduce((s, o) => s + o.price, 0),
      revenueMonth: paidReal.filter((o) => o.createdAt.startsWith(month)).reduce((s, o) => s + o.price, 0),
      demoOrders: single.filter((o) => o.payment.mode === 'demo').length,
      byStatus,
      avgScore: done.length ? Math.round(done.reduce((s, o) => s + o.summary.score, 0) / done.length) : null,
      activeSubs: activeSubs.length,
      mrr: activeSubs.reduce((s, x) => s + x.price, 0),
      failed: all.filter((o) => o.status === 'failed').length,
    },
    orders: all.slice(0, 300).map((o) => ({
      ...orders.publicOrder(o),
      email: o.payment.email || null,
      paymentMode: o.payment.mode,
      reportUrl: o.status === 'done' ? `/api/a11y/orders/${o.id}/report.pdf?token=${o.token}` : null,
      statusUrl: `${routePath('audit', o.lang)}?order=${o.id}&token=${o.token}`,
    })),
    subscriptions: allSubs.map((s) => ({ ...subs.publicSub(s), email: s.email, pageUrl: `${routePath('audit', s.lang)}?sub=${s.id}&token=${s.token}`, cancelAtPeriodEnd: !!s.cancelAtPeriodEnd })),
  };
}

/* ---------- router ---------- */

/**
 * Vráti true, ak požiadavku obslúžil. `limit(key, max)` = rate limit zo servera.
 */
async function handle(req, res, url, limit) {
  const p = url.pathname;
  const ip = req.socket.remoteAddress || 'unknown';
  let lang = url.searchParams.get('lang') === 'en' ? 'en' : 'sk';
  const L = (sk, en) => (lang === 'en' ? en : sk);
  if (!p.startsWith('/api/a11y/') && !p.startsWith('/api/admin/') && p !== '/api/stripe/webhook') return false;
  try {
    if (p === '/api/a11y/config' && req.method === 'GET') return sendJson(res, 200, config(lang)), true;

    if (p === '/api/a11y/preview' && req.method === 'POST') {
      if (limit('pv:' + ip, 6)) return sendJson(res, 429, { error: L('Príliš veľa testov. Skúste to o minútu znova.', 'Too many tests. Please try again in a minute.') }), true;
      const body = await readJson(req);
      lang = body.lang === 'en' ? 'en' : 'sk';
      return sendJson(res, 200, await orders.createPreview(body.url, lang)), true;
    }
    if (p === '/api/a11y/checkout' && req.method === 'POST') {
      if (limit('co:' + ip, 10)) return sendJson(res, 429, { error: L('Príliš veľa požiadaviek.', 'Too many requests.') }), true;
      const body = await readJson(req);
      lang = body.lang === 'en' ? 'en' : 'sk';
      return sendJson(res, 200, await orders.createOrder(body, baseUrl(req))), true;
    }
    if (p === '/api/a11y/subscribe' && req.method === 'POST') {
      if (limit('co:' + ip, 10)) return sendJson(res, 429, { error: L('Príliš veľa požiadaviek.', 'Too many requests.') }), true;
      const body = await readJson(req);
      lang = body.lang === 'en' ? 'en' : 'sk';
      return sendJson(res, 200, await subs.createSubscription(body, baseUrl(req))), true;
    }
    if (p === '/api/stripe/webhook' && req.method === 'POST') {
      await orders.handleWebhook(await readBody(req, 1024 * 1024), req.headers['stripe-signature']);
      return sendJson(res, 200, { received: true }), true;
    }

    let m = /^\/api\/a11y\/orders\/([a-f0-9-]{36})(\/report\.pdf|\/retry)?$/.exec(p);
    if (m) {
      const token = url.searchParams.get('token');
      if (!m[2] && req.method === 'GET') return sendJson(res, 200, await orders.getOrder(m[1], token)), true;
      if (m[2] === '/retry' && req.method === 'POST') return sendJson(res, 200, await orders.retryOrder(m[1], token)), true;
      if (m[2] === '/report.pdf' && req.method === 'GET') {
        const { pdf, filename } = await orders.getReport(m[1], token);
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `${url.searchParams.get('inline') ? 'inline' : 'attachment'}; filename="${filename}"`,
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end(pdf);
        return true;
      }
    }

    m = /^\/api\/a11y\/subscriptions\/([a-f0-9-]{36})(\/portal|\/cancel)?$/.exec(p);
    if (m) {
      const token = url.searchParams.get('token');
      if (!m[2] && req.method === 'GET') return sendJson(res, 200, await subs.getSubscription(m[1], token)), true;
      if (m[2] === '/portal' && req.method === 'POST') return sendJson(res, 200, await subs.portal(m[1], token, baseUrl(req))), true;
      if (m[2] === '/cancel' && req.method === 'POST') return sendJson(res, 200, await subs.cancel(m[1], token)), true;
    }

    /* ---- admin ---- */
    if (p.startsWith('/api/admin/')) {
      if (!ADMIN_TOKEN) return sendJson(res, 404, { error: 'Nenájdené.' }), true;
      if (limit('adm:' + ip, 60)) return sendJson(res, 429, { error: 'Príliš veľa požiadaviek.' }), true;
      if (!isAdmin(req)) {
        if (limit('admfail:' + ip, 5)) return sendJson(res, 429, { error: 'Príliš veľa neúspešných pokusov.' }), true;
        return sendJson(res, 401, { error: 'Neplatný prístupový kľúč.' }), true;
      }
      if (p === '/api/admin/overview' && req.method === 'GET') return sendJson(res, 200, await adminOverview()), true;
      m = /^\/api\/admin\/orders\/([a-f0-9-]{36})\/retry$/.exec(p);
      if (m && req.method === 'POST') return sendJson(res, 200, await orders.retryOrder(m[1], null, { admin: true })), true;
      m = /^\/api\/admin\/subscriptions\/([a-f0-9-]{36})\/(run|cancel)$/.exec(p);
      if (m && req.method === 'POST') {
        if (m[2] === 'run') {
          const id = await subs.startRun(m[1]);
          if (!id) throw new PublicError('Audit sa nedá spustiť (predplatné nie je aktívne alebo už audit beží).', 'The audit cannot start (subscription inactive or an audit is already running).', 409);
          return sendJson(res, 200, { orderId: id }), true;
        }
        return sendJson(res, 200, await subs.cancel(m[1], null, { admin: true })), true;
      }
    }

    sendJson(res, 404, { error: 'Nenájdené.' });
    return true;
  } catch (e) {
    if (e instanceof PublicError) return sendJson(res, e.status, { error: e.text(lang) }), true;
    if (e instanceof SyntaxError) return sendJson(res, 400, { error: L('Neplatný JSON.', 'Invalid JSON.') }), true;
    console.error('[api]', e);
    sendJson(res, 500, { error: L('Interná chyba servera.', 'Internal server error.') });
    return true;
  }
}

function start() {
  orders.resumeJobs().catch((e) => console.error('[resume]', e));
  subs.startScheduler();
  orders.cleanup().catch(() => {});
  setInterval(() => orders.cleanup().catch(() => {}), 3600e3).unref();
}

module.exports = { handle, start, config };
