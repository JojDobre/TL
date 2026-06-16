// backend/src/controllers/leaderboardPage.controller.js
//
// Samostatná stránka rebríčka sezóny. Súčet bodov naprieč VŠETKÝMI ligami
// sezóny + presnosť (trafené tipy / odtipované vyhodnotené). Trend nemáme
// (netrackujeme históriu poradia) → zobrazí sa "—".

const { Season, League, Round, Match, Tip, User, UserSeason } = require('../models');
const { asyncHandler } = require('../middleware/error.middleware');
const { seasonStatus, canViewSeasonContent } = require('../utils/season.utils');

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
      { model: Match, include: [{ model: Round, include: [{ model: League, where: { seasonId: season.id }, attributes: ['id'] }], attributes: ['id'] }], attributes: ['id', 'status'] },
      { model: User, attributes: ['id', 'username', 'firstName', 'lastName', 'role'] },
    ],
  });

  // agregácia podľa hráča: body + presnosť (zásah = >0 bodov na vyhodnotenom zápase)
  const byUser = {};
  tips.forEach((tip) => {
    if (!tip.User || !tip.Match) return;
    const finished = tip.Match.status === 'finished';
    const uid = tip.User.id;
    if (!byUser[uid]) byUser[uid] = { user: tip.User.toJSON(), totalPoints: 0, evaluated: 0, hits: 0 };
    byUser[uid].totalPoints += tip.points || 0;
    if (finished) {
      byUser[uid].evaluated += 1;
      if ((tip.points || 0) > 0) byUser[uid].hits += 1;
    }
  });

  const leaderboard = Object.values(byUser)
    .map((row) => ({
      ...row,
      accuracy: row.evaluated > 0 ? Math.round((row.hits / row.evaluated) * 100) : null,
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
  });
});

module.exports = { seasonLeaderboardPage };
