const express = require('express');
const { register, login, getProfile, updateProfile, changePassword } = require('../controllers/auth.controller');
const { verifyToken } = require('../middleware/auth.middleware');
// Nové vo Fáze 0: validácia vstupov
const { validate, authRules } = require('../middleware/validate.middleware');

const router = express.Router();

// Verejné routes (nevyžadujú autentifikáciu)
// Pravidlá (authRules.*) bežia pred controllerom, validate vyhodnotí výsledok.
router.post('/register', authRules.register, validate, register);
router.post('/login', authRules.login, validate, login);

// Chránené routes (vyžadujú autentifikáciu)
router.get('/profile', verifyToken, getProfile);
router.put('/profile', verifyToken, updateProfile);
router.put('/change-password', verifyToken, authRules.changePassword, validate, changePassword);

module.exports = router;
