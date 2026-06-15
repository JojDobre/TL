// backend/src/middleware/page-auth.middleware.js
//
// Ochrana EJS stránok cez session (ekvivalent React ProtectedRoute).
//  - requireLogin: pustí len prihláseného, inak presmeruje na /login
//  - requireAdmin: pustí len admina, inak na / (alebo /login ak neprihlásený)

// Vyžaduje prihlásenie
const requireLogin = (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
};

// Vyžaduje admin rolu
const requireAdmin = (req, res, next) => {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  if (req.session.userRole !== 'admin') {
    return res.redirect('/seasons'); // neadmin → preč
  }
  next();
};

// API verzia admin ochrany (pre /api/* volané zo stránok cez fetch).
// Namiesto redirectu vracia JSON 401/403. Nastaví req.userId zo session,
// aby controllery (ktoré čítajú prihláseného) fungovali aj bez JWT.
const apiRequireAdmin = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Neprihlásený.' });
  }
  if (req.session.userRole !== 'admin') {
    return res.status(403).json({ success: false, message: 'Vyžaduje sa admin rola.' });
  }
  req.userId = req.session.userId;
  next();
};

// API verzia ochrany pre prihlásených (JSON 401 namiesto redirectu).
const apiRequireLogin = (req, res, next) => {
  if (!req.session.userId) {
    return res.status(401).json({ success: false, message: 'Musíš byť prihlásený.' });
  }
  req.userId = req.session.userId;
  next();
};

// Voliteľne pripojí prihláseného (req.userId) zo session, ale NIKOHO neblokuje.
// Pre verejné GET, kde sa obsah líši podľa toho, či/kto je prihlásený
// (napr. skrytie cudzích tipov do uzávierky kola).
const attachUser = (req, res, next) => {
  if (req.session && req.session.userId) {
    req.userId = req.session.userId;
    req.userRole = req.session.userRole;
  }
  next();
};

module.exports = { requireLogin, requireAdmin, apiRequireAdmin, apiRequireLogin, attachUser };