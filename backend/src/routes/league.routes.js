const express = require('express');
const { 
  getAllLeagues, 
  getLeagueById, 
  createLeague, 
  updateLeague, 
  deleteLeague, 
  getLeagueLeaderboard 
} = require('../controllers/league.controller');
const { verifyToken } = require('../middleware/auth.middleware');

const router = express.Router();

// Verejné routes
router.get('/', getAllLeagues);
router.get('/:id', getLeagueById);
router.get('/:id/leaderboard', getLeagueLeaderboard);

// Chránené routes (vyžadujú autentifikáciu)
router.use(verifyToken);
router.post('/', createLeague);
router.put('/:id', updateLeague);
router.delete('/:id', deleteLeague);

module.exports = router;