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
  if (['national', 'club', 'individual'].includes(req.query.teamType)) where.teamType = req.query.teamType;
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
  const teamType = ['national', 'club', 'individual'].includes(body.teamType) ? body.teamType : 'club';
  let sport = null;
  let country = body.country && COUNTRY_CODES.includes(body.country) ? body.country : null;
  if (teamType === 'club') {
    sport = body.sport && SPORT_CODES.includes(body.sport) ? body.sport : null;
    if (!sport) throw new ApiError(400, 'Klub musí mať platný šport.');
    if (!country) throw new ApiError(400, 'Klub musí mať platnú krajinu.');
  } else if (teamType === 'individual') {
    // jednotlivec (tenista, šípkar…): šport aj krajina sú voliteľné
    sport = body.sport && SPORT_CODES.includes(body.sport) ? body.sport : null;
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
// Hromadný import. Každý riadok: Názov[;typ][;šport][;krajina][;logo]
// — polia sú voliteľné, prázdne pole (;;) = použije sa predvolená hodnota
//   z formulára (teamType/sport/country v tele requestu).
// — typ: club|national|individual, akceptujú sa aj slovenské aliasy.
// — šport/krajina: kód (football, SK) alebo label (Futbal, Slovensko),
//   bez ohľadu na veľkosť písmen.
const TYPE_ALIASES = {
  club: 'club', klub: 'club', k: 'club',
  national: 'national', narodny: 'national', 'národný': 'national', n: 'national',
  individual: 'individual', jednotlivec: 'individual', hrac: 'individual', 'hráč': 'individual', j: 'individual', i: 'individual',
};
const { SPORTS, COUNTRIES } = require('../utils/team.constants');
const norm = (v) => String(v || '').trim().toLowerCase();
const resolveSport = (v) => {
  if (!v) return null;
  const n = norm(v);
  const hit = SPORTS.find((s) => s.code.toLowerCase() === n || s.label.toLowerCase() === n);
  return hit ? hit.code : undefined; // undefined = neplatná hodnota (rozlíš od "nezadané")
};
const resolveCountry = (v) => {
  if (!v) return null;
  const n = norm(v);
  const hit = COUNTRIES.find((c) => c.code.toLowerCase() === n || c.label.toLowerCase() === n);
  return hit ? hit.code : undefined;
};

const bulkCreateTeams = asyncHandler(async (req, res) => {
  const { teamType, sport, country, names } = req.body;
  if (!names || !names.trim()) throw new ApiError(400, 'Zadaj aspoň jeden tím.');

  // predvolené hodnoty z formulára
  const defType = ['national', 'club', 'individual'].includes(teamType) ? teamType : 'club';
  const defSport = SPORT_CODES.includes(sport) ? sport : null;
  const defCountry = COUNTRY_CODES.includes(country) ? country : null;

  const lines = names.split('\n').map((l) => l.trim()).filter(Boolean);
  let added = 0; const skipped = [];
  for (const line of lines) {
    const parts = line.split(';').map((p) => p.trim());
    const name = parts[0];
    if (!name) { skipped.push({ line, reason: 'chýba názov' }); continue; }

    // typ
    let type = defType;
    if (parts[1]) {
      const t = TYPE_ALIASES[norm(parts[1])];
      if (!t) { skipped.push({ line, reason: `neznámy typ „${parts[1]}"` }); continue; }
      type = t;
    }

    // šport (national nemá šport)
    let sp = null;
    if (type !== 'national') {
      if (parts[2]) {
        sp = resolveSport(parts[2]);
        if (sp === undefined) { skipped.push({ line, reason: `neznámy šport „${parts[2]}"` }); continue; }
      } else sp = defSport;
    }

    // krajina
    let co = null;
    if (parts[3]) {
      co = resolveCountry(parts[3]);
      if (co === undefined) { skipped.push({ line, reason: `neznáma krajina „${parts[3]}"` }); continue; }
    } else co = defCountry;

    // logo (URL)
    const logo = parts[4] && /^https?:\/\//i.test(parts[4]) ? parts[4] : null;
    if (parts[4] && !logo) { skipped.push({ line, reason: 'logo musí byť http(s) URL' }); continue; }

    // klub vyžaduje šport aj krajinu (po dosadení predvolieb)
    if (type === 'club' && (!sp || !co)) { skipped.push({ line, reason: 'klub potrebuje šport a krajinu' }); continue; }

    const exists = await Team.findOne({ where: { name, scope: 'global', teamType: type, sport: sp } });
    if (exists) { skipped.push({ line, reason: 'už existuje' }); continue; }
    await Team.create({ name, scope: 'global', teamType: type, sport: sp, country: co, logo, creatorId: null });
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