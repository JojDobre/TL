// backend/src/routes/page.routes.js
//
// Routy, ktoré vracajú HTML stránky (EJS). API routy (JSON) sú oddelene pod /api/*.

const express = require('express');
const router = express.Router();

const {
  seasonsPage, seasonDetailPage,
  createSeasonPage, createSeasonSubmit, joinSeasonSubmit, joinPage, joinSubmit,
  manageSeasonPage, manageSeasonSubmit, endSeasonSubmit,
  deleteSeasonSubmit, leaveSeasonSubmit, seasonMembersPage, seasonMemberAction,
} = require('../controllers/page.controller');
const {
  loginPage, loginSubmit, registerPage, registerSubmit, logout,
  forgotPasswordPage, forgotPasswordSubmit, resetPasswordPage, resetPasswordSubmit,
} = require('../controllers/authPage.controller');
const { adminDashboardPage, adminUsersPage, adminCompetitionsPage } = require('../controllers/adminPage.controller');
const { leagueDetailPage, joinLeagueSubmit, createLeaguePage, createLeagueSubmit, editLeaguePage, editLeagueSubmit, deleteLeagueSubmit, leaveLeagueSubmit, leagueMembersPage, leagueMemberAction, endLeagueSubmit, manageLeaguePage } = require('../controllers/leaguePage.controller');
const { roundDetailPage, roundResultsPage } = require('../controllers/roundPage.controller');
const { createRoundPage, createRoundSubmit, editRoundPage } = require('../controllers/roundPageCreate.controller');
const { createMatchesPage } = require('../controllers/matchPage.controller');
const { evaluatePage } = require('../controllers/evaluatePage.controller');
const { teamsAdminPage } = require('../controllers/teamAdminPage.controller');
const { listTeams, createTeam, bulkCreateTeams, deleteTeam, updateTeam } = require('../controllers/teamAdmin.controller');
const { availableTeams, leagueTeams, addTeam, removeTeam, createCustomTeam, updateCustomTeam, deleteCustomTeam } = require('../controllers/leagueTeam.controller');
const { updateRound, deleteRound } = require('../controllers/round.controller');
const { updateMatch, bulkCreateMatches } = require('../controllers/match.controller');
const { seasonLeaderboardPage, globalLeaderboardPage } = require('../controllers/leaderboardPage.controller');
const { seasonMatchesPage } = require('../controllers/seasonMatchesPage.controller');
const { myPage } = require('../controllers/myPage.controller');
const { statsPage } = require('../controllers/statsPage.controller');
const { profilePage } = require('../controllers/profilePage.controller');
const { settingsPage, updateProfile, changePassword } = require('../controllers/settingsPage.controller');
const { requireLogin, requireAdmin, apiRequireAdmin, apiRequireLogin, attachUser } = require('../middleware/page-auth.middleware');
const { homePage } = require('../controllers/homePage.controller');
const { aboutPage, kontaktPage, kontaktSubmit, navodyPage, logoIdentityPage, podmienkyPage, sukromiePage } = require('../controllers/staticPage.controller');
const { blogListPage, blogPostPage } = require('../controllers/blogPage.controller');
const {
  adminBlogListPage, adminBlogNewPage, adminBlogCreate,
  adminBlogEditPage, adminBlogUpdate, adminBlogDelete,
} = require('../controllers/adminBlog.controller');
const { achievementsPage } = require('../controllers/achievementsPage.controller');
const {
  notificationsPage, markRead, markAllRead, unreadCountApi, recentApi,
} = require('../controllers/notificationsPage.controller');
const { tipHistoryPage } = require('../controllers/tipHistoryPage.controller');
const { discoverPage } = require('../controllers/discoverPage.controller');
const { playerPage } = require('../controllers/playerPage.controller');
const { comparePage } = require('../controllers/comparePage.controller');
const { myTipsPage } = require('../controllers/myTipsPage.controller');





// Domov 
router.get('/', attachUser, homePage);

// Auth
router.get('/login', loginPage);
router.post('/login', loginSubmit);
router.get('/register', registerPage);
router.post('/register', registerSubmit);
router.get('/forgot-password', forgotPasswordPage);
router.post('/forgot-password', forgotPasswordSubmit);
router.get('/logout', logout);
router.get('/reset-password', resetPasswordPage);
router.post('/reset-password', resetPasswordSubmit);

// Pripojenie cez ID/kód — samostatná stránka
router.get('/join', requireLogin, joinPage);
router.post('/join', requireLogin, joinSubmit);

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
router.get('/seasons/:id/members', requireLogin, (req, res) => res.redirect('/seasons/' + req.params.id + '/manage'));
router.post('/seasons/:id/members/:userId', requireLogin, seasonMemberAction);
router.get('/leaderboards', attachUser, globalLeaderboardPage);
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
router.get('/leagues/:id/manage', requireLogin, manageLeaguePage);
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

// Admin blog (len admin)
router.get('/admin/blog', requireAdmin, adminBlogListPage);
router.get('/admin/blog/new', requireAdmin, adminBlogNewPage);
router.post('/admin/blog/new', requireAdmin, adminBlogCreate);
router.get('/admin/blog/:id/edit', requireAdmin, adminBlogEditPage);
router.post('/admin/blog/:id/edit', requireAdmin, adminBlogUpdate);
router.post('/admin/blog/:id/delete', requireAdmin, adminBlogDelete);

// Súpiska tímov ligy (JSON, cez session login; oprávnenie rieši controller)
router.get('/api/leagues/:id/teams', apiRequireLogin, leagueTeams);
router.get('/api/leagues/:id/teams/available', apiRequireLogin, availableTeams);
router.post('/api/leagues/:id/teams', apiRequireLogin, addTeam);
router.post('/api/leagues/:id/teams/custom', apiRequireLogin, createCustomTeam);
router.put('/api/teams/custom/:id', apiRequireLogin, updateCustomTeam);
router.delete('/api/teams/custom/:id', apiRequireLogin, deleteCustomTeam);
router.delete('/api/leagues/:id/teams/:teamId', apiRequireLogin, removeTeam);

// Statické stránky (verejné). attachUser → navbar pozná prihláseného usera.
router.get('/about', attachUser, aboutPage);
router.get('/kontakt', attachUser, kontaktPage);
router.post('/kontakt', attachUser, kontaktSubmit);
router.get('/navody', attachUser, navodyPage);
router.get('/podmienky', attachUser, podmienkyPage);
router.get('/sukromie', attachUser, sukromiePage);
router.get('/achievements', requireLogin, achievementsPage);
router.get('/logo-identity', logoIdentityPage);
router.get('/tip-history', requireLogin, tipHistoryPage);
router.get('/moje-tipy', requireLogin, myTipsPage);
router.get('/rounds/:id/results', attachUser, roundResultsPage);
router.get('/discover', attachUser, discoverPage);

// verejný profil — dostupný aj neprihlásenému (attachUser kvôli spoločným súťažiam)
router.get('/player/:id', attachUser, playerPage);

// porovnanie ja vs iný hráč (vyžaduje prihlásenie)
router.get('/compare', requireLogin, comparePage);

// Blog (verejné). attachUser → navbar pozná prihláseného usera.
router.get('/blog', attachUser, blogListPage);
router.get('/blog/:slug', attachUser, blogPostPage);

// stránka + akcie (vyžadujú prihlásenie)
router.get('/notifications', requireLogin, notificationsPage);
router.post('/notifications/:id/read', requireLogin, markRead);
router.post('/notifications/read-all', requireLogin, markAllRead);

// API pre zvonček v navbare
router.get('/api/notifications/unread-count', requireLogin, unreadCountApi);
router.get('/api/notifications/recent', requireLogin, recentApi);

module.exports = router;