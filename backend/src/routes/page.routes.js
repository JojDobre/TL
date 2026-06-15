// backend/src/routes/page.routes.js
//
// Routy, ktoré vracajú HTML stránky (EJS). API routy (JSON) sú oddelene pod /api/*.

const express = require('express');
const router = express.Router();

const {
  seasonsPage, seasonDetailPage,
  createSeasonPage, createSeasonSubmit, joinSeasonSubmit,
  manageSeasonPage, manageSeasonSubmit, endSeasonSubmit,
} = require('../controllers/page.controller');
const {
  loginPage, loginSubmit, registerPage, registerSubmit, logout,
} = require('../controllers/authPage.controller');
const { adminUsersPage } = require('../controllers/adminPage.controller');
const { leagueDetailPage, joinLeagueSubmit, createLeaguePage, createLeagueSubmit, editLeaguePage, editLeagueSubmit } = require('../controllers/leaguePage.controller');
const { roundDetailPage } = require('../controllers/roundPage.controller');
const { createRoundPage, createRoundSubmit } = require('../controllers/roundPageCreate.controller');
const { createMatchesPage } = require('../controllers/matchPage.controller');
const { evaluatePage } = require('../controllers/evaluatePage.controller');
const { teamsAdminPage } = require('../controllers/teamAdminPage.controller');
const { listTeams, createTeam, bulkCreateTeams, deleteTeam } = require('../controllers/teamAdmin.controller');
const { requireLogin, requireAdmin, apiRequireAdmin, attachUser } = require('../middleware/page-auth.middleware');

// Domov → zatiaľ na sezóny
router.get('/', (req, res) => res.redirect('/seasons'));

// Auth
router.get('/login', loginPage);
router.post('/login', loginSubmit);
router.get('/register', registerPage);
router.post('/register', registerSubmit);
router.get('/logout', logout);

// Sezóny — POZOR na poradie: /create a /join PRED /:id
router.get('/seasons', attachUser, seasonsPage);
router.get('/seasons/create', requireLogin, createSeasonPage);
router.post('/seasons/create', requireLogin, createSeasonSubmit);
router.post('/seasons/join', requireLogin, joinSeasonSubmit);
router.get('/seasons/:id/manage', requireLogin, manageSeasonPage);
router.post('/seasons/:id/manage', requireLogin, manageSeasonSubmit);
router.post('/seasons/:id/end', requireLogin, endSeasonSubmit);
router.get('/seasons/:id', attachUser, seasonDetailPage);

// Ligy — /create a /join PRED /:id
router.post('/leagues/join', requireLogin, joinLeagueSubmit);
router.get('/leagues/create', requireLogin, createLeaguePage);
router.post('/leagues/create', requireLogin, createLeagueSubmit);
router.get('/leagues/:id/edit', requireLogin, editLeaguePage);
router.post('/leagues/:id/edit', requireLogin, editLeagueSubmit);
router.get('/leagues/:id', attachUser, leagueDetailPage);

// Kolá — /create PRED /:id
router.get('/rounds/create', requireLogin, createRoundPage);
router.post('/rounds/create', requireLogin, createRoundSubmit);
router.get('/rounds/:id/matches/create', requireLogin, createMatchesPage);
router.get('/rounds/:id/evaluate', requireLogin, evaluatePage);
router.get('/rounds/:id', attachUser, roundDetailPage);

// Admin
router.get('/admin/users', requireAdmin, adminUsersPage);
router.get('/admin/teams', requireAdmin, teamsAdminPage);

// Admin API — tímy (JSON, cez session admin)
router.get('/api/admin/teams', apiRequireAdmin, listTeams);
router.post('/api/admin/teams', apiRequireAdmin, createTeam);
router.post('/api/admin/teams/bulk', apiRequireAdmin, bulkCreateTeams);
router.delete('/api/admin/teams/:id', apiRequireAdmin, deleteTeam);

module.exports = router;
