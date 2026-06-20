// backend/src/seeds/teams.seed.js

const { Team } = require('../models');

const NATIONAL = [
  ['Slovensko', 'SK', 'https://upload.wikimedia.org/wikipedia/commons/e/e6/Flag_of_Slovakia.svg'],
  ['Česko', 'CZ', 'https://upload.wikimedia.org/wikipedia/commons/c/cb/Flag_of_the_Czech_Republic.svg'],
];

const CLUBS = [
  ['Arsenal', 'football', 'EN', 'https://upload.wikimedia.org/wikipedia/en/5/53/Arsenal_FC.svg'],
  ['Manchester United', 'football', 'EN', 'https://upload.wikimedia.org/wikipedia/en/7/7a/Manchester_United_FC_crest.svg'],
];

async function upsertNationalTeam(name, country, logo) {
  const exists = await Team.findOne({
    where: { name, scope: 'global', teamType: 'national' },
  });

  if (!exists) {
    const created = await Team.create({
      name,
      logo,
      scope: 'global',
      teamType: 'national',
      sport: null,
      country,
      creatorId: null,
    });

    console.log('CREATED NATIONAL:', created.toJSON());
    return { created: 1, updated: 0 };
  }

  console.log('BEFORE NATIONAL UPDATE:', exists.toJSON());

  await exists.update({
    logo,
    country,
    scope: 'global',
    teamType: 'national',
    sport: null,
    creatorId: null,
  });

  await exists.reload();
  console.log('AFTER NATIONAL UPDATE:', exists.toJSON());

  return { created: 0, updated: 1 };
}

async function upsertClubTeam(name, sport, country, logo) {
  const exists = await Team.findOne({
    where: { name, scope: 'global', teamType: 'club', sport },
  });

  if (!exists) {
    const created = await Team.create({
      name,
      logo,
      scope: 'global',
      teamType: 'club',
      sport,
      country,
      creatorId: null,
    });

    console.log('CREATED CLUB:', created.toJSON());
    return { created: 1, updated: 0 };
  }

  console.log('BEFORE CLUB UPDATE:', exists.toJSON());

  await exists.update({
    logo,
    country,
    scope: 'global',
    teamType: 'club',
    sport,
    creatorId: null,
  });

  await exists.reload();
  console.log('AFTER CLUB UPDATE:', exists.toJSON());

  return { created: 0, updated: 1 };
}

async function seedTeams() {
  console.log('DB name:', Team.sequelize.config.database);
  console.log('DB host:', Team.sequelize.config.host);

  let added = 0;
  let updated = 0;

  for (const [name, country, logo] of NATIONAL) {
    const result = await upsertNationalTeam(name, country, logo);
    added += result.created;
    updated += result.updated;
  }

  for (const [name, sport, country, logo] of CLUBS) {
    const result = await upsertClubTeam(name, sport, country, logo);
    added += result.created;
    updated += result.updated;
  }

  return { added, updated };
}

module.exports = seedTeams;

if (require.main === module) {
  const db = require('../models');

  db.sequelize.authenticate()
    .then(() => seedTeams())
    .then((result) => {
      console.log('DONE:', result);
      process.exit(0);
    })
    .catch((e) => {
      console.error('Seed zlyhal:', e);
      process.exit(1);
    });
}