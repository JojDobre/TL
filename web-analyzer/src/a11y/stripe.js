'use strict';

/* Stripe cez REST API (bez SDK). */

const crypto = require('crypto');
const { PublicError, safeEqual } = require('./store');

const STRIPE_KEY = process.env.STRIPE_SECRET_KEY || '';
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || '';
const PAYMENT_MODE = STRIPE_KEY ? 'stripe' : 'demo';
if (PAYMENT_MODE === 'demo') console.warn('[a11y] STRIPE_SECRET_KEY nie je nastavený – platby bežia v DEMO režime (bez reálneho platenia).');

async function stripe(method, endpoint, params) {
  const body = params ? new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString() : undefined;
  const res = await fetch('https://api.stripe.com' + endpoint, {
    method,
    headers: { Authorization: `Bearer ${STRIPE_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Stripe-Version': '2024-06-20' },
    body,
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('[stripe]', res.status, data?.error?.message);
    throw new PublicError('Platobnú bránu sa nepodarilo kontaktovať. Skúste to prosím znova.', 'Could not reach the payment gateway. Please try again.', 502);
  }
  return data;
}

/** Overenie podpisu webhooku (Stripe-Signature: t=…,v1=…), tolerancia 5 minút. */
function verifyWebhook(rawBody, header) {
  if (!STRIPE_WEBHOOK_SECRET) throw new PublicError('Webhook nie je nakonfigurovaný.', 'Webhook is not configured.', 400);
  const items = String(header || '').split(',').map((kv) => kv.trim().split('='));
  const t = Number((items.find(([k]) => k === 't') || [])[1]);
  const sigs = items.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!t || !sigs.length || Math.abs(Date.now() / 1000 - t) > 300) throw new PublicError('Neplatný podpis.', 'Invalid signature.', 400);
  const expected = crypto.createHmac('sha256', STRIPE_WEBHOOK_SECRET).update(`${t}.${rawBody}`).digest('hex');
  if (!sigs.some((s) => safeEqual(s, expected))) throw new PublicError('Neplatný podpis.', 'Invalid signature.', 400);
  return JSON.parse(rawBody);
}

module.exports = { stripe, verifyWebhook, PAYMENT_MODE };
