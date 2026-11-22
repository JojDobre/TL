// backend/src/controllers/googleAuth.controller.js
//
// PRIHLÁSENIE CEZ GOOGLE (OAuth 2.0 / OpenID Connect, „authorization code“ tok).
//   GET /auth/google            → presmerovanie na výber Google účtu
//   GET /auth/google/callback   → Google vráti kód, vymeníme ho za ID token,
//                                 nájdeme/založíme používateľa a prihlásime ho
// Bez ďalších knižníc. ID token prichádza priamo z tokenového endpointu Google
// cez overené HTTPS spojenie (výmena kódu s client secret), preto stačí
// skontrolovať jeho obsah (iss, aud, exp) — OpenID Connect Core 3.1.3.7.
//
// Nastavenie (.env na serveri):
//   GOOGLE_CLIENT_ID=…apps.googleusercontent.com
//   GOOGLE_CLIENT_SECRET=…
//   APP_URL=https://tifo.sk      (presmerovacia adresa = APP_URL + /auth/google/callback)
// Bez GOOGLE_CLIENT_ID/SECRET sa tlačidlo „Pokračovať cez Google“ nezobrazí.

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { User, Sequelize } = require('../models');

const { Op } = Sequelize;
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];

const enabled = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

function redirectUri(req) {
  const base = (process.env.APP_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  return `${base}/auth/google/callback`;
}

// kam po prihlásení — len lokálna cesta (žiadne presmerovanie na cudzí web)
function safeNext(v) {
  const s = String(v || '');
  return /^\/(?!\/)[\w\-./?=&%#]*$/.test(s) ? s : '/my';
}

function decodeJwtPayload(jwt) {
  const part = String(jwt || '').split('.')[1];
  if (!part) return null;
  try { return JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')); } catch (e) { return null; }
}

// prezývka z mena / e-mailu, unikátna (pridá číslo, ak je obsadená)
async function uniqueUsername(profile) {
  const raw = (profile.given_name || String(profile.email || '').split('@')[0] || 'hrac')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 18) || 'hrac';
  const base = raw.length >= 3 ? raw : `${raw}hrac`;
  for (let i = 0; i < 30; i++) {
    const name = i === 0 ? base : `${base}${Math.floor(10 + Math.random() * (i < 10 ? 90 : 9990))}`;
    // eslint-disable-next-line no-await-in-loop
    if (!(await User.findOne({ where: { username: name }, attributes: ['id'] }))) return name;
  }
  return `${base}${Date.now().toString(36)}`;
}

function fail(req, res, msg) {
  const page = req.session && req.session.googleIntent === 'register' ? 'register' : 'login';
  if (req.session) { delete req.session.googleState; delete req.session.googleNext; delete req.session.googleIntent; }
  return res.status(400).render(page, { error: msg, oldEmail: '' });
}

// GET /auth/google?next=/app&intent=register
const start = (req, res) => {
  if (!enabled()) return res.redirect('/login');
  const state = crypto.randomBytes(24).toString('hex');
  req.session.googleState = state;
  req.session.googleNext = safeNext(req.query.next);
  req.session.googleIntent = req.query.intent === 'register' ? 'register' : 'login';
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(req),
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  // session sa uloží pred presmerovaním (inak by state pri návrate chýbal)
  req.session.save(() => res.redirect(`${AUTH_URL}?${q.toString()}`));
};

// GET /auth/google/callback?code=…&state=…
const callback = async (req, res) => {
  if (!enabled()) return res.redirect('/login');
  if (req.query.error) return fail(req, res, 'Prihlásenie cez Google bolo zrušené.');
  const expected = req.session && req.session.googleState;
  if (!expected || !req.query.state || req.query.state !== expected || !req.query.code) {
    return fail(req, res, 'Prihlásenie cez Google vypršalo. Skús to znova.');
  }
  const next = req.session.googleNext || '/my';

  let profile;
  try {
    const r = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body: new URLSearchParams({
        code: String(req.query.code),
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri(req),
        grant_type: 'authorization_code',
      }).toString(),
      signal: AbortSignal.timeout(10000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.id_token) throw new Error(j.error_description || j.error || `HTTP ${r.status}`);
    profile = decodeJwtPayload(j.id_token);
  } catch (e) {
    console.error('[google-auth] výmena kódu zlyhala:', e.message);
    return fail(req, res, 'Google prihlásenie sa nepodarilo. Skús to znova.');
  }

  if (!profile || !ISSUERS.includes(profile.iss) || profile.aud !== process.env.GOOGLE_CLIENT_ID
    || !profile.sub || (profile.exp && profile.exp * 1000 < Date.now())) {
    return fail(req, res, 'Google prihlásenie sa nepodarilo overiť.');
  }
  if (!profile.email || profile.email_verified === false || profile.email_verified === 'false') {
    return fail(req, res, 'Google účet nemá overený e-mail.');
  }

  try {
    const email = String(profile.email).toLowerCase();
    // 1) už prepojený účet  2) existujúci účet s rovnakým (overeným) e-mailom  3) nový
    let user = await User.findOne({ where: { googleId: String(profile.sub) } });
    if (!user) user = await User.findOne({ where: { email: { [Op.in]: [email, profile.email] } } });
    if (user) {
      if (user.active === false) return fail(req, res, 'Tvoj účet je zablokovaný.');
      const upd = {};
      if (!user.googleId) upd.googleId = String(profile.sub);
      if (!user.profileImage && profile.picture) upd.profileImage = String(profile.picture).slice(0, 250);
      if (Object.keys(upd).length) await user.update(upd);
    } else {
      user = await User.create({
        username: await uniqueUsername(profile),
        email,
        // heslo sa nepoužíva (prihlasuje sa cez Google); dá sa nastaviť cez „Zabudol si heslo?“
        password: await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10),
        firstName: profile.given_name ? String(profile.given_name).slice(0, 60) : null,
        lastName: profile.family_name ? String(profile.family_name).slice(0, 60) : null,
        profileImage: profile.picture ? String(profile.picture).slice(0, 250) : null,
        googleId: String(profile.sub),
        role: 'player',
      });
      try { require('../utils/achievement.engine').evaluateInBackground([user.id]); } catch (e) { /* nič */ }
    }

    // nová session (ochrana pred session fixation), potom prihlásenie
    req.session.regenerate((err) => {
      if (err) return fail(req, res, 'Prihlásenie sa nepodarilo. Skús to znova.');
      req.session.userId = user.id;
      req.session.userRole = user.role;
      req.session.userName = user.username || [user.firstName, user.lastName].filter(Boolean).join(' ');
      req.session.save(() => res.redirect(next));
    });
  } catch (e) {
    console.error('[google-auth] prihlásenie zlyhalo:', e.message);
    return fail(req, res, 'Prihlásenie sa nepodarilo. Skús to znova.');
  }
};

module.exports = { start, callback, enabled, _test: { safeNext, decodeJwtPayload, uniqueUsername } };
