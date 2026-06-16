// backend/src/controllers/adminPage.controller.js
//
// Admin EJS stránky: prehľad (dashboard), správa užívateľov, globálna správa
// sezón a líg. Dáta sú reálne; čo netrackujeme (grafy aktivity, audit log),
// sa nezobrazuje.

const { User, Season, League, Round, Match, Tip, Team, Sequelize } = require('../models');
const { Op } = Sequelize;
const { asyncHandler } = require('../middleware/error.middleware');
const { seasonStatus } = require('../utils/season.utils');

// GET /admin — prehľad platformy
const adminDashboardPage = asyncHandler(async (req, res) => {
  const [usersCount, seasonsCount, leaguesCount, teamsCount] = await Promise.all([
    User.count(),
    Season.count(),
    League.count(),
    Team.count(),
  ]);

  // aktívne sezóny (status active)
  const allSeasons = await Season.findAll({ attributes: ['id', 'startDate', 'endDate', 'ended'] });
  const activeSeasons = allSeasons.filter((s) => seasonStatus(s) === 'active').length;

  // zápasy čakajúce na vyhodnotenie: po matchTime, stále scheduled, nie klon
  const now = new Date();
  const pendingMatches = await Match.findAll({
    where: { status: 'scheduled', matchTime: { [Op.lt]: now }, sourceMatchId: null },
    include: [{ model: Round, attributes: ['id', 'name', 'leagueId'], include: [{ model: League, attributes: ['id', 'name'] }] }],
    order: [['matchTime', 'ASC']],
    limit: 8,
  });

  const tipsCount = await Tip.count();

  res.render('adminDashboard', {
    stats: { usersCount, seasonsCount, leaguesCount, teamsCount, activeSeasons, tipsCount, pendingCount: pendingMatches.length },
    pending: pendingMatches.map((m) => ({
      id: m.id,
      roundId: m.Round ? m.Round.id : null,
      roundName: m.Round ? m.Round.name : '—',
      leagueName: m.Round && m.Round.League ? m.Round.League.name : '—',
      matchTime: m.matchTime,
    })),
  });
});

// GET /admin/users
const adminUsersPage = asyncHandler(async (req, res) => {
  const limit = 20;
  const { count, rows } = await User.findAndCountAll({
    attributes: { exclude: ['password'] },
    order: [['createdAt', 'DESC']],
    limit,
    offset: 0,
  });

  res.render('adminUsers', {
    users: rows.map((u) => u.toJSON()),
    pagination: { total: count, page: 1, limit, pages: Math.ceil(count / limit) || 1 },
  });
});

// GET /admin/competitions — globálna správa sezón a líg
const adminCompetitionsPage = asyncHandler(async (req, res) => {
  const seasons = await Season.findAll({ order: [['createdAt', 'DESC']] });
  const out = [];
  for (const s of seasons) {
    const leagues = await League.findAll({ where: { seasonId: s.id }, attributes: ['id', 'name', 'type', 'ended', 'isTemplate', 'templateId'], order: [['createdAt', 'ASC']] });
    out.push({
      ...s.toJSON(),
      status: seasonStatus(s),
      leagues: leagues.map((l) => l.toJSON()),
    });
  }
  res.render('adminCompetitions', { seasons: out });
});

module.exports = { adminDashboardPage, adminUsersPage, adminCompetitionsPage };
