// backend/src/controllers/leaderboardPage.controller.js
//
// Samostatná stránka rebríčka sezóny. Súčet bodov naprieč VŠETKÝMI ligami
// sezóny + presnosť (trafené tipy / odtipované vyhodnotené). Trend nemáme
// (netrackujeme históriu poradia) → zobrazí sa "—".

const { Season, League, Round, Match, Tip, User, UserSeason, Sequelize } = require('../models');
const Op = Sequelize.Op;
const { asyncHandler } = require('../middleware/error.middleware');
const { seasonStatus, canViewSeasonContent } = require('../utils/season.utils');
const { standings, pointsBefore, accuracyOf, precomputed } = require('../utils/standings.util');

// GET /seasons/:id/leaderboard
const seasonLeaderboardPage = asyncHandler(async (req, res) => {
  const meId = req.userId ? Number(req.userId) : null;
  const season = await Season.findByPk(req.params.id);
  if (!season) return res.status(404).render('error-page', { message: 'Sezóna nebola nájdená.' });

  // súkromná sezóna: obsah len pre člena / po hesle (rovnaké pravidlo ako detail)
  let isMember = false;
  let isCreator = false;
  let isGlobalAdmin = false;
  if (meId) {
    const m = await UserSeason.findOne({ where: { userId: meId, seasonId: season.id } });
    isMember = !!m;
    isCreator = season.creatorId === meId;
    const u = await User.findByPk(meId, { attributes: ['role'] });
    isGlobalAdmin = !!(u && u.role === 'admin');
  }
  if (!canViewSeasonContent(season, { isMember, isCreator, isGlobalAdmin })) {
    return res.redirect('/seasons/' + season.id); // späť na detail, kde sa pýta heslo
  }

  // body + vážená presnosť po hráčoch — agregované v SQL (viď standings.util)
  const rows = season.type === 'official'
    ? await precomputed(`season:${season.id}`, () => standings({ seasonId: season.id }))
    : await standings({ seasonId: season.id });
  const users = rows.length
    ? await User.findAll({ where: { id: { [Op.in]: rows.map((r) => r.userId) } }, attributes: ['id', 'username', 'firstName', 'lastName', 'role', 'profileImage'] })
    : [];
  const userById = new Map(users.map((u) => [u.id, u.toJSON()]));

  const leaderboard = rows
    .filter((r) => userById.has(r.userId))
    .map((r) => ({
      user: userById.get(r.userId),
      totalPoints: r.points,
      evaluated: r.evaluated,
      weightSum: r.weightSum,
      accuracy: accuracyOf(r),
    }));

  // moje poradie
  let myRank = null;
  if (meId) {
    const idx = leaderboard.findIndex((r) => r.user.id === meId);
    if (idx >= 0) myRank = idx + 1;
  }

  // ligy sezóny (na sidebar odkazy)
  const leagues = await League.findAll({ where: { seasonId: season.id }, attributes: ['id', 'name'], order: [['createdAt', 'ASC']] });

  res.render('leaderboard', {
    season: { ...season.toJSON(), status: seasonStatus(season) },
    leaderboard,
    myRank,
    meId,
    leagues: leagues.map((l) => l.toJSON()),
    isStandalone: season.mode === 'standalone',
  });
});

// Celkový rebríček oficiálnych líg za posledný rok — vopred prepočítaný
// (standings.util precomputed): prepočet beží na pozadí po vyhodnotení zápasov
// a raz za hodinu, stránka len číta výsledok.
function globalStandings(seasonFilter, offLeagueIds) {
  return precomputed(`global:${seasonFilter || 'all'}`, async () => {
    const nowT = new Date();
    const yA = new Date(nowT); yA.setFullYear(yA.getFullYear() - 1);
    const wA = new Date(nowT.getTime() - 7 * 24 * 60 * 60 * 1000);
    const r = await standings({ leagueIds: offLeagueIds, roundEndFrom: yA, finishedOnly: true });
    const us = r.length ? await User.findAll({ where: { id: { [Op.in]: r.map((x) => x.userId) } }, attributes: ['id', 'username', 'firstName', 'lastName', 'role', 'profileImage'], raw: true }) : [];
    const pw = Object.fromEntries(await pointsBefore({ leagueIds: offLeagueIds, roundEndFrom: yA, before: wA }));
    return { rows: r, users: us, pointsWeekAgo: pw };
  });
}

// príprava pri štarte servera
async function warmGlobal() {
  const ids = (await League.findAll({ where: { type: 'official', isTemplate: false }, attributes: ['id'] })).map((l) => l.id);
  if (ids.length) await globalStandings(null, ids);
}

// GET /leaderboards — globálny rebríček z oficiálnych líg za posledný rok.
// Súčet bodov všetkých hráčov z vyhodnotených tipov v oficiálnych ligách,
// kde kolo skončilo za posledných 12 mesiacov. + presnosť a moja pozícia.
const globalLeaderboardPage = asyncHandler(async (req, res) => {
  const meId = req.userId ? Number(req.userId) : null;

  // hranica: posledný rok; a hranica "pred týždňom" pre výpočet skokanov
  const now = new Date();
  const yearAgo = new Date(); yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const officialLeagues = await League.findAll({
    where: { type: 'official', isTemplate: false },
    attributes: ['id', 'name', 'seasonId'],
  });

  // voliteľný filter podľa sezóny (?season=ID) — obmedzí na ligy danej sezóny
  const seasonFilter = req.query.season ? Number(req.query.season) : null;
  const filteredLeagues = seasonFilter
    ? officialLeagues.filter((l) => l.seasonId === seasonFilter)
    : officialLeagues;
  const offLeagueIds = filteredLeagues.map((l) => l.id);

  // názov vybranej sezóny (na popisok)
  let selectedSeasonName = null;
  if (seasonFilter && filteredLeagues.length) {
    const sn = await Season.findByPk(seasonFilter, { attributes: ['name'] });
    selectedSeasonName = sn ? sn.name : null;
  }

  let board = [];
  let movers = [];
  if (offLeagueIds.length) {
    // body z vyhodnotených tipov v kolách skončených za posledný rok (SQL agregácia)
    // Vopred prepočítané (viď standings.util — precomputed): prepočet beží na
    // pozadí po vyhodnotení zápasov a raz za hodinu, stránka len číta výsledok.
    const pre = await globalStandings(seasonFilter, offLeagueIds);
    const rows = pre.rows;
    if (rows.length) {
      const userById = new Map(pre.users.map((u) => [u.id, u]));
      // stav spred týždňa: len tipy, ktorých kolo skončilo pred weekAgo
      const pointsWeekAgo = pre.pointsWeekAgo;
      const byUser = {};
      rows.forEach((r) => {
        const u = userById.get(r.userId);
        if (u) byUser[r.userId] = { user: u, totalPoints: r.points, evaluated: r.evaluated, weightSum: r.weightSum };
      });

      board = Object.values(byUser)
        .map((b) => ({
          userId: b.user.id,
          name: [b.user.firstName, b.user.lastName].filter(Boolean).join(' ') || b.user.username,
          username: b.user.username,
          role: b.user.role,
          initials: ([b.user.firstName, b.user.lastName].filter(Boolean).map((x) => x[0]).join('') || (b.user.username || '?')[0]).toUpperCase(),
          profileImage: b.user.profileImage || '',
          totalPoints: b.totalPoints,
          evaluated: b.evaluated,
          accuracy: b.evaluated > 0 ? Math.round((b.weightSum / b.evaluated) * 100) : null,
        }))
        .sort((a, b) => b.totalPoints - a.totalPoints || (b.accuracy || 0) - (a.accuracy || 0));

      board.forEach((row, i) => { row.rank = i + 1; });

      // ── SKOKANI TÝŽDŇA ──
      // poradie teraz vs. poradie podľa stavu pred týždňom; skok = zlepšenie pozície.
      const rankNow = {};
      board.forEach((r) => { rankNow[r.userId] = r.rank; });

      const weekBoard = Object.keys(byUser)
        .map((uid) => ({ userId: Number(uid), points: pointsWeekAgo[uid] || 0 }))
        .sort((a, b) => b.points - a.points);
      const rankThen = {};
      weekBoard.forEach((r, i) => { rankThen[r.userId] = i + 1; });

      movers = board
        .map((r) => {
          const then = rankThen[r.userId];
          const gained = r.totalPoints - (pointsWeekAgo[r.userId] || 0); // body za posledný týždeň
          const climb = (then != null) ? (then - r.rank) : 0;            // o koľko miest hore
          return { userId: r.userId, name: r.name, username: r.username, initials: r.initials, profileImage: r.profileImage, rank: r.rank, climb, gained };
        })
        .filter((m) => m.gained > 0)                 // niečo získal za týždeň
        .sort((a, b) => b.climb - a.climb || b.gained - a.gained)
        .slice(0, 3);
    }
  }

  const myRow = meId ? board.find((r) => r.userId === meId) : null;

  // zoznam sezón pre filter (unikátne podľa seasonId)
  // Zoznam oficiálnych sezón pre filter a odkazy "podľa sezóny".
  // Preskakujeme ligy bez sezóny (seasonId null — napr. staré dáta) a názvy
  // berieme zo SEZÓN, nie z prvej ligy (sezóna môže mať viac líg).
  const seasonIds = [...new Set(officialLeagues.map((l) => l.seasonId).filter(Boolean))];
  const seasonRows = seasonIds.length
    ? await Season.findAll({ where: { id: { [Op.in]: seasonIds } }, attributes: ['id', 'name', 'image'] })
    : [];
  const seasonOpts = seasonRows.map((s) => ({ id: s.id, name: s.name, image: s.image || '' }));

  res.render('leaderboards', {
    board,
    podium: board.slice(0, 3),
    rest: board.slice(3),
    myRow: myRow || null,
    movers,
    meId,
    officialLeagues: seasonOpts,
    seasonFilter,
    selectedSeasonName,
    periodLabel: selectedSeasonName ? selectedSeasonName : 'Posledný rok',
  });
});

module.exports = { seasonLeaderboardPage, globalLeaderboardPage, warmGlobal };