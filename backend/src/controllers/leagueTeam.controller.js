// backend/src/controllers/leagueTeam.controller.js
//
// Správa súpisky tímov ligy: dostupné tímy (filter), pridať/odobrať tím zo
// súpisky, vytvoriť custom tím (rovno do súpisky ligy). Custom tím patrí lige
// (scope=custom, creatorId = používateľ). Z tímov v súpiske sa tvoria zápasy.

const { League, Team, LeagueTeam, Match, Round, User, UserSeason, Sequelize } = require('../models');
const { Op } = Sequelize;
const { SPORT_CODES, COUNTRY_CODES } = require('../utils/team.constants');
const { ApiError, asyncHandler } = require('../middleware/error.middleware');

// správca ligy?
async function canManageLeague(league, userId) {
  if (!userId) return false;
  const user = await User.findByPk(userId);
  if (user && user.role === 'admin') return true;
  if (league.creatorId === userId) return true;
  // tvorca sezóny / admin sezóny
  const sRole = await UserSeason.findOne({ where: { userId, seasonId: league.seasonId } });
  if (sRole && sRole.role === 'admin') return true;
  return false;
}

async function loadManageableLeague(leagueId, userId) {
  const league = await League.findByPk(leagueId);
  if (!league) throw new ApiError(404, 'Liga nebola nájdená.');
  if (!(await canManageLeague(league, userId))) throw new ApiError(403, 'Nemáš oprávnenie spravovať túto ligu.');
  if (league.templateId) throw new ApiError(400, 'Liga zo šablóny — tímy sú prevzaté zo šablóny a nedajú sa meniť.');
  return league;
}

// GET /api/leagues/:id/teams/available?teamType=&sport=&country=&search=
// dostupné tímy na pridanie: globálne + vlastné custom (vytvorené v tejto lige)
const availableTeams = asyncHandler(async (req, res) => {
  const userId = Number(req.session.userId);
  const league = await loadManageableLeague(req.params.id, userId);

  const where = {
    [Op.or]: [
      { scope: 'global' },
      { scope: 'custom', creatorId: userId },
    ],
  };
  if (req.query.teamType === 'national' || req.query.teamType === 'club') where.teamType = req.query.teamType;
  if (req.query.sport && SPORT_CODES.includes(req.query.sport)) where.sport = req.query.sport;
  if (req.query.country && COUNTRY_CODES.includes(req.query.country)) where.country = req.query.country;
  if (req.query.search) where.name = { [Op.like]: `%${req.query.search}%` };

  const teams = await Team.findAll({ where, order: [['name', 'ASC']], limit: 100 });

  // ktoré sú už v súpiske
  const inLeague = await LeagueTeam.findAll({ where: { leagueId: league.id }, attributes: ['teamId'] });
  const selectedIds = inLeague.map((lt) => lt.teamId);

  res.status(200).json({ success: true, data: teams, selectedIds });
});

// GET /api/leagues/:id/teams — tímy v súpiske ligy
const leagueTeams = asyncHandler(async (req, res) => {
  const userId = Number(req.session.userId);
  const league = await League.findByPk(req.params.id);
  if (!league) throw new ApiError(404, 'Liga nebola nájdená.');
  const teams = await league.getTeams({ order: [['name', 'ASC']] });
  res.status(200).json({ success: true, data: teams });
});

// POST /api/leagues/:id/teams  { teamId }  — pridať tím do súpisky
const addTeam = asyncHandler(async (req, res) => {
  const userId = Number(req.session.userId);
  const league = await loadManageableLeague(req.params.id, userId);
  const team = await Team.findByPk(req.body.teamId);
  if (!team) throw new ApiError(404, 'Tím nenájdený.');
  // custom tím cudzieho používateľa nepridávame
  if (team.scope === 'custom' && team.creatorId !== userId) {
    throw new ApiError(403, 'Tento custom tím nie je tvoj.');
  }
  await LeagueTeam.findOrCreate({ where: { leagueId: league.id, teamId: team.id }, defaults: { leagueId: league.id, teamId: team.id } });
  res.status(201).json({ success: true, message: 'Tím pridaný do súpisky.', data: team });
});

// DELETE /api/leagues/:id/teams/:teamId — odobrať zo súpisky
// (len ak tím nie je použitý v zápase tejto ligy)
const removeTeam = asyncHandler(async (req, res) => {
  const userId = Number(req.session.userId);
  const league = await loadManageableLeague(req.params.id, userId);
  const teamId = Number(req.params.teamId);

  // je tím použitý v zápase tejto ligy?
  const rounds = await Round.findAll({ where: { leagueId: league.id }, attributes: ['id'] });
  const roundIds = rounds.map((r) => r.id);
  if (roundIds.length) {
    const used = await Match.count({
      where: { roundId: { [Op.in]: roundIds }, [Op.or]: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
    });
    if (used > 0) throw new ApiError(400, 'Tím sa nedá odobrať — je použitý v zápase tejto ligy.');
  }

  await LeagueTeam.destroy({ where: { leagueId: league.id, teamId } });
  res.status(200).json({ success: true, message: 'Tím odobraný zo súpisky.' });
});

// POST /api/leagues/:id/teams/custom  { name, teamType, sport, country, logo }
// vytvorí custom tím (patrí lige/tvorcovi) a rovno ho pridá do súpisky
const createCustomTeam = asyncHandler(async (req, res) => {
  const userId = Number(req.session.userId);
  const league = await loadManageableLeague(req.params.id, userId);

  const name = (req.body.name || '').trim();
  if (!name) throw new ApiError(400, 'Názov tímu je povinný.');
  const teamType = req.body.teamType === 'national' ? 'national' : 'club';
  let sport = null;
  let country = req.body.country && COUNTRY_CODES.includes(req.body.country) ? req.body.country : null;
  if (teamType === 'club') {
    sport = req.body.sport && SPORT_CODES.includes(req.body.sport) ? req.body.sport : null;
  }
  const logo = (req.body.logo || '').trim() || null;

  const team = await Team.create({ name, scope: 'custom', teamType, sport, country, logo, creatorId: userId });
  await LeagueTeam.create({ leagueId: league.id, teamId: team.id });

  res.status(201).json({ success: true, message: 'Custom tím vytvorený a pridaný.', data: team });
});

// PUT /api/teams/custom/:id — používateľ upraví svoj custom tím
const updateCustomTeam = asyncHandler(async (req, res) => {
  const userId = Number(req.session.userId);
  const team = await Team.findByPk(req.params.id);
  if (!team) throw new ApiError(404, 'Tím nenájdený.');
  if (team.scope !== 'custom' || team.creatorId !== userId) {
    throw new ApiError(403, 'Upraviť môžeš len svoj vlastný tím.');
  }
  const name = (req.body.name || '').trim();
  if (!name) throw new ApiError(400, 'Názov tímu je povinný.');
  const teamType = req.body.teamType === 'national' ? 'national' : 'club';
  let sport = null;
  const country = req.body.country && COUNTRY_CODES.includes(req.body.country) ? req.body.country : null;
  if (teamType === 'club') sport = req.body.sport && SPORT_CODES.includes(req.body.sport) ? req.body.sport : null;
  const logo = (req.body.logo || '').trim() || null;

  team.name = name; team.teamType = teamType; team.sport = sport; team.country = country; team.logo = logo;
  await team.save();
  res.status(200).json({ success: true, message: 'Tím upravený.', data: team });
});

// DELETE /api/teams/custom/:id — používateľ zmaže svoj custom tím
// (len ak nie je v žiadnom zápase; odoberie sa aj zo súpisiek líg)
const deleteCustomTeam = asyncHandler(async (req, res) => {
  const userId = Number(req.session.userId);
  const team = await Team.findByPk(req.params.id);
  if (!team) throw new ApiError(404, 'Tím nenájdený.');
  if (team.scope !== 'custom' || team.creatorId !== userId) {
    throw new ApiError(403, 'Zmazať môžeš len svoj vlastný tím.');
  }
  const used = await Match.count({ where: { [Op.or]: [{ homeTeamId: team.id }, { awayTeamId: team.id }] } });
  if (used > 0) throw new ApiError(400, 'Tím nemožno zmazať — je použitý v zápasoch.');
  await LeagueTeam.destroy({ where: { teamId: team.id } });
  await team.destroy();
  res.status(200).json({ success: true, message: 'Tím zmazaný.' });
});

module.exports = { availableTeams, leagueTeams, addTeam, removeTeam, createCustomTeam, updateCustomTeam, deleteCustomTeam };
