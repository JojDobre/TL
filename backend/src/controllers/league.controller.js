// backend/src/controllers/league.controller.js
//
// Správa líg (Model A: liga je hlavná jednotka, do ktorej sa hráč pripája cez
// join kód). Prepísané na produkčnú kvalitu:
//  - asyncHandler + ApiError (žiadny únik chýb, žiadne debug logy)
//  - heslo ligy HASHOVANÉ (bcrypt), klientovi sa NIKDY neposiela (len hasPassword)
//  - joinCode (6-miestny) na pripojenie, creatorId (kto vytvoril)
//  - členstvo cez UserLeague; pri pripojení sa pridá aj členstvo v sezóne
//  - leaderboard: presnosť z PRESNÝCH výsledkov (exactScore), nie z hocijakých bodov
//  - limit líg počítaný správne cez creatorId

const { League, Season, Round, Match, User, UserSeason, UserLeague, Tip, Sequelize } = require('../models');
const { Op } = Sequelize;
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { ApiError, asyncHandler } = require('../middleware/error.middleware');
const { tipQualityWeight } = require('../utils/accuracy.util');
const notify = require('../utils/notification.service');
const achievements = require('../utils/achievement.engine');

const LEAGUE_LIMITS = { player: 5, vip: 10 }; // admin = bez limitu
const DEFAULT_SCORING = { exactScore: 10, correctGoals: 1, correctWinner: 3, goalDifference: 2 };

// vygeneruje unikátny 6-miestny join kód
const generateJoinCode = async () => {
  for (let i = 0; i < 10; i++) {
    const code = uuidv4().substring(0, 6).toUpperCase();
    const exists = await League.findOne({ where: { joinCode: code } });
    if (!exists) return code;
  }
  throw new ApiError(500, 'Nepodarilo sa vygenerovať kód ligy. Skús znova.');
};

// odstráni citlivé polia (heslo) z ligy pred odoslaním klientovi
const sanitizeLeague = (league) => {
  const json = league.toJSON ? league.toJSON() : league;
  delete json.password;
  return json;
};

// kontrola oprávnenia spravovať ligu (tvorca ligy, tvorca sezóny, admin sezóny, alebo globálny admin)
const canManageLeague = async (league, userId) => {
  const user = await User.findByPk(userId);
  if (user && user.role === 'admin') return true;
  if (league.creatorId === userId) return true;
  const season = league.Season || await Season.findByPk(league.seasonId);
  if (season && season.creatorId === userId) return true;
  const seasonRole = await UserSeason.findOne({ where: { userId, seasonId: league.seasonId } });
  if (seasonRole && seasonRole.role === 'admin') return true;
  return false;
};

// GET /api/leagues?seasonId=&type=
const getAllLeagues = asyncHandler(async (req, res) => {
  const { seasonId, type } = req.query;
  const where = {};
  if (seasonId) where.seasonId = seasonId;
  if (type) where.type = type;

  const leagues = await League.findAll({
    where,
    include: [{ model: Season, attributes: ['id', 'name', 'type', 'image'] }],
    order: [['createdAt', 'DESC']],
  });

  const data = await Promise.all(leagues.map(async (league) => {
    const roundsCount = await Round.count({ where: { leagueId: league.id } });
    let membersCount = 0;
    try { membersCount = await league.countMembers(); } catch { /* nič */ }
    return { ...sanitizeLeague(league), roundsCount, membersCount };
  }));

  res.status(200).json({ success: true, data });
});

// GET /api/leagues/:id
const getLeagueById = asyncHandler(async (req, res) => {
  const league = await League.findByPk(req.params.id, {
    include: [
      {
        model: Season,
        attributes: ['id', 'name', 'type', 'creatorId'],
        include: [{ model: User, as: 'creator', attributes: ['id', 'username'] }],
      },
      { model: Round, attributes: ['id', 'name', 'description', 'startDate', 'endDate', 'active'] },
    ],
  });

  if (!league) throw new ApiError(404, 'Liga nebola nájdená.');

  const rounds = await Promise.all((league.Rounds || []).map(async (round) => {
    const matchesCount = await Match.count({ where: { roundId: round.id } });
    return { ...round.toJSON(), matchesCount };
  }));

  let membersCount = 0;
  try { membersCount = await league.countMembers(); } catch { /* nič */ }

  const result = sanitizeLeague(league);
  result.Rounds = rounds;
  result.membersCount = membersCount;

  res.status(200).json({ success: true, data: result });
});

// POST /api/leagues
const createLeague = asyncHandler(async (req, res) => {
  const { name, description, image, type, password, seasonId, scoringSystem } = req.body;
  const userId = req.userId;

  if (!name || !name.trim()) throw new ApiError(400, 'Názov ligy je povinný.');
  if (!seasonId) throw new ApiError(400, 'Chýba sezóna, do ktorej liga patrí.');

  const season = await Season.findByPk(seasonId);
  if (!season) throw new ApiError(404, 'Sezóna nebola nájdená.');

  const user = await User.findByPk(userId);
  if (!user) throw new ApiError(404, 'Používateľ nebol nájdený.');

  // oprávnenie vytvoriť ligu v sezóne: tvorca sezóny, admin sezóny, alebo globálny admin
  const seasonRole = await UserSeason.findOne({ where: { userId, seasonId } });
  const isSeasonAdmin = seasonRole && seasonRole.role === 'admin';
  if (season.creatorId !== userId && !isSeasonAdmin && user.role !== 'admin') {
    throw new ApiError(403, 'Nemáš oprávnenie vytvoriť ligu v tejto sezóne.');
  }

  // oficiálnu ligu môže vytvoriť len admin
  const leagueType = (type === 'official' && user.role === 'admin') ? 'official' : 'custom';

  // limit počtu líg podľa roly (počítaný správne cez creatorId)
  const limit = LEAGUE_LIMITS[user.role];
  if (limit !== undefined) {
    const count = await League.count({ where: { creatorId: userId } });
    if (count >= limit) {
      throw new ApiError(403, user.role === 'player'
        ? `Ako bežný užívateľ môžeš vytvoriť maximálne ${limit} líg. Prejdi na VIP pre viac.`
        : `Ako VIP môžeš vytvoriť maximálne ${limit} líg.`);
    }
  }

  // heslo (ak je) sa hashuje
  let passwordHash = null;
  if (password && password.trim()) {
    passwordHash = await bcrypt.hash(password.trim(), 10);
  }

  const joinCode = await generateJoinCode();

  const newLeague = await League.create({
    name: name.trim(),
    description,
    image,
    type: leagueType,
    joinCode,
    password: passwordHash,
    hasPassword: !!passwordHash,
    seasonId,
    creatorId: userId,
    scoringSystem: scoringSystem || DEFAULT_SCORING,
    scoringLocked: false,
    active: true,
  });

  // tvorca sa stáva členom ligy s admin rolou + členom sezóny
  await UserLeague.create({ userId, leagueId: newLeague.id, role: 'admin', joinedAt: new Date() });
  const inSeason = await UserSeason.findOne({ where: { userId, seasonId } });
  if (!inSeason) {
    await UserSeason.create({ userId, seasonId, role: 'player', joinedAt: new Date() });
  }

  // achievement: vytvorenie ligy
  achievements.evaluateInBackground([userId]);

  res.status(201).json({ success: true, message: 'Liga bola úspešne vytvorená.', data: sanitizeLeague(newLeague) });
});

// POST /api/leagues/join   body: { joinCode, password? }
const joinLeague = asyncHandler(async (req, res) => {
  const { joinCode, password } = req.body;
  const userId = req.userId;

  if (!joinCode || !joinCode.trim()) throw new ApiError(400, 'Zadaj ID ligy.');

  const league = await League.findOne({ where: { joinCode: joinCode.trim().toUpperCase() } });
  if (!league) throw new ApiError(404, 'Liga s týmto ID nebola nájdená.');
  if (!league.active) throw new ApiError(400, 'Táto liga nie je aktívna.');

  // ak je liga chránená heslom, over ho
  if (league.hasPassword) {
    if (!password) throw new ApiError(401, 'Táto liga je chránená heslom.');
    const ok = await bcrypt.compare(password, league.password || '');
    if (!ok) throw new ApiError(401, 'Nesprávne heslo ligy.');
  }

  // už člen?
  const uid = Number(userId);
  const existing = await UserLeague.findOne({ where: { userId: uid, leagueId: league.id } });
  if (existing) throw new ApiError(400, 'Už si členom tejto ligy.');

  // pripoj do ligy + do sezóny (ak ešte nie je)
  await UserLeague.create({ userId: uid, leagueId: league.id, role: 'player', joinedAt: new Date() });
  await UserSeason.findOrCreate({
    where: { userId: uid, seasonId: league.seasonId },
    defaults: { userId: uid, seasonId: league.seasonId, role: 'player', joinedAt: new Date() },
  });

  // notifikácia ostatným členom ligy o novom hráčovi
  const joiner = await User.findByPk(uid, { attributes: ['username'] });
  await notify.memberJoined(league, uid, joiner ? joiner.username : null);

  res.status(200).json({
    success: true,
    message: 'Úspešne si sa pripojil do ligy.',
    data: { leagueId: league.id, leagueName: league.name, seasonId: league.seasonId },
  });
});

// PUT /api/leagues/:id
const updateLeague = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, image, password, active, scoringSystem } = req.body;
  const userId = req.userId;

  const league = await League.findByPk(id, { include: [{ model: Season, attributes: ['id', 'creatorId'] }] });
  if (!league) throw new ApiError(404, 'Liga nebola nájdená.');

  if (!(await canManageLeague(league, userId))) {
    throw new ApiError(403, 'Nemáš oprávnenie upraviť túto ligu.');
  }

  // bodovací systém sa nesmie meniť po začiatku prvého kola
  const hasStartedRounds = await Round.findOne({
    where: { leagueId: id, startDate: { [Op.lt]: new Date() } },
  });
  if (scoringSystem && (league.scoringLocked || hasStartedRounds)) {
    throw new ApiError(400, 'Bodovací systém nemožno zmeniť po začiatku prvého kola.');
  }

  if (name) league.name = name.trim();
  if (description !== undefined) league.description = description;
  if (image !== undefined) league.image = image;
  if (active !== undefined) league.active = active;
  if (scoringSystem && !league.scoringLocked) league.scoringSystem = scoringSystem;

  // zmena/zrušenie hesla
  if (password !== undefined) {
    if (password === null || password === '') {
      league.password = null;
      league.hasPassword = false;
    } else {
      league.password = await bcrypt.hash(password.trim(), 10);
      league.hasPassword = true;
    }
  }

  // ak začalo prvé kolo, uzamkni bodovací systém
  if (hasStartedRounds && !league.scoringLocked) league.scoringLocked = true;

  await league.save();
  res.status(200).json({ success: true, message: 'Liga bola úspešne aktualizovaná.', data: sanitizeLeague(league) });
});

// DELETE /api/leagues/:id
const deleteLeague = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  const league = await League.findByPk(id, { include: [{ model: Season, attributes: ['id', 'creatorId'] }] });
  if (!league) throw new ApiError(404, 'Liga nebola nájdená.');

  if (!(await canManageLeague(league, userId))) {
    throw new ApiError(403, 'Nemáš oprávnenie vymazať túto ligu.');
  }

  await league.destroy();
  res.status(200).json({ success: true, message: 'Liga bola úspešne vymazaná.' });
});

// GET /api/leagues/:id/leaderboard
const getLeagueLeaderboard = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const league = await League.findByPk(id);
  if (!league) throw new ApiError(404, 'Liga nebola nájdená.');

  const exactScore = (league.scoringSystem && league.scoringSystem.exactScore) || DEFAULT_SCORING.exactScore;

  const tips = await Tip.findAll({
    include: [
      {
        model: Match,
        required: true,
        include: [{
          model: Round,
          where: { leagueId: id },
          required: true,
          include: [{ model: League, attributes: ['id', 'name'] }],
        }],
      },
      { model: User, attributes: ['id', 'username', 'firstName', 'lastName', 'profileImage'] },
    ],
  });

  const byUser = {};
  tips.forEach((tip) => {
    if (!tip.User) return;
    const uid = tip.User.id;
    if (!byUser[uid]) {
      byUser[uid] = {
        user: {
          id: tip.User.id, username: tip.User.username,
          firstName: tip.User.firstName, lastName: tip.User.lastName,
          profileImage: tip.User.profileImage,
        },
        totalPoints: 0, tipsCount: 0, evaluated: 0, weightSum: 0,
      };
    }
    byUser[uid].totalPoints += tip.points || 0;
    byUser[uid].tipsCount += 1;
    // vážená presnosť — len z vyhodnotených zápasov (kvalita tipu)
    if (tip.Match && tip.Match.status === 'finished') {
      byUser[uid].evaluated += 1;
      byUser[uid].weightSum += tipQualityWeight(tip, tip.Match);
    }
  });

  const leaderboard = Object.values(byUser)
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
      accuracy: entry.evaluated ? Math.round((entry.weightSum / entry.evaluated) * 100) : 0,
    }));

  res.status(200).json({ success: true, data: leaderboard });
});

module.exports = {
  getAllLeagues,
  getLeagueById,
  createLeague,
  joinLeague,
  updateLeague,
  deleteLeague,
  getLeagueLeaderboard,
};