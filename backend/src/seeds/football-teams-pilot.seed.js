'use strict';

require('dotenv').config();

const https = require('https');

const API_KEY = process.env.TSDB_API_KEY;
const RATE_LIMIT_MS = 650; // 100 req/min
const BASE = `https://www.thesportsdb.com/api/v1/json/${API_KEY}`;

const COUNTRY_MAP = {
  Slovakia: 'SK',
  Czechia: 'CZ',
  'Czech Republic': 'CZ',
  Hungary: 'HU',
  Poland: 'PL',
  Austria: 'AT',
  Germany: 'DE',
  England: 'EN',
  Spain: 'ES',
  Italy: 'IT',
  France: 'FR',
  Netherlands: 'NL',
  Belgium: 'BE',
  Portugal: 'PT',
  Switzerland: 'CH',
  Croatia: 'HR',
  Serbia: 'RS',
  Slovenia: 'SI',
  Romania: 'RO',
  Bulgaria: 'BG',
  Greece: 'GR',
  Turkey: 'TR',
  Ukraine: 'UA',
  Denmark: 'DK',
  Sweden: 'SE',
  Norway: 'NO',
  Finland: 'FI',
  Ireland: 'IE',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function get(path) {
  return new Promise((resolve, reject) => {
    https
      .get(`${BASE}/${path}`, (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}: ${path}`));
          try {
            resolve(JSON.parse(buf));
          } catch (e) {
            reject(new Error(`Neplatný JSON: ${path}`));
          }
        });
      })
      .on('error', reject);
  });
}

async function listLeagues(filter) {
  const { leagues } = await get('all_leagues.php');
  const rx = filter ? new RegExp(filter, 'i') : null;

  (leagues || [])
    .filter((l) => l.strSport === 'Soccer')
    .filter((l) => !rx || rx.test(l.strLeague) || rx.test(l.strLeagueAlternate || ''))
    .forEach((l) => console.log(`${String(l.idLeague).padEnd(6)} ${l.strLeague}`));
}

async function importLeague(leagueName, { dryRun }) {
  const { Team } = require('../models');

  const { teams } = await get(`search_all_teams.php?l=${encodeURIComponent(leagueName)}`);
  await sleep(RATE_LIMIT_MS);

  if (!teams || !teams.length) {
    console.log(`Liga "${leagueName}": žiadne tímy.`);
    return;
  }

  console.log(`Liga "${leagueName}": ${teams.length} tímov\n`);

  const stats = { added: 0, updated: 0, skipped: 0 };

  for (const t of teams) {
    const name = (t.strTeam || '').trim();
    if (!name) {
      stats.skipped++;
      continue;
    }

    const payload = {
      name,
      logo: t.strBadge || null,
      country: COUNTRY_MAP[(t.strCountry || '').trim()] || 'other',
      sport: 'football',
      scope: 'global',
      teamType: 'club',
      externalId: String(t.idTeam),
    };

    if (dryRun) {
      console.log(`[dry] ${payload.externalId.padEnd(8)} ${name.padEnd(30)} ${t.strCountry} -> ${payload.country}`);
      continue;
    }

    const [, created] = await Team.findOrCreate({
      where: { externalId: payload.externalId },
      defaults: payload,
    });

    if (created) {
      stats.added++;
      console.log(`+ ${name}`);
    } else {
      await Team.update(payload, { where: { externalId: payload.externalId } });
      stats.updated++;
      console.log(`~ ${name}`);
    }
  }

  console.log(`\nPridané: ${stats.added}  Aktualizované: ${stats.updated}  Preskočené: ${stats.skipped}\n`);
}

async function main() {
  if (!API_KEY) throw new Error('Chýba TSDB_API_KEY');

  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  const listIdx = args.indexOf('--list');
  if (listIdx !== -1) {
    return listLeagues(args[listIdx + 1]);
  }

  const nameIdx = args.indexOf('--league');
  if (nameIdx === -1 || !args[nameIdx + 1]) {
    throw new Error('Použi --league "<názov ligy>" alebo --list [filter]');
  }

  return importLeague(args[nameIdx + 1], { dryRun });
}

if (require.main === module) {
  const db = require('../models');
  db.sequelize
    .authenticate()
    .then(main)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Zlyhalo:', err.message);
      process.exit(1);
    });
}

module.exports = { importLeague, listLeagues };