// backend/src/middleware/error.middleware.js
//
// Centrálne spracovanie chýb pre celé API.
// Cieľ: nahradiť opakované try/catch bloky v controlleroch a zabrániť tomu,
// aby sa interné detaily chýb (DB hlášky, stack trace) dostali ku klientovi.

// Vlastná trieda chyby — umožňuje v controlleri jednoducho "vyhodiť" chybu
// so správnym HTTP statusom a peknou správou, napr.:
//   throw new ApiError(404, 'Sezóna nenájdená.');
class ApiError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;   // HTTP status, ktorý sa pošle klientovi
    this.isOperational = true;      // Označenie, že ide o očakávanú/zvládnutú chybu
  }
}

// Obal pre async controllery. Odchytí akúkoľvek odmietnutú Promise
// a pošle ju do centrálneho error handleru, takže v controlleri
// už nemusíš písať try/catch:
//   router.get('/', asyncHandler(async (req, res) => { ... }));
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Middleware pre neexistujúce cesty (404). Registruje sa za všetky routes.
const notFoundHandler = (req, res, next) => {
  next(new ApiError(404, `Cesta ${req.originalUrl} neexistuje.`));
};

// Hlavný error handler. Musí mať 4 parametre, aby ho Express rozpoznal.
// Registruje sa ako ÚPLNE POSLEDNÝ middleware v index.js.
const errorHandler = (err, req, res, next) => {
  // Preklad známych Sequelize chýb na zrozumiteľné správy a správny status
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Interná chyba servera.';

  if (err.name === 'SequelizeValidationError' || err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 400;
    // Spojíme validačné správy z modelu do jednej čitateľnej hlášky
    message = err.errors?.map((e) => e.message).join(', ') || 'Neplatné údaje.';
  } else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Neplatný token.';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token vypršal.';
  }

  // Na server vždy zalogujeme plný detail (vrátane stack trace) pre ladenie.
  // 404 nelogujeme ako chybu (zbytočný šum z botov a preklepov v URL).
  if (statusCode !== 404) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl} ->`, err);
  }

  // Rozhodnutie JSON vs HTML:
  //  - API požiadavky (/api/*) a klienti, čo si pýtajú JSON → JSON odpoveď
  //  - bežná návšteva v prehliadači (zlý odkaz) → vyrenderovaná error-page.ejs
  const wantsJson =
    req.originalUrl.startsWith('/api/') ||
    req.xhr ||
    (req.headers.accept && req.headers.accept.indexOf('application/json') !== -1 &&
      (!req.headers.accept || req.headers.accept.indexOf('text/html') === -1));

  if (wantsJson) {
    // Klientovi pošleme len bezpečnú správu. Stack trace pridáme LEN mimo produkcie.
    const responseBody = { success: false, message };
    if (process.env.NODE_ENV !== 'production') responseBody.stack = err.stack;
    return res.status(statusCode).json(responseBody);
  }

  // HTML stránka chyby. Pri 404 zobrazíme priateľskú hlášku, inak konkrétnu správu.
  const pageMessage = statusCode === 404
    ? 'Stránka nebola nájdená.'
    : message;

  // render môže sám zlyhať (napr. chýbajúca šablóna) — preto fallback na plain text,
  // aby sme sa nikdy nezacyklili v ďalšej chybe.
  res.status(statusCode).render('error-page', { statusCode, message: pageMessage }, (renderErr, html) => {
    if (renderErr) {
      console.error('[ERROR] Render error-page zlyhal ->', renderErr);
      return res.status(statusCode).type('text/plain').send(`${statusCode} — ${pageMessage}`);
    }
    res.send(html);
  });
};

module.exports = {
  ApiError,
  asyncHandler,
  notFoundHandler,
  errorHandler,
};