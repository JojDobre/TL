// backend/src/middleware/csrf.middleware.js
//
// CSRF ochrana pre server-rendered appku so session (synchronizer token pattern).
//
// Ako to funguje:
//  1) Pre každú session vygenerujeme náhodný token (uložený v req.session.csrfToken).
//  2) Token sprístupníme šablónam ako res.locals.csrfToken — vkladá sa do formulárov
//     (skryté pole `_csrf`) aj do <meta name="csrf-token"> pre fetch akcie.
//  3) Pri každej mutujúcej požiadavke (POST/PUT/PATCH/DELETE) porovnáme token
//     z tela (`_csrf`) alebo hlavičky (`x-csrf-token`) so session tokenom.
//     Ak nesedí → 403.
//
// GET/HEAD/OPTIONS sa nekontrolujú (sú bezpečné/idempotentné).
// /api/auth/* login a register sú tiež mutujúce — token doň dodá login/register
// stránka. Verejné webhooky (žiadne tu nie sú) by sa museli explicitne vyňať.

const crypto = require('crypto');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

// Zabezpečí, že session má CSRF token, a sprístupní ho šablónam.
function provideCsrfToken(req, res, next) {
  if (req.session) {
    if (!req.session.csrfToken) req.session.csrfToken = generateToken();
    res.locals.csrfToken = req.session.csrfToken;
  } else {
    res.locals.csrfToken = '';
  }
  next();
}

// Overí token pri mutujúcich požiadavkách. Časovo konštantné porovnanie.
function verifyCsrf(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const sessionToken = req.session && req.session.csrfToken;
  const sent = (req.body && req.body._csrf)
    || req.headers['x-csrf-token']
    || req.headers['x-xsrf-token'];

  const ok = sessionToken && sent
    && sessionToken.length === String(sent).length
    && crypto.timingSafeEqual(Buffer.from(sessionToken), Buffer.from(String(sent)));

  if (!ok) {
    const msg = 'Neplatný alebo chýbajúci bezpečnostný token. Obnov stránku a skús to znova.';
    // JSON vraciame API cestám a fetch klientom (JSON telo / accept / csrf hlavička);
    // klasické HTML formuláre dostanú error stránku.
    const wantsJson = req.originalUrl.startsWith('/api/')
      || (req.headers.accept || '').includes('application/json')
      || (req.headers['content-type'] || '').includes('application/json')
      || req.headers['x-csrf-token'] !== undefined
      || req.headers['x-requested-with'] === 'XMLHttpRequest';
    if (wantsJson) return res.status(403).json({ success: false, message: msg });
    try {
      return res.status(403).render('error-page', { statusCode: 403, message: msg });
    } catch (e) {
      return res.status(403).json({ success: false, message: msg });
    }
  }
  return next();
}

module.exports = { provideCsrfToken, verifyCsrf, generateToken };
