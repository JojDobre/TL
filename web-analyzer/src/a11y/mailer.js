'use strict';

/*
 * Odosielanie e-mailov cez Resend (https://resend.com) – používa sa len pri predplatnom.
 * Bez RESEND_API_KEY sa e-mail uloží do DATA_DIR/outbox (na vývoj a kontrolu).
 */

const fsp = require('fs').promises;
const path = require('path');
const { DATA_DIR, DIRS } = require('./store');

const RESEND_KEY = process.env.RESEND_API_KEY || '';
const MAIL_FROM = process.env.MAIL_FROM || 'Web Analyzer <onboarding@resend.dev>';
const MAIL_MODE = RESEND_KEY ? 'resend' : 'outbox';

async function sendMail({ to, subject, html, attachments = [] }) {
  if (MAIL_MODE === 'outbox') {
    const base = path.join(DATA_DIR, DIRS.outbox, `${Date.now()}-${String(to).replace(/[^a-z0-9@._-]/gi, '_')}`);
    await fsp.writeFile(base + '.html', `<!-- To: ${to}\n     Subject: ${subject} -->\n${html}`);
    for (const a of attachments) await fsp.writeFile(`${base}-${a.filename}`, Buffer.from(a.content, 'base64'));
    console.log(`[mail] (outbox) ${to}: ${subject}`);
    return { id: 'outbox', mode: 'outbox' };
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: MAIL_FROM, to: [to], subject, html, attachments }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Resend ${res.status}: ${data?.message || 'chyba'}`);
  return { id: data.id, mode: 'resend' };
}

module.exports = { sendMail, MAIL_MODE };
