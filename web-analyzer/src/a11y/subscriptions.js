'use strict';

/*
 * Predplatné „Monitoring“: mesačný audit, porovnanie s predchádzajúcim
 * a PDF správa e-mailom. E-maily sa posielajú výhradne pri predplatnom.
 */

const fs = require('fs');
const { MONITORING } = require('./tiers');
const { load, save, list, file, PublicError, safeEqual, newId, newToken } = require('./store');
const { stripe, PAYMENT_MODE } = require('./stripe');
const { sendMail, MAIL_MODE } = require('./mailer');
const orders = require('./orders');
const { compareAudits } = require('./scanner');

const PUBLIC_URL = () => (process.env.PUBLIC_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, '');
const EMAIL_RE = /^[^\s@<>"]{1,64}@[^\s@<>"]{1,190}\.[a-z]{2,24}$/i;
const MAX_RUNS_KEPT = 24;

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const maskEmail = (e) => String(e || '').replace(/^(.).*?(.)?@/, (m, a, b) => `${a}${'•'.repeat(3)}${b || ''}@`);
const addMonth = (d) => { const x = new Date(d); x.setMonth(x.getMonth() + 1); return x.toISOString(); };
const subPage = (sub, base = PUBLIC_URL()) => `${base}/pristupnost.html?sub=${sub.id}&token=${sub.token}`;

/* ======================= Verejný pohľad ======================= */

function publicSub(sub) {
  return {
    id: sub.id,
    url: sub.url,
    host: sub.host,
    email: maskEmail(sub.email),
    status: sub.status,
    price: sub.price,
    demo: sub.payment.mode === 'demo',
    mailMode: MAIL_MODE,
    createdAt: sub.createdAt,
    nextRunAt: sub.status === 'active' ? sub.nextRunAt : null,
    canceledAt: sub.canceledAt || null,
    runs: sub.runs.slice().reverse().map((r) => ({
      date: r.date, status: r.status, score: r.score ?? null, delta: r.delta ?? null,
      newIssues: r.newIssues ?? null, fixedIssues: r.fixedIssues ?? null, emailed: !!r.emailedAt,
      orderId: r.orderId,
      reportUrl: r.status === 'done' && fs.existsSync(file('reports', r.orderId, 'pdf')) ? `/api/a11y/orders/${r.orderId}/report.pdf?token=${r.orderToken}` : null,
      statusUrl: `/pristupnost.html?order=${r.orderId}&token=${r.orderToken}`,
    })),
  };
}

/* ======================= Vytvorenie ======================= */

async function createSubscription(body, baseUrl) {
  const preview = await orders.loadPreview(body.previewId);
  const consent = orders.requireConsent(body);
  const email = String(body.email || '').trim();
  if (!EMAIL_RE.test(email)) throw new PublicError('Zadaj platnú e-mailovú adresu – posielame na ňu mesačné správy.');

  const sub = {
    id: newId(),
    token: newToken(),
    email,
    url: preview.url,
    host: preview.host,
    price: MONITORING.price,
    status: 'pending_payment',
    payment: { mode: PAYMENT_MODE },
    consent,
    runs: [],
    lastAuditId: null,
    nextRunAt: null,
    createdAt: new Date().toISOString(),
  };
  const page = subPage(sub, baseUrl);

  if (PAYMENT_MODE === 'demo') {
    await save('subscriptions', sub);
    await activate(sub.id, {});
    return { redirect: page, demo: true };
  }

  const session = await stripe('POST', '/v1/checkout/sessions', {
    mode: 'subscription',
    locale: 'sk',
    customer_email: email,
    'line_items[0][quantity]': 1,
    'line_items[0][price_data][currency]': 'eur',
    'line_items[0][price_data][unit_amount]': MONITORING.price * 100,
    'line_items[0][price_data][recurring][interval]': 'month',
    'line_items[0][price_data][product_data][name]': 'Monitoring prístupnosti webu',
    client_reference_id: sub.id,
    'metadata[sub_id]': sub.id,
    'subscription_data[metadata][sub_id]': sub.id,
    'subscription_data[description]': `Mesačný audit prístupnosti – ${preview.host}`,
    success_url: `${page}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${baseUrl}/pristupnost.html?url=${encodeURIComponent(preview.url)}&canceled=1`,
  });
  sub.payment.sessionId = session.id;
  await save('subscriptions', sub);
  return { redirect: session.url };
}

async function getSubscription(id, token) {
  let sub = await load('subscriptions', id);
  if (!sub || !safeEqual(sub.token, token || '')) throw new PublicError('Predplatné neexistuje.', 404);
  if (sub.status === 'pending_payment' && sub.payment.mode === 'stripe' && sub.payment.sessionId) {
    try {
      const s = await stripe('GET', `/v1/checkout/sessions/${encodeURIComponent(sub.payment.sessionId)}`);
      if (s.status === 'complete' && s.metadata?.sub_id === sub.id && s.subscription) {
        await activate(sub.id, { customerId: s.customer, subscriptionId: s.subscription });
        sub = await load('subscriptions', id);
      }
    } catch (e) { console.error('[sub verify]', e.message); }
  }
  return publicSub(sub);
}

async function activate(id, { customerId, subscriptionId }) {
  const sub = await load('subscriptions', id);
  if (!sub || sub.status !== 'pending_payment') return;
  sub.status = 'active';
  sub.payment = { ...sub.payment, customerId: customerId || null, subscriptionId: subscriptionId || null, activatedAt: new Date().toISOString() };
  await save('subscriptions', sub);
  await startRun(sub.id);
}

/* ======================= Mesačné behy ======================= */

async function startRun(subId) {
  const sub = await load('subscriptions', subId);
  if (!sub || sub.status !== 'active') return null;
  if (sub.runs.some((r) => r.status === 'running')) return null;
  const order = {
    id: newId(),
    token: newToken(),
    kind: 'monitor',
    subId: sub.id,
    url: sub.url,
    host: sub.host,
    tier: 'monitor',
    price: 0,
    status: 'paid',
    payment: { mode: sub.payment.mode, subscription: true },
    progress: null,
    error: null,
    createdAt: new Date().toISOString(),
  };
  await save('orders', order);
  sub.runs.push({ orderId: order.id, orderToken: order.token, date: order.createdAt, status: 'running' });
  sub.runs = sub.runs.slice(-MAX_RUNS_KEPT);
  sub.nextRunAt = addMonth(order.createdAt);
  await save('subscriptions', sub);
  orders.startJob(order.id);
  return order.id;
}

// Pred vykreslením PDF doplníme porovnanie s predchádzajúcim auditom
orders.on('beforeRender', async (o, audit) => {
  if (o.kind !== 'monitor') return;
  const sub = await load('subscriptions', o.subId);
  if (!sub || !sub.lastAuditId) return;
  const prev = await load('audits', sub.lastAuditId);
  if (prev) audit.comparison = compareAudits(prev, audit);
});

orders.on('afterDone', async (o, audit, pdf) => {
  if (o.kind !== 'monitor') return;
  const sub = await load('subscriptions', o.subId);
  if (!sub) return;
  const run = sub.runs.find((r) => r.orderId === o.id);
  const c = audit.comparison;
  Object.assign(run || {}, {
    status: 'done', score: audit.score, delta: c ? c.scoreDelta : null,
    newIssues: c ? c.newIssues.length : null, fixedIssues: c ? c.fixedIssues.length : null,
  });
  sub.lastAuditId = o.id;
  await save('subscriptions', sub);

  try {
    await sendReportMail(sub, o, audit, pdf);
    const s2 = await load('subscriptions', sub.id);
    const r2 = s2.runs.find((r) => r.orderId === o.id);
    if (r2) r2.emailedAt = new Date().toISOString();
    await save('subscriptions', s2);
  } catch (e) {
    console.error('[mail]', sub.id, e.message);
  }
});

orders.on('afterFail', async (o) => {
  if (o.kind !== 'monitor') return;
  const sub = await load('subscriptions', o.subId);
  const run = sub && sub.runs.find((r) => r.orderId === o.id);
  if (run) { run.status = 'failed'; await save('subscriptions', sub); }
});

/* ======================= E-mail ======================= */

function mailHtml(sub, audit) {
  const c = audit.comparison;
  const color = audit.score >= 90 ? '#12b76a' : audit.score >= 65 ? '#e0a100' : audit.score >= 50 ? '#f97316' : '#ef4444';
  const delta = c ? `<span style="color:${c.scoreDelta > 0 ? '#12b76a' : c.scoreDelta < 0 ? '#ef4444' : '#6b7287'};font-weight:700">${c.scoreDelta > 0 ? '+' : ''}${c.scoreDelta}</span> oproti ${new Date(c.previousDate).toLocaleDateString('sk-SK')}` : 'prvý audit v rámci monitoringu';
  const top = audit.issues.slice(0, 5).map((i) => `<li style="margin:0 0 6px">${esc(i.title)} <span style="color:#6b7287">(${i.nodeCount}×)</span></li>`).join('');
  return `<!doctype html><html lang="sk"><body style="margin:0;background:#f4f5f8;font-family:Arial,Helvetica,sans-serif;color:#1d2333">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f8;padding:24px 12px"><tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;padding:28px">
    <tr><td>
      <p style="margin:0 0 4px;color:#6b7287;font-size:13px">Mesačný monitoring prístupnosti</p>
      <h1 style="margin:0 0 18px;font-size:22px">${esc(sub.host)}</h1>
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="font-size:44px;font-weight:800;color:${color};padding-right:14px">${audit.score}</td>
        <td style="font-size:14px;color:#464d63">skóre zo 100<br>${delta}</td>
      </tr></table>
      <p style="margin:18px 0;font-size:15px"><b>${esc(audit.conformance.label)}</b> – ${audit.issues.length} typov problémov na ${audit.pages.length} podstránkach.</p>
      ${c ? `<p style="margin:0 0 18px;font-size:14px">✅ Opravené: <b>${c.fixedIssues.length}</b> &nbsp; ⚠️ Nové: <b>${c.newIssues.length}</b></p>` : ''}
      ${top ? `<p style="margin:0 0 6px;font-weight:700;font-size:14px">Najdôležitejšie problémy</p><ul style="margin:0 0 20px;padding-left:18px;font-size:14px">${top}</ul>` : ''}
      <p style="margin:0 0 22px;font-size:14px">Podrobnú PDF správu nájdete v prílohe.</p>
      <a href="${esc(subPage(sub))}" style="display:inline-block;background:#6d5dfc;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700;font-size:14px">Zobraziť históriu auditov</a>
      <p style="margin:26px 0 0;font-size:12px;color:#8a90a2">Tento e-mail dostávate, pretože ste si predplatili monitoring prístupnosti webu ${esc(sub.host)}. Predplatné môžete kedykoľvek zrušiť na stránke predplatného.</p>
    </td></tr>
  </table></td></tr></table></body></html>`;
}

async function sendReportMail(sub, o, audit, pdf) {
  const c = audit.comparison;
  const worse = c && (c.scoreDelta < 0 || c.newIssues.length > 0);
  const subject = worse
    ? `⚠️ Prístupnosť webu ${sub.host} sa zhoršila (skóre ${audit.score}${c.scoreDelta ? `, ${c.scoreDelta}` : ''})`
    : `Mesačný audit prístupnosti – ${sub.host}: skóre ${audit.score}`;
  await sendMail({
    to: sub.email,
    subject,
    html: mailHtml(sub, audit),
    attachments: [{ filename: `audit-pristupnosti-${sub.host}-${o.createdAt.slice(0, 10)}.pdf`, content: pdf.toString('base64') }],
  });
}

/* ======================= Správa predplatného ======================= */

async function portal(id, token, baseUrl) {
  const sub = await load('subscriptions', id);
  if (!sub || !safeEqual(sub.token, token || '')) throw new PublicError('Predplatné neexistuje.', 404);
  if (sub.payment.mode !== 'stripe' || !sub.payment.customerId) throw new PublicError('Správa platby nie je pre toto predplatné dostupná.');
  const s = await stripe('POST', '/v1/billing_portal/sessions', { customer: sub.payment.customerId, return_url: subPage(sub, baseUrl), locale: 'sk' });
  return { redirect: s.url };
}

/** Zrušenie: v Stripe ku koncu obdobia (cez portál), v demo režime hneď. */
async function cancel(id, token, { admin = false } = {}) {
  const sub = await load('subscriptions', id);
  if (!sub || (!admin && !safeEqual(sub.token, token || ''))) throw new PublicError('Predplatné neexistuje.', 404);
  if (sub.payment.mode === 'stripe' && sub.payment.subscriptionId) {
    await stripe('POST', `/v1/subscriptions/${encodeURIComponent(sub.payment.subscriptionId)}`, { cancel_at_period_end: 'true' });
    sub.cancelAtPeriodEnd = true;
  } else {
    sub.status = 'canceled';
    sub.canceledAt = new Date().toISOString();
  }
  await save('subscriptions', sub);
  return publicSub(sub);
}

/* ======================= Stripe webhooky ======================= */

async function findByStripeSub(stripeSubId) {
  return (await list('subscriptions')).find((s) => s.payment.subscriptionId === stripeSubId) || null;
}

orders.on('webhook', async (event) => {
  const o = event.data?.object || {};
  if (event.type === 'checkout.session.completed' && o.mode === 'subscription' && o.metadata?.sub_id) {
    await activate(o.metadata.sub_id, { customerId: o.customer, subscriptionId: o.subscription });
    return;
  }
  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
    const sub = (o.metadata?.sub_id && await load('subscriptions', o.metadata.sub_id)) || await findByStripeSub(o.id);
    if (!sub) return;
    const map = { active: 'active', trialing: 'active', past_due: 'past_due', unpaid: 'past_due', canceled: 'canceled', incomplete_expired: 'canceled' };
    const next = event.type === 'customer.subscription.deleted' ? 'canceled' : map[o.status];
    if (next && sub.status !== 'pending_payment') {
      sub.status = next;
      sub.cancelAtPeriodEnd = !!o.cancel_at_period_end;
      if (next === 'canceled') sub.canceledAt = new Date().toISOString();
      await save('subscriptions', sub);
    }
  }
  if (event.type === 'invoice.payment_failed' && o.subscription) {
    const sub = await findByStripeSub(o.subscription);
    if (sub && sub.status === 'active') { sub.status = 'past_due'; await save('subscriptions', sub); }
  }
});

/* ======================= Plánovač ======================= */

async function schedulerTick() {
  const now = Date.now();
  for (const sub of await list('subscriptions')) {
    if (sub.status === 'active' && sub.nextRunAt && Date.parse(sub.nextRunAt) <= now) {
      console.log(`[monitor] mesačný audit ${sub.host}`);
      await startRun(sub.id).catch((e) => console.error('[monitor]', e));
    }
  }
}

function startScheduler(intervalMs = 15 * 60 * 1000) {
  schedulerTick().catch(() => {});
  return setInterval(() => schedulerTick().catch((e) => console.error('[scheduler]', e)), intervalMs).unref();
}

module.exports = { createSubscription, getSubscription, portal, cancel, startRun, schedulerTick, startScheduler, publicSub, mailHtml };
