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
 * @param {number} p.minutes   – platnosť odkazu v minútach (do textu)
 */
async function sendPasswordResetEmail({ to, name, resetUrl, minutes }) {
  const greeting = name ? `Ahoj ${escapeHtml(name)},` : 'Ahoj,';
  const subject = 'Obnova hesla — tifo.sk';

  const html = baseTemplate(`
    <h1 style="margin:0 0 16px;font-size:22px;color:#0f172a">Obnova hesla</h1>
    <p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#334155">${greeting}</p>
    <p style="margin:0 0 22px;font-size:15px;line-height:1.6;color:#334155">
      Dostali sme žiadosť o obnovu hesla k tvojmu účtu na <b>tifo.sk</b>.
      Klikni na tlačidlo nižšie a nastav si nové heslo. Odkaz je platný <b>${minutes} minút</b>.
    </p>
    <p style="margin:0 0 28px">
      <a href="${resetUrl}" style="display:inline-block;background:#7c5cff;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 26px;border-radius:10px">Nastaviť nové heslo</a>
    </p>
    <p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#64748b">
      Ak tlačidlo nefunguje, skopíruj do prehliadača tento odkaz:
    </p>
    <p style="margin:0 0 22px;font-size:13px;line-height:1.6;word-break:break-all">
      <a href="${resetUrl}" style="color:#7c5cff">${resetUrl}</a>
    </p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#94a3b8">
      Ak si obnovu hesla nepožadoval(a), tento e-mail ignoruj — heslo ostane nezmenené.
    </p>
  `);

  const text =
    `${name ? 'Ahoj ' + name + ',' : 'Ahoj,'}\n\n` +
    `Dostali sme žiadosť o obnovu hesla k tvojmu účtu na tifo.sk.\n` +
    `Nastav si nové heslo cez tento odkaz (platný ${minutes} minút):\n\n${resetUrl}\n\n` +
    `Ak si obnovu nepožadoval(a), e-mail ignoruj.`;

  return sendEmail({ to, subject, html, text });
}

/**
 * E-mail z kontaktného formulára — doručí podnet na schránku podpory.
 * @param {Object} p
 * @param {string} p.name     – meno odosielateľa
 * @param {string} p.email    – e-mail odosielateľa (nastaví sa ako Reply-To)
 * @param {string} p.subject  – predmet
 * @param {string} p.message  – text správy
 */
async function sendContactEmail({ name, email, subject, message }) {
  const to = process.env.CONTACT_TO || 'podpora@tifo.sk';
  const safeSubject = subject && subject.trim() ? subject.trim() : '(bez predmetu)';

  const html = baseTemplate(`
    <h1 style="margin:0 0 16px;font-size:20px;color:#0f172a">Nová správa z kontaktného formulára</h1>
    <table style="width:100%;border-collapse:collapse;font-size:14px;color:#334155">
      <tr><td style="padding:6px 0;width:90px;color:#64748b">Meno:</td><td style="padding:6px 0"><b>${escapeHtml(name) || '—'}</b></td></tr>
      <tr><td style="padding:6px 0;color:#64748b">E-mail:</td><td style="padding:6px 0">${escapeHtml(email) || '—'}</td></tr>
      <tr><td style="padding:6px 0;color:#64748b">Predmet:</td><td style="padding:6px 0">${escapeHtml(safeSubject)}</td></tr>
    </table>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:18px 0">
    <p style="margin:0;font-size:15px;line-height:1.6;color:#334155;white-space:pre-wrap">${escapeHtml(message)}</p>
  `);

  const text =
    `Nová správa z kontaktného formulára tifo.sk\n\n` +
    `Meno: ${name || '—'}\nE-mail: ${email || '—'}\nPredmet: ${safeSubject}\n\n${message}`;

  // Reply-To = e-mail odosielateľa → na podnet sa dá odpovedať jedným klikom.
  return sendEmail({ to, subject: `[Kontakt] ${safeSubject}`, html, text, replyTo: email });
}

// ---------------------------------------------------------------------------
// Pomocné funkcie
// ---------------------------------------------------------------------------

// Jednoduchý e-mailový wrapper (hlavička s logom-textom + pätička), aby
// boli e-maily konzistentné a čitateľné naprieč klientmi.
function baseTemplate(inner) {
  return `<!doctype html>
<html lang="sk"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:28px 16px">
    <div style="padding:0 0 18px">
      <span style="font-size:22px;font-weight:800;color:#0f172a">tifo<span style="color:#7c5cff">.sk</span></span>
    </div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:30px">
      ${inner}
    </div>
    <p style="margin:18px 4px 0;font-size:12px;color:#94a3b8">© ${new Date().getFullYear()} tifo.sk · Tento e-mail bol odoslaný automaticky, neodpovedaj naň priamo.</p>
  </div>
</body></html>`;
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
