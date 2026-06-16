// backend/src/routes/page.routes.js
//
// Routy, ktoré vracajú HTML stránky (EJS). API routy (JSON) sú oddelene pod /api/*.

const express = require('express');
const router = express.Router();

const {
  seasonsPage, seasonDetailPage,
  createSeasonPage, createSeasonSubmit, joinSeasonSubmit,
  manageSeasonPage, manageSeasonSubmit, endSeasonSubmit,
  deleteSeasonSubmit, leaveSeasonSubmit, seasonMembersPage, seasonMemberAction,
} = require('../controllers/page.controller');
const {
  loginPage, loginSubmit, registerPage, registerSubmit, logout,
} = require('../controllers/authPage.controller');
const { adminDashboardPage, adminUsersPage, adminCompetitionsPage } = require('../controllers/adminPage.controller');
const { leagueDetailPage, joinLeagueSubmit, createLeaguePage, createLeagueSubmit, editLeaguePage, editLeagueSubmit, deleteLeagueSubmit, leaveLeagueSubmit, leagueMembersPage, leagueMemberAction, endLeagueSubmit } = require('../controllers/leaguePage.controller');
const { roundDetailPage } = require('../controllers/roundPage.controller');
const { createRoundPage, createRoundSubmit, editRoundPage } = require('../controllers/roundPageCreate.controller');
const { createMatchesPage } = require('../controllers/matchPage.controller');
const { evaluatePage } = require('../controllers/evaluatePage.controller');
const { teamsAdminPage } = require('../controllers/teamAdminPage.controller');
const { listTeams, createTeam, bulkCreateTeams, deleteTeam, updateTeam } = require('../controllers/teamAdmin.controller');
const { availableTeams, leagueTeams, addTeam, removeTeam, createCustomTeam, updateCustomTeam, deleteCustomTeam } = require('../controllers/leagueTeam.controller');
const { updateRound, deleteRound } = require('../controllers/round.controller');
const { updateMatch, bulkCreateMatches } = require('../controllers/match.controller');
const { seasonLeaderboardPage } = require('../controllers/leaderboardPage.controller');
const { seasonMatchesPage } = require('../controllers/seasonMatchesPage.controller');
const { myPage } = require('../controllers/myPage.controller');
const { statsPage } = require('../controllers/statsPage.controller');
const { profilePage } = require('../controllers/profilePage.controller');
const { settingsPage, updateProfile, changePassword } = require('../controllers/settingsPage.controller');
const { requireLogin, requireAdmin, apiRequireAdmin, apiRequireLogin, attachUser } = require('../middleware/page-auth.middleware');

// Domov → zatiaľ na sezóny
router.get('/', (req, res) => res.redirect('/seasons'));

// Auth
router.get('/login', loginPage);
router.post('/login', loginSubmit);
router.get('/register', registerPage);
router.post('/register', registerSubmit);
router.get('/logout', logout);

// Sezóny — POZOR na poradie: /create a /join PRED /:id
router.get('/my', requireLogin, myPage);
router.get('/stats', requireLogin, statsPage);
router.get('/profile', requireLogin, profilePage);
router.get('/settings', requireLogin, settingsPage);
router.put('/api/profile', apiRequireLogin, updateProfile);
router.put('/api/profile/password', apiRequireLogin, changePassword);
router.get('/seasons', attachUser, seasonsPage);
router.get('/seasons/create', requireLogin, createSeasonPage);
router.post('/seasons/create', requireLogin, createSeasonSubmit);
router.post('/seasons/join', requireLogin, joinSeasonSubmit);
router.get('/seasons/:id/manage', requireLogin, manageSeasonPage);
router.post('/seasons/:id/manage', requireLogin, manageSeasonSubmit);
router.post('/seasons/:id/end', requireLogin, endSeasonSubmit);
router.post('/seasons/:id/delete', requireLogin, deleteSeasonSubmit);
router.post('/seasons/:id/leave', requireLogin, leaveSeasonSubmit);
router.get('/seasons/:id/members', requireLogin, seasonMembersPage);
router.post('/seasons/:id/members/:userId', requireLogin, seasonMemberAction);
router.get('/seasons/:id/leaderboard', attachUser, seasonLeaderboardPage);
router.get('/seasons/:id/zapasy', requireLogin, seasonMatchesPage);
router.get('/seasons/:id', attachUser, seasonDetailPage);

// Ligy — /create a /join PRED /:id
router.post('/leagues/join', requireLogin, joinLeagueSubmit);
router.get('/leagues/create', requireLogin, createLeaguePage);
router.post('/leagues/create', requireLogin, createLeagueSubmit);
router.get('/leagues/:id/edit', requireLogin, editLeaguePage);
router.post('/leagues/:id/edit', requireLogin, editLeagueSubmit);
router.post('/leagues/:id/delete', requireLogin, deleteLeagueSubmit);
router.post('/leagues/:id/leave', requireLogin, leaveLeagueSubmit);
router.get('/leagues/:id/members', requireLogin, leagueMembersPage);
router.post('/leagues/:id/members/:userId', requireLogin, leagueMemberAction);
router.post('/leagues/:id/end', requireLogin, endLeagueSubmit);
router.get('/leagues/:id', attachUser, leagueDetailPage);

// Kolá — /create PRED /:id
router.get('/rounds/create', requireLogin, createRoundPage);
router.post('/rounds/create', requireLogin, createRoundSubmit);
router.get('/rounds/:id/matches/create', requireLogin, createMatchesPage);
router.get('/rounds/:id/evaluate', requireLogin, evaluatePage);
router.get('/rounds/:id/edit', requireLogin, editRoundPage);
router.get('/rounds/:id', attachUser, roundDetailPage);

// API — kolá a zápasy (úprava/mazanie cez session)
router.put('/api/rounds/:id', apiRequireLogin, updateRound);
router.delete('/api/rounds/:id', apiRequireLogin, deleteRound);
router.put('/api/matches/:id', apiRequireLogin, updateMatch);
router.post('/api/rounds/:id/matches/bulk', apiRequireLogin, bulkCreateMatches);

// Admin
router.get('/admin', requireAdmin, adminDashboardPage);
router.get('/admin/users', requireAdmin, adminUsersPage);
router.get('/admin/competitions', requireAdmin, adminCompetitionsPage);
router.get('/admin/teams', requireAdmin, teamsAdminPage);

// Admin API — tímy (JSON, cez session admin)
router.get('/api/admin/teams', apiRequireAdmin, listTeams);
router.post('/api/admin/teams', apiRequireAdmin, createTeam);
router.post('/api/admin/teams/bulk', apiRequireAdmin, bulkCreateTeams);
router.delete('/api/admin/teams/:id', apiRequireAdmin, deleteTeam);
router.put('/api/admin/teams/:id', apiRequireAdmin, updateTeam);

// Súpiska tímov ligy (JSON, cez session login; oprávnenie rieši controller)
router.get('/api/leagues/:id/teams', apiRequireLogin, leagueTeams);
router.get('/api/leagues/:id/teams/available', apiRequireLogin, availableTeams);
router.post('/api/leagues/:id/teams', apiRequireLogin, addTeam);
router.post('/api/leagues/:id/teams/custom', apiRequireLogin, createCustomTeam);
router.put('/api/teams/custom/:id', apiRequireLogin, updateCustomTeam);
router.delete('/api/teams/custom/:id', apiRequireLogin, deleteCustomTeam);
router.delete('/api/leagues/:id/teams/:teamId', apiRequireLogin, removeTeam);

module.exports = router;
