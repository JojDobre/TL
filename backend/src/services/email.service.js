// backend/src/services/email.service.js
//
// Centrálna služba na odosielanie e-mailov cez Resend (https://resend.com).
// Resend posiela e-maily cez HTTPS API (port 443), NIE cez SMTP — takže nás
// netrápia blokované/limitované SMTP porty na VPS ani reputácia IP adresy VPS.
//
// Potrebné .env premenné:
//   RESEND_API_KEY  – API kľúč z Resend dashboardu (Settings → API Keys)
//   EMAIL_FROM      – odosielateľská adresa na OVERENEJ doméne, napr. "tifo.sk <noreply@tifo.sk>"
//   CONTACT_TO      – schránka, kam chodia správy z kontaktného formulára
//   APP_URL         – základná URL aplikácie (napr. https://tifo.sk) pre tvorbu odkazov
//
// Návrh: ak RESEND_API_KEY chýba (napr. lokálny vývoj), e-mail sa reálne
// neodošle — len sa vypíše do konzoly a vráti sa { success:false, skipped:true }.
// Vďaka tomu appka nespadne, keď kľúč nie je nakonfigurovaný.
//
// VIZUÁL: e-maily sú v tmavom brandingu tifo.sk (violet + zlatá, karta s accent
// pruhom). Postavené na <table> layoute s inline štýlmi — to je jediný spoľahlivý
// spôsob naprieč e-mailovými klientmi (Gmail, Outlook, Apple Mail). Externé fonty
// (Space Grotesk) Gmail/Outlook nenačíta → wordmark má systémový fallback;
// identitu nesie logo-obrázok a farby.

const { Resend } = require('resend');

// Inicializujeme klienta len ak máme kľúč (inak ostane null → dev fallback).
const apiKey = process.env.RESEND_API_KEY;
const resend = apiKey ? new Resend(apiKey) : null;

// Odosielateľská adresa. Musí byť na doméne overenej v Resende.
const FROM = process.env.EMAIL_FROM || 'tifo.sk <noreply@tifo.sk>';

/**
 * Nízkoúrovňové odoslanie e-mailu.
 * @param {Object} opts
 * @param {string|string[]} opts.to    – príjemca / príjemcovia
 * @param {string} opts.subject        – predmet
 * @param {string} opts.html           – HTML telo
 * @param {string} [opts.text]         – textový fallback (odporúčané)
 * @param {string} [opts.replyTo]      – Reply-To adresa
 * @returns {Promise<{success:boolean, id?:string, skipped?:boolean, error?:string}>}
 */
async function sendEmail({ to, subject, html, text, replyTo }) {
  // Dev fallback: bez kľúča e-mail neodosielame, len logujeme.
  if (!resend) {
    console.warn('[email] RESEND_API_KEY nie je nastavený — e-mail sa neodoslal.');
    console.warn(`[email] (dev) To: ${to} | Subject: ${subject}`);
    return { success: false, skipped: true };
  }

  try {
    const payload = {
      from: FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    };
    if (text) payload.text = text;          // textová verzia pre klientov bez HTML
    if (replyTo) payload.replyTo = replyTo; // aby sa dalo odpovedať priamo používateľovi

    const { data, error } = await resend.emails.send(payload);

    if (error) {
      console.error('[email] Resend vrátil chybu:', error);
      return { success: false, error: error.message || String(error) };
    }
    return { success: true, id: data && data.id };
  } catch (err) {
    console.error('[email] Neočakávaná chyba pri odosielaní:', err);
    return { success: false, error: err.message };
  }
}

// ---------------------------------------------------------------------------
// Konkrétne e-maily aplikácie
// ---------------------------------------------------------------------------

/**
 * E-mail s odkazom na obnovu hesla.
 * @param {Object} p
 * @param {string} p.to        – e-mail príjemcu
 * @param {string} p.name      – meno/prezývka do oslovenia (môže byť prázdne)
 * @param {string} p.resetUrl  – plný odkaz s tokenom
 * @param {number} p.minutes   – platnosť odkazu v minútach
 */
async function sendPasswordResetEmail({ to, name, resetUrl, minutes }) {
  const greeting = name ? `Ahoj ${escapeHtml(name)},` : 'Ahoj,';
  const subject = 'Obnova hesla — tifo.sk';

  const inner = `
    <!-- accent pruh -->
    <tr><td style="height:3px;background:linear-gradient(90deg,#06080f,#7c5cff,#06080f);font-size:0;line-height:0">&nbsp;</td></tr>

    <tr><td style="padding:34px 40px 8px">
      ${badge('Zabezpečenie účtu', 'brand')}
      <h1 style="${H1}">Obnova hesla</h1>
      <p style="margin:14px 0 0;font-size:15px;line-height:1.55;color:#b8c0d6">
        ${greeting}<br>dostali sme žiadosť o obnovenie hesla k tvojmu účtu na <b style="color:#eef1f9">tifo.sk</b>. Klikni na tlačidlo nižšie a nastav si nové heslo.
      </p>
    </td></tr>

    <!-- CTA -->
    <tr><td style="padding:28px 40px 26px">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td align="center" bgcolor="#facc15" style="border-radius:12px">
          <a href="${resetUrl}" style="${BTN_GOLD}">Nastaviť nové heslo &rarr;</a>
        </td>
      </tr></table>
    </td></tr>

    <!-- fallback odkaz -->
    <tr><td style="padding:0 40px 24px">
      <p style="margin:0 0 8px;font-size:13px;color:#828caa">Tlačidlo nefunguje? Skopíruj tento odkaz do prehliadača:</p>
      <div style="background:#0d1322;border:1px solid rgba(150,165,215,.14);border-radius:12px;padding:14px 16px;font-size:13px;color:#828caa;word-break:break-all">
        <a href="${resetUrl}" style="color:#9d83ff;text-decoration:none">${resetUrl}</a>
      </div>
    </td></tr>

    <tr><td style="padding:0 40px"><div style="height:1px;background:rgba(150,165,215,.12);font-size:0;line-height:0">&nbsp;</div></td></tr>

    <!-- security note -->
    <tr><td style="padding:24px 40px 32px">
      <div style="background:rgba(124,92,255,.08);border:1px solid rgba(124,92,255,.22);border-radius:12px;padding:16px 18px">
        <b style="color:#eef1f9">🔒 Odkaz je platný ${minutes} minút.</b>
        <p style="margin:6px 0 0;font-size:13.5px;line-height:1.55;color:#9aa3bd">Ak si o obnovu hesla nežiadal/a ty, tento e-mail pokojne ignoruj — tvoje heslo zostáva nezmenené a účet v bezpečí.</p>
      </div>
    </td></tr>
  `;

  const html = baseTemplate(inner, {
    preheader: `Obnov si heslo na tifo.sk — odkaz je platný ${minutes} minút.`,
    footerKind: 'public',
  });

  const text =
    `${name ? 'Ahoj ' + name + ',' : 'Ahoj,'}\n\n` +
    `Dostali sme žiadosť o obnovu hesla k tvojmu účtu na tifo.sk.\n` +
    `Nastav si nové heslo cez tento odkaz (platný ${minutes} minút):\n\n${resetUrl}\n\n` +
    `Ak si obnovu nepožadoval(a), e-mail ignoruj.`;

  return sendEmail({ to, subject, html, text });
}

/**
 * E-mail z kontaktného formulára — interná notifikácia podpory.
 * @param {Object} p
 * @param {string} p.name     – meno odosielateľa
 * @param {string} p.email    – e-mail odosielateľa (Reply-To + tlačidlo Odpovedať)
 * @param {string} p.topic    – vybraná téma (tag)
 * @param {string} p.subject  – predmet správy
 * @param {string} p.message  – text správy
 * @param {boolean} p.consent – udelený súhlas so spracovaním
 */
async function sendContactEmail({ name, email, topic, subject, message, consent }) {
  const to = process.env.CONTACT_TO || 'podpora@tifo.sk';
  const base = (process.env.APP_URL || 'https://tifo.sk').replace(/\/$/, '');
  const safeName = escapeHtml(name) || '—';
  const safeEmail = escapeHtml(email) || '—';
  const safeTopic = topic && topic.trim() ? escapeHtml(topic.trim()) : '';
  const safeSubject = subject && subject.trim() ? escapeHtml(subject.trim()) : '(bez predmetu)';
  const initials = makeInitials(name) || '?';
  const now = formatSkDateTime(new Date());

  // mailto na priamu odpoveď + adminská podpora
  const replyHref = `mailto:${encodeURIComponent(email || '')}?subject=${encodeURIComponent('Re: ' + (subject || 'Vaša správa na tifo.sk'))}`;
  const adminHref = `${base}/admin`;

  const topicTag = safeTopic
    ? `<td valign="middle" align="right"><span style="display:inline-block;font-family:'Space Grotesk',Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#facc15;background:rgba(250,204,21,.13);border:1px solid rgba(250,204,21,.30);border-radius:8px;padding:5px 11px">${safeTopic}</span></td>`
    : '';

  const consentCell = consent
    ? `<div style="font-size:15px;color:#1fd497;font-weight:600;margin-top:3px">✓ Udelený</div>`
    : `<div style="font-size:15px;color:#828caa;font-weight:600;margin-top:3px">—</div>`;

  const inner = `
    <tr><td style="height:3px;background:linear-gradient(90deg,#06080f,#7c5cff,#06080f);font-size:0;line-height:0">&nbsp;</td></tr>

    <tr><td style="padding:34px 40px 8px">
      ${badge('Kontaktný formulár', 'brand')}
      <h1 style="${H1}">Nová správa z webu</h1>
      <p style="margin:10px 0 0;font-size:14px;color:#828caa">Odoslané ${now} · cez stránku /kontakt</p>
    </td></tr>

    <!-- sender strip -->
    <tr><td style="padding:22px 40px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0d1322;border:1px solid rgba(150,165,215,.14);border-radius:14px">
        <tr>
          <td width="46" valign="middle" style="padding:16px 0 16px 18px">
            <div style="width:46px;height:46px;border-radius:12px;background:linear-gradient(150deg,#7c5cff,#5b3fd6);color:#fff;font-family:'Space Grotesk',Arial,sans-serif;font-weight:700;font-size:18px;text-align:center;line-height:46px">${initials}</div>
          </td>
          <td valign="middle" style="padding:16px 14px">
            <div style="font-family:'Space Grotesk',Arial,sans-serif;font-weight:700;font-size:16px;color:#eef1f9">${safeName}</div>
            <div style="margin-top:2px"><a href="mailto:${safeEmail}" style="color:#9d83ff;font-size:13.5px;text-decoration:none">${safeEmail}</a></div>
          </td>
          ${topicTag}
          <td style="width:18px"></td>
        </tr>
      </table>
    </td></tr>

    <!-- meta -->
    <tr><td style="padding:22px 40px 0">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td width="50%" valign="top" style="padding-right:10px">
          <div style="${META_LABEL}">Predmet</div>
          <div style="font-size:15px;color:#eef1f9;font-weight:600;margin-top:3px">${safeSubject}</div>
        </td>
        <td width="50%" valign="top" style="padding-left:10px">
          <div style="${META_LABEL}">Súhlas so spracovaním</div>
          ${consentCell}
        </td>
      </tr></table>
    </td></tr>

    <!-- message -->
    <tr><td style="padding:22px 40px 8px">
      <div style="${META_LABEL};margin-bottom:8px">Správa</div>
      <div style="background:#0d1322;border:1px solid rgba(150,165,215,.14);border-left:3px solid #7c5cff;border-radius:12px;padding:18px 20px">
        <p style="margin:0;color:#cdd4e6;font-size:15px;line-height:1.65;white-space:pre-wrap">${escapeHtml(message)}</p>
      </div>
    </td></tr>
  `;

  const html = baseTemplate(inner, {
    preheader: `Nová správa od ${name || 'návštevníka'}${safeTopic ? ' · Téma: ' + topic : ''}`,
    footerKind: 'support',
  });

  const text =
    `Nová správa z kontaktného formulára tifo.sk\n\n` +
    `Meno: ${name || '—'}\nE-mail: ${email || '—'}\n` +
    `${topic ? 'Téma: ' + topic + '\n' : ''}Predmet: ${subject || '(bez predmetu)'}\n` +
    `Súhlas: ${consent ? 'udelený' : '—'}\n\n${message}`;

  return sendEmail({ to, subject: `[Kontakt] ${topic ? topic + ' — ' : ''}${subject || '(bez predmetu)'}`, html, text, replyTo: email });
}

// ---------------------------------------------------------------------------
// Šablóna a pomocné funkcie
// ---------------------------------------------------------------------------

// Spoločné inline štýly (skratky, aby sa neopakovali v tele).
const H1 = "font-family:'Space Grotesk',Arial,sans-serif;font-weight:700;font-size:26px;line-height:1.14;letter-spacing:-.02em;color:#eef1f9;margin:18px 0 0";
const BTN_GOLD = "display:inline-block;background:linear-gradient(180deg,#fde047,#facc15);border-radius:12px;color:#1c1605;font-family:'Space Grotesk',Arial,sans-serif;font-weight:700;font-size:15px;line-height:1;text-decoration:none;padding:15px 30px";
const META_LABEL = "font-family:'Space Grotesk',Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:#59617c";

// Badge (štítok nad nadpisom) — violet alebo zlatý variant.
function badge(text, kind) {
  if (kind === 'gold') {
    return `<span style="display:inline-block;font-family:'Space Grotesk',Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#facc15;background:rgba(250,204,21,.13);border:1px solid rgba(250,204,21,.30);border-radius:8px;padding:6px 12px">${text}</span>`;
  }
  return `<span style="display:inline-block;font-family:'Space Grotesk',Arial,sans-serif;font-size:11px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:#9d83ff;background:rgba(124,92,255,.14);border:1px solid rgba(124,92,255,.40);border-radius:8px;padding:6px 12px">${text}</span>`;
}

// E-mailový wrapper v tmavom brandingu tifo.sk (podľa návrhu).
// inner = obsah karty (riadky <tr>); opts.preheader = skrytý náhľadový text;
// opts.footerKind = 'public' (verejný e-mail) | 'support' (interná notifikácia).
function baseTemplate(inner, opts) {
  opts = opts || {};
  const base = (process.env.APP_URL || 'https://tifo.sk').replace(/\/$/, '');
  const logoSrc = `${base}/branding/identity/favicon-192.png`;
  const preheader = opts.preheader || '';

  const footer = opts.footerKind === 'support'
    ? `
        <p style="margin:0 0 6px;font-family:'Space Grotesk',Arial,sans-serif;color:#828caa;font-weight:600;font-size:12.5px">tifo<span style="color:#facc15">.sk</span> — interná notifikácia podpory</p>
        <p style="margin:0 0 6px;font-size:12.5px;color:#59617c">Táto správa bola vygenerovaná z kontaktného formulára na tifo.sk.</p>
      `
    : `
        <p style="margin:0 0 6px;font-family:'Space Grotesk',Arial,sans-serif;color:#828caa;font-weight:600;font-size:12.5px">tifo<span style="color:#facc15">.sk</span> — komunitná tipovacia liga</p>
        <p style="margin:0 0 6px;font-size:12.5px;color:#59617c">Tento e-mail bol odoslaný automaticky, prosíme neodpovedaj naň.</p>
        <p style="margin:0 0 6px;font-size:12.5px;color:#59617c">Potrebuješ pomoc? <a href="mailto:podpora@tifo.sk" style="color:#828caa;text-decoration:underline">podpora@tifo.sk</a></p>
      `;

  return `<!doctype html>
<html lang="sk"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<!--[if mso]><style>* { font-family: Arial, sans-serif !important; }</style><![endif]-->
</head>
<body style="margin:0;padding:0;width:100%;background:#06080f;color:#b8c0d6;font-family:'Manrope',-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55">
<span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${escapeHtml(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#06080f;background-image:radial-gradient(680px 360px at 50% -6%, rgba(124,92,255,.18), transparent 60%)">
  <tr><td align="center" style="padding:12px 12px 36px">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:600px;margin:0 auto">

      <!-- BRAND -->
      <tr><td style="padding:30px 40px 8px">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="padding-right:10px"><img src="${logoSrc}" width="36" height="36" alt="tifo.sk" style="display:block;width:36px;height:36px;border-radius:9px"></td>
          <td style="font-family:'Space Grotesk',Arial,sans-serif;font-weight:700;font-size:21px;color:#ffffff;letter-spacing:-.01em">tifo<b style="color:#facc15;font-weight:700">.sk</b></td>
        </tr></table>
      </td></tr>

      <!-- CARD -->
      <tr><td style="padding:8px 0">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#111728;border:1px solid rgba(150,165,215,.14);border-radius:20px;overflow:hidden">
          ${inner}
        </table>
      </td></tr>

      <!-- FOOTER -->
      <tr><td style="padding:26px 40px 40px;text-align:center">
        ${footer}
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

// Iniciálky z mena (max 2 znaky) pre avatar v sender stripe.
function makeInitials(name) {
  if (!name) return '';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Dátum a čas v slovenskom formáte (napr. "23. júna 2026 o 14:38").
function formatSkDateTime(d) {
  try {
    const date = new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
    const time = new Intl.DateTimeFormat('sk-SK', { hour: '2-digit', minute: '2-digit' }).format(d);
    return `${date} o ${time}`;
  } catch (_) {
    return d.toISOString();
  }
}

// Escapovanie HTML, aby vstup od používateľa nemohol rozbiť/zneužiť šablónu (XSS).
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendContactEmail,
};