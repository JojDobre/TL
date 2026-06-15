// backend/src/routes/match.routes.js
//
// Zápasy. GET verejné. Akcie (vytvoriť/upraviť/zmazať/vyhodnotiť) vyžadujú
// prihlásenie cez session; oprávnenie (správca) rieši controller.

const express = require('express');
const {
  getAllMatches,
  getMatchById,
  createMatch,
  updateMatch,
  deleteMatch,
  evaluateMatch,
} = require('../controllers/match.controller');
const { apiRequireLogin } = require('../middleware/page-auth.middleware');

const router = express.Router();

// Verejné
router.get('/', getAllMatches);
router.get('/:id', getMatchById);

// Chránené (prihlásený; oprávnenie správcu kontroluje controller)
router.post('/', apiRequireLogin, createMatch);
router.put('/:id', apiRequireLogin, updateMatch);
router.delete('/:id', apiRequireLogin, deleteMatch);
router.post('/:id/evaluate', apiRequireLogin, evaluateMatch);

module.exports = router;
