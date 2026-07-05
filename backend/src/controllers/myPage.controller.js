// backend/src/controllers/myPage.controller.js
//
// "Moje súťaže" (/my): sezóny a ligy, ktorých je prihlásený používateľ členom.
// Šablóna sa prenáša 1:1 — bloky, pre ktoré nemáme reálne dáta (počet hráčov
// celkovo, "šport" ako pole, countdown), ponechávame vizuálne s neutrálnym
// stavom ("—"), nič si nevymýšľame.

const { Season, League, Round, Match, Tip, User, UserSeason, UserLeague, Team, Sequelize } = require('../models');
const { asyncHandler } = require('../middleware/error.middleware');
const { seasonStatus } = require('../utils/season.utils');
const { tipQualityWeight } = require('../utils/accuracy.util');

const Op = Sequelize.Op;

// rebríček (body podľa user) z poľa tipov
function rankFromTips(tips) {
  const byUser = {};
  tips.forEach((t) => {
    if (!t.User) return;
    const uid = t.User.id;
    if (!byUser[uid]) byUser[uid] = { userId: uid, points: 0 };
    byUser[uid].points += t.points || 0;
  });
  return Object.values(byUser).sort((a, b) => b.points - a.points);
}

// vážená presnosť používateľa z jeho tipov (kvalita tipu / vyhodnotené)
function accuracyFromTips(tips, meId) {
  let ev = 0; let weightSum = 0;
  tips.forEach((t) => {
    if (t.User && t.User.id !== meId) return;
    if (!t.Match || t.Match.status !== 'finished') return;
    ev += 1; weightSum += tipQualityWeight(t, t.Match);
  });
  return ev > 0 ? Math.round((weightSum / ev) * 100) : null;
}

// GET /my
const myPage = asyncHandler(async (req, res) => {
  const meId = Number(req.session.userId);
  const user = await User.findByPk(meId, { attributes: ['firstName', 'lastName', 'username'] });
  const greetName = user ? (user.firstName || user.username) : '';

  // ---- MOJE SEZÓNY ----
  const sMems = await UserSeason.findAll({ where: { userId: meId } });
  const seasonIds = sMems.map((m) => m.seasonId);
  const seasons = seasonIds.length
    ? await Season.findAll({ where: { id: { [Op.in]: seasonIds } }, order: [['createdAt', 'DESC']] })
    : [];

  const mySeasons = [];
  for (const s of seasons) {
    const leagues = await League.findAll({ where: { seasonId: s.id }, attributes: ['id'] });
    const leagueIds = leagues.map((l) => l.id);
    let myPoints = 0; let rank = null; let playedRounds = 0; let totalRounds = 0; let accuracy = null;
    if (leagueIds.length) {
      const rounds = await Round.findAll({ where: { leagueId: { [Op.in]: leagueIds } }, attributes: ['id', 'endDate'] });
      totalRounds = rounds.length;
      const now = new Date();
      playedRounds = rounds.filter((r) => r.endDate && new Date(r.endDate) < now).length;
      const tips = await Tip.findAll({
        include: [
          { model: Match, attributes: ['id', 'status', 'tipType', 'homeScore', 'awayScore'], include: [{ model: Round, attributes: ['id'], where: { leagueId: { [Op.in]: leagueIds } }, required: true }], required: true },
          { model: User, attributes: ['id'] },
        ],
      });
      const board = rankFromTips(tips);
      const idx = board.findIndex((b) => b.userId === meId);
      if (idx >= 0) { rank = idx + 1; myPoints = board[idx].points; }
      accuracy = accuracyFromTips(tips, meId);
    }
    mySeasons.push({
      id: s.id, name: s.name, type: s.type, hasPassword: s.hasPassword, image: s.image || null,
      status: seasonStatus(s), rank, myPoints, accuracy,
      playedRounds, totalRounds,
      progressPct: totalRounds > 0 ? Math.round((playedRounds / totalRounds) * 100) : 0,
    });
  }

  // ---- MOJE LIGY ----
  const lMems = await UserLeague.findAll({ where: { userId: meId } });
  const myLeagueIds = lMems.map((m) => m.leagueId);
  const leaguesRaw = myLeagueIds.length
    ? await League.findAll({ where: { id: { [Op.in]: myLeagueIds } }, include: [{ model: Season, attributes: ['id', 'name', 'endDate', 'ended', 'mode'] }], order: [['createdAt', 'DESC']] })
    : [];

  const myLeagues = [];
  for (const l of leaguesRaw) {
    const rounds = await Round.findAll({ where: { leagueId: l.id }, attributes: ['id'] });
    const roundIds = rounds.map((r) => r.id);
    let rank = null; let myPoints = 0;
    if (roundIds.length) {
      const tips = await Tip.findAll({
        include: [
          { model: Match, attributes: ['id'], where: { roundId: { [Op.in]: roundIds } }, required: true },
          { model: User, attributes: ['id'] },
        ],
      });
      const board = rankFromTips(tips);
      const idx = board.findIndex((b) => b.userId === meId);
      if (idx >= 0) { rank = idx + 1; myPoints = board[idx].points; }
    }
    const sEnded = l.Season && seasonStatus(l.Season) === 'ended';
    myLeagues.push({
      id: l.id, name: l.name, type: l.type, hasPassword: l.hasPassword, image: l.image || null,
      seasonName: l.Season ? l.Season.name : null,
      seasonId: l.Season ? l.Season.id : null,
      seasonMode: l.Season ? l.Season.mode : null,
      ended: !!l.ended || sEnded, rank, myPoints,
    });
  }

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