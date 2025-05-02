const express = require('express');
const { 
  getAllTeams, 
  getTeamById, 
  createTeam, 
  updateTeam, 
  deleteTeam 
} = require('../controllers/team.controller');
const { verifyToken } = require('../middleware/auth.middleware');

const router = express.Router();

// Verejné routes
router.get('/', getAllTeams);
router.get('/:id', getTeamById);

// Chránené routes (vyžadujú autentifikáciu)
router.use(verifyToken);
router.post('/', createTeam);
router.put('/:id', updateTeam);
router.delete('/:id', deleteTeam);

module.exports = router;