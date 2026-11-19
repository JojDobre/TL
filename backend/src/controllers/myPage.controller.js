// backend/src/controllers/myPage.controller.js
//
// "Moje súťaže" (/my): sezóny a ligy, ktorých je prihlásený používateľ členom.
// Šablóna sa prenáša 1:1 — bloky, pre ktoré nemáme reálne dáta (počet hráčov
// celkovo, "šport" ako pole, countdown), ponechávame vizuálne s neutrálnym
// stavom ("—"), nič si nevymýšľame.

const { Season, League, Round, Match, Tip, User, UserSeason, UserLeague, Team, Sequelize } = require('../models');
const { asyncHandler } = require('../middleware/error.middleware');
const { seasonStatus } = require('../utils/season.utils');
const { leagueStandingsMap, accuracyOf, roundCounts } = require('../utils/standings.util');

const Op = Sequelize.Op;

// GET /my
const myPage = asyncHandler(async (req, res) => {
  const meId = Number(req.session.userId);
  const user = await User.findByPk(meId, { attributes: ['firstName', 'lastName', 'username'] });
  const greetName = user ? (user.firstName || user.username) : '';

  // ---- MOJE SEZÓNY ----
  const sMems = await UserSeason.findAll({ where: { userId: meId }, attributes: ['seasonId'] });
  const seasonIds = sMems.map((m) => m.seasonId);
  const seasons = seasonIds.length
    ? await Season.findAll({ where: { id: { [Op.in]: seasonIds } }, order: [['createdAt', 'DESC']] })
    : [];

  // ---- MOJE LIGY (členstvá) ----
  const lMems = await UserLeague.findAll({ where: { userId: meId }, attributes: ['leagueId'] });
  const myLeagueIds = lMems.map((m) => m.leagueId);
  const leaguesRaw = myLeagueIds.length
    ? await League.findAll({ where: { id: { [Op.in]: myLeagueIds } }, include: [{ model: Season, attributes: ['id', 'name', 'endDate', 'ended', 'mode', 'image'] }], order: [['createdAt', 'DESC']] })
    : [];

  // ligy všetkých mojich sezón (sezónny rebríček = súčet cez všetky jej ligy)
  const seasonLeagues = seasonIds.length
    ? await League.findAll({ where: { seasonId: { [Op.in]: seasonIds } }, attributes: ['id', 'seasonId'] })
    : [];
  const leaguesBySeason = new Map();
  seasonLeagues.forEach((l) => {
    if (!leaguesBySeason.has(l.seasonId)) leaguesBySeason.set(l.seasonId, []);
    leaguesBySeason.get(l.seasonId).push(l.id);
  });

  // JEDEN agregovaný dotaz: body každého hráča v každej relevantnej lige
  const allLeagueIds = [...new Set([...myLeagueIds, ...seasonLeagues.map((l) => l.id)])];
  // (oficiálne ligy z vopred prepočítaných rebríčkov, komunitné živo)
  const [rowsByLeague, rCounts] = await Promise.all([
    leagueStandingsMap(allLeagueIds),
    roundCounts(allLeagueIds),
  ]);

  // poradie a body hráča v rebríčku zloženom z daných líg
  function myStanding(leagueIds) {
    const byUser = new Map();
    leagueIds.forEach((lid) => (rowsByLeague.get(lid) || []).forEach((r) => {
      const cur = byUser.get(r.userId) || { userId: r.userId, points: 0, evaluated: 0, weightSum: 0 };
      cur.points += r.points; cur.evaluated += r.evaluated; cur.weightSum += r.weightSum;
      byUser.set(r.userId, cur);
    }));
    const board = [...byUser.values()].sort((a, b) => b.points - a.points);
    const idx = board.findIndex((b) => b.userId === meId);
    return idx >= 0
      ? { rank: idx + 1, myPoints: board[idx].points, accuracy: accuracyOf(board[idx]) }
      : { rank: null, myPoints: 0, accuracy: null };
  }

  const mySeasons = seasons.map((s) => {
    const lids = leaguesBySeason.get(s.id) || [];
    let totalRounds = 0; let playedRounds = 0;
    lids.forEach((lid) => { const c = rCounts.get(lid); if (c) { totalRounds += c.total; playedRounds += c.played; } });
    const st = lids.length ? myStanding(lids) : { rank: null, myPoints: 0, accuracy: null };
    return {
      id: s.id, name: s.name, type: s.type, hasPassword: s.hasPassword, image: s.image || null,
      status: seasonStatus(s), rank: st.rank, myPoints: st.myPoints, accuracy: st.accuracy,
      playedRounds, totalRounds,
      progressPct: totalRounds > 0 ? Math.round((playedRounds / totalRounds) * 100) : 0,
    };
  });

  const myLeagues = leaguesRaw.map((l) => {
    const st = myStanding([l.id]);
    const sEnded = l.Season && seasonStatus(l.Season) === 'ended';
    return {
      id: l.id, name: l.name, type: l.type, hasPassword: l.hasPassword,
      // Pri standalone turnaji je obrázok uložený na SEZÓNE (sezóna a liga sú
      // tam jeden celok) — bez fallbacku by karta ostala bez loga.
      image: l.image || (l.Season ? l.Season.image : null) || null,
      seasonName: l.Season ? l.Season.name : null,
      seasonId: l.Season ? l.Season.id : null,
      seasonMode: l.Season ? l.Season.mode : null,
      ended: !!l.ended || sEnded, rank: st.rank, myPoints: st.myPoints,
    };
  });

  // ---- NAJBLIŽŠIE ZÁPASY NA TIP (naprieč mojimi ligami) ----
  // Tipovateľné = zápasy v OTVORENÝCH kolách (now medzi startDate a endDate),
  // ktoré sú scheduled a ešte nezačali, a ktoré používateľ ešte nemá natipované.
  // Logika je zladená so stránkou /seasons/:id/zapasy, aby počet v banneri
  // zodpovedal tomu, čo sa reálne dá tipovať (nie nevyhodnotené zápasy).
  let upcoming = [];
  let unfilledCount = 0;
  let hasOpenMatches = false; // existujú vôbec otvorené tipovateľné zápasy (aj keď natipované)?
  let firstOpenSeasonId = null; // sezóna, kam smerovať tlačidlá (otvorené zápasy)
  if (myLeagueIds.length) {
    const now = new Date();
    // len OTVORENÉ kolá: startDate <= now <= endDate
    const openRounds = await Round.findAll({
      where: {
        leagueId: { [Op.in]: myLeagueIds },
        startDate: { [Op.lte]: now },
        endDate: { [Op.gt]: now },
      },
      attributes: ['id'],
    });
    const roundIds = openRounds.map((r) => r.id);
    if (roundIds.length) {
      const matches = await Match.findAll({
        where: { roundId: { [Op.in]: roundIds }, status: 'scheduled', matchTime: { [Op.gt]: now } },
        include: [
          { model: Team, as: 'homeTeam', attributes: ['name'] },
          { model: Team, as: 'awayTeam', attributes: ['name'] },
          { model: Round, attributes: ['id', 'leagueId'], include: [{ model: League, attributes: ['id', 'seasonId'] }] },
        ],
        order: [['matchTime', 'ASC']],
        limit: 30,
      });
      const myTips = await Tip.findAll({ where: { userId: meId, matchId: { [Op.in]: matches.map((m) => m.id) } }, attributes: ['matchId'] });
      const tippedIds = new Set(myTips.map((t) => t.matchId));
      const abbr = (n) => (n || '?').substring(0, 3).toUpperCase();
      const notTipped = matches.filter((m) => !tippedIds.has(m.id));
      hasOpenMatches = matches.length > 0; // sú nejaké otvorené tipovateľné zápasy
      // sezóna prvého otvoreného zápasu — cieľ tlačidla aj keď je všetko natipované
      if (matches.length && matches[0].Round && matches[0].Round.League) {
        firstOpenSeasonId = matches[0].Round.League.seasonId;
      }
      unfilledCount = notTipped.length;
      upcoming = notTipped.slice(0, 3).map((m) => ({
        home: m.homeTeam ? m.homeTeam.name : '—',
        away: m.awayTeam ? m.awayTeam.name : '—',
        homeAbbr: abbr(m.homeTeam ? m.homeTeam.name : ''),
        homeLogo: m.homeTeam ? (m.homeTeam.logo || null) : null,
        time: m.matchTime,
        seasonId: m.Round && m.Round.League ? m.Round.League.seasonId : null,
        leagueId: m.Round ? m.Round.leagueId : null,
      }));
    }
  }

  res.render('my', {
    greetName,
    mySeasons,
    myLeagues,
    upcoming,
    unfilledCount,
    hasOpenMatches,
    firstOpenSeasonId,
    hasAnything: mySeasons.length > 0 || myLeagues.length > 0,
  });
});

module.exports = { myPage };