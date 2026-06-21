// backend/src/controllers/staticPage.controller.js
//
// Controllery pre jednoduché statické stránky (O nás, Kontakt).
// Tieto stránky nepotrebujú dáta z DB; výnimkou je Kontakt, ktorý predvyplní
// meno a e-mail prihláseného používateľa do formulára (ak je prihlásený).

const { User } = require('../models');
const { asyncHandler } = require('../middleware/error.middleware');

// GET /about — statická stránka "O nás" (obsah 1:1 zo šablóny)
const aboutPage = (req, res) => {
  res.render('about');
};

// GET /kontakt — kontaktný formulár (zatiaľ len UI, bez reálneho odosielania).
// Ak je používateľ prihlásený, predvyplníme meno a e-mail z jeho účtu.
const kontaktPage = asyncHandler(async (req, res) => {
  let contactName = '';   // predvyplnené meno (prázdne pre hosťa)
  let contactEmail = '';  // predvyplnený e-mail (prázdne pre hosťa)

  // ak je v relácii prihlásený používateľ, načítame jeho údaje
  if (req.session && req.session.userId) {
    const user = await User.findByPk(Number(req.session.userId), {
      attributes: ['username', 'email'], // len to, čo potrebujeme do formulára
    });
    if (user) {
      contactName = user.username || '';
      contactEmail = user.email || '';
    }
  }

  res.render('kontakt', { contactName, contactEmail });
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

module.exports = { aboutPage, kontaktPage, navodyPage, logoIdentityPage };