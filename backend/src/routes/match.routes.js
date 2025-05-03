// backend/src/routes/match.routes.js
const express = require('express');
const { 
  getAllMatches, 
  getMatchById, 
  createMatch, 
  updateMatch, 
  deleteMatch,
  evaluateMatch 
} = require('../controllers/match.controller');
const { verifyToken } = require('../middleware/auth.middleware');

const router = express.Router();

// Verejné routes
router.get('/', getAllMatches);
router.get('/:id', getMatchById);

// Chránené routes (vyžadujú autentifikáciu)
router.use(verifyToken);
router.post('/', createMatch);
router.put('/:id', updateMatch);
router.delete('/:id', deleteMatch);
router.post('/:id/evaluate', evaluateMatch);

module.exports = router;