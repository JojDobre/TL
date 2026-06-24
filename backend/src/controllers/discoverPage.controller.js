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

  // Filtre prístupu a stavu prichádzajú ako checkboxy. Keď používateľ pošle
  // formulár, odškrtnutý checkbox sa NEpošle — preto rozlišujeme, či filter
  // bol vôbec odoslaný (req.query.f === '1' nastaví skrytý input vo formulári).
  const filtersSubmitted = req.query.f === '1';
  // Prístup: 'pub' = verejné (bez hesla), 'pwd' = chránené heslom
  const accVals = [].concat(req.query.access || []);
  const showPublic = filtersSubmitted ? accVals.includes('pub') : true;
  const showProtected = filtersSubmitted ? accVals.includes('pwd') : true;
  // Stav: 'active' | 'upcoming' | 'ended'
  const stVals = [].concat(req.query.status || []);
  const showActive = filtersSubmitted ? stVals.includes('active') : true;
  const showUpcoming = filtersSubmitted ? stVals.includes('upcoming') : true;
  // ukončené sa NEzobrazujú štandardne — len ak ich používateľ vo filtri zaškrtne
  const showEnded = filtersSubmitted ? stVals.includes('ended') : false;

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

  let withCounts = await Promise.all(seasons.map(async (s) => {
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

  // filter prístupu (ak je aspoň jeden odškrtnutý)
  withCounts = withCounts.filter((s) => (s.hasPassword ? showProtected : showPublic));
  // filter stavu
  withCounts = withCounts.filter((s) => {
    if (s.status === 'active') return showActive;
    if (s.status === 'upcoming') return showUpcoming;
    if (s.status === 'ended') return showEnded;
    return true;
  });

  // triedenie
  if (sort === 'players') withCounts.sort((a, b) => b.participantsCount - a.participantsCount);
  // 'newest' je už zaradené podľa createdAt DESC z DB

  res.render('discover', {
    seasons: withCounts,
    q, sort,
    filters: { showPublic, showProtected, showActive, showUpcoming, showEnded },
    total: withCounts.length,
  });
});

module.exports = { discoverPage };