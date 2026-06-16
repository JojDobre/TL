// backend/src/controllers/evaluatePage.controller.js
//
// Stránka na vyhodnotenie zápasov kola (zadanie výsledkov). Načíta kolo a jeho
// zápasy s počtom tipov. Samotné uloženie výsledku beží cez
// POST /api/matches/:id/evaluate (tam sa prepočítajú body).
// Tipy hráčov sa tu NEzobrazujú — férovosť (admin zadáva výsledok naslepo).

const { Round, League, Season, Match, Team, Tip, User, UserSeason } = require('../models');
const { asyncHandler } = require('../middleware/error.middleware');
const { isLeagueLocked } = require('../utils/league.utils');

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

// GET /rounds/:id/evaluate
const evaluatePage = asyncHandler(async (req, res) => {
  const round = await Round.findByPk(req.params.id, {
    include: [{ model: League, include: [{ model: Season, attributes: ['id', 'name', 'creatorId', 'startDate', 'endDate', 'ended'] }] }],
  });
  if (!round) return res.status(404).render('error-page', { message: 'Kolo nebolo nájdené.' });

  const league = round.League;
  if (!(await canManageLeague(league, Number(req.session.userId)))) {
    return res.status(403).render('error-page', { message: 'Nemáš oprávnenie vyhodnocovať toto kolo.' });
  }

  // liga zo šablóny — výsledky riadi admin v oficiálnej lige, tu sa nevyhodnocuje
  if (league.templateId) {
    return res.status(403).render('error-page', { message: 'Táto liga je vytvorená zo šablóny — výsledky zápasov spravuje administrátor v oficiálnej lige a prejavia sa automaticky.' });
  }
  if (isLeagueLocked(league)) {
    return res.status(403).render('error-page', { message: 'Liga je ukončená — vyhodnocovanie nie je možné.' });
  }

  const matches = await Match.findAll({
    where: { roundId: round.id },
    include: [{ model: Team, as: 'homeTeam' }, { model: Team, as: 'awayTeam' }],
    order: [['matchTime', 'ASC']],
  });

  const matchData = await Promise.all(matches.map(async (m) => {
    const mj = m.toJSON();
    const tipsCount = await Tip.count({ where: { matchId: m.id } });
    return {
      ...mj,
      homeAbbr: teamAbbr(mj.homeTeam && mj.homeTeam.name),
      awayAbbr: teamAbbr(mj.awayTeam && mj.awayTeam.name),
      tipsCount,
    };
  }));

  const evaluated = matchData.filter((m) => m.status === 'finished').length;
  const canceled = matchData.filter((m) => m.status === 'canceled').length;
  const pending = matchData.length - evaluated - canceled;

  res.render('evaluate', {
    round: round.toJSON(),
    league: league.toJSON(),
    matches: matchData,
    stats: { total: matchData.length, evaluated, canceled, pending },
  });
});

module.exports = { evaluatePage };
