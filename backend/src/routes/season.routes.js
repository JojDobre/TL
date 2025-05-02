const express = require('express');
const { 
  getAllSeasons, 
  getSeasonById, 
  createSeason, 
  updateSeason, 
  deleteSeason, 
  joinSeason, 
  getSeasonLeaderboard 
} = require('../controllers/season.controller');
const { verifyToken, isAdmin } = require('../middleware/auth.middleware');

const router = express.Router();

// Verejné routes
router.get('/', getAllSeasons);
router.get('/:id', getSeasonById);
router.get('/:id/leaderboard', getSeasonLeaderboard);

// Chránené routes (vyžadujú autentifikáciu)
router.use(verifyToken);
router.post('/', createSeason);
router.put('/:id', updateSeason);
router.delete('/:id', deleteSeason);
router.post('/join', joinSeason);

module.exports = router;