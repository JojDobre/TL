// backend/src/controllers/season.controller.js
//
// Správa sezón. Prepísané na produkčnú kvalitu:
//  - asyncHandler + ApiError (žiadny únik chýb, centrálne spracovanie)
//  - odstránené debug console.log a mŕtvy/duplicitný kód
//  - vyčistený getSeasonById (žiadne zmätočné ručné skladanie objektu)
//  - zjednodušené limity sezón podľa roly
//  - leaderboard: presnosť počítaná z presných výsledkov (10 b), nie z akýchkoľvek bodov

const { Season, User, League, Match, Round, Tip, UserSeason } = require('../models');
const { v4: uuidv4 } = require('uuid');
const { ApiError, asyncHandler } = require('../middleware/error.middleware');
const { tipQualityWeight } = require('../utils/accuracy.util');
const { seasonCounts, leaderboardWithUsers } = require('../utils/standings.util');

// 6-znakový alfanumerický kód pozvánky
const generateInviteCode = () => uuidv4().substring(0, 6).toUpperCase();

// Limit počtu vytvorených sezón podľa roly (admin = bez limitu)
const SEASON_LIMITS = { player: 1, vip: 2 };

const creatorSummary = (creator) => creator ? {
  id: creator.id, username: creator.username,
  firstName: creator.firstName, lastName: creator.lastName,
} : null;

// GET /api/seasons?type=official|community
const getAllSeasons = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.type) where.type = req.query.type;

  const seasons = await Season.findAll({
    where,
    include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] }],
    order: [['createdAt', 'DESC']],
  });

  // doplníme počty líg a účastníkov
  const counts = await seasonCounts(seasons.map((s) => s.id));
  const data = seasons.map((season) => {
    const c = counts.get(season.id) || {};
    return { ...season.toJSON(), leaguesCount: c.leaguesCount || 0, participantsCount: c.participantsCount || 0 };
  });

  res.status(200).json({ success: true, data });
});

// GET /api/seasons/:id
const getSeasonById = asyncHandler(async (req, res) => {
  const season = await Season.findByPk(req.params.id, {
    include: [
      { model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] },
      {
        model: User, as: 'participants',
        attributes: ['id', 'username', 'firstName', 'lastName', 'profileImage'],
        through: { attributes: ['role', 'joinedAt'] },
      },
    ],
  });

  if (!season) throw new ApiError(404, 'Sezóna nebola nájdená.');

  const participantsCount = await season.countParticipants();

  res.status(200).json({
    success: true,
    data: { ...season.toJSON(), participantsCount },
  });
});

// POST /api/seasons
const createSeason = asyncHandler(async (req, res) => {
  const { name, description, image, type, rules, participantLimit } = req.body;
  const userId = req.userId;

  const user = await User.findByPk(userId);
  if (!user) throw new ApiError(404, 'Používateľ nebol nájdený.');

  // Limit počtu sezón podľa roly (admin bez limitu)
  const limit = SEASON_LIMITS[user.role];
  if (limit !== undefined) {
    const count = await Season.count({ where: { creatorId: userId } });
    if (count >= limit) {
      throw new ApiError(403, user.role === 'player'
        ? 'Ako bežný užívateľ môžeš vytvoriť maximálne 1 sezónu. Prejdi na VIP pre viac.'
        : `Ako VIP môžeš vytvoriť maximálne ${limit} sezóny.`);
    }
  }

  // Typ sezóny: oficiálnu môže vytvoriť IBA admin. Player a VIP vždy community.
  const seasonType = (type === 'official' && user.role === 'admin') ? 'official' : 'community';

  // Limit účastníkov: oficiálne = neobmedzené (null), komunitné = 100 (VIP/admin si môžu nastaviť)
  let finalParticipantLimit = null;
  if (seasonType === 'community') {
    finalParticipantLimit = (user.role === 'vip' || user.role === 'admin') && participantLimit !== undefined
      ? participantLimit : 100;
  }

  const season = await Season.create({
    name,
    description,
    image,
    type: seasonType,
    rules,
    inviteCode: generateInviteCode(),
    creatorId: userId,
    active: true,
    participantLimit: finalParticipantLimit,
  });

  // tvorca sa stáva účastníkom s admin rolou v sezóne
  try {
    await season.addParticipant(userId, { through: { role: 'admin' } });
  } catch (e) {
    // asociácia nie je kritická pre vytvorenie sezóny
  }

  res.status(201).json({ success: true, message: 'Sezóna bola úspešne vytvorená.', data: season });
});

// PUT /api/seasons/:id
const updateSeason = asyncHandler(async (req, res) => {
  const { name, description, image, active, rules, participantLimit } = req.body;
  const userId = req.userId;

  const season = await Season.findByPk(req.params.id);
  if (!season) throw new ApiError(404, 'Sezóna nebola nájdená.');

  const user = await User.findByPk(userId);
  const isOwner = season.creatorId === userId;
  const isAdmin = user && user.role === 'admin';
  if (!isOwner && !isAdmin) {
    throw new ApiError(403, 'Nemáš oprávnenie upraviť túto sezónu.');
  }

  if (name) season.name = name;
  if (description !== undefined) season.description = description;
  if (image !== undefined) season.image = image;
  if (active !== undefined) season.active = active;
  if (rules !== undefined) season.rules = rules;

  // limit účastníkov môže meniť len VIP/admin a len pre komunitné sezóny
  if (participantLimit !== undefined && season.type === 'community' && (user.role === 'vip' || user.role === 'admin')) {
    season.participantLimit = participantLimit;
  }

  await season.save();
  res.status(200).json({ success: true, message: 'Sezóna bola úspešne aktualizovaná.', data: season });
});

// DELETE /api/seasons/:id
const deleteSeason = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const season = await Season.findByPk(req.params.id);
  if (!season) throw new ApiError(404, 'Sezóna nebola nájdená.');

  const user = await User.findByPk(userId);
  const isOwner = season.creatorId === userId;
  const isAdmin = user && user.role === 'admin';
  if (!isOwner && !isAdmin) {
    throw new ApiError(403, 'Nemáš oprávnenie vymazať túto sezónu.');
  }

  await season.destroy();
  res.status(200).json({ success: true, message: 'Sezóna bola úspešne vymazaná.' });
});

// POST /api/seasons/join
const joinSeason = asyncHandler(async (req, res) => {
  const { inviteCode } = req.body;
  const userId = req.userId;

  if (!inviteCode) throw new ApiError(400, 'Zadaj kód pozvánky.');

  const season = await Season.findOne({ where: { inviteCode } });
  if (!season) throw new ApiError(404, 'Sezóna s týmto kódom nebola nájdená.');
  if (!season.active) throw new ApiError(400, 'Táto sezóna nie je aktívna.');

  const existing = await UserSeason.findOne({ where: { userId, seasonId: season.id } });
  if (existing) throw new ApiError(400, 'Už si členom tejto sezóny.');

  // limit účastníkov pre komunitné sezóny
  if (season.type === 'community' && season.participantLimit !== null) {
    const count = await UserSeason.count({ where: { seasonId: season.id } });
    if (count >= season.participantLimit) {
      throw new ApiError(400, `Táto sezóna už dosiahla maximálny počet účastníkov (${season.participantLimit}).`);
    }
  }

  await UserSeason.create({ userId, seasonId: season.id, role: 'player', joinedAt: new Date() });

  res.status(200).json({
    success: true,
    message: 'Úspešne si sa pripojil k sezóne.',
    data: { seasonId: season.id, seasonName: season.name },
  });
});

// GET /api/seasons/:id/leaderboard
const getSeasonLeaderboard = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const season = await Season.findByPk(id);
  if (!season) throw new ApiError(404, 'Sezóna nebola nájdená.');

  // body a presnosť agregované v SQL (len tipy z líg tejto sezóny)
  const leaderboard = (await leaderboardWithUsers({ seasonId: id }, ['id', 'username', 'firstName', 'lastName', 'profileImage']))
    .map((entry, index) => ({
      user: entry.user,
      totalPoints: entry.totalPoints,
      tipsCount: entry.tipsCount,
      evaluated: entry.evaluated,
      weightSum: entry.weightSum,
      rank: index + 1,
      accuracy: entry.accuracy || 0,
    }));

  res.status(200).json({ success: true, data: leaderboard });
});

module.exports = {
  getAllSeasons,
  getSeasonById,
  createSeason,
  updateSeason,
  deleteSeason,
  joinSeason,
  getSeasonLeaderboard,
};