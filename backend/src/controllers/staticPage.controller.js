// backend/src/controllers/staticPage.controller.js
//
// Controllery pre jednoduché statické stránky (O nás, Kontakt).
// Tieto stránky nepotrebujú dáta z DB; výnimkou je Kontakt, ktorý predvyplní
// meno a e-mail prihláseného používateľa do formulára (ak je prihlásený)
// a po odoslaní pošle podnet na schránku podpory cez e-mailovú službu.

const { User } = require('../models');
const { asyncHandler } = require('../middleware/error.middleware');
const { sendContactEmail } = require('../services/email.service');

// GET /about — statická stránka "O nás" (obsah 1:1 zo šablóny)
const aboutPage = (req, res) => {
  res.render('about');
};

// pomocník: predvyplní meno/e-mail z prihláseného používateľa (ak je)
async function prefillFromSession(req) {
  let contactName = '';
  let contactEmail = '';
  if (req.session && req.session.userId) {
    const user = await User.findByPk(Number(req.session.userId), {
      attributes: ['username', 'email'],
    });
    if (user) {
      contactName = user.username || '';
      contactEmail = user.email || '';
    }
  }
  return { contactName, contactEmail };
}

// GET /kontakt — kontaktný formulár.
// Ak je používateľ prihlásený, predvyplníme meno a e-mail z jeho účtu.
const kontaktPage = asyncHandler(async (req, res) => {
  const { contactName, contactEmail } = await prefillFromSession(req);
  res.render('kontakt', { contactName, contactEmail, sent: false, error: null });
});

// POST /kontakt — spracuje odoslaný formulár a pošle e-mail na schránku podpory.
const kontaktSubmit = asyncHandler(async (req, res) => {
  const { name, email, subject, topic, message } = req.body;
  const { contactName, contactEmail } = await prefillFromSession(req);

  // Základná validácia povinných polí (e-mail + správa).
  if (!email || !message || !message.trim()) {
    return res.status(400).render('kontakt', {
      contactName: name || contactName,
      contactEmail: email || contactEmail,
      sent: false,
      error: 'Vyplň e-mail aj text správy.',
    });
  }

  // Predmet skombinujeme s vybranou témou, aby bol podnet v schránke prehľadný.
  const fullSubject = [topic, subject].filter(Boolean).join(' — ') || '(bez predmetu)';

  const result = await sendContactEmail({
    name: name || contactName,
    email,
    subject: fullSubject,
    message,
  });

  // skipped = chýba RESEND_API_KEY (dev). Pre používateľa to berieme ako úspech,
  // aby sme neodhaľovali internú konfiguráciu; chyba je zalogovaná v service.
  if (!result.success && !result.skipped) {
    return res.status(500).render('kontakt', {
      contactName: name || contactName,
      contactEmail: email || contactEmail,
      sent: false,
      error: 'Správu sa nepodarilo odoslať. Skús to neskôr alebo nám napíš priamo na e-mail.',
    });
  }

  // Úspech → render s potvrdzovacím bannerom; polia opäť predvyplníme zo session.
  return res.render('kontakt', { contactName, contactEmail, sent: true, error: null });
});

// GET /navody — návody / mini-Wiki (statická stránka, bez DB)
const navodyPage = (req, res) => {
  res.render('navody');
};

// GET /logo-identity — vizuálna identita značky tifo.sk (statická stránka, bez DB).
// Samostatná stránka s vlastným topbarom/footerom (nepoužíva navbar partial).
const logoIdentityPage = (req, res) => {
  res.render('logo-identity');
};

module.exports = { aboutPage, kontaktPage, kontaktSubmit, navodyPage, logoIdentityPage };