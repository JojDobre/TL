'use strict';

const https = require('https');

const API_KEY = process.env.TSDB_API_KEY || '123';
const DELAY_MS = parseInt(process.env.TSDB_DELAY_MS || '2200', 10);
const BASE_URL = `https://www.thesportsdb.com/api/v1/json/${API_KEY}`;

/**
 * Názvy líg zladené podľa browse stránky TheSportsDB Soccer:
 * https://www.thesportsdb.com/sport.php?all=1&s=Soccer
 *
 * Pozn:
 * - držím sa primárne mužských seniorských európskych líg
 * - sú tam top ligy + viaceré 2./3./4. úrovne, ktoré sú na stránke viditeľné
 * - "names" = [primárny canonical názov, fallback aliasy]
 */
const EUROPEAN_LEAGUES = [
  // England
  { country: 'EN', names: ['English Premier League'] },
  { country: 'EN', names: ['English League Championship'] },
  { country: 'EN', names: ['English League 1'] },
  { country: 'EN', names: ['English League 2'] },

  // Scotland
  { country: 'SC', names: ['Scottish Premier League'] },
  { country: 'SC', names: ['Scottish Championship'] },
  { country: 'SC', names: ['Scottish League 1', 'Scottish League One'] },
  { country: 'SC', names: ['Scottish League 2', 'Scottish League Two'] },

  // Spain
  { country: 'ES', names: ['Spanish La Liga'] },
  { country: 'ES', names: ['Spanish Segunda División', 'Spanish Segunda Division'] },
  { country: 'ES', names: ['Primera División RFEF Group 1'] },
  { country: 'ES', names: ['Primera División RFEF Group 2'] },
  { country: 'ES', names: ['Spanish Segunda RFEF Group 1'] },
  { country: 'ES', names: ['Spanish Segunda RFEF Group 2'] },
  { country: 'ES', names: ['Spanish Segunda RFEF Group 3'] },
  { country: 'ES', names: ['Spanish Segunda RFEF Group 4'] },
  { country: 'ES', names: ['Spanish Segunda RFEF Group 5'] },

  // Germany
  { country: 'DE', names: ['German Bundesliga'] },
  { country: 'DE', names: ['German 2. Bundesliga'] },
  { country: 'DE', names: ['German 3. Liga'] },
  { country: 'DE', names: ['German Regionalliga Bayern'] },
  { country: 'DE', names: ['German Regionalliga Nord'] },
  { country: 'DE', names: ['German Regionalliga Nordost'] },
  { country: 'DE', names: ['German Regionalliga SudWest'] },
  { country: 'DE', names: ['German Regionalliga West'] },

  // Italy
  { country: 'IT', names: ['Italian Serie A'] },
  { country: 'IT', names: ['Italian Serie B'] },
  { country: 'IT', names: ['Italian Serie C'] },
  { country: 'IT', names: ['Italy Serie D Girone A'] },
  { country: 'IT', names: ['Italy Serie D Girone B'] },
  { country: 'IT', names: ['Italy Serie D Girone C'] },
  { country: 'IT', names: ['Italy Serie D Girone D'] },
  { country: 'IT', names: ['Italy Serie D Girone E'] },
  { country: 'IT', names: ['Italy Serie D Girone F'] },
  { country: 'IT', names: ['Italy Serie D Girone G'] },
  { country: 'IT', names: ['Italy Serie D Girone H'] },
  { country: 'IT', names: ['Italy Serie D Girone I'] },

  // France
  { country: 'FR', names: ['French Ligue 1'] },
  { country: 'FR', names: ['French Ligue 2'] },
  { country: 'FR', names: ['French National'] },
  { country: 'FR', names: ['French National 2 Group A'] },
  { country: 'FR', names: ['French National 2 Group B'] },
  { country: 'FR', names: ['French National 2 Group C'] },

  // Netherlands
  { country: 'NL', names: ['Dutch Eredivisie'] },
  { country: 'NL', names: ['Dutch Eerste Divisie'] },
  { country: 'NL', names: ['Dutch Tweede Divisie'] },
  { country: 'NL', names: ['Netherlands Derde Divisie Saturday'] },
  { country: 'NL', names: ['Netherlands Derde Divisie Sunday'] },

  // Belgium
  { country: 'BE', names: ['Belgian Pro League'] },

  // Portugal
  { country: 'PT', names: ['Portuguese Primeira Liga'] },
  { country: 'PT', names: ['Portuguese Liga de Honra'] },
  { country: 'PT', names: ['Portugal Liga 3'] },
  { country: 'PT', names: ['Campeonato de Portugal Serie A'] },
  { country: 'PT', names: ['Campeonato de Portugal Serie B'] },
  { country: 'PT', names: ['Campeonato de Portugal Serie C'] },
  { country: 'PT', names: ['Campeonato de Portugal Serie D'] },

  // Turkey
  { country: 'TR', names: ['Turkish Super Lig'] },
  { country: 'TR', names: ['Turkish 1. Lig'] },
  { country: 'TR', names: ['Turkish 3 Lig Group 1'] },
  { country: 'TR', names: ['Turkish 3 Lig Group 2'] },
  { country: 'TR', names: ['Turkish 3 Lig Group 3'] },

  // Greece
  { country: 'GR', names: ['Greek Superleague Greece'] },
  { country: 'GR', names: ['Greek Super League 2'] },
  { country: 'GR', names: ['Greek Gamma Ethniki Group 1'] },
  { country: 'GR', names: ['Greek Gamma Ethniki Group 2'] },
  { country: 'GR', names: ['Greek Gamma Ethniki Group 3'] },
  { country: 'GR', names: ['Greek Gamma Ethniki Group 4'] },
  { country: 'GR', names: ['Greek Gamma Ethniki Group 5'] },
  { country: 'GR', names: ['Greek Gamma Ethniki Group 6'] },

  // Austria
  { country: 'AT', names: ['Austrian Bundesliga'] },
  { country: 'AT', names: ['Austrian 2. Liga'] },

  // Switzerland
  { country: 'CH', names: ['Swiss Super League'] },
  { country: 'CH', names: ['Swiss Challenge League'] },

  // Czechia
  { country: 'CZ', names: ['Czech First League'] },
  { country: 'CZ', names: ['Czech National Football League'] },
  { country: 'CZ', names: ['Czech Bohemian Football League'] },
  { country: 'CZ', names: ['Czech Moravian-Silesian Football League'] },

  // Slovakia
  { country: 'SK', names: ['Slovak First Football League', 'Slovak Super Liga'] },

  // Poland
  { country: 'PL', names: ['Polish Ekstraklasa'] },
  { country: 'PL', names: ['Polish I Liga'] },
  { country: 'PL', names: ['Polish II liga'] },
  { country: 'PL', names: ['Polish III liga Group I'] },
  { country: 'PL', names: ['Polish III liga Group II'] },
  { country: 'PL', names: ['Polish III liga Group III'] },
  { country: 'PL', names: ['Polish III liga Group IV'] },

  // Hungary
  { country: 'HU', names: ['Hungarian NB I'] },
  { country: 'HU', names: ['Hungarian NB II'] },

  // Croatia
  { country: 'HR', names: ['Croatian First Football League'] },
  { country: 'HR', names: ['Croatian Second Football League'] },

  // Serbia
  { country: 'RS', names: ['Serbian Super Liga', 'Serbian SuperLiga'] },
  { country: 'RS', names: ['Serbian Prva Liga'] },

  // Slovenia
  { country: 'SI', names: ['Slovenian 1. SNL', 'Slovenian PrvaLiga'] },

  // Romania
  { country: 'RO', names: ['Romanian Liga I'] },
  { country: 'RO', names: ['Romanian Liga II'] },
  { country: 'RO', names: ['Romanian Liga III Seria I'] },
  { country: 'RO', names: ['Romanian Liga III Seria II'] },
  { country: 'RO', names: ['Romanian Liga III Seria III'] },
  { country: 'RO', names: ['Romanian Liga III Seria IV'] },
  { country: 'RO', names: ['Romanian Liga III Seria V'] },
  { country: 'RO', names: ['Romanian Liga III Seria VI'] },
  { country: 'RO', names: ['Romanian Liga III Seria VII'] },
  { country: 'RO', names: ['Romanian Liga III Seria VIII'] },

  // Bulgaria
  { country: 'BG', names: ['Bulgarian First League'] },

  // Denmark
  { country: 'DK', names: ['Danish Superliga'] },
  { country: 'DK', names: ['Danish 1st Division'] },
  { country: 'DK', names: ['Danish 2nd Division'] },
  { country: 'DK', names: ['Denmark 3 Division'] },
  { country: 'DK', names: ['Denmark Series Group 1'] },
  { country: 'DK', names: ['Denmark Series Group 2'] },
  { country: 'DK', names: ['Denmark Series Group 3'] },
  { country: 'DK', names: ['Denmark Series Group 4'] },

  // Sweden
  { country: 'SE', names: ['Swedish Allsvenskan'] },
  { country: 'SE', names: ['Swedish Superettan'] },

  // Norway
  { country: 'NO', names: ['Norwegian Eliteserien'] },
  { country: 'NO', names: ['Norwegian First Division'] },
  { country: 'NO', names: ['Norwegian Second Division Group 1'] },
  { country: 'NO', names: ['Norwegian Second Division Group 2'] },

  // Finland
  { country: 'FI', names: ['Finnish Veikkausliiga'] },
  { country: 'FI', names: ['Finnish Ykkösliiga', 'Finnish Ykkonen'] },

  // Ireland
  { country: 'IE', names: ['Irish Premier Division'] },

  // Wales
  { country: 'WL', names: ['Welsh Premier League'] },
  { country: 'WL', names: ['Welsh Cymru North-South'] },

  // Northern Ireland
  { country: 'NIR', names: ['Northern Irish Premiership', 'NIFL Premiership'] },

  // Iceland
  { country: 'IS', names: ['Icelandic Úrvalsdeild karla', 'Icelandic Premier League'] },

  // Estonia
  { country: 'EE', names: ['Estonian Meistriliiga'] },
  { country: 'EE', names: ['Estonian Esiliiga'] },

  // Faroe Islands
  { country: 'FO', names: ['Faroe Islands 1. deild'] },

  // Lithuania
  { country: 'LT', names: ['Lithuanian TOPLYGA', 'Lithuanian A Lyga'] },

  // Ukraine
  { country: 'UA', names: ['Ukrainian Premier League'] },
  { country: 'UA', names: ['Ukrainian First League'] },

  // Russia
  { country: 'RU', names: ['Russian Football Premier League', 'Russian Premier League'] },
  { country: 'RU', names: ['Russia FNL 2 Division A Gold Group'] },
  { country: 'RU', names: ['Russia FNL 2 Division A Silver Group'] },
  { country: 'RU', names: ['Russia FNL 2 Group 1'] },
  { country: 'RU', names: ['Russia FNL 2 Group 2'] },
  { country: 'RU', names: ['Russia FNL 2 Group 3'] },

  // Bosnia and Herzegovina
  { country: 'BA', names: ['Bosnian Premier Liga'] },

  // Montenegro
  { country: 'ME', names: ['Montenegrin First League'] },

  // North Macedonia
  { country: 'MK', names: ['Macedonian First League'] },

  // Albania
  { country: 'AL', names: ['Albanian Superliga'] },

  // Kosovo
  { country: 'XK', names: ['Kosovan Superleague'] },

  // Cyprus
  { country: 'CY', names: ['Cypriot First Division'] },

  // Malta
  { country: 'MT', names: ['Maltese Premier League'] },

  // Luxembourg
  { country: 'LU', names: ['Luxembourg National Division'] },

  // Moldova
  { country: 'MD', names: ['Moldovan National Division'] },

  // Georgia
  { country: 'GE', names: ['Georgian Erovnuli Liga'] },
  { country: 'GE', names: ['Georgian Erovnuli Liga 2'] },

  // Armenia
  { country: 'AM', names: ['Armenian Premier League'] },

  // Azerbaijan
  { country: 'AZ', names: ['Azerbaijani Premier League'] },

  // Kazakhstan
  { country: 'KZ', names: ['Kazakhstan Premier League'] },

  // Gibraltar
  { country: 'GI', names: ['Gibraltarian National League'] },

  // Andorra
  { country: 'AD', names: ['Andorran 1a Divisió'] },

  // San Marino
  { country: 'SM', names: ['San-Marino Campionato', 'Campionato Sammarinese di Calcio'] },
];

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(
      url,
      {
        headers: {
          'User-Agent': 'clubs-seed/1.0',
          Accept: 'application/json',
        },
      },
      (res) => {
        let raw = '';

        res.on('data', (chunk) => {
          raw += chunk;
        });

        res.on('end', () => {
          if (res.statusCode === 429) {
            return reject(new Error('Rate limit (429) – zvýš TSDB_DELAY_MS alebo počkaj minútu.'));
          }

          if (res.statusCode >= 400) {
            return reject(new Error(`HTTP ${res.statusCode} pre URL: ${url}`));
          }

          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(new Error(`JSON parse error: ${e.message}\nRaw: ${raw.slice(0, 300)}`));
          }
        });
      }
    ).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchTeamsForLeague(leagueName) {
  const url = `${BASE_URL}/search_all_teams.php?l=${encodeURIComponent(leagueName)}`;
  const data = await fetchJson(url);
  return Array.isArray(data.teams) ? data.teams : [];
}

function getBadgeUrl(team) {
  return team.strBadge || team.strTeamBadge || team.strLogo || null;
}

function mapTeam(team, fallbackCountry) {
  return {
    name: team.strTeam ? team.strTeam.trim() : null,
    sport: 'football',
    scope: 'global',
    teamType: 'club',
    country: fallbackCountry || null,
    logo: getBadgeUrl(team),
    externalId: team.idTeam || null,
    creatorId: null,
  };
}

async function resolveLeagueTeams(leagueDef) {
  for (const leagueName of leagueDef.names) {
    const teams = await fetchTeamsForLeague(leagueName);
    if (teams.length > 0) {
      return {
        leagueNameUsed: leagueName,
        teams,
      };
    }
    await sleep(350);
  }

  return {
    leagueNameUsed: null,
    teams: [],
  };
}

async function seedClubs({
  dryRun = false,
  updateLogos = false,
  verbose = false,
  listLeagues = false,
} = {}) {
  const { Team } = require('../models');

  if (listLeagues) {
    console.log('\nEurópske futbalové ligy pripravené na import:\n');
    EUROPEAN_LEAGUES.forEach((l, i) => {
      console.log(
        `${String(i + 1).padStart(3, ' ')}. ${l.names[0]} | ${l.country} | aliasy: ${l.names.join(' / ')}`
      );
    });
    console.log(`\nSpolu: ${EUROPEAN_LEAGUES.length}\n`);
    return { leagues: EUROPEAN_LEAGUES.length };
  }

  console.log('\n🏟️  Seed európskych futbalových klubov (TheSportsDB)');
  console.log(`   API kľúč      : ${API_KEY === '123' ? '123 (free)' : '*** (custom)'}`);
  console.log(`   Ligy          : ${EUROPEAN_LEAGUES.length}`);
  console.log(`   Dry-run       : ${dryRun}`);
  console.log(`   Update logos  : ${updateLogos}`);
  console.log(`   Delay         : ${DELAY_MS}ms\n`);

  let totalAdded = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  const emptyLeagues = [];
  const failedLeagues = [];
  const suspiciousLeagues = [];
  const successLeagues = [];

  const seenExternalIds = new Set();
  const seenNames = new Set();

  for (const league of EUROPEAN_LEAGUES) {
    process.stdout.write(`  📋 ${league.names[0]} … `);

    let resolved;
    try {
      resolved = await resolveLeagueTeams(league);
    } catch (err) {
      console.log('ERROR');
      failedLeagues.push({
        league: league.names[0],
        aliases: league.names,
        error: err.message,
      });
      totalErrors++;
      await sleep(DELAY_MS * 2);
      continue;
    }

    const { leagueNameUsed, teams } = resolved;

    if (!teams.length) {
      console.log('0 tímov');
      emptyLeagues.push({
        league: league.names[0],
        aliasesTried: league.names,
      });
      await sleep(DELAY_MS);
      continue;
    }

    console.log(`${teams.length} tímov${leagueNameUsed ? ` [match: ${leagueNameUsed}]` : ''}`);

    successLeagues.push({
      league: league.names[0],
      used: leagueNameUsed,
      count: teams.length,
    });

    if (teams.length <= 10) {
      suspiciousLeagues.push({
        league: league.names[0],
        used: leagueNameUsed,
        count: teams.length,
      });
    }

    if (verbose) {
      const preview = teams.slice(0, 5).map((t) => ({
        idTeam: t.idTeam,
        strTeam: t.strTeam,
        strLeague: t.strLeague,
      }));
      console.log('     preview:', preview);
    }

    for (const raw of teams) {
      const mapped = mapTeam(raw, league.country);

      if (!mapped.name) {
        totalSkipped++;
        continue;
      }

      const extKey = mapped.externalId ? `id:${mapped.externalId}` : null;
      const nameKey = `${mapped.name.toLowerCase()}::football`;

      if ((extKey && seenExternalIds.has(extKey)) || seenNames.has(nameKey)) {
        if (verbose) console.log(`     [skip-dup] ${mapped.name}`);
        totalSkipped++;
        continue;
      }

      if (extKey) seenExternalIds.add(extKey);
      seenNames.add(nameKey);

      if (dryRun) {
        totalAdded++;
        if (verbose) {
          console.log(`     [dry] ${mapped.name} | logo: ${mapped.logo ? '✓' : '✗'}`);
        }
        continue;
      }

      try {
        const exists = await Team.findOne({
          where: {
            name: mapped.name,
            scope: 'global',
            teamType: 'club',
            sport: 'football',
          },
        });

        if (!exists) {
          const { externalId, ...dataToCreate } = mapped;
          await Team.create(dataToCreate);
          if (verbose) console.log(`     [+] ${mapped.name}`);
          totalAdded++;
        } else {
          const patch = {};

          if (mapped.logo && (!exists.logo || updateLogos)) {
            patch.logo = mapped.logo;
          }

          if (!exists.country && mapped.country) {
            patch.country = mapped.country;
          }

          if (Object.keys(patch).length > 0) {
            await exists.update(patch);
            if (verbose) console.log(`     [upd] ${mapped.name}`);
            totalUpdated++;
          } else {
            totalSkipped++;
          }
        }
      } catch (dbErr) {
        console.error(`\n     ❌ DB chyba pri ${mapped.name}: ${dbErr.message}`);
        totalErrors++;
      }
    }

    await sleep(DELAY_MS);
  }

  console.log('\n──────────────────────────────────────');
  console.log('✅ Hotovo!');
  console.log(`   Pridaných          : ${totalAdded}`);
  console.log(`   Aktualizovaných    : ${totalUpdated}`);
  console.log(`   Preskočených       : ${totalSkipped}`);
  console.log(`   Chýb               : ${totalErrors}`);
  console.log(`   Úspešné ligy       : ${successLeagues.length}`);
  console.log(`   Prázdne ligy       : ${emptyLeagues.length}`);
  console.log(`   Failed ligy        : ${failedLeagues.length}`);
  console.log(`   Podozrivo malé     : ${suspiciousLeagues.length}`);
  console.log('──────────────────────────────────────\n');

  if (emptyLeagues.length) {
    console.log('Ligy bez výsledkov:');
    emptyLeagues.forEach((x) => {
      console.log(` - ${x.league} | skúšané: ${x.aliasesTried.join(' | ')}`);
    });
    console.log('');
  }

  if (failedLeagues.length) {
    console.log('Ligy s chybou:');
    failedLeagues.forEach((x) => {
      console.log(` - ${x.league}: ${x.error}`);
    });
    console.log('');
  }

  if (suspiciousLeagues.length) {
    console.log('Ligy s podozrivo malým počtom tímov (<= 10):');
    suspiciousLeagues.forEach((x) => {
      console.log(` - ${x.league} | použité: ${x.used} | tímy: ${x.count}`);
    });
    console.log('');
  }

  return {
    added: totalAdded,
    updated: totalUpdated,
    skipped: totalSkipped,
    errors: totalErrors,
    emptyLeagues,
    failedLeagues,
    suspiciousLeagues,
    successLeagues,
  };
}

module.exports = seedClubs;

if (require.main === module) {
  const args = process.argv.slice(2);

  const dryRun = args.includes('--dry-run');
  const updateLogos = args.includes('--update-logos');
  const verbose = args.includes('--verbose');
  const listLeagues = args.includes('--list-leagues');

  const db = require('../models');

  db.sequelize
    .authenticate()
    .then(() =>
      seedClubs({
        dryRun,
        updateLogos,
        verbose,
        listLeagues,
      })
    )
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seed zlyhal:', err.message);
      process.exit(1);
    });
}