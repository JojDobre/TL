// backend/src/controllers/teamAdmin.controller.js
//
// Správa GLOBÁLNYCH tímov pre admina: zoznam s filtrom, pridanie jedného,
// hromadné pridanie (textarea: jeden tím na riadok), mazanie.
// Custom tímy používateľov sa tu neriešia (tie vznikajú pri tvorbe ligy).

const { Team, Match, Sequelize } = require('../models');
const { Op } = Sequelize;
const { SPORT_CODES, COUNTRY_CODES } = require('../utils/team.constants');
const { ApiError, asyncHandler } = require('../middleware/error.middleware');

// GET /api/admin/teams?scope=&teamType=&sport=&country=&search=&page=&limit=
const listTeams = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
  const offset = (page - 1) * limit;

  const where = {};
  // admin vidí primárne globálne; ak chce, môže filtrovať aj custom
  if (req.query.scope === 'global' || req.query.scope === 'custom') where.scope = req.query.scope;
  if (req.query.teamType === 'national' || req.query.teamType === 'club') where.teamType = req.query.teamType;
  if (req.query.sport && SPORT_CODES.includes(req.query.sport)) where.sport = req.query.sport;
  if (req.query.country && COUNTRY_CODES.includes(req.query.country)) where.country = req.query.country;
  if (req.query.search) where.name = { [Op.like]: `%${req.query.search}%` };

  const { count, rows } = await Team.findAndCountAll({
    where, order: [['name', 'ASC']], limit, offset,
  });

  res.status(200).json({
    success: true,
    data: rows,
    pagination: { total: count, page, limit, pages: Math.ceil(count / limit) || 1 },
  });
});

// validuje a normalizuje vstup tímu
function normalizeTeam(body) {
  const name = (body.name || '').trim();
  if (!name) throw new ApiError(400, 'Názov tímu je povinný.');
  const teamType = body.teamType === 'national' ? 'national' : 'club';
  let sport = null;
  let country = body.country && COUNTRY_CODES.includes(body.country) ? body.country : null;
  if (teamType === 'club') {
    sport = body.sport && SPORT_CODES.includes(body.sport) ? body.sport : null;
    if (!sport) throw new ApiError(400, 'Klub musí mať platný šport.');
    if (!country) throw new ApiError(400, 'Klub musí mať platnú krajinu.');
  }
  const logo = (body.logo || '').trim() || null;
  return { name, teamType, sport, country, logo };
}

// POST /api/admin/teams  (jeden globálny tím)
const createTeam = asyncHandler(async (req, res) => {
  const t = normalizeTeam(req.body);
  const exists = await Team.findOne({ where: { name: t.name, scope: 'global', teamType: t.teamType, sport: t.sport } });
  if (exists) throw new ApiError(409, 'Takýto globálny tím už existuje.');
  const team = await Team.create({ ...t, scope: 'global', creatorId: null });
  res.status(201).json({ success: true, message: 'Tím pridaný.', data: team });
});

// POST /api/admin/teams/bulk  (hromadne; body { teamType, sport, country, names })
// names = text, jeden tím na riadok. sport/country sa použijú pre všetky.
const bulkCreateTeams = asyncHandler(async (req, res) => {
  const { teamType, sport, country, names } = req.body;
  if (!names || !names.trim()) throw new ApiError(400, 'Zadaj aspoň jeden tím.');

  const type = teamType === 'national' ? 'national' : 'club';
  const sp = type === 'club' ? (SPORT_CODES.includes(sport) ? sport : null) : null;
  const co = COUNTRY_CODES.includes(country) ? country : null;
  if (type === 'club' && (!sp || !co)) throw new ApiError(400, 'Pri kluboch zvoľ platný šport aj krajinu.');

  const lines = names.split('\n').map((l) => l.trim()).filter(Boolean);
  let added = 0; const skipped = [];
  for (const name of lines) {
    const exists = await Team.findOne({ where: { name, scope: 'global', teamType: type, sport: sp } });
    if (exists) { skipped.push(name); continue; }
    await Team.create({ name, scope: 'global', teamType: type, sport: sp, country: co, creatorId: null });
    added += 1;
  }
  res.status(201).json({ success: true, message: `Pridaných ${added} tímov.`, added, skipped });
});

// DELETE /api/admin/teams/:id  (len ak tím nie je v žiadnom zápase)
const deleteTeam = asyncHandler(async (req, res) => {
  const team = await Team.findByPk(req.params.id);
  if (!team) throw new ApiError(404, 'Tím nenájdený.');
  const used = await Match.count({ where: { [Op.or]: [{ homeTeamId: team.id }, { awayTeamId: team.id }] } });
  if (used > 0) throw new ApiError(400, 'Tím nemožno zmazať — je použitý v zápasoch.');
  await team.destroy();
  res.status(200).json({ success: true, message: 'Tím zmazaný.' });
});

// PUT /api/admin/teams/:id  (úprava globálneho tímu)
const updateTeam = asyncHandler(async (req, res) => {
  const team = await Team.findByPk(req.params.id);
  if (!team) throw new ApiError(404, 'Tím nenájdený.');
  if (team.scope !== 'global') throw new ApiError(400, 'Cez admin správu sa upravujú len globálne tímy.');
  const t = normalizeTeam(req.body);
  // duplikát (iný tím s rovnakým menom/typom/športom)
  const dup = await Team.findOne({ where: { name: t.name, scope: 'global', teamType: t.teamType, sport: t.sport, id: { [Op.ne]: team.id } } });
  if (dup) throw new ApiError(409, 'Iný globálny tím s rovnakým názvom už existuje.');
  team.name = t.name;
  team.teamType = t.teamType;
  team.sport = t.sport;
  team.country = t.country;
  team.logo = t.logo;
  await team.save();
  res.status(200).json({ success: true, message: 'Tím upravený.', data: team });
});

module.exports = { listTeams, createTeam, bulkCreateTeams, deleteTeam, updateTeam };
