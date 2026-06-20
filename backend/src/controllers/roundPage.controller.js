// backend/src/controllers/roundPage.controller.js
//
// EJS stránka detailu kola — tu sa tipuje. Načíta kolo, jeho zápasy s tímami,
// vlastné tipy hráča, a (po uzávierke alebo pre správcu) aj cudzie tipy s bodmi.
// Skrývanie cudzích tipov do uzávierky je rovnaké ako v round API controlleri.

const { Round, League, Season, Match, Team, Tip, User, UserSeason, UserLeague } = require('../models');
const { isSeasonLocked } = require('../utils/season.utils');
const { asyncHandler } = require('../middleware/error.middleware');

const DEFAULT_SCORING = { exactScore: 10, correctGoals: 1, correctWinner: 3, goalDifference: 2 };

// skratka tímu z názvu (prvé 3 písmená veľkými)
const teamAbbr = (name) => (name || '?').replace(/[^A-Za-zÀ-ž0-9 ]/g, '').split(' ').map((w) => w[0]).join('').substring(0, 3).toUpperCase() || (name || '?').substring(0, 3).toUpperCase();

// stav kola podľa dátumov
function roundStatus(round) {
  const now = new Date();
  if (now < new Date(round.startDate)) return 'scheduled';
  if (now > new Date(round.endDate)) return 'finished';
  return 'open';
}

// správca kola?
async function canManageRound(league, userId) {
  if (!userId) return false;
  const user = await User.findByPk(userId);
  if (user && user.role === 'admin') return true;
  if (league.creatorId === userId) return true;
  if (league.Season && league.Season.creatorId === userId) return true;
  const sRole = await UserSeason.findOne({ where: { userId, seasonId: league.seasonId } });
  if (sRole && sRole.role === 'admin') return true;
  return false;
}

// GET /rounds/:id
const roundDetailPage = asyncHandler(async (req, res) => {
  const round = await Round.findByPk(req.params.id, {
    include: [{
      model: League,
      attributes: ['id', 'name', 'seasonId', 'scoringSystem', 'creatorId', 'templateId'],
      include: [{ model: Season, attributes: ['id', 'name', 'creatorId', 'ended', 'endDate'] }],
    }],
  });
  if (!round) return res.status(404).render('error-page', { message: 'Kolo nebolo nájdené.' });

  const league = round.League;
  const scoring = (league && league.scoringSystem) || DEFAULT_SCORING;
  const meId = req.userId ? Number(req.userId) : null;
  const status = roundStatus(round);
  const isManager = await canManageRound(league, meId);
  const revealAll = status === 'finished' || isManager;

  // členstvo v lige — len člen (alebo manažér) môže tipovať / zadávať skóre
  let isMember = false;
  if (meId) {
    if (isManager) isMember = true;
    else {
      const ul = await UserLeague.findOne({ where: { userId: meId, leagueId: league.id } });
      isMember = !!ul;
    }
  }

  // zápasy kola s tímami
  const matches = await Match.findAll({
    where: { roundId: round.id },
    include: [{ model: Team, as: 'homeTeam' }, { model: Team, as: 'awayTeam' }],
    order: [['matchTime', 'ASC']],
  });

  // moje tipy (mapa podľa matchId)
  const myTipsArr = meId ? await Tip.findAll({
    where: { userId: meId },
    include: [{ model: Match, where: { roundId: round.id }, required: true, attributes: ['id'] }],
  }) : [];
  const myTips = {};
  myTipsArr.forEach((t) => { myTips[t.matchId] = t; });

  // cudzie tipy (len ak revealAll) — zoskupené podľa matchId
  let othersByMatch = {};
  if (revealAll) {
    const allTips = await Tip.findAll({
      include: [
        { model: Match, where: { roundId: round.id }, required: true, attributes: ['id'] },
        { model: User, attributes: ['id', 'username', 'firstName', 'lastName'] },
      ],
    });
    allTips.forEach((t) => {
      if (meId && t.userId === meId) return; // cudzie = bez mojich
      if (!othersByMatch[t.matchId]) othersByMatch[t.matchId] = [];
      othersByMatch[t.matchId].push(t);
    });
  }

  // priprav zápasy pre šablónu
  const matchData = matches.map((m) => {
    const mj = m.toJSON();
    const my = myTips[m.id] || null;
    return {
      ...mj,
      homeAbbr: teamAbbr(mj.homeTeam && mj.homeTeam.name),
      awayAbbr: teamAbbr(mj.awayTeam && mj.awayTeam.name),
      myTip: my ? { homeScore: my.homeScore, awayScore: my.awayScore, winner: my.winner, points: my.points } : null,
      others: (othersByMatch[m.id] || []).map((t) => ({
        name: [t.User.firstName, t.User.lastName].filter(Boolean).join(' ') || t.User.username || 'Hráč',
        abbr: teamAbbr([t.User.firstName, t.User.lastName].filter(Boolean).join(' ') || t.User.username),
        homeScore: t.homeScore, awayScore: t.awayScore, winner: t.winner, points: t.points,
      })),
    };
  });

  const tippedCount = matchData.filter((m) => m.myTip && (m.myTip.homeScore != null || m.myTip.winner)).length;

  // rebríček kola
  const lbTips = await Tip.findAll({
    include: [
      { model: Match, where: { roundId: round.id }, required: true, attributes: ['id'] },
      { model: User, attributes: ['id', 'username', 'firstName', 'lastName'] },
    ],
  });
  const byUser = {};
  lbTips.forEach((t) => {
    if (!t.User) return;
    const uid = t.User.id;
    if (!byUser[uid]) byUser[uid] = { user: t.User.toJSON(), totalPoints: 0 };
    byUser[uid].totalPoints += t.points || 0;
  });
  const leaderboard = Object.values(byUser).sort((a, b) => b.totalPoints - a.totalPoints);

  const myPoints = matchData.reduce((sum, m) => sum + (m.myTip && m.myTip.points ? m.myTip.points : 0), 0);

  res.render('roundDetail', {
    round: { ...round.toJSON(), status },
    league,
    scoring,
    matches: matchData,
    tippedCount,
    leaderboard,
    revealAll,
    isManager,
    isMember,
    myPoints,
    isClone: !!(league && league.templateId),
    seasonLocked: league.Season ? isSeasonLocked(league.Season) : false,
  });
});

module.exports = { roundDetailPage };