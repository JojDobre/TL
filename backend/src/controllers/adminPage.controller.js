// backend/src/controllers/adminPage.controller.js
//
// Admin EJS stránky: prehľad (dashboard), správa užívateľov, globálna správa
// sezón a líg. Dáta sú reálne; čo netrackujeme (grafy aktivity, audit log),
// sa nezobrazuje.

const { User, Season, League, Round, Match, Tip, Team, UserSeason, UserLeague, Sequelize } = require('../models');
const { Op } = Sequelize;
const { asyncHandler } = require('../middleware/error.middleware');
const { seasonStatus } = require('../utils/season.utils');

// GET /admin — prehľad platformy
// GET /admin — prehľad platformy
const adminDashboardPage = asyncHandler(async (req, res) => {
  const adminId = Number(req.session.userId);

  const [usersCount, seasonsCount, leaguesCount, teamsCount] = await Promise.all([
    User.count(),
    Season.count(),
    League.count(),
    Team.count(),
  ]);

  // aktívne sezóny (status active)
  const allSeasons = await Season.findAll({ attributes: ['id', 'type', 'startDate', 'endDate', 'ended'] });
  const activeSeasons = allSeasons.filter((s) => seasonStatus(s) === 'active').length;
  const officialSeasons = allSeasons.filter((s) => s.type === 'official').length;

  // ligy, ktoré admin SPRAVUJE: oficiálne, ním vytvorené, alebo patriace do
  // oficiálnej sezóny. Cudzie custom ligy iných používateľov ho nezaujímajú.
  const officialSeasonIds = allSeasons.filter((s) => s.type === 'official').map((s) => s.id);
  const managedLeagues = await League.findAll({
    where: {
      [Op.or]: [
        { type: 'official' },
        { creatorId: adminId },
        ...(officialSeasonIds.length ? [{ seasonId: { [Op.in]: officialSeasonIds } }] : []),
      ],
    },
    attributes: ['id', 'name', 'type'],
  });
  const managedLeagueIds = managedLeagues.map((l) => l.id);

  // zápasy čakajúce na vyhodnotenie — LEN v ligách, ktoré admin spravuje.
  const now = new Date();
  let pendingMatches = [];
  if (managedLeagueIds.length) {
    const managedRounds = await Round.findAll({ where: { leagueId: { [Op.in]: managedLeagueIds } }, attributes: ['id'] });
    const managedRoundIds = managedRounds.map((r) => r.id);
    if (managedRoundIds.length) {
      pendingMatches = await Match.findAll({
        where: { status: 'scheduled', matchTime: { [Op.lt]: now }, sourceMatchId: null, roundId: { [Op.in]: managedRoundIds } },
        include: [{ model: Round, attributes: ['id', 'name', 'leagueId'], include: [{ model: League, attributes: ['id', 'name'] }] }],
        order: [['matchTime', 'ASC']],
        limit: 8,
      });
    }
  }
  // celkový počet čakajúcich (nie len zobrazených 8)
  let pendingTotal = 0;
  if (managedLeagueIds.length) {
    const mr = await Round.findAll({ where: { leagueId: { [Op.in]: managedLeagueIds } }, attributes: ['id'] });
    const mrIds = mr.map((r) => r.id);
    if (mrIds.length) {
      pendingTotal = await Match.count({ where: { status: 'scheduled', matchTime: { [Op.lt]: now }, sourceMatchId: null, roundId: { [Op.in]: mrIds } } });
    }
  }

  const tipsCount = await Tip.count();

  // --- NOVÉ BLOKY ---

  // 1) Najbližšie uzávierky kôl (otvorené kolá v spravovaných ligách, end v budúcnosti)
  let upcomingDeadlines = [];
  if (managedLeagueIds.length) {
    const rounds = await Round.findAll({
      where: { leagueId: { [Op.in]: managedLeagueIds }, endDate: { [Op.gt]: now }, startDate: { [Op.lt]: now } },
      include: [{ model: League, attributes: ['id', 'name'] }],
      order: [['endDate', 'ASC']],
      limit: 5,
    });
    upcomingDeadlines = rounds.map((r) => ({
      id: r.id,
      name: r.name,
      leagueName: r.League ? r.League.name : '—',
      endDate: r.endDate,
    }));
  }

  // 2) Najaktívnejší hráči (podľa počtu odoslaných tipov)
  const topTippers = await Tip.findAll({
    attributes: ['userId', [Sequelize.fn('COUNT', Sequelize.col('id')), 'tipCount']],
    group: ['userId'],
    order: [[Sequelize.literal('tipCount'), 'DESC']],
    limit: 5,
  });
  const tipperIds = topTippers.map((t) => t.userId).filter(Boolean);
  const tipperUsers = tipperIds.length
    ? await User.findAll({ where: { id: { [Op.in]: tipperIds } }, attributes: ['id', 'username', 'firstName', 'lastName'] })
    : [];
  const tipperById = {};
  tipperUsers.forEach((u) => { tipperById[u.id] = u; });
  const topPlayers = topTippers.map((t) => {
    const u = tipperById[t.userId];
    return {
      name: u ? ([u.firstName, u.lastName].filter(Boolean).join(' ') || u.username) : ('#' + t.userId),
      username: u ? u.username : null,
      tipCount: Number(t.get('tipCount')),
    };
  }).filter((p) => p.username);

  // 3) Noví používatelia (posledných 5)
  const recentUsers = await User.findAll({
    attributes: ['id', 'username', 'firstName', 'lastName', 'createdAt', 'role'],
    order: [['createdAt', 'DESC']],
    limit: 5,
  });

  res.render('adminDashboard', {
    stats: {
      usersCount, seasonsCount, leaguesCount, teamsCount, activeSeasons, officialSeasons,
      tipsCount, pendingCount: pendingTotal,
      managedLeaguesCount: managedLeagueIds.length,
    },
    pending: pendingMatches.map((m) => ({
      id: m.id,
      roundId: m.Round ? m.Round.id : null,
      roundName: m.Round ? m.Round.name : '—',
      leagueName: m.Round && m.Round.League ? m.Round.League.name : '—',
      matchTime: m.matchTime,
    })),
    upcomingDeadlines,
    topPlayers,
    recentUsers: recentUsers.map((u) => ({
      name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username,
      username: u.username,
      role: u.role,
      createdAt: u.createdAt,
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
  const now = new Date();
  const seasons = await Season.findAll({ order: [['createdAt', 'DESC']] });
  const out = [];

  for (const s of seasons) {
    const leagues = await League.findAll({
      where: { seasonId: s.id },
      attributes: ['id', 'name', 'type', 'ended', 'isTemplate', 'templateId', 'hasPassword', 'creatorId'],
      order: [['createdAt', 'ASC']],
    });
    const leagueIds = leagues.map((l) => l.id);

    // počet členov sezóny
    const membersCount = await UserSeason.count({ where: { seasonId: s.id } });

    // kolá + zápasy čakajúce na vyhodnotenie naprieč ligami sezóny
    let roundsCount = 0;
    let pendingCount = 0;
    const roundCountByLeague = {};
    if (leagueIds.length) {
      const rounds = await Round.findAll({ where: { leagueId: { [Op.in]: leagueIds } }, attributes: ['id', 'leagueId'] });
      roundsCount = rounds.length;
      rounds.forEach((r) => { roundCountByLeague[r.leagueId] = (roundCountByLeague[r.leagueId] || 0) + 1; });
      const roundIds = rounds.map((r) => r.id);
      if (roundIds.length) {
        pendingCount = await Match.count({ where: { status: 'scheduled', matchTime: { [Op.lt]: now }, sourceMatchId: null, roundId: { [Op.in]: roundIds } } });
      }
    }

    // vlastník sezóny
    const owner = await User.findByPk(s.creatorId, { attributes: ['username', 'firstName', 'lastName'] });
    const ownerName = owner ? ([owner.firstName, owner.lastName].filter(Boolean).join(' ') || ('@' + owner.username)) : '—';

    // počty členov jednotlivých líg
    const leagueData = [];
    for (const l of leagues) {
      const lMembers = await UserLeague.count({ where: { leagueId: l.id } });
      leagueData.push({
        ...l.toJSON(),
        membersCount: lMembers,
        roundsCount: roundCountByLeague[l.id] || 0,
      });
    }

    out.push({
      ...s.toJSON(),
      status: seasonStatus(s),
      membersCount,
      roundsCount,
      pendingCount,
      ownerName,
      leagues: leagueData,
    });
  }

  const official = out.filter((s) => s.type === 'official');
  const community = out.filter((s) => s.type !== 'official');

  res.render('adminCompetitions', {
    seasons: out,
    official,
    community,
    totals: { seasons: out.length, leagues: out.reduce((a, s) => a + s.leagues.length, 0) },
  });
});

module.exports = { adminDashboardPage, adminUsersPage, adminCompetitionsPage };