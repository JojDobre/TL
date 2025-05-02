// backend/src/routes/tip.routes.js
const express = require('express');
const { 
  getUserTipForMatch,
  getUserTips,
  createOrUpdateTip
} = require('../controllers/tip.controller');
const { verifyToken } = require('../middleware/auth.middleware');

const router = express.Router();

// Všetky routes vyžadujú autentifikáciu
router.use(verifyToken);

router.get('/match/:matchId', getUserTipForMatch);
router.get('/user', getUserTips);
router.post('/', createOrUpdateTip);

module.exports = router;