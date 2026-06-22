// backend/src/controllers/authPage.controller.js
//
// Server-rendered auth: vykreslí login/register stránky (GET), spracuje
// odoslané formuláre (POST) cez session, a odhlási (logout).
// Logika overenia hesla je rovnaká ako v API auth.controller — líši sa len tým,
// že namiesto JWT tokenu ukladáme údaje do req.session a presmerujeme.

const bcrypt = require('bcrypt');
const { User, Sequelize } = require('../models');
const Op = Sequelize.Op;

// pomocník: uloží prihláseného používateľa do session
function setSession(req, user) {
  req.session.userId = user.id;
  req.session.userRole = user.role;
  req.session.userName = user.username || [user.firstName, user.lastName].filter(Boolean).join(' ');
}

// GET /login
const loginPage = (req, res) => {
  if (req.session.userId) return res.redirect('/seasons');
  res.render('login', { error: null, oldEmail: '' });
};

// GET /forgot-password — stránka obnovy hesla (zatiaľ len UI; e-mailový backend
// pribudne neskôr, preto sa reálne heslo nemení).
const forgotPasswordPage = (req, res) => {
  if (req.session.userId) return res.redirect('/seasons');
  res.render('forgot-password');
};

// POST /login
const loginSubmit = async (req, res) => {
  try {
    const { email, password } = req.body;
    // prihlásenie cez e-mail ALEBO prezývku (pole sa volá "email" ale berieme oboje)
    const user = await User.findOne({
      where: { [Op.or]: [{ email }, { username: email }] },
    });
    if (!user) {
      return res.status(401).render('login', { error: 'Nesprávny e-mail alebo heslo.', oldEmail: email });
    }
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).render('login', { error: 'Nesprávny e-mail alebo heslo.', oldEmail: email });
    }
    if (user.active === false) {
      return res.status(403).render('login', { error: 'Tvoj účet je zablokovaný.', oldEmail: email });
    }
    setSession(req, user);
    res.redirect('/seasons');
  } catch (err) {
    res.status(500).render('login', { error: 'Chyba pri prihlásení. Skús znova.', oldEmail: req.body.email || '' });
  }
};

// GET /register
const registerPage = (req, res) => {
  if (req.session.userId) return res.redirect('/seasons');
  res.render('register', { error: null });
};

// POST /register
const registerSubmit = async (req, res) => {
  try {
    const { username, email, password, firstName, lastName } = req.body;
    if (!username || !email || !password) {
      return res.status(400).render('register', { error: 'Vyplň prezývku, e-mail aj heslo.' });
    }
    if (password.length < 8) {
      return res.status(400).render('register', { error: 'Heslo musí mať aspoň 8 znakov.' });
    }
    const existing = await User.findOne({ where: { [Op.or]: [{ email }, { username }] } });
    if (existing) {
      return res.status(400).render('register', { error: 'Používateľ s týmto e-mailom alebo prezývkou už existuje.' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      username, email, password: hashed, firstName, lastName, role: 'player',
    });
    setSession(req, user);
    res.redirect('/seasons');
  } catch (err) {
    res.status(500).render('register', { error: 'Chyba pri registrácii. Skús znova.' });
  }
};

// GET /logout
const logout = (req, res) => {
  req.session.destroy(() => res.redirect('/seasons'));
};

module.exports = { loginPage, loginSubmit, registerPage, registerSubmit, logout, forgotPasswordPage };
