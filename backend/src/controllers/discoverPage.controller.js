// backend/src/controllers/discoverPage.controller.js
//
// Objavovanie verejných komunitných sezón (/discover). Hľadanie podľa názvu/ID,
// triedenie (najviac hráčov / najnovšie). Zobrazujú sa len neskryté komunitné
// sezóny (oficiálne majú vlastnú sekciu inde).

const { Season, League, Sequelize } = require('../models');
const { Op } = Sequelize;
const { seasonStatus } = require('../utils/season.utils');
const { asyncHandler } = require('../middleware/error.middleware');

// GET /discover
const discoverPage = asyncHandler(async (req, res) => {
  const q = (req.query.q || '').trim();
  const sort = req.query.sort || 'players'; // 'players' | 'newest'

  // základ: neskryté komunitné sezóny
  const where = { hidden: false, type: 'community' };
  if (q) {
    where[Op.or] = [
      { name: { [Op.like]: `%${q}%` } },
      { inviteCode: { [Op.like]: `%${q}%` } },
    ];
  }

  const seasons = await Season.findAll({
    where,
    order: [['createdAt', 'DESC']],
  });

  const withCounts = await Promise.all(seasons.map(async (s) => {
    const lc = await League.count({ where: { seasonId: s.id } });
    let pc = 0;
    try { pc = await s.countParticipants(); } catch { /* nič */ }
    return {
      id: s.id,
      name: s.name,
      description: s.description || '',
      participantsCount: pc,
      leaguesCount: lc,
      hasPassword: !!s.hasPassword,
      status: seasonStatus(s),
    };
  }));

  // triedenie
  if (sort === 'players') withCounts.sort((a, b) => b.participantsCount - a.participantsCount);
  // 'newest' je už zaradené podľa createdAt DESC z DB

  res.render('discover', {
    seasons: withCounts,
    q, sort,
    total: withCounts.length,
  });
});

module.exports = { discoverPage };
