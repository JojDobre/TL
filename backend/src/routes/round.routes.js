// backend/src/routes/round.routes.js
//
// Kolá. GET sú verejné (leaderboard tiež). Detail kola používa attachUser, aby
// vedel, kto sa pozerá (kvôli skrývaniu cudzích tipov do uzávierky). Akcie
// vyžadujú prihlásenie cez session.

const express = require('express');
const {
  getAllRounds,
  getRoundById,
  createRound,
  updateRound,
  deleteRound,
  getRoundLeaderboard,
} = require('../controllers/round.controller');
const { apiRequireLogin, attachUser } = require('../middleware/page-auth.middleware');

const router = express.Router();

// Verejné (leaderboard verejný; detail s voliteľným userom kvôli tipom)
router.get('/', getAllRounds);
router.get('/:id/leaderboard', getRoundLeaderboard);
router.get('/:id', attachUser, getRoundById);

// Chránené (prihlásený)
router.post('/', apiRequireLogin, createRound);
router.put('/:id', apiRequireLogin, updateRound);
router.delete('/:id', apiRequireLogin, deleteRound);

module.exports = router;
