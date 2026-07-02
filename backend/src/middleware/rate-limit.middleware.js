// backend/src/middleware/rate-limit.middleware.js
//
// Ochrana proti brute-force útokom na citlivé endpointy (prihlásenie,
// registrácia, obnova hesla). Obmedzuje počet pokusov z jednej IP za okno.
//
// Pozn.: aplikácia beží za reverse proxy (app.set('trust proxy', 1) v index.js),
// takže express-rate-limit vidí reálnu IP klienta z X-Forwarded-For.

const rateLimit = require('express-rate-limit');

// Spoločné správanie pri prekročení limitu: HTML stránke vrátime peknú hlášku,
// API (/api/*) dostane JSON. Rozlíšenie podľa cesty/Accept hlavičky.
function limitHandler(req, res /* , next, options */) {
  const msg = 'Priveľa pokusov. Skús to znova o chvíľu.';
  const wantsJson = req.originalUrl.startsWith('/api/')
    || (req.headers.accept || '').includes('application/json')
    || (req.headers['content-type'] || '').includes('application/json')
    || req.headers['x-requested-with'] === 'XMLHttpRequest';
  if (wantsJson) {
    return res.status(429).json({ success: false, message: msg });
  }
  try {
    return res.status(429).render('error-page', { statusCode: 429, message: msg });
  } catch (e) {
    return res.status(429).json({ success: false, message: msg });
  }
}

// Prihlásenie: prísnejší limit (brána pre útok na heslá).
// 10 pokusov / 15 min na IP. Úspešné požiadavky sa nerátajú (aby bežný používateľ
// s viacerými prihláseniami z jednej siete nebol blokovaný zbytočne).
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: limitHandler,
});

// Registrácia: 5 nových účtov / hodinu na IP (proti hromadnému zakladaniu účtov).
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler,
});

// Obnova hesla: 5 žiadostí / hodinu na IP (proti spamovaniu e-mailov a enumerácii).
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: limitHandler,
});

module.exports = { loginLimiter, registerLimiter, passwordResetLimiter };
