// backend/src/controllers/seasonMatchesPage.controller.js
//
// "Zápasy sezóny" (/seasons/:id/zapasy): všetky BUDÚCE naplánované zápasy danej
// sezóny, ale len z líg, do ktorých je hráč pripojený. Tipuje sa priamo tu
// (rovnako ako v kole, cez /api/tips). Šablóna vychádza z detailu kola.

const { Season, League, Round, Match, Team, Tip, User, UserSeason, UserLeague, Sequelize } = require('../models');
const { asyncHandler } = require('../middleware/error.middleware');
const { seasonStatus } = require('../utils/season.utils');

const Op = Sequelize.Op;
const DEFAULT_SCORING = { exactScore: 10, correctGoals: 1, correctWinner: 3, goalDifference: 2 };

// Stav kola odvodený z dátumov — identicky ako v roundPage.controller.
// Tipovať sa dá LEN v otvorenom kole (now medzi startDate a endDate).
function roundStatus(round) {
  const now = new Date();
  if (now < new Date(round.startDate)) return 'scheduled'; // ešte neotvorené
  if (now > new Date(round.endDate)) return 'finished';     // uzávierka prešla
  return 'open';
}

const teamAbbr = (name) => (name || '?').replace(/[^A-Za-zÀ-ž0-9 ]/g, '').split(' ').map((w) => w[0]).join('').substring(0, 3).toUpperCase() || (name || '?').substring(0, 3).toUpperCase();

// GET /seasons/:id/zapasy
const seasonMatchesPage = asyncHandler(async (req, res) => {
  const meId = Number(req.session.userId);
  const season = await Season.findByPk(req.params.id);
  if (!season) return res.status(404).render('error-page', { message: 'Sezóna nebola nájdená.' });

  // ligy v sezóne, do ktorých je hráč pripojený
  const seasonLeagues = await League.findAll({ where: { seasonId: season.id }, attributes: ['id', 'name', 'scoringSystem'] });
  const seasonLeagueIds = seasonLeagues.map((l) => l.id);
  let myLeagues = [];
  if (seasonLeagueIds.length) {
    const mem = await UserLeague.findAll({ where: { userId: meId, leagueId: { [Op.in]: seasonLeagueIds } } });
    const myIds = new Set(mem.map((m) => m.leagueId));
    myLeagues = seasonLeagues.filter((l) => myIds.has(l.id));
  }
  const myLeagueIds = myLeagues.map((l) => l.id);

  // budúce naplánované zápasy z mojich líg v sezóne
  let groups = [];
  let totalMatches = 0;
  if (myLeagueIds.length) {
    const now = new Date();
    const allRounds = await Round.findAll({ where: { leagueId: { [Op.in]: myLeagueIds } }, attributes: ['id', 'name', 'leagueId', 'startDate', 'endDate'], order: [['startDate', 'ASC']] });
    // len OTVORENÉ kolá — zápasy z neotvorených (scheduled) ani uzavretých
    // (finished) kôl sa tu tipovať nedajú, takže ich nezobrazujeme.
    const rounds = allRounds.filter((r) => roundStatus(r) === 'open');
    const roundIds = rounds.map((r) => r.id);
    let matches = [];
    if (roundIds.length) {
      matches = await Match.findAll({
        where: { roundId: { [Op.in]: roundIds }, status: 'scheduled', matchTime: { [Op.gt]: now } },
        include: [{ model: Team, as: 'homeTeam' }, { model: Team, as: 'awayTeam' }],
        order: [['matchTime', 'ASC']],
      });
    }
    totalMatches = matches.length;

    // moje tipy pre tieto zápasy
    const myTipsArr = matches.length ? await Tip.findAll({ where: { userId: meId, matchId: { [Op.in]: matches.map((m) => m.id) } } }) : [];
    const myTips = {};
    myTipsArr.forEach((t) => { myTips[t.matchId] = t; });

    // zoskup podľa kola (kolo patrí lige)
    const roundById = {};
    rounds.forEach((r) => { roundById[r.id] = r; });
    const leagueById = {};
    myLeagues.forEach((l) => { leagueById[l.id] = l; });

    const byRound = {};
    matches.forEach((m) => {
      const r = roundById[m.roundId];
      if (!byRound[m.roundId]) {
        byRound[m.roundId] = {
          roundId: m.roundId,
          roundName: r ? r.name : 'Kolo',
          leagueName: r && leagueById[r.leagueId] ? leagueById[r.leagueId].name : '',
          endDate: r ? r.endDate : null,
          matches: [],
        };
      }
      const mj = m.toJSON();
      const my = myTips[m.id] || null;
      byRound[m.roundId].matches.push({
        ...mj,
        homeAbbr: teamAbbr(mj.homeTeam && mj.homeTeam.name),
        awayAbbr: teamAbbr(mj.awayTeam && mj.awayTeam.name),
        myTip: my ? { homeScore: my.homeScore, awayScore: my.awayScore, winner: my.winner } : null,
      });
    });
    groups = Object.values(byRound).sort((a, b) => new Date(a.endDate || 0) - new Date(b.endDate || 0));
  }

  // počet nevyplnených
  let unfilled = 0;
  groups.forEach((g) => g.matches.forEach((m) => { if (!m.myTip || (m.myTip.homeScore == null && !m.myTip.winner)) unfilled += 1; }));

  res.render('seasonMatches', {
    season: { id: season.id, name: season.name, type: season.type, status: seasonStatus(season) },
    scoring: (myLeagues[0] && myLeagues[0].scoringSystem) || DEFAULT_SCORING,
    groups,
    totalMatches,
    unfilled,
    notMember: myLeagueIds.length === 0,
  });
});

module.exports = { seasonMatchesPage };