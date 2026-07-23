// backend/src/controllers/staticPage.controller.js
//
// Controllery pre jednoduché statické stránky (O nás, Kontakt).
// Väčšina týchto stránok nepotrebuje dáta z DB. Výnimkou sú: "O nás" (načíta
// reálne štatistiky do metrík) a Kontakt, ktorý predvyplní
// meno a e-mail prihláseného používateľa do formulára (ak je prihlásený)
// a po odoslaní pošle podnet na schránku podpory cez e-mailovú službu.

const { User, League, Tip } = require('../models');
const { asyncHandler } = require('../middleware/error.middleware');
const { sendContactEmail } = require('../services/email.service');

// GET /about — stránka "O nás".
// Metriky v hlavičke stránky ukazujú REÁLNE čísla z databázy (rovnaký zdroj
// ako štatistiky na úvodnej stránke), nie pevne zapísané hodnoty.
const aboutPage = asyncHandler(async (req, res) => {
  const [usersCount, leaguesCount, tipsCount] = await Promise.all([
    User.count(),
    League.count(),
    Tip.count(),
  ]);

  res.render('about', {
    stats: { usersCount, leaguesCount, tipsCount },
  });
});

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
// Podporuje dva režimy:
//   • AJAX (fetch z view) → vracia JSON { ok, error } a stránka sa nereloadne
//   • klasický POST (fallback bez JS) → vracia vykreslenú stránku s bannerom
const kontaktSubmit = asyncHandler(async (req, res) => {
    console.log('[kontakt] body:', req.body);   // <-- dočasný diagnostický riadok

  const { name, email, subject, topic, message } = req.body;
  const { contactName, contactEmail } = await prefillFromSession(req);

  // Detekcia AJAX požiadavky (fetch posiela tieto hlavičky).
  const wantsJson =
    req.xhr ||
    (req.get('X-Requested-With') === 'XMLHttpRequest') ||
    (req.get('Accept') || '').includes('application/json');

  // pomocník: odpoveď podľa režimu (JSON pre AJAX, render pre klasický POST)
  const fail = (status, msg) => {
    if (wantsJson) return res.status(status).json({ ok: false, error: msg });
    return res.status(status).render('kontakt', {
      contactName: name || contactName,
      contactEmail: email || contactEmail,
      sent: false,
      error: msg,
    });
  };

  // Základná validácia povinných polí (e-mail + správa).
  if (!email || !message || !message.trim()) {
    return fail(400, 'Vyplň e-mail aj text správy.');
  }

  // Tému, predmet a súhlas posielame zvlášť — e-mail ich zobrazí samostatne
  // (téma ako štítok, predmet ako pole, súhlas ako stav).
  const result = await sendContactEmail({
    name: name || contactName,
    email,
    topic: topic || '',
    subject: subject || '',
    message,
    consent: !!req.body.consent,
  });

  // skipped = chýba RESEND_API_KEY (dev). Pre používateľa to berieme ako úspech,
  // aby sme neodhaľovali internú konfiguráciu; chyba je zalogovaná v service.
  if (!result.success && !result.skipped) {
    return fail(500, 'Správu sa nepodarilo odoslať. Skús to neskôr alebo nám napíš priamo na e-mail.');
  }

  // Úspech.
  if (wantsJson) return res.json({ ok: true });
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

// GET /podmienky — Podmienky používania (statická stránka)
const podmienkyPage = (req, res) => {
  res.render('podmienky');
};

// GET /sukromie — Zásady ochrany súkromia / GDPR (statická stránka)
const sukromiePage = (req, res) => {
  res.render('sukromie');
};

module.exports = { aboutPage, kontaktPage, kontaktSubmit, navodyPage, logoIdentityPage, podmienkyPage, sukromiePage };