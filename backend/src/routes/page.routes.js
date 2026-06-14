// backend/src/routes/page.routes.js
//
// Routy, ktoré vracajú HTML stránky (EJS). API routy (JSON) sú oddelene pod /api/*.

const express = require('express');
const router = express.Router();

const { seasonsPage } = require('../controllers/page.controller');
const {
  loginPage, loginSubmit,
  registerPage, registerSubmit,
  logout,
} = require('../controllers/authPage.controller');

// Domov → zatiaľ na sezóny (home doplníme neskôr)
router.get('/', (req, res) => res.redirect('/seasons'));

// Auth
router.get('/login', loginPage);
router.post('/login', loginSubmit);
router.get('/register', registerPage);
router.post('/register', registerSubmit);
router.get('/logout', logout);

// Sezóny
router.get('/seasons', seasonsPage);

module.exports = router;
