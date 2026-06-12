// backend/src/middleware/validate.middleware.js
//
// Validácia vstupov pomocou express-validator.
// Vyžaduje balík:  npm install express-validator
//
// Použitie v routes, napr.:
//   const { validate, authRules } = require('../middleware/validate.middleware');
//   router.post('/register', authRules.register, validate, register);

const { body, validationResult } = require('express-validator');

// Middleware, ktorý vyhodnotí výsledky validácie a v prípade chýb
// vráti 400 s prehľadným zoznamom. Dáva sa ZA pravidlá a PRED controller.
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Neplatné vstupné údaje.',
      errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

// --- Sady pravidiel pre jednotlivé domény ---

const authRules = {
  register: [
    body('username').trim().isLength({ min: 3, max: 30 })
      .withMessage('Používateľské meno musí mať 3 až 30 znakov.'),
    body('email').trim().isEmail()
      .withMessage('Zadaj platný e-mail.').normalizeEmail(),
    body('password').isLength({ min: 6 })
      .withMessage('Heslo musí mať aspoň 6 znakov.'),
    body('firstName').optional().trim().isLength({ max: 50 }),
    body('lastName').optional().trim().isLength({ max: 50 }),
  ],
  login: [
    body('email').trim().isEmail().withMessage('Zadaj platný e-mail.'),
    body('password').notEmpty().withMessage('Heslo je povinné.'),
  ],
  changePassword: [
    body('currentPassword').notEmpty().withMessage('Aktuálne heslo je povinné.'),
    body('newPassword').isLength({ min: 6 })
      .withMessage('Nové heslo musí mať aspoň 6 znakov.'),
  ],
};

const seasonRules = {
  create: [
    body('name').trim().notEmpty().withMessage('Názov sezóny je povinný.')
      .isLength({ max: 100 }).withMessage('Názov je príliš dlhý.'),
    body('type').optional().isIn(['official', 'community'])
      .withMessage('Typ musí byť official alebo community.'),
  ],
};

const leagueRules = {
  create: [
    body('name').trim().notEmpty().withMessage('Názov ligy je povinný.')
      .isLength({ max: 100 }).withMessage('Názov je príliš dlhý.'),
    body('seasonId').notEmpty().withMessage('Sezóna je povinná.'),
  ],
};

const roundRules = {
  create: [
    body('name').trim().notEmpty().withMessage('Názov kola je povinný.'),
    body('leagueId').notEmpty().withMessage('Liga je povinná.'),
  ],
};

const matchRules = {
  create: [
    body('homeTeamId').notEmpty().withMessage('Domáci tím je povinný.'),
    body('awayTeamId').notEmpty().withMessage('Hosťujúci tím je povinný.'),
    body('matchDate').optional().isISO8601()
      .withMessage('Dátum zápasu musí byť platný.'),
  ],
};

const tipRules = {
  create: [
    body('matchId').notEmpty().withMessage('Zápas je povinný.'),
    body('homeScore').isInt({ min: 0 }).withMessage('Skóre musí byť 0 alebo viac.'),
    body('awayScore').isInt({ min: 0 }).withMessage('Skóre musí byť 0 alebo viac.'),
  ],
};

module.exports = {
  validate,
  authRules,
  seasonRules,
  leagueRules,
  roundRules,
  matchRules,
  tipRules,
};
