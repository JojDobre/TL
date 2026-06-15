// backend/src/routes/league.routes.js
//
// Ligy. GET sú verejné, akcie (vytvoriť/pripojiť/upraviť/zmazať) vyžadujú
// prihlásenie cez session (apiRequireLogin nastaví req.userId zo session).

const express = require('express');
const {
  getAllLeagues,
  getLeagueById,
  createLeague,
  joinLeague,
  updateLeague,
  deleteLeague,
  getLeagueLeaderboard,
} = require('../controllers/league.controller');
const { apiRequireLogin } = require('../middleware/page-auth.middleware');

const router = express.Router();

// Verejné
router.get('/', getAllLeagues);
router.get('/:id', getLeagueById);
router.get('/:id/leaderboard', getLeagueLeaderboard);

// Chránené (prihlásený) — POZOR: /join pred /:id nie je nutné (rozdielne metódy/cesty),
// ale držíme poriadok
router.use(apiRequireLogin);
router.post('/', createLeague);
router.post('/join', joinLeague);
router.put('/:id', updateLeague);
router.delete('/:id', deleteLeague);

module.exports = router;
