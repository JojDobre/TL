'use strict';

const fsp = require('fs').promises;
const { TIERS, ALL_TIERS, localizeTier } = require('./tiers');
const { routePath } = require('../site/i18n');

const normLang = (l) => (l === 'en' ? 'en' : 'sk');
const { crawlAndScan, quickScan, shortErr } = require('./scanner');
const { renderPdf } = require('./report');
const { UserError } = require('../fetcher');
const { file, load, save, remove, list, PublicError, safeEqual, newId, newToken, ID_RE } = require('./store');
const { stripe, verifyWebhook, PAYMENT_MODE } = require('./stripe');

const RETENTION_DAYS = Number(process.env.RETENTION_DAYS) || 180;
const CONSENT_VERSION = '2026-11';

/* ======================= Háčiky (používa ich predplatné) ======================= */

const hooks = { beforeRender: [], afterDone: [], afterFail: [], webhook: [] };
const on = (name, fn) => hooks[name].push(fn);

/* ======================= Bezplatný náhľad ======================= */

const PREVIEW_FREE_ISSUES = 3;

async function createPreview(url, lang = 'sk') {
  lang = normLang(lang);
  let r;
  try { r = await quickScan(url, lang); } catch (e) {
    if (e instanceof UserError) throw new PublicError(e.message, e.en);
    throw new PublicError(shortErr(e, 'sk') + '.', shortErr(e, 'en') + '.', 502);
  }
  const preview = { id: newId(), lang, createdAt: new Date().toISOString(), url: r.url, host: r.host, result: r };
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
    keyboard: r.keyboard,
    consent: r.consent ? { dismissed: r.consent.dismissed } : null,
    criteria: { fail: r.criteria.filter((c) => c.status === 'fail').length, pass: r.criteria.filter((c) => c.status === 'pass').length, manual: r.criteria.filter((c) => c.status === 'manual').length },
    issues: r.issues.map((i, idx) => (idx < PREVIEW_FREE_ISSUES
      ? { locked: false, title: i.title, impact: i.impact, fix: i.fix, nodeCount: i.nodeCount, custom: i.custom, sc: i.sc.map((s) => ({ id: s.id, name: s.name, level: s.level })) }
      : { locked: true, impact: i.impact })),
    scannedAt: r.scannedAt,
  };
}

async function loadPreview(previewId) {
  if (!ID_RE.test(String(previewId))) throw new PublicError('Neplatný náhľad.', 'Invalid preview.');
  const preview = await load('previews', previewId);
  if (!preview) throw new PublicError('Náhľad vypršal, spustite test znova.', 'The preview has expired, please run the test again.', 410);
  return preview;
}

function requireConsent(body) {
  if (body.consent !== true) throw new PublicError('Pred objednávkou je potrebné súhlasiť s obchodnými podmienkami a so začatím poskytovania služby.', 'Before ordering you must accept the terms of service and agree to the service starting immediately.');
  return { at: new Date().toISOString(), version: CONSENT_VERSION };
}

/* ======================= Jednorazové objednávky ======================= */

function publicOrder(o) {
  return {
    id: o.id, url: o.url, host: o.host, tier: o.tier, tierName: localizeTier(ALL_TIERS[o.tier], o.lang).name, price: o.price, lang: o.lang || 'sk',
    status: o.status, progress: o.progress, error: o.error, demo: o.payment.mode === 'demo',
    kind: o.kind || 'single', subId: o.subId || null,
    createdAt: o.createdAt, finishedAt: o.finishedAt || null,
    summary: o.summary || null,
  };
}

async function createOrder(body, baseUrl) {
  const { previewId, tier } = body;
  if (!TIERS[tier]) throw new PublicError('Neplatný balík.', 'Invalid plan.');
  const preview = await loadPreview(previewId);
  const consent = requireConsent(body);

  const lang = normLang(body.lang || preview.lang);
  const t = localizeTier(TIERS[tier], lang);
  const order = {
    id: newId(),
    token: newToken(),
    lang,
    kind: 'single',
    previewId,
    url: preview.url,
    host: preview.host,
    tier,
    price: t.price,
    status: 'pending_payment',
    payment: { mode: PAYMENT_MODE },
    consent,
    progress: null,
    error: null,
    createdAt: new Date().toISOString(),
  };
  const auditPath = routePath('audit', lang);
  const orderPage = `${baseUrl}${auditPath}?order=${order.id}&token=${order.token}`;

  if (PAYMENT_MODE === 'demo') {
    order.status = 'paid';
    order.payment.paidAt = new Date().toISOString();
    await save('orders', order);
    startJob(order.id);
    return { redirect: orderPage, demo: true };
  }

  const session = await stripe('POST', '/v1/checkout/sessions', {
    mode: 'payment',
    locale: lang,
    'line_items[0][quantity]': 1,
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][unit_amount]': t.price * 100,
    'line_items[0][price_data][product_data][name]': lang === 'en' ? `Accessibility audit – ${t.name}` : `Audit prístupnosti – ${t.name}`,
    'line_items[0][price_data][product_data][description]': lang === 'en'
      ? `${preview.host} · up to ${t.pages} pages · PDF report (EAA / WCAG 2.1 AA)`
      : `${preview.host} · až ${t.pages} podstránok · PDF správa (EAA / WCAG 2.1 AA)`,
    client_reference_id: order.id,
    'metadata[order_id]': order.id,
    'payment_intent_data[metadata][order_id]': order.id,
    success_url: `${orderPage}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}${auditPath}?url=${encodeURIComponent(preview.url)}&canceled=1`,
  });
  order.payment.sessionId = session.id;
  await save('orders', order);
  return { redirect: session.url };
}

async function getOrder(id, token) {
  const o = await load('orders', id);
  if (!o || !safeEqual(o.token, token || '')) throw new PublicError('Objednávka neexistuje.', 'Order not found.', 404);
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

async function retryOrder(id, token, { admin = false } = {}) {
  const o = await load('orders', id);
  if (!o || (!admin && !safeEqual(o.token, token || ''))) throw new PublicError('Objednávka neexistuje.', 'Order not found.', 404);
  if (o.status !== 'failed') throw new PublicError('Objednávku nie je potrebné opakovať.', 'This order does not need to be retried.');
  o.status = 'paid'; o.error = null;
  await save('orders', o);
  startJob(o.id);
  return publicOrder(o);
}

async function getReport(id, token) {
  const o = await load('orders', id);
  if (!o || !safeEqual(o.token, token || '')) throw new PublicError('Objednávka neexistuje.', 'Order not found.', 404);
  if (o.status !== 'done') throw new PublicError('Správa ešte nie je pripravená.', 'The report is not ready yet.', 409);
  const pdf = await fsp.readFile(file('reports', id, 'pdf')).catch(() => null);
  if (!pdf) throw new PublicError('Správa už nie je k dispozícii (uplynula doba uchovávania).', 'The report is no longer available (retention period expired).', 410);
  return { pdf, filename: `${o.lang === 'en' ? 'accessibility-audit' : 'audit-pristupnosti'}-${o.host.replace(/[^a-z0-9.-]/gi, '')}-${o.createdAt.slice(0, 10)}.pdf` };
}

/* ======================= Spracovanie auditu ======================= */

const running = new Set();

async function startJob(id) {
  if (running.has(id)) return;
  running.add(id);
  try {
    let o = await load('orders', id);
    if (!o || !['paid', 'scanning'].includes(o.status)) return;
    const tier = ALL_TIERS[o.tier];
    o.status = 'scanning';
    o.progress = { done: 0, total: tier.pages, url: o.url, phase: 'scan' };
    await save('orders', o);

    let lastSave = 0;
    const audit = await crawlAndScan(o.url, { maxPages: tier.pages, deepPages: tier.deepPages, examples: tier.examples, lang: o.lang || 'sk' }, async (p) => {
      o.progress = { ...p, phase: 'scan' };
      if (Date.now() - lastSave > 1500) { lastSave = Date.now(); await save('orders', o).catch(() => {}); }
    });
    audit.id = o.id;
    for (const fn of hooks.beforeRender) await fn(o, audit);
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
    for (const fn of hooks.afterDone) await fn(o, audit, pdf).catch((e) => console.error('[afterDone]', e));
  } catch (e) {
    console.error('[a11y job]', id, e);
    const o = await load('orders', id);
    if (o) {
      o.status = 'failed'; o.error = shortErr(e, o.lang);
      await save('orders', o);
      for (const fn of hooks.afterFail) await fn(o, e).catch(() => {});
    }
  } finally {
    running.delete(id);
  }
}

/** Po reštarte servera dokončí rozpracované objednávky. */
async function resumeJobs() {
  for (const o of await list('orders')) if (o.status === 'paid' || o.status === 'scanning') startJob(o.id);
}

/* ======================= Uchovávanie dát (GDPR) ======================= */

async function cleanup() {
  const now = Date.now();
  for (const p of await list('previews')) if (now - Date.parse(p.createdAt) > 24 * 3600e3) await remove('previews', p.id);
  for (const o of await list('orders')) {
    if (running.has(o.id) || ['paid', 'scanning'].includes(o.status)) continue;
    const age = now - Date.parse(o.createdAt);
    const stale = o.status === 'pending_payment' ? age > 7 * 864e5 : age > RETENTION_DAYS * 864e5;
    if (!stale) continue;
    await remove('reports', o.id, 'pdf');
    await remove('audits', o.id);
    await remove('orders', o.id);
  }
}

/* ======================= Stripe ======================= */

async function verifyStripeSession(o) {
  const s = await stripe('GET', `/v1/checkout/sessions/${encodeURIComponent(o.payment.sessionId)}`);
  if (s.payment_status === 'paid' && s.metadata?.order_id === o.id && s.amount_total === o.price * 100 && s.currency === 'eur') {
    await markPaid(o.id, { paymentIntent: s.payment_intent, email: s.customer_details?.email || null });
  }
}

async function handleWebhook(rawBody, header) {
  const event = verifyWebhook(rawBody, header);
  const s = event.data?.object || {};
  if ((event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') && s.mode === 'payment') {
    const id = s.metadata?.order_id;
    if (ID_RE.test(String(id)) && s.payment_status === 'paid') {
      const o = await load('orders', id);
      if (o && s.amount_total === o.price * 100 && s.currency === 'eur') {
        await markPaid(id, { paymentIntent: s.payment_intent, email: s.customer_details?.email || null });
      }
    }
  }
  for (const fn of hooks.webhook) await fn(event);
}

module.exports = {
  createPreview, loadPreview, requireConsent, createOrder, getOrder, retryOrder, getReport, publicOrder,
  startJob, resumeJobs, cleanup, handleWebhook, on, PublicError, PAYMENT_MODE,
};
