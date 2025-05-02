const express = require('express');
const { 
  getAllRounds, 
  getRoundById, 
  createRound, 
  updateRound, 
  deleteRound 
} = require('../controllers/round.controller');
const { verifyToken } = require('../middleware/auth.middleware');

const router = express.Router();

// Verejné routes
router.get('/', getAllRounds);
router.get('/:id', getRoundById);

// Chránené routes (vyžadujú autentifikáciu)
router.use(verifyToken);
router.post('/', createRound);
router.put('/:id', updateRound);
router.delete('/:id', deleteRound);

module.exports = router;