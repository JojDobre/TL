// backend/src/controllers/round.controller.js
//
// Správa kôl (kolo patrí do ligy, obsahuje zápasy). Prepísané na produkčnú kvalitu:
//  - asyncHandler + ApiError (žiadne debug logy, žiadny únik chýb)
//  - getRoundById: cudzie tipy sú SKRYTÉ do uzávierky kola (endDate); po uzávierke
//    alebo pre správcu ligy sú viditeľné. Vlastné tipy vidí hráč vždy.
//  - leaderboard: presnosť z PRESNÝCH výsledkov (exactScore z bodovacieho systému ligy),
//    ošetrené null body (|| 0)
//  - zjednodušená validácia dátumov, validácia povinných polí
//  - oprávnenia cez prehľadnú funkciu

const { Round, League, Match, User, UserSeason, Season, Team, Tip, Sequelize, UserLeague } = require('../models');
const { Op } = Sequelize;
const { ApiError, asyncHandler } = require('../middleware/error.middleware');
const { tipQualityWeight } = require('../utils/accuracy.util');
const notify = require('../utils/notification.service');
// Parsovanie dátumov z formulárov v slovenskej zóne (viď utils/datetime.util.js)
const { parseLocalInput } = require('../utils/datetime.util');

const DEFAULT_EXACT = 10;

// oprávnenie spravovať kolo (tvorca sezóny, admin sezóny, tvorca ligy, globálny admin)
const canManageRound = async (round, userId) => {
  if (!userId) return false;
  const user = await User.findByPk(userId);
  if (user && user.role === 'admin') return true;
  const league = round.League || await League.findByPk(round.leagueId, { include: [{ model: Season, attributes: ['id', 'creatorId'] }] });
  if (!league) return false;
  if (league.creatorId === userId) return true;
  const season = league.Season || await Season.findByPk(league.seasonId);
  if (season && season.creatorId === userId) return true;
  const seasonRole = await UserSeason.findOne({ where: { userId, seasonId: league.seasonId } });
  if (seasonRole && seasonRole.role === 'admin') return true;
  const lRole = await UserLeague.findOne({ where: { userId, leagueId: league.id, role: 'admin' } });
  if (lRole) return true;
  return false;
};

// GET /api/rounds?leagueId=
const getAllRounds = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.leagueId) where.leagueId = req.query.leagueId;

  const rounds = await Round.findAll({
    where,
    include: [{ model: League, attributes: ['id', 'name', 'seasonId'] }],
    order: [['startDate', 'ASC']],
  });

  const data = await Promise.all(rounds.map(async (round) => {
    const matchesCount = await Match.count({ where: { roundId: round.id } });
    return { ...round.toJSON(), matchesCount };
  }));

  res.status(200).json({ success: true, data });
});

// GET /api/rounds/:id  — detail kola; cudzie tipy skryté do uzávierky
const getRoundById = asyncHandler(async (req, res) => {
  const round = await Round.findByPk(req.params.id, {
    include: [
      {
        model: League,
        attributes: ['id', 'name', 'seasonId', 'scoringSystem', 'creatorId'],
        include: [{ model: Season, attributes: ['id', 'name', 'creatorId'] }],
      },
      {
        model: Match,
        include: [
          { model: Team, as: 'homeTeam' },
          { model: Team, as: 'awayTeam' },
          { model: Tip, include: [{ model: User, attributes: ['id', 'username', 'firstName', 'lastName', 'profileImage'] }] },
        ],
      },
    ],
  });

  if (!round) throw new ApiError(404, 'Kolo nebolo nájdené.');

  const meId = Number(req.userId) || null;
  const afterDeadline = new Date(round.endDate) <= new Date();
  const isManager = await canManageRound(round, meId);
  const revealAll = afterDeadline || isManager;

  const result = round.toJSON();

  // skryť cudzie tipy do uzávierky: ponechaj len vlastné, ostatné odstráň
  if (!revealAll && Array.isArray(result.Matches)) {
    result.Matches = result.Matches.map((m) => ({
      ...m,
      Tips: (m.Tips || []).filter((t) => meId && t.userId === meId),
    }));
  }
  result.tipsRevealed = revealAll;

  res.status(200).json({ success: true, data: result });
});

// GET /api/rounds/:id/leaderboard  — verejné
const getRoundLeaderboard = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const round = await Round.findByPk(id, { include: [{ model: League, attributes: ['scoringSystem'] }] });
  if (!round) throw new ApiError(404, 'Kolo nebolo nájdené.');

  const exactScore = (round.League && round.League.scoringSystem && round.League.scoringSystem.exactScore) || DEFAULT_EXACT;

  const tips = await Tip.findAll({
    include: [
      {
        model: Match,
        where: { roundId: id },
        required: true,
        include: [
          { model: Team, as: 'homeTeam', attributes: ['id', 'name'] },
          { model: Team, as: 'awayTeam', attributes: ['id', 'name'] },
        ],
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

// POST /api/rounds
const createRound = asyncHandler(async (req, res) => {
  const { name, description, leagueId, startDate, endDate } = req.body;
  const userId = req.userId;

  if (!name || !name.trim()) throw new ApiError(400, 'Názov kola je povinný.');
  if (!leagueId) throw new ApiError(400, 'Chýba liga, do ktorej kolo patrí.');
  if (!startDate || !endDate) throw new ApiError(400, 'Zadaj začiatok aj koniec tipovania.');

  const league = await League.findByPk(leagueId, { include: [{ model: Season, attributes: ['id', 'creatorId'] }] });
  if (!league) throw new ApiError(404, 'Liga nebola nájdená.');

  const fakeRound = { League: league, leagueId: league.id };
  if (!(await canManageRound(fakeRound, userId))) {
    throw new ApiError(403, 'Nemáš oprávnenie vytvoriť kolo v tejto lige.');
  }

  // Dátumy z <input type="datetime-local"> prichádzajú bez zóny — parseLocalInput
  // ich vyhodnotí ako slovenský čas (inak by server v UTC posunul uzávierku).
  const startObj = parseLocalInput(startDate);
  const endObj = parseLocalInput(endDate);
  if (!startObj || !endObj) throw new ApiError(400, 'Neplatný formát dátumu.');
  if (endObj <= startObj) throw new ApiError(400, 'Koniec tipovania musí byť po začiatku.');

  const newRound = await Round.create({
    name: name.trim(), description, leagueId,
    startDate: startObj, endDate: endObj, active: true,
  });

  // POZN.: notifikáciu o kole tu ZÁMERNE neposielame. Kolo v tejto chvíli ešte
  // nemusí byť otvorené na tipovanie — upozornenie by hráča informovalo o niečom,
  // s čím nemôže nič robiť. Notifikáciu pošle plánovač (utils/scheduler.js)
  // v okamihu, keď kolo naozaj začne (notify.roundStarted).

  res.status(201).json({ success: true, message: 'Kolo bolo úspešne vytvorené.', data: newRound });
});

// PUT /api/rounds/:id
const updateRound = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, startDate, endDate, active } = req.body;
  const userId = req.userId;

  const round = await Round.findByPk(id, {
    include: [{ model: League, include: [{ model: Season, attributes: ['id', 'creatorId'] }] }],
  });
  if (!round) throw new ApiError(404, 'Kolo nebolo nájdené.');

  if (!(await canManageRound(round, userId))) {
    throw new ApiError(403, 'Nemáš oprávnenie upraviť toto kolo.');
  }

  // výsledné dátumy (nové alebo pôvodné) a validácia, že koniec je po začiatku
  const newStart = startDate ? parseLocalInput(startDate) : new Date(round.startDate);
  const newEnd = endDate ? parseLocalInput(endDate) : new Date(round.endDate);
  if (!newStart || !newEnd || isNaN(newStart) || isNaN(newEnd)) throw new ApiError(400, 'Neplatný formát dátumu.');
  if (newEnd <= newStart) throw new ApiError(400, 'Koniec tipovania musí byť po začiatku.');
  round.startDate = newStart;
  round.endDate = newEnd;

  if (name) round.name = name.trim();
  if (description !== undefined) round.description = description;
  if (active !== undefined) round.active = active;

  await round.save();
  res.status(200).json({ success: true, message: 'Kolo bolo úspešne aktualizované.', data: round });
});

// DELETE /api/rounds/:id
const deleteRound = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  const round = await Round.findByPk(id, {
    include: [{ model: League, include: [{ model: Season, attributes: ['id', 'creatorId'] }] }],
  });
  if (!round) throw new ApiError(404, 'Kolo nebolo nájdené.');

  if (!(await canManageRound(round, userId))) {
    throw new ApiError(403, 'Nemáš oprávnenie vymazať toto kolo.');
  }

  // kolo s tipmi sa nedá zmazať (ochrana dát)
  const hasTips = await Tip.findOne({ include: [{ model: Match, where: { roundId: id }, required: true }] });
  if (hasTips) {
    throw new ApiError(400, 'Kolo nemožno vymazať, pretože už obsahuje tipy.');
  }

  // zmaž zápasy kola a potom kolo
  await Match.destroy({ where: { roundId: id } });
  await round.destroy();

  res.status(200).json({ success: true, message: 'Kolo bolo úspešne vymazané.' });
});

module.exports = {
  getAllRounds,
  getRoundById,
  createRound,
  updateRound,
  deleteRound,
  getRoundLeaderboard,
};