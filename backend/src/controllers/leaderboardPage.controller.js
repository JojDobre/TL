// backend/src/controllers/leaderboardPage.controller.js
//
// Samostatná stránka rebríčka sezóny. Súčet bodov naprieč VŠETKÝMI ligami
// sezóny + presnosť (trafené tipy / odtipované vyhodnotené). Trend nemáme
// (netrackujeme históriu poradia) → zobrazí sa "—".

const { Season, League, Round, Match, Tip, User, UserSeason, Sequelize } = require('../models');
const Op = Sequelize.Op;
const { asyncHandler } = require('../middleware/error.middleware');
const { seasonStatus, canViewSeasonContent } = require('../utils/season.utils');
const { tipQualityWeight } = require('../utils/accuracy.util');

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

  // všetky tipy v sezóne (cez Match→Round→League where seasonId)
  const tips = await Tip.findAll({
    include: [
      // required:true na celej reťazi → INNER JOIN, takže where {seasonId}
      // skutočne odfiltruje tipy z iných sezón (inak LEFT JOIN vráti všetky tipy).
      { model: Match, required: true, include: [{ model: Round, required: true, include: [{ model: League, required: true, where: { seasonId: season.id }, attributes: ['id'] }], attributes: ['id'] }], attributes: ['id', 'status', 'tipType', 'homeScore', 'awayScore'] },
      { model: User, attributes: ['id', 'username', 'firstName', 'lastName', 'role'] },
    ],
  });

  // agregácia podľa hráča: body + VÁŽENÁ presnosť (kvalita tipu, viď accuracy.util)
  const byUser = {};
  tips.forEach((tip) => {
    if (!tip.User || !tip.Match) return;
    const finished = tip.Match.status === 'finished';
    const uid = tip.User.id;
    if (!byUser[uid]) byUser[uid] = { user: tip.User.toJSON(), totalPoints: 0, evaluated: 0, weightSum: 0 };
    byUser[uid].totalPoints += tip.points || 0;
    if (finished) {
      byUser[uid].evaluated += 1;
      byUser[uid].weightSum += tipQualityWeight(tip, tip.Match);
    }
  });

  const leaderboard = Object.values(byUser)
    .map((row) => ({
      ...row,
      accuracy: row.evaluated > 0 ? Math.round((row.weightSum / row.evaluated) * 100) : null,
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints);

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

// GET /leaderboards — globálny rebríček z oficiálnych líg za posledný rok.
// Súčet bodov všetkých hráčov z vyhodnotených tipov v oficiálnych ligách,
// kde kolo skončilo za posledných 12 mesiacov. + presnosť a moja pozícia.
const globalLeaderboardPage = asyncHandler(async (req, res) => {
  const meId = req.userId ? Number(req.userId) : null;

  // hranica: posledný rok; a hranica "pred týždňom" pre výpočet skokanov
  const now = new Date();
  const yearAgo = new Date(); yearAgo.setFullYear(yearAgo.getFullYear() - 1);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const officialLeagues = await League.findAll({ where: { type: 'official' }, attributes: ['id', 'name', 'seasonId'] });

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
    const rounds = await Round.findAll({
      where: { leagueId: { [Op.in]: offLeagueIds }, endDate: { [Op.gte]: yearAgo } },
      attributes: ['id'],
    });
    const roundIds = rounds.map((r) => r.id);

    if (roundIds.length) {
      const tips = await Tip.findAll({
        attributes: ['userId', 'points', 'winner', 'homeScore', 'awayScore'],
        include: [
          { model: Match, attributes: ['id', 'status', 'tipType', 'homeScore', 'awayScore'], where: { status: 'finished', roundId: { [Op.in]: roundIds } }, required: true,
            include: [{ model: Round, attributes: ['id', 'endDate'] }] },
          { model: User, attributes: ['id', 'username', 'firstName', 'lastName', 'role'] },
        ],
      });

      const byUser = {};      // súčet k dnešku
      const pointsWeekAgo = {}; // súčet k stavu pred 7 dňami (len kolá skončené pred týždňom)
      tips.forEach((t) => {
        if (!t.User) return;
        const uid = t.User.id;
        if (!byUser[uid]) byUser[uid] = { user: t.User.toJSON(), totalPoints: 0, evaluated: 0, weightSum: 0 };
        byUser[uid].totalPoints += t.points || 0;
        byUser[uid].evaluated += 1;
        byUser[uid].weightSum += tipQualityWeight(t, t.Match);

        // stav spred týždňa: započítaj len tipy, ktorých kolo skončilo pred weekAgo
        const rEnd = t.Match && t.Match.Round ? t.Match.Round.endDate : null;
        if (rEnd && new Date(rEnd) < weekAgo) {
          pointsWeekAgo[uid] = (pointsWeekAgo[uid] || 0) + (t.points || 0);
        }
      });

      board = Object.values(byUser)
        .map((b) => ({
          userId: b.user.id,
          name: [b.user.firstName, b.user.lastName].filter(Boolean).join(' ') || b.user.username,
          username: b.user.username,
          role: b.user.role,
          initials: ([b.user.firstName, b.user.lastName].filter(Boolean).map((x) => x[0]).join('') || (b.user.username || '?')[0]).toUpperCase(),
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
          return { userId: r.userId, name: r.name, username: r.username, initials: r.initials, rank: r.rank, climb, gained };
        })
        .filter((m) => m.gained > 0)                 // niečo získal za týždeň
        .sort((a, b) => b.climb - a.climb || b.gained - a.gained)
        .slice(0, 3);
    }
  }

  const myRow = meId ? board.find((r) => r.userId === meId) : null;

  // zoznam sezón pre filter (unikátne podľa seasonId)
  const seasonOpts = [];
  const seenSeason = {};
  officialLeagues.forEach((l) => { if (!seenSeason[l.seasonId]) { seenSeason[l.seasonId] = 1; seasonOpts.push({ id: l.seasonId, name: l.name }); } });

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

module.exports = { seasonLeaderboardPage, globalLeaderboardPage };