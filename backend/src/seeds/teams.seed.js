// backend/src/seeds/teams.seed.js
//
// Naplní DB základnými GLOBÁLNYMI tímami (národné + vybrané kluby).
// Spúšťa sa idempotentne — tím sa pridá len ak rovnaké meno+scope global ešte nie je.
// Použitie: zavolaj seedTeams() (napr. z db.sync.js alebo samostatným skriptom).

const { Team } = require('../models');
const { Op } = require('sequelize');

// národné tímy (bez športu, teamType national); krajina = kód
const NATIONAL = [
  ['Slovensko', 'SK'], ['Česko', 'CZ'], ['Kanada', 'CA'], ['USA', 'US'],
  ['Švédsko', 'SE'], ['Fínsko', 'FI'], ['Nemecko', 'DE'], ['Anglicko', 'EN'],
  ['Španielsko', 'ES'], ['Taliansko', 'IT'], ['Francúzsko', 'FR'], ['Švajčiarsko', 'CH'],
  ['Rakúsko', 'AT'], ['Rusko', 'RU'],
];

// kluby: [názov, šport, krajina]
const CLUBS = [
  // futbal Anglicko
  ['Arsenal', 'football', 'EN'], ['Manchester United', 'football', 'EN'],
  ['Manchester City', 'football', 'EN'], ['Liverpool', 'football', 'EN'],
  ['Chelsea', 'football', 'EN'],
  // futbal Španielsko
  ['Real Madrid', 'football', 'ES'], ['FC Barcelona', 'football', 'ES'],
  ['Atlético Madrid', 'football', 'ES'],
  // futbal Nemecko
  ['Bayern Mníchov', 'football', 'DE'], ['Borussia Dortmund', 'football', 'DE'],
  // futbal Taliansko
  ['Juventus', 'football', 'IT'], ['Inter Miláno', 'football', 'IT'], ['AC Miláno', 'football', 'IT'],
  // hokej Slovensko
  ['HC Košice', 'hockey', 'SK'], ['HC Slovan Bratislava', 'hockey', 'SK'],
  ['HK Nitra', 'hockey', 'SK'], ['HKM Zvolen', 'hockey', 'SK'],
  // hokej Česko
  ['HC Sparta Praha', 'hockey', 'CZ'], ['HC Oceláři Třinec', 'hockey', 'CZ'],
];

async function seedTeams() {
  let added = 0;
  for (const [name, country] of NATIONAL) {
    const exists = await Team.findOne({ where: { name, scope: 'global', teamType: 'national' } });
    if (!exists) {
      await Team.create({ name, scope: 'global', teamType: 'national', sport: null, country, creatorId: null });
      added += 1;
    }
  }
  for (const [name, sport, country] of CLUBS) {
    const exists = await Team.findOne({ where: { name, scope: 'global', teamType: 'club', sport } });
    if (!exists) {
      await Team.create({ name, scope: 'global', teamType: 'club', sport, country, creatorId: null });
      added += 1;
    }
  }
  return added;
}

module.exports = seedTeams;

// ak sa spustí priamo: node src/seeds/teams.seed.js
if (require.main === module) {
  const db = require('../models');
  db.sequelize.authenticate()
    .then(() => seedTeams())
    .then((n) => { console.log(`Pridaných ${n} globálnych tímov.`); process.exit(0); })
    .catch((e) => { console.error('Seed zlyhal:', e.message); process.exit(1); });
}