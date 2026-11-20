'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { TIERS } = require('./tiers');
const { crawlAndScan, quickScan, shortErr } = require('./scanner');
const { renderPdf } = require('./report');
const { UserError } = require('../fetcher');

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data'));
const DIRS = { previews: 'previews', orders: 'orders', audits: 'audits', reports: 'reports' };
for (const d of Object.values(DIRS)) fs.mkdirSync(path.join(DATA_DIR, d), { recursive: true });

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const PAYMENT_MODE = STRIPE_KEY ? 'stripe' : 'demo';
if (PAYMENT_MODE === 'demo') console.warn('[a11y] STRIPE_SECRET_KEY nie je nastavený – platby bežia v DEMO režime (bez reálneho platenia).');

/* ======================= Úložisko (JSON súbory) ======================= */

const ID_RE = /^[a-f0-9-]{36}$/;
const file = (dir, id, ext = 'json') => {
  if (!ID_RE.test(id)) throw new Error('bad id');
  return path.join(DATA_DIR, DIRS[dir], `${id}.${ext}`);
};
async function load(dir, id) {
  try { return JSON.parse(await fsp.readFile(file(dir, id), 'utf8')); } catch { return null; }
}
async function save(dir, obj) {
  const f = file(dir, obj.id);
  await fsp.writeFile(f + '.tmp', JSON.stringify(obj));
  await fsp.rename(f + '.tmp', f);
}

class PublicError extends Error {
  constructor(msg, status = 400) { super(msg); this.status = status; }
}

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

/* ======================= Bezplatný náhľad ======================= */

const PREVIEW_FREE_ISSUES = 3;

async function createPreview(url) {
  let r;
  try { r = await quickScan(url); } catch (e) {
    if (e instanceof UserError) throw new PublicError(e.message);
    throw new PublicError(shortErr(e) + '.', 502);
  }
  const preview = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), url: r.url, host: r.host, result: r };
  await save('previews', preview);
  return publicPreview(preview);
}

/** Verzia náhľadu pre klienta – detaily nad rámec ukážky sú zamknuté. */
function publicPreview(p) {
  const r = p.result;
  return {
    id: p.id,
    url: r.url,
    host: r.host,
    title: r.title,
    score: r.score,
    conformance: r.conformance,
    counts: r.counts,
    totalNodes: r.totalNodes,
    discoveredPages: r.discoveredPages,
    principles: r.principles,
    criteria: { fail: r.criteria.filter((c) => c.status === 'fail').length, pass: r.criteria.filter((c) => c.status === 'pass').length, manual: r.criteria.filter((c) => c.status === 'manual').length },
    issues: r.issues.map((i, idx) => (idx < PREVIEW_FREE_ISSUES
      ? { locked: false, title: i.title, impact: i.impact, fix: i.fix, nodeCount: i.nodeCount, sc: i.sc.map((s) => ({ id: s.id, name: s.name, level: s.level })) }
      : { locked: true, impact: i.impact })),
    scannedAt: r.scannedAt,
  };
}

/* ======================= Objednávky ======================= */

function publicOrder(o) {
  return {
    id: o.id, url: o.url, host: o.host, tier: o.tier, tierName: TIERS[o.tier].name, price: o.price,
    status: o.status, progress: o.progress, error: o.error, demo: o.payment.mode === 'demo',
    createdAt: o.createdAt, finishedAt: o.finishedAt || null,
    summary: o.summary || null,
  };
}

async function createOrder({ previewId, tier }, baseUrl) {
  if (!TIERS[tier]) throw new PublicError('Neplatný balík.');
  if (!ID_RE.test(String(previewId))) throw new PublicError('Neplatný náhľad.');
  const preview = await load('previews', previewId);
  if (!preview) throw new PublicError('Náhľad vypršal, spusti test znova.', 410);

  const t = TIERS[tier];
  const order = {
    id: crypto.randomUUID(),
    token: crypto.randomBytes(24).toString('hex'),
    previewId,
    url: preview.url,
    host: preview.host,
    tier,
    price: t.price,
    status: 'pending_payment',
    payment: { mode: PAYMENT_MODE },
    progress: null,
    error: null,
    createdAt: new Date().toISOString(),
  };
  const orderPage = `${baseUrl}/pristupnost.html?order=${order.id}&token=${order.token}`;

  if (PAYMENT_MODE === 'demo') {
    order.status = 'paid';
    order.payment.paidAt = new Date().toISOString();
    await save('orders', order);
    startJob(order.id);
    return { redirect: orderPage, demo: true };
  }

  const session = await stripe('POST', '/v1/checkout/sessions', {
    mode: 'payment',
    locale: 'sk',
    'line_items[0][quantity]': 1,
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][unit_amount]': t.price * 100,
    'line_items[0][price_data][product_data][name]': `Audit prístupnosti – ${t.name}`,
    'line_items[0][price_data][product_data][description]': `${preview.host} · až ${t.pages} podstránok · PDF správa (EAA / WCAG 2.1 AA)`,
    client_reference_id: order.id,
    'metadata[order_id]': order.id,
    'payment_intent_data[metadata][order_id]': order.id,
    success_url: `${orderPage}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/pristupnost.html?url=${encodeURIComponent(preview.url)}&canceled=1`,
  });
  order.payment.sessionId = session.id;
  await save('orders', order);
  return { redirect: session.url };
}

async function getOrder(id, token) {
  if (!ID_RE.test(String(id))) throw new PublicError('Objednávka neexistuje.', 404);
  const o = await load('orders', id);
  if (!o || !safeEqual(o.token, token || '')) throw new PublicError('Objednávka neexistuje.', 404);
  // Ak webhook ešte neprišiel, overíme platbu priamo v Stripe
  if (o.status === 'pending_payment' && o.payment.mode === 'stripe' && o.payment.sessionId) {
    await verifyStripeSession(o).catch((e) => console.error('[stripe verify]', e.message));
  }
  return publicOrder((await load('orders', id)) || o);
}

async function markPaid(orderId, info) {
  const o = await load('orders', orderId);
  if (!o || o.status !== 'pending_payment') return;
  o.status = 'paid';
  o.payment = { ...o.payment, ...info, paidAt: new Date().toISOString() };
  await save('orders', o);
  startJob(o.id);
}

async function retryOrder(id, token) {
  const o = await load('orders', id);
  if (!o || !safeEqual(o.token, token || '')) throw new PublicError('Objednávka neexistuje.', 404);
  if (o.status !== 'failed') throw new PublicError('Objednávku nie je potrebné opakovať.');
  o.status = 'paid'; o.error = null;
  await save('orders', o);
  startJob(o.id);
  return publicOrder(o);
}

async function getReport(id, token) {
  const o = await load('orders', id);
  if (!o || !safeEqual(o.token, token || '')) throw new PublicError('Objednávka neexistuje.', 404);
  if (o.status !== 'done') throw new PublicError('Správa ešte nie je pripravená.', 409);
  return { pdf: await fsp.readFile(file('reports', id, 'pdf')), filename: `audit-pristupnosti-${o.host.replace(/[^a-z0-9.-]/gi, '')}.pdf` };
}

/* ======================= Spracovanie auditu ======================= */

const running = new Set();

async function startJob(id) {
  if (running.has(id)) return;
  running.add(id);
  try {
    let o = await load('orders', id);
    if (!o || !['paid', 'scanning'].includes(o.status)) return;
    const tier = TIERS[o.tier];
    o.status = 'scanning';
    o.progress = { done: 0, total: tier.pages, url: o.url, phase: 'scan' };
    await save('orders', o);

    let lastSave = 0;
    const audit = await crawlAndScan(o.url, tier.pages, async (p) => {
      o.progress = { ...p, phase: 'scan' };
      if (Date.now() - lastSave > 1500) { lastSave = Date.now(); await save('orders', o).catch(() => {}); }
    });
    audit.id = o.id;
    await save('audits', audit);

    o.progress = { done: audit.pages.length, total: audit.pages.length, phase: 'pdf' };
    await save('orders', o);
    const pdf = await renderPdf(audit, o);
    await fsp.writeFile(file('reports', o.id, 'pdf'), pdf);

    o = await load('orders', id);
    o.status = 'done';
    o.finishedAt = new Date().toISOString();
    o.progress = { done: audit.pages.length, total: audit.pages.length, phase: 'done' };
    o.summary = { score: audit.score, conformance: audit.conformance.label, issues: audit.issues.length, pages: audit.pages.length, counts: audit.counts };
    await save('orders', o);
    console.log(`[a11y] hotovo ${o.id} ${o.host} skóre ${audit.score}`);
  } catch (e) {
    console.error('[a11y job]', id, e);
    const o = await load('orders', id);
    if (o) { o.status = 'failed'; o.error = shortErr(e); await save('orders', o); }
  } finally {
    running.delete(id);
  }
}

/** Po reštarte servera dokončí rozpracované objednávky. */
async function resumeJobs() {
  const files = await fsp.readdir(path.join(DATA_DIR, DIRS.orders)).catch(() => []);
  for (const f of files) {
    if (!f.endsWith('.json')) continue;
    const o = await load('orders', f.slice(0, -5));
    if (o && (o.status === 'paid' || o.status === 'scanning')) startJob(o.id);
  }
}

async function cleanupPreviews(maxAgeMs = 24 * 3600 * 1000) {
  const dir = path.join(DATA_DIR, DIRS.previews);
  for (const f of await fsp.readdir(dir).catch(() => [])) {
    const st = await fsp.stat(path.join(dir, f)).catch(() => null);
    if (st && Date.now() - st.mtimeMs > maxAgeMs) await fsp.unlink(path.join(dir, f)).catch(() => {});
  }
}

/* ======================= Stripe ======================= */

async function stripe(method, endpoint, params) {
  const body = params ? new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString() : undefined;
  const res = await fetch('https://api.stripe.com' + endpoint, {
    method,
    headers: { Authorization: `Bearer ${STRIPE_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Stripe-Version': '2024-06-20' },
    body,
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json();
  if (!res.ok) {
    console.error('[stripe]', res.status, data?.error?.message);
    throw new PublicError('Platobnú bránu sa nepodarilo kontaktovať. Skús to prosím znova.', 502);
  }
  return data;
}

async function verifyStripeSession(o) {
  const s = await stripe('GET', `/v1/checkout/sessions/${encodeURIComponent(o.payment.sessionId)}`);
  if (s.payment_status === 'paid' && s.metadata?.order_id === o.id && s.amount_total === o.price * 100 && s.currency === 'eur') {
    await markPaid(o.id, { paymentIntent: s.payment_intent, email: s.customer_details?.email || null });
  }
}

/** Overenie podpisu webhooku (Stripe-Signature: t=…,v1=…). */
function verifyWebhook(rawBody, header) {
  if (!STRIPE_WEBHOOK_SECRET) throw new PublicError('Webhook nie je nakonfigurovaný.', 400);
  const parts = Object.fromEntries(String(header || '').split(',').map((kv) => kv.split('=')).filter((x) => x.length === 2).map(([k, v]) => [k.trim(), v]));
  const sigs = String(header || '').split(',').filter((x) => x.startsWith('v1=')).map((x) => x.slice(3));
  const t = Number(parts.t);
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > 300) throw new PublicError('Neplatný podpis.', 400);
  const expected = crypto.createHmac('sha256', STRIPE_WEBHOOK_SECRET).update(`${t}.${rawBody}`).digest('hex');
  if (!sigs.some((s) => safeEqual(s, expected))) throw new PublicError('Neplatný podpis.', 400);
  return JSON.parse(rawBody);
}

async function handleWebhook(rawBody, header) {
  const event = verifyWebhook(rawBody, header);
  if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
    const s = event.data.object;
    const id = s.metadata?.order_id;
    if (ID_RE.test(String(id)) && s.payment_status === 'paid') {
      const o = await load('orders', id);
      if (o && s.amount_total === o.price * 100 && s.currency === 'eur') {
        await markPaid(id, { paymentIntent: s.payment_intent, email: s.customer_details?.email || null });
      }
    }
  }
}

function config() {
  return {
    paymentMode: PAYMENT_MODE,
    tiers: Object.values(TIERS).map(({ key, name, price, pages, tagline, features, popular }) => ({ key, name, price, pages, tagline, features, popular: !!popular })),
  };
}

module.exports = { createPreview, createOrder, getOrder, retryOrder, getReport, handleWebhook, resumeJobs, cleanupPreviews, config, PublicError };
