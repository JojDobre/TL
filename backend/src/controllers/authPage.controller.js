// backend/src/controllers/authPage.controller.js
//
// Server-rendered auth: vykreslí login/register stránky (GET), spracuje
// odoslané formuláre (POST) cez session, a odhlási (logout).
// Logika overenia hesla je rovnaká ako v API auth.controller — líši sa len tým,
// že namiesto JWT tokenu ukladáme údaje do req.session a presmerujeme.

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { User, PasswordResetToken, Sequelize } = require('../models');
const Op = Sequelize.Op;
const { sendPasswordResetEmail } = require('../services/email.service');

// Platnosť reset odkazu v minútach (rozumný kompromis medzi pohodlím a bezpečnosťou).
const RESET_TOKEN_MINUTES = 60;

// pomocník: uloží prihláseného používateľa do session
function setSession(req, user) {
  req.session.userId = user.id;
  req.session.userRole = user.role;
  req.session.userName = user.username || [user.firstName, user.lastName].filter(Boolean).join(' ');
}

// pomocník: zahashuje surový token (rovnaký postup pri uložení aj pri overení)
function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

// GET /login
const loginPage = (req, res) => {
  if (req.session.userId) return res.redirect('/seasons');
  res.render('login', { error: null, oldEmail: '' });
};

// GET /forgot-password — stránka so žiadosťou o obnovu hesla.
const forgotPasswordPage = (req, res) => {
  if (req.session.userId) return res.redirect('/seasons');
  // sent=false → zobrazí sa fáza so vstupom e-mailu (fáza 1)
  res.render('forgot-password', { sent: false, error: null });
};

// POST /forgot-password — prijme e-mail, vygeneruje token a pošle odkaz.
//
// BEZPEČNOSŤ: bez ohľadu na to, či e-mail v DB existuje, vraciame rovnakú
// odpoveď ("ak účet existuje, poslali sme odkaz"). Tým neumožníme útočníkovi
// zistiť, ktoré e-maily sú zaregistrované (account enumeration).
const forgotPasswordSubmit = async (req, res) => {
  const { email } = req.body;
  try {
    if (email) {
      const user = await User.findOne({ where: { email } });
      if (user && user.active !== false) {
        // Zneplatníme prípadné staré nepoužité tokeny tohto usera, aby vždy
        // platil len posledný odoslaný odkaz.
        await PasswordResetToken.update(
          { usedAt: new Date() },
          { where: { userId: user.id, usedAt: null } }
        );

        // Vygenerujeme kryptograficky silný surový token (v odkaze) a uložíme len jeho hash.
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashToken(rawToken);
        const expiresAt = new Date(Date.now() + RESET_TOKEN_MINUTES * 60 * 1000);

        await PasswordResetToken.create({ userId: user.id, tokenHash, expiresAt });

        // Zostavíme plný odkaz. APP_URL má byť napr. https://tifo.sk (bez koncového /).
        const base = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
        const resetUrl = `${base}/reset-password?token=${rawToken}`;

        // E-mail posielame "fire-and-forget" v rámci requestu, ale chyby logujeme.
        const result = await sendPasswordResetEmail({
          to: user.email,
          name: user.username || user.firstName || '',
          resetUrl,
          minutes: RESET_TOKEN_MINUTES,
        });
        if (!result.success && !result.skipped) {
          console.error('[forgot-password] e-mail sa nepodarilo odoslať pre', user.email);
        }
      }
    }
  } catch (err) {
    // Ani pri internej chybe neodhalíme detaily — len zalogujeme.
    console.error('[forgot-password] chyba:', err);
  }

  // Vždy rovnaká neutrálna odpoveď (fáza 2 — "skontroluj e-mail").
  return res.render('forgot-password', { sent: true, error: null });
};

// GET /reset-password?token=... — stránka na nastavenie nového hesla.
// Overí token a podľa platnosti zobrazí formulár alebo chybový stav.
const resetPasswordPage = async (req, res) => {
  const rawToken = req.query.token || '';
  const validToken = await isResetTokenValid(rawToken);
  res.render('reset-password', {
    token: rawToken,
    validToken,
    error: null,
  });
};

// POST /reset-password — overí token a uloží nové heslo.
const resetPasswordSubmit = async (req, res) => {
  const { token, password, confirmPassword } = req.body;

  try {
    // Validácia hesla na backende (frontend validáciu nestačí dôverovať).
    if (!password || password.length < 8) {
      return res.status(400).render('reset-password', {
        token, validToken: true,
        error: 'Heslo musí mať aspoň 8 znakov.',
      });
    }
    if (password !== confirmPassword) {
      return res.status(400).render('reset-password', {
        token, validToken: true,
        error: 'Heslá sa nezhodujú.',
      });
    }

    // Nájdeme platný, nepoužitý a neexpirovaný token podľa hashu.
    const tokenHash = hashToken(token);
    const record = await PasswordResetToken.findOne({
      where: { tokenHash, usedAt: null, expiresAt: { [Op.gt]: new Date() } },
    });
    if (!record) {
      return res.status(400).render('reset-password', {
        token, validToken: false,
        error: 'Odkaz na obnovu je neplatný alebo expiroval.',
      });
    }

    // Nastavíme nové heslo používateľovi.
    const user = await User.findByPk(record.userId);
    if (!user) {
      return res.status(400).render('reset-password', {
        token, validToken: false,
        error: 'Účet sa nenašiel.',
      });
    }
    user.password = await bcrypt.hash(password, 10);
    await user.save();

    // Token zneplatníme (jednorazové použitie).
    record.usedAt = new Date();
    await record.save();

    // Pre istotu zneplatníme aj všetky ostatné nepoužité tokeny usera.
    await PasswordResetToken.update(
      { usedAt: new Date() },
      { where: { userId: user.id, usedAt: null } }
    );

    // Hotovo → render stavu "heslo zmenené".
    return res.render('reset-password', { token: '', validToken: true, error: null, done: true });
  } catch (err) {
    console.error('[reset-password] chyba:', err);
    return res.status(500).render('reset-password', {
      token, validToken: true,
      error: 'Niečo sa pokazilo. Skús to znova.',
    });
  }
};

// pomocník: overí, či surový token zodpovedá platnému, nepoužitému záznamu
async function isResetTokenValid(rawToken) {
  if (!rawToken) return false;
  const tokenHash = hashToken(rawToken);
  const record = await PasswordResetToken.findOne({
    where: { tokenHash, usedAt: null, expiresAt: { [Op.gt]: new Date() } },
  });
  return !!record;
}

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

module.exports = {
  loginPage,
  loginSubmit,
  registerPage,
  registerSubmit,
  logout,
  forgotPasswordPage,
  forgotPasswordSubmit,
  resetPasswordPage,
  resetPasswordSubmit,
};