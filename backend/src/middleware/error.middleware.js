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

  // Na server vždy zalogujeme plný detail (vrátane stack trace) pre ladenie
  console.error(`[ERROR] ${req.method} ${req.originalUrl} ->`, err);

  // Klientovi pošleme len bezpečnú správu. Stack trace pridáme LEN mimo produkcie.
  const responseBody = {
    success: false,
    message,
  };
  if (process.env.NODE_ENV !== 'production') {
    responseBody.stack = err.stack;
  }

  res.status(statusCode).json(responseBody);
};

module.exports = {
  ApiError,
  asyncHandler,
  notFoundHandler,
  errorHandler,
};
