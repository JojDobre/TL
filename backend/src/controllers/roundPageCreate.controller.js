// backend/src/controllers/roundPageCreate.controller.js
//
// Vytvorenie kola (GET formulár + POST). Kolo = názov + termíny (otvorenie,
// uzávierka), patrí do ligy. Zápasy sa pridávajú až POTOM (create-matches),
// lebo zápas potrebuje existujúce kolo.

const { League, Season, Round, User, UserSeason } = require('../models');
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

// GET /rounds/create?league=:id
const createRoundPage = asyncHandler(async (req, res) => {
  const leagueId = req.query.league;
  if (!leagueId) return res.redirect('/seasons');
  const league = await League.findByPk(leagueId, {
    include: [{ model: Season, attributes: ['id', 'name', 'creatorId'] }],
  });
  if (!league) return res.status(404).render('error-page', { message: 'Liga nebola nájdená.' });

  if (!(await canManageLeague(league, Number(req.session.userId)))) {
    return res.status(403).render('error-page', { message: 'Nemáš oprávnenie pridávať kolá do tejto ligy.' });
  }
  if (league.templateId) {
    return res.status(403).render('error-page', { message: 'Liga zo šablóny — kolá sú prevzaté z oficiálnej ligy a nedajú sa pridávať.' });
  }

  res.render('createRound', { league: league.toJSON(), error: null });
});

// POST /rounds/create
const createRoundSubmit = asyncHandler(async (req, res) => {
  const { leagueId, name, startDate, endDate } = req.body;
  const userId = Number(req.session.userId);

  const league = await League.findByPk(leagueId, {
    include: [{ model: Season, attributes: ['id', 'name', 'creatorId'] }],
  });
  if (!league) return res.redirect('/seasons');

  const renderErr = (msg) => res.status(400).render('createRound', { league: league.toJSON(), error: msg });

  if (!(await canManageLeague(league, userId))) {
    return res.status(403).render('error-page', { message: 'Nemáš oprávnenie pridávať kolá do tejto ligy.' });
  }
  if (league.templateId) {
    return res.status(403).render('error-page', { message: 'Liga zo šablóny — kolá sa nedajú pridávať.' });
  }
  if (!name || !name.trim()) return renderErr('Názov kola je povinný.');
  if (!startDate || !endDate) return renderErr('Zadaj otvorenie aj uzávierku tipovania.');

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start) || isNaN(end)) return renderErr('Neplatný formát dátumu.');
  if (end <= start) return renderErr('Uzávierka musí byť po otvorení tipovania.');

  const round = await Round.create({
    name: name.trim(), description: req.body.description || null,
    leagueId: league.id, startDate: start, endDate: end, active: true,
  });

  // po vytvorení kola → pridávanie zápasov
  res.redirect('/rounds/' + round.id + '/matches/create');
});

module.exports = { createRoundPage, createRoundSubmit };
