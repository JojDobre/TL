// backend/src/controllers/page.controller.js
//
// Controllery, ktoré VYKRESĽUJÚ EJS stránky (server-rendered HTML s dátami).
// Logika načítania dát je rovnaká ako v API controlleroch — líši sa len tým,
// že na konci je res.render(...) namiesto res.json(...).

const { Season, User, League, Round, Match, Tip, UserSeason } = require('../models');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const { seasonStatus, isSeasonLocked, canViewSeasonContent } = require('../utils/season.utils');
const { asyncHandler } = require('../middleware/error.middleware');

const generateInviteCode = () => uuidv4().substring(0, 6).toUpperCase();
const SEASON_LIMITS = { player: 1, vip: 2 };

// GET /seasons
const seasonsPage = asyncHandler(async (req, res) => {
  const meId = req.userId ? Number(req.userId) : null;
  // ID sezón, ktorých je prihlásený členom (skryté sezóny smie vidieť, ak je v nich)
  let mySeasonIds = [];
  if (meId) {
    const mem = await UserSeason.findAll({ where: { userId: meId }, attributes: ['seasonId'] });
    mySeasonIds = mem.map((m) => m.seasonId);
  }

  const seasons = await Season.findAll({
    include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] }],
    order: [['createdAt', 'DESC']],
  });
  const withCounts = await Promise.all(seasons.map(async (season) => {
    const leaguesCount = await League.count({ where: { seasonId: season.id } });
    let participantsCount = 0;
    try { participantsCount = await season.countParticipants(); } catch { /* nič */ }
    return { ...season.toJSON(), leaguesCount, participantsCount, status: seasonStatus(season) };
  }));

  // skryté sezóny zo zoznamu vypadnú — okrem tých, kde je užívateľ člen/tvorca
  const visible = withCounts.filter((s) =>
    !s.hidden || (meId && (s.creatorId === meId || mySeasonIds.includes(s.id))));

  const official = visible.filter((s) => s.type === 'official');
  const community = visible.filter((s) => s.type === 'community');
  res.render('seasons', { official, community });
});

// GET /seasons/:id
const seasonDetailPage = asyncHandler(async (req, res) => {
  const season = await Season.findByPk(req.params.id, {
    include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] }],
  });
  if (!season) return res.status(404).render('error-page', { message: 'Sezóna nebola nájdená.' });

  const meId = req.userId ? Number(req.userId) : null;

  // je prihlásený členom / tvorcom / globálnym adminom?
  let isMember = false;
  let isGlobalAdmin = false;
  if (meId) {
    const membership = await UserSeason.findOne({ where: { userId: meId, seasonId: season.id } });
    isMember = !!membership;
    const u = await User.findByPk(meId);
    isGlobalAdmin = u && u.role === 'admin';
  }
  const isCreator = meId && season.creatorId === meId;
  const canManage = isCreator || isGlobalAdmin || false;

  const status = seasonStatus(season);

  // SÚKROMIE: ak je súkromná a nemám prístup → zamknutý detail (len pole na heslo)
  const canView = canViewSeasonContent(season, { isMember, isCreator, isGlobalAdmin });
  if (!canView) {
    return res.render('seasonDetail', {
      season: { ...season.toJSON(), status, locked: true, participantsCount: null, leaguesCount: null },
      leagues: [], leaderboard: [], joinError: null,
      restricted: true, canManage: false, status,
    });
  }

  let participantsCount = 0;
  try { participantsCount = await season.countParticipants(); } catch { /* nič */ }
  const leagues = await League.findAll({ where: { seasonId: season.id }, order: [['createdAt', 'ASC']] });

  // súhrnný rebríček (agregácia bodov z tipov vo všetkých ligách sezóny)
  let leaderboard = [];
  try {
    const tips = await Tip.findAll({
      include: [
        { model: Match, include: [{ model: Round, include: [{ model: League, where: { seasonId: season.id } }] }] },
        { model: User, attributes: ['id', 'username', 'firstName', 'lastName'] },
      ],
    });
    const byUser = {};
    tips.forEach((tip) => {
      if (!tip.User) return;
      const uid = tip.User.id;
      if (!byUser[uid]) byUser[uid] = { user: tip.User.toJSON(), totalPoints: 0 };
      byUser[uid].totalPoints += tip.points || 0;
    });
    leaderboard = Object.values(byUser).sort((a, b) => b.totalPoints - a.totalPoints);
  } catch (e) { leaderboard = []; }

  res.render('seasonDetail', {
    season: { ...season.toJSON(), participantsCount, leaguesCount: leagues.length, status },
    leagues: leagues.map((l) => l.toJSON()),
    leaderboard,
    joinError: null,
    restricted: false,
    canManage,
    status,
  });
});

// GET /seasons/create
const createSeasonPage = (req, res) => {
  res.render('createSeason', { error: null });
};

// POST /seasons/create
const createSeasonSubmit = asyncHandler(async (req, res) => {
  const { name, description, image, type, startDate, endDate, password, isPrivate, hidden } = req.body;
  const userId = Number(req.session.userId);
  const user = await User.findByPk(userId);
  if (!user) return res.redirect('/login');

  const back = (error) => res.status(400).render('createSeason', { error });

  if (!name || !name.trim()) return back('Názov sezóny je povinný.');

  // limit počtu AKTÍVNYCH sezón podľa roly (ended sa nepočítajú)
  const limit = SEASON_LIMITS[user.role];
  if (limit !== undefined) {
    const mine = await Season.findAll({ where: { creatorId: userId } });
    const activeCount = mine.filter((s) => seasonStatus(s) !== 'ended').length;
    if (activeCount >= limit) {
      return back(user.role === 'player'
        ? 'Máš už maximálny počet aktívnych sezón (1). Ukonči niektorú, alebo prejdi na VIP.'
        : `Máš už maximálny počet aktívnych sezón (${limit}). Ukonči niektorú pre vytvorenie ďalšej.`);
    }
  }

  // oficiálnu sezónu môže vytvoriť LEN admin
  const seasonType = (type === 'official' && user.role === 'admin') ? 'official' : 'community';
  const participantLimit = seasonType === 'community' ? 100 : null;

  // dátumy (voliteľné, ale ak sú obe, koniec musí byť po začiatku)
  let start = startDate ? new Date(startDate) : null;
  let end = endDate ? new Date(endDate) : null;
  if (start && isNaN(start)) start = null;
  if (end && isNaN(end)) end = null;
  if (start && end && end <= start) return back('Koniec sezóny musí byť po jej začiatku.');

  // heslo + súkromie — len pre community (oficiálne sú vždy verejné)
  let passwordHash = null;
  let priv = false;
  let hide = false;
  if (seasonType === 'community' && (isPrivate === 'on' || isPrivate === 'true')) {
    if (!password || !password.trim()) return back('Súkromná sezóna musí mať heslo.');
    passwordHash = await bcrypt.hash(password.trim(), 10);
    priv = true;
    hide = (hidden === 'on' || hidden === 'true');
  }

  const season = await Season.create({
    name: name.trim(), description, image: image || null,
    type: seasonType, inviteCode: generateInviteCode(),
    creatorId: userId, active: true, participantLimit,
    startDate: start, endDate: end, ended: false,
    password: passwordHash, hasPassword: priv, hidden: hide,
  });
  try { await season.addParticipant(userId, { through: { role: 'admin' } }); } catch (e) { /* nič */ }

  res.redirect('/seasons/' + season.id);
});

// POST /seasons/join   (cez invite kód ALEBO id, s heslom ak je súkromná)
const joinSeasonSubmit = asyncHandler(async (req, res) => {
  const { inviteCode, seasonId, password } = req.body;
  const userId = Number(req.session.userId);
  if (!userId) return res.redirect('/login');

  // nájdi sezónu podľa id (z detailu) alebo invite kódu (z dialógu)
  let season = null;
  if (seasonId) season = await Season.findByPk(seasonId);
  if (!season && inviteCode) season = await Season.findOne({ where: { inviteCode: (inviteCode || '').toUpperCase() } });
  if (!season) return res.redirect('/seasons');

  // ukončená sezóna — nedá sa pripojiť
  if (isSeasonLocked(season)) return res.redirect('/seasons/' + season.id);

  // súkromná → over heslo
  if (season.hasPassword) {
    const ok = password && await bcrypt.compare(password, season.password || '');
    if (!ok) {
      // späť na detail s chybou hesla
      return res.status(401).render('seasonDetail', {
        season: { ...season.toJSON(), status: seasonStatus(season), locked: true },
        leagues: [], leaderboard: [], joinError: 'Nesprávne heslo sezóny.',
        restricted: true, canManage: false, status: seasonStatus(season),
      });
    }
  }

  await UserSeason.findOrCreate({
    where: { userId, seasonId: season.id },
    defaults: { userId, seasonId: season.id, role: 'player', joinedAt: new Date() },
  });
  res.redirect('/seasons/' + season.id);
});

// GET /seasons/:id/manage — úprava sezóny (len tvorca/admin)
const manageSeasonPage = asyncHandler(async (req, res) => {
  const userId = Number(req.session.userId);
  const season = await Season.findByPk(req.params.id);
  if (!season) return res.status(404).render('error-page', { message: 'Sezóna nebola nájdená.' });

  const u = await User.findByPk(userId);
  const allowed = season.creatorId === userId || (u && u.role === 'admin');
  if (!allowed) return res.status(403).render('error-page', { message: 'Nemáš oprávnenie spravovať túto sezónu.' });

  res.render('manageSeason', { season: { ...season.toJSON(), status: seasonStatus(season) }, error: null });
});

// POST /seasons/:id/manage
const manageSeasonSubmit = asyncHandler(async (req, res) => {
  const userId = Number(req.session.userId);
  const { name, description, image, startDate, endDate, isPrivate, password, removePassword, hidden } = req.body;
  const season = await Season.findByPk(req.params.id);
  if (!season) return res.redirect('/seasons');

  const u = await User.findByPk(userId);
  const allowed = season.creatorId === userId || (u && u.role === 'admin');
  if (!allowed) return res.status(403).render('error-page', { message: 'Nemáš oprávnenie spravovať túto sezónu.' });

  const back = (error) => res.status(400).render('manageSeason', { season: { ...season.toJSON(), status: seasonStatus(season) }, error });

  // ukončenú sezónu nemožno upravovať
  if (isSeasonLocked(season)) return back('Sezóna je ukončená a uzamknutá, nedá sa upravovať.');
  if (!name || !name.trim()) return back('Názov sezóny je povinný.');

  let start = startDate ? new Date(startDate) : null;
  let end = endDate ? new Date(endDate) : null;
  if (start && isNaN(start)) start = null;
  if (end && isNaN(end)) end = null;
  if (start && end && end <= start) return back('Koniec sezóny musí byť po jej začiatku.');

  season.name = name.trim();
  season.description = description || null;
  season.image = image || null;
  season.startDate = start;
  season.endDate = end;

  // súkromie/heslo — len pre community
  if (season.type === 'community') {
    if (removePassword === 'on' || removePassword === 'true') {
      season.password = null; season.hasPassword = false; season.hidden = false;
    } else if (isPrivate === 'on' || isPrivate === 'true') {
      if (password && password.trim()) {
        season.password = await bcrypt.hash(password.trim(), 10);
        season.hasPassword = true;
      } else if (!season.hasPassword) {
        return back('Súkromná sezóna musí mať heslo.');
      }
      season.hidden = (hidden === 'on' || hidden === 'true');
    } else {
      // odškrtnuté súkromie = verejná
      season.password = null; season.hasPassword = false; season.hidden = false;
    }
  }

  await season.save();
  res.redirect('/seasons/' + season.id);
});

// POST /seasons/:id/end — ukončenie sezóny (uzamknutie)
const endSeasonSubmit = asyncHandler(async (req, res) => {
  const userId = Number(req.session.userId);
  const season = await Season.findByPk(req.params.id);
  if (!season) return res.redirect('/seasons');

  const u = await User.findByPk(userId);
  const allowed = season.creatorId === userId || (u && u.role === 'admin');
  if (!allowed) return res.status(403).render('error-page', { message: 'Nemáš oprávnenie ukončiť túto sezónu.' });

  season.ended = true;
  season.active = false;
  await season.save();
  res.redirect('/seasons/' + season.id);
});

module.exports = {
  seasonsPage,
  seasonDetailPage,
  createSeasonPage,
  createSeasonSubmit,
  joinSeasonSubmit,
  manageSeasonPage,
  manageSeasonSubmit,
  endSeasonSubmit,
};
