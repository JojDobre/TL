// backend/src/controllers/teamAdminPage.controller.js
//
// Vykreslí admin stránku na správu tímov (zoznam + filtre + pridanie).
// Dáta sa potom dynamicky načítavajú/menia cez /api/admin/teams.

const { Team } = require('../models');
const { SPORTS, COUNTRIES } = require('../utils/team.constants');
const { asyncHandler } = require('../middleware/error.middleware');

// GET /admin/teams
const teamsAdminPage = asyncHandler(async (req, res) => {
  // počiatočný zoznam globálnych tímov (prvých 30, zvyšok cez API/filter)
  const teams = await Team.findAll({ where: { scope: 'global' }, order: [['name', 'ASC']], limit: 30 });
  const total = await Team.count({ where: { scope: 'global' } });

  res.render('adminTeams', {
    teams: teams.map((t) => t.toJSON()),
    total,
    sports: SPORTS,
    countries: COUNTRIES,
  });
});

module.exports = { teamsAdminPage };
