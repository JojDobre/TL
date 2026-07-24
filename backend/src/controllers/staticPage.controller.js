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

// GET /podpor-nas — donate stránka (statická, bez DB)
const podporNasPage = (req, res) => {
  res.render('podpor-nas');
};

// GET /nahlasit-bug — formulár na nahlásenie chyby.
// Len pre prihlásených (route má requireLogin) — meno a e-mail berieme zo
// session, takže ich používateľ nemusí vypĺňať.
const bugReportPage = (req, res) => {
  res.render('nahlasit-bug', {
    sent: false, error: null,
    subject: '', message: '', imageUrl: '', pageUrl: '',
  });
};

// POST /nahlasit-bug — odošle hlásenie na schránku podpory.
// Hlásenie ide cez rovnakú e-mailovú službu ako kontaktný formulár, len s
// pevnou témou a s technickými údajmi (stránka, screenshot, prehliadač)
// pribalenými do textu správy.
const bugReportSubmit = asyncHandler(async (req, res) => {
  const { subject, message, imageUrl, pageUrl, area } = req.body;

  const back = (error) => res.status(400).render('nahlasit-bug', {
    sent: false, error,
    subject: subject || '', message: message || '',
    imageUrl: imageUrl || '', pageUrl: pageUrl || '',
  });

  if (!subject || !subject.trim()) return back('Vyplň stručný popis chyby.');
  if (!message || !message.trim()) return back('Popíš, čo sa stalo.');

  // odkaz na screenshot je nepovinný, ale ak je zadaný, musí to byť http(s)
  const img = (imageUrl || '').trim();
  if (img && !/^https?:\/\//i.test(img)) {
    return back('Odkaz na screenshot musí začínať http:// alebo https://');
  }

  // middleware attachUser/requireLogin dáva len req.userId — používateľa
  // musíme načítať kvôli menu a e-mailu (Reply-To v hlásení)
  const user = req.userId
    ? await User.findByPk(req.userId, { attributes: ['id', 'username', 'firstName', 'lastName', 'email'] })
    : null;
  const reporterName = user
    ? ([user.firstName, user.lastName].filter(Boolean).join(' ') || user.username)
    : 'Neznámy používateľ';
  const reporterEmail = (user && user.email) || process.env.CONTACT_TO || 'podpora@tifo.sk';

  // technické údaje pripojíme k textu — v e-maile sa zobrazia ako súčasť správy
  const details = [
    message.trim(),
    '',
    '— — —',
    `Oblasť: ${area || 'Všeobecné'}`,
    pageUrl && pageUrl.trim() ? `Stránka: ${pageUrl.trim()}` : null,
    img ? `Screenshot: ${img}` : null,
    user ? `Používateľ: ${user.username} (ID ${user.id})` : null,
    `Prehliadač: ${req.get('user-agent') || '—'}`,
  ].filter(Boolean).join('\n');

  const result = await sendContactEmail({
    name: reporterName,
    email: reporterEmail,
    topic: 'Chyba v aplikácii',
    subject: `[BUG] ${subject.trim()}`,
    message: details,
    consent: true,
  });

  // skipped = chýba RESEND_API_KEY (dev) — pre používateľa to berieme ako úspech
  if (!result.success && !result.skipped) {
    return back('Hlásenie sa nepodarilo odoslať. Skús to prosím neskôr.');
  }

  return res.render('nahlasit-bug', {
    sent: true, error: null,
    subject: '', message: '', imageUrl: '', pageUrl: '',
  });
});

module.exports = {
  aboutPage, kontaktPage, kontaktSubmit, navodyPage, logoIdentityPage,
  podmienkyPage, sukromiePage, podporNasPage, bugReportPage, bugReportSubmit,
};