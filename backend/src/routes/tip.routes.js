// backend/src/routes/tip.routes.js
//
// Tipy. Všetko vyžaduje prihlásenie (tipuješ za seba) — cez session.

const express = require('express');
const {
  getUserTipForMatch,
  getUserTips,
  createOrUpdateTip,
} = require('../controllers/tip.controller');
const { apiRequireLogin } = require('../middleware/page-auth.middleware');

const router = express.Router();

router.use(apiRequireLogin);

router.get('/match/:matchId', getUserTipForMatch);
router.get('/user', getUserTips);
router.post('/', createOrUpdateTip);

module.exports = router;
