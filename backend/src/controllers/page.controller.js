// backend/src/controllers/page.controller.js
//
// Controllery, ktoré VYKRESĽUJÚ EJS stránky (server-rendered HTML s dátami).
// Logika načítania dát je rovnaká ako v API controlleroch — líši sa len tým,
// že na konci je res.render(...) namiesto res.json(...).

const { Season, User, League } = require('../models');
const { asyncHandler } = require('../middleware/error.middleware');

// GET /seasons  → vykreslí zoznam sezón
const seasonsPage = asyncHandler(async (req, res) => {
  const seasons = await Season.findAll({
    include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] }],
    order: [['createdAt', 'DESC']],
  });

  const withCounts = await Promise.all(seasons.map(async (season) => {
    const leaguesCount = await League.count({ where: { seasonId: season.id } });
    let participantsCount = 0;
    try { participantsCount = await season.countParticipants(); } catch { /* nič */ }
    return { ...season.toJSON(), leaguesCount, participantsCount };
  }));

  const official = withCounts.filter((s) => s.type === 'official');
  const community = withCounts.filter((s) => s.type === 'community');

  res.render('seasons', { official, community });
});

module.exports = { seasonsPage };
