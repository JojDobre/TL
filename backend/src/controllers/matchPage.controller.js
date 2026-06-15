// backend/src/controllers/matchPage.controller.js
//
// Stránka na pridávanie zápasov do kola (ručný režim). Načíta kolo, jeho ligu
// a zoznam tímov z DB. Samotné pridávanie/mazanie zápasov beží cez /api/matches.

const { Round, League, Season, Match, Team, User, UserSeason } = require('../models');
const { asyncHandler } = require('../middleware/error.middleware');

async function canManageLeague(league, userId) {
  if (!userId) return false;
  const user = await User.findByPk(userId);
  if (user && user.role === 'admin') return true;
  if (league.creatorId === userId) return true;
  if (league.Season && league.Season.creatorId === userId) return true;
  const sRole = await UserSeason.findOne({ where: { userId, seasonId: league.seasonId } });
  if (sRole && sRole.role === 'admin') return true;
  return false;
}

const teamAbbr = (name) => (name || '?').replace(/[^A-Za-zÀ-ž0-9 ]/g, '').split(' ').map((w) => w[0]).join('').substring(0, 3).toUpperCase() || (name || '?').substring(0, 3).toUpperCase();

// GET /rounds/:id/matches/create
const createMatchesPage = asyncHandler(async (req, res) => {
  const round = await Round.findByPk(req.params.id, {
    include: [{ model: League, include: [{ model: Season, attributes: ['id', 'name', 'creatorId'] }] }],
  });
  if (!round) return res.status(404).render('error-page', { message: 'Kolo nebolo nájdené.' });

  const league = round.League;
  if (!(await canManageLeague(league, Number(req.session.userId)))) {
    return res.status(403).render('error-page', { message: 'Nemáš oprávnenie pridávať zápasy do tohto kola.' });
  }

  // liga zo šablóny — kolá a zápasy sú prevzaté zo šablóny, nedajú sa tu meniť
  if (league.templateId) {
    return res.status(403).render('error-page', { message: 'Táto liga je vytvorená zo šablóny — zápasy sú prevzaté z oficiálnej ligy a nedajú sa upravovať.' });
  }

  // tímy pre výber — LEN zo súpisky ligy (definovanej pri lige)
  const teams = await league.getTeams({ attributes: ['id', 'name'], order: [['name', 'ASC']] });

  // už pridané zápasy v kole
  const matches = await Match.findAll({
    where: { roundId: round.id },
    include: [{ model: Team, as: 'homeTeam' }, { model: Team, as: 'awayTeam' }],
    order: [['matchTime', 'ASC']],
  });
  const matchData = matches.map((m) => {
    const mj = m.toJSON();
    return { ...mj, homeAbbr: teamAbbr(mj.homeTeam && mj.homeTeam.name), awayAbbr: teamAbbr(mj.awayTeam && mj.awayTeam.name) };
  });

  res.render('createMatches', {
    round: round.toJSON(),
    league: league.toJSON(),
    teams: teams.map((t) => t.toJSON()),
    matches: matchData,
  });
});

module.exports = { createMatchesPage };
