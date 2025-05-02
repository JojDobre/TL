const express = require('express');
const { register, login, getProfile, updateProfile, changePassword } = require('../controllers/auth.controller');
const { verifyToken } = require('../middleware/auth.middleware');

const router = express.Router();

// Verejné routes (nevyžadujú autentifikáciu)
router.post('/register', register);
router.post('/login', login);

// Chránené routes (vyžadujú autentifikáciu)
router.get('/profile', verifyToken, getProfile);
router.put('/profile', verifyToken, updateProfile);
router.put('/change-password', verifyToken, changePassword);

module.exports = router;