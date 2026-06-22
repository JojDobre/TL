// backend/src/controllers/myTipsPage.controller.js
//
// "Moje tipy" (/moje-tipy): VŠETKY zápasy, ktoré používateľ môže práve upraviť —
// teda zápasy v OTVORENÝCH kolách (now medzi startDate a endDate), naprieč
// všetkými ligami a sezónami, ktorých je členom. Zoskupené sezóna → kolo.
// Tipuje sa priamo tu (cez /api/tips), rovnaké UI ako /seasons/:id/zapasy.

const { Season, League, Round, Match, Team, Tip, UserLeague, Sequelize } = require('../models');
const { asyncHandler } = require('../middleware/error.middleware');

const Op = Sequelize.Op;
const DEFAULT_SCORING = { exactScore: 10, correctGoals: 1, correctWinner: 3, goalDifference: 2 };

// Stav kola z dátumov — tipovať sa dá len v otvorenom kole.
function roundStatus(round) {
  const now = new Date();
  if (now < new Date(round.startDate)) return 'scheduled';
  if (now > new Date(round.endDate)) return 'finished';
  return 'open';
}

const teamAbbr = (name) => (name || '?').replace(/[^A-Za-zÀ-ž0-9 ]/g, '').split(' ').map((w) => w[0]).join('').substring(0, 3).toUpperCase() || (name || '?').substring(0, 3).toUpperCase();

// GET /moje-tipy
const myTipsPage = asyncHandler(async (req, res) => {
  const meId = Number(req.session.userId);

  // ligy, ktorých je hráč členom
  const mems = await UserLeague.findAll({ where: { userId: meId }, attributes: ['leagueId'] });
  const myLeagueIds = mems.map((m) => m.leagueId);

  let seasonGroups = [];
  let totalMatches = 0;
  let unfilled = 0;
  let scoring = DEFAULT_SCORING;

  if (myLeagueIds.length) {
    // ligy s detailmi (názov, sezóna, bodovanie)
    const leagues = await League.findAll({
      where: { id: { [Op.in]: myLeagueIds } },
      attributes: ['id', 'name', 'seasonId', 'scoringSystem'],
      include: [{ model: Season, attributes: ['id', 'name', 'type'] }],
    });
    const leagueById = {};
    leagues.forEach((l) => { leagueById[l.id] = l; });
    if (leagues[0] && leagues[0].scoringSystem) scoring = leagues[0].scoringSystem;

    // otvorené kolá naprieč mojimi ligami
    const allRounds = await Round.findAll({
      where: { leagueId: { [Op.in]: myLeagueIds } },
      attributes: ['id', 'name', 'leagueId', 'startDate', 'endDate'],
      order: [['startDate', 'ASC']],
    });
    const openRounds = allRounds.filter((r) => roundStatus(r) === 'open');
    const roundById = {};
    openRounds.forEach((r) => { roundById[r.id] = r; });
    const roundIds = openRounds.map((r) => r.id);

    let matches = [];
    if (roundIds.length) {
      const now = new Date();
      matches = await Match.findAll({
        where: { roundId: { [Op.in]: roundIds }, status: 'scheduled', matchTime: { [Op.gt]: now } },
        include: [{ model: Team, as: 'homeTeam' }, { model: Team, as: 'awayTeam' }],
        order: [['matchTime', 'ASC']],
      });
    }
    totalMatches = matches.length;

    // moje tipy pre tieto zápasy
    const myTipsArr = matches.length
      ? await Tip.findAll({ where: { userId: meId, matchId: { [Op.in]: matches.map((m) => m.id) } } })
      : [];
    const myTips = {};
    myTipsArr.forEach((t) => { myTips[t.matchId] = t; });

    // zoskup: sezóna -> kolo -> zápasy
    // bySeason[seasonId] = { seasonId, seasonName, seasonType, rounds: { roundId -> group } }
    const bySeason = {};
    matches.forEach((m) => {
      const round = roundById[m.roundId];
      const league = round ? leagueById[round.leagueId] : null;
      const season = league && league.Season ? league.Season : null;
      const sId = season ? season.id : 0;

      if (!bySeason[sId]) {
        bySeason[sId] = {
          seasonId: sId,
          seasonName: season ? season.name : 'Ostatné',
          seasonType: season ? season.type : null,
          roundsMap: {},
        };
      }
      const sg = bySeason[sId];
      if (!sg.roundsMap[m.roundId]) {
        sg.roundsMap[m.roundId] = {
          roundId: m.roundId,
          roundName: round ? round.name : 'Kolo',
          leagueName: league ? league.name : '',
          endDate: round ? round.endDate : null,
          matches: [],
        };
      }
      const mj = m.toJSON();
      const my = myTips[m.id] || null;
      const isWinner = mj.tipType === 'winner';
      const tipped = my && (isWinner ? my.winner : my.homeScore != null);
      if (!tipped) unfilled += 1;

      sg.roundsMap[m.roundId].matches.push({
        ...mj,
        homeAbbr: teamAbbr(mj.homeTeam && mj.homeTeam.name),
        awayAbbr: teamAbbr(mj.awayTeam && mj.awayTeam.name),
        myTip: my ? { homeScore: my.homeScore, awayScore: my.awayScore, winner: my.winner } : null,
      });
    });

    // map -> zoradené polia
    seasonGroups = Object.values(bySeason).map((sg) => ({
      seasonId: sg.seasonId,
      seasonName: sg.seasonName,
      seasonType: sg.seasonType,
      rounds: Object.values(sg.roundsMap).sort((a, b) => new Date(a.endDate || 0) - new Date(b.endDate || 0)),
    }));
  }

  res.render('my-tips', {
    seasonGroups,
    scoring,
    totalMatches,
    unfilled,
    notMember: myLeagueIds.length === 0,
  });
});

module.exports = { myTipsPage };