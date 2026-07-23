'use strict';

require('dotenv').config();

const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = process.env.TSDB_API_KEY;
const RATE_LIMIT_MS = parseInt(process.env.TSDB_DELAY_MS || '650', 10);
const BASE = `https://www.thesportsdb.com/api/v1/json/${API_KEY}`;
const PROGRESS_FILE = path.join(__dirname, '.tsdb-other-progress.json');

// mode: 'teams'       -> search_all_teams.php, uloží kontajnery ako tímy
// mode: 'individuals' -> search_all_teams.php -> lookup_all_players.php, uloží hráčov
const COMPETITIONS = [
  // Motorsport
  { league: 'Formula 1', sport: 'motorsport', mode: 'individuals' },
  { league: 'Formula 2', sport: 'motorsport', mode: 'individuals' },
  { league: 'MotoGP', sport: 'motorsport', mode: 'individuals' },

  // Fighting
  { league: 'Boxing', sport: 'fighting', mode: 'individuals' },
  { league: 'KSW', sport: 'fighting', mode: 'individuals' },
  { league: 'UFC', sport: 'fighting', mode: 'individuals' },
  { league: 'Oktagon MMA', sport: 'fighting', mode: 'individuals' },
  { league: 'Cage Warriors', sport: 'fighting', mode: 'individuals' },
  { league: 'Professional Fighters League', sport: 'fighting', mode: 'individuals' },

  // Basketball
  { league: 'EuroLeague Basketball', sport: 'basketball', mode: 'teams' },
  { league: 'NBA', sport: 'basketball', mode: 'teams' },
  { league: 'Spanish Liga ACB', sport: 'basketball', mode: 'teams' },
  { league: 'Turkish Basketbol Super Ligi', sport: 'basketball', mode: 'teams' },
  { league: 'Italian Lega Basket', sport: 'basketball', mode: 'teams' },
  { league: 'Czech NBL', sport: 'basketball', mode: 'teams' },
  { league: 'Slovak Basketball League', sport: 'basketball', mode: 'teams' },

  // American Football
  { league: 'NFL', sport: 'americanfootball', mode: 'teams' },

  // Ice Hockey
  { league: 'NHL', sport: 'hockey', mode: 'teams' },
  { league: 'American AHL', sport: 'hockey', mode: 'teams' },
  { league: 'Canadian OHL', sport: 'hockey', mode: 'teams' },
  { league: 'NCAA Division 1 Ice Hockey', sport: 'hockey', mode: 'teams' },
  { league: 'Finnish Liiga', sport: 'hockey', mode: 'teams' },
  { league: 'German DEL', sport: 'hockey', mode: 'teams' },
  { league: 'Swedish Hockey League', sport: 'hockey', mode: 'teams' },
  { league: 'Swiss National League', sport: 'hockey', mode: 'teams' },
  { league: 'Czech Extraliga', sport: 'hockey', mode: 'teams' },
  { league: 'Russian KHL', sport: 'hockey', mode: 'teams' },
  { league: 'Slovak Extraliga', sport: 'hockey', mode: 'teams' },
  { league: 'Slovak Hockey League', sport: 'hockey', mode: 'teams' },
  { league: 'Swiss League', sport: 'hockey', mode: 'teams' },
  { league: 'Hungarian Erste Liga', sport: 'hockey', mode: 'teams' },

  // Rugby
  { league: 'Australian National Rugby League', sport: 'rugby', mode: 'teams' },
  { league: 'English Prem Rugby', sport: 'rugby', mode: 'teams' },
  { league: 'English Rugby League Super League', sport: 'rugby', mode: 'teams' },
  { league: 'French Top 14', sport: 'rugby', mode: 'teams' },
  { league: 'Super Rugby', sport: 'rugby', mode: 'teams' },
  { league: 'United Rugby Championship', sport: 'rugby', mode: 'teams' },

  // Tennis
  { league: 'ATP World Tour', sport: 'tennis', mode: 'individuals' },
  { league: 'WTA Tour', sport: 'tennis', mode: 'individuals' },

  // Cycling
  { league: 'UCI World Tour', sport: 'cycling', mode: 'individuals' },

  // ESports
  { league: 'ESL Pro League', sport: 'esports', mode: 'teams' },
  { league: 'ESL One', sport: 'esports', mode: 'teams' },
  { league: 'FC Pro World Championship', sport: 'esports', mode: 'teams' },
  { league: 'FIFA eWorld Cup Series', sport: 'esports', mode: 'teams' },
  { league: 'Apex Legends Global Series', sport: 'esports', mode: 'teams' },
  { league: 'League of Legends Champions Korea', sport: 'esports', mode: 'teams' },
  { league: 'League of Legends EMEA Championship', sport: 'esports', mode: 'teams' },
  { league: 'League of Legends Pro League', sport: 'esports', mode: 'teams' },
  { league: 'League of The Americas', sport: 'esports', mode: 'teams' },
  { league: 'Blast Premier', sport: 'esports', mode: 'teams' },
  { league: 'Valorant Champions Tour', sport: 'esports', mode: 'teams' },

  // Volleyball
  { league: 'French Ligue A Mens Volleyball', sport: 'volleyball', mode: 'teams' },
  { league: 'French Ligue A Womens Volleyball', sport: 'volleyball', mode: 'teams' },
  { league: 'German 1. Bundesliga', sport: 'volleyball', mode: 'teams' },
  { league: 'Greek A1 Ethniki', sport: 'volleyball', mode: 'teams' },
  { league: 'Italian Volleyball League', sport: 'volleyball', mode: 'teams' },
  { league: 'Italian Womens Volleyball League', sport: 'volleyball', mode: 'teams' },
  { league: 'Polish PlusLiga', sport: 'volleyball', mode: 'teams' },

  // Handball
  { league: 'Danish Mens Handball League', sport: 'handball', mode: 'teams' },
  { league: 'French LNH Division 1', sport: 'handball', mode: 'teams' },
  { league: 'German Handball-Bundesliga', sport: 'handball', mode: 'teams' },
  { league: 'Hungarian Nemzeti Bajnokság I', sport: 'handball', mode: 'teams' },
  { league: 'International Friendlies Handball', sport: 'handball', mode: 'teams' },
  { league: 'Polish Handball Superliga', sport: 'handball', mode: 'teams' },
  { league: 'Spanish Liga ASOBAL', sport: 'handball', mode: 'teams' },
  { league: 'Swedish Handbollsligan', sport: 'handball', mode: 'teams' },

  // Snooker / Darts
  { league: 'World Snooker', sport: 'snooker', mode: 'individuals' },
  { league: 'PDC Darts', sport: 'darts', mode: 'individuals' },

  // Skiing
  { league: 'Biathlon World Cup', sport: 'skiing', mode: 'individuals' },
  { league: 'FIS Alpine World Ski Championships', sport: 'skiing', mode: 'individuals' },
];

// kód sportu v našom číselníku -> strSport z TheSportsDB (validácia)
const SPORT_TO_TSDB = {
  motorsport: 'Motorsport',
  fighting: 'Fighting',
  basketball: 'Basketball',
  americanfootball: 'American Football',
  hockey: 'Ice Hockey',
  rugby: 'Rugby',
  tennis: 'Tennis',
  cycling: 'Cycling',
  esports: 'ESports',
  volleyball: 'Volleyball',
  handball: 'Handball',
  snooker: 'Snooker',
  darts: 'Darts',
  skiing: 'Skiing',
};

const COUNTRY_MAP = require('./country-map');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function get(pathname) {
  return new Promise((resolve, reject) => {
    https
      .get(`${BASE}/${pathname}`, (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
          try {
            resolve(JSON.parse(buf));
          } catch {
            reject(new Error('Neplatný JSON'));
          }
        });
      })
      .on('error', reject);
  });
}

const loadProgress = () => {
  try {
    return new Set(JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')));
  } catch {
    return new Set();
  }
};
const saveProgress = (d) => fs.writeFileSync(PROGRESS_FILE, JSON.stringify([...d]));

const mapCountry = (n) => COUNTRY_MAP[(n || '').trim()] || 'other';
const toInt = (v) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

function mapTeam(t, sport) {
  return {
    name: (t.strTeam || '').trim(),
    logo: t.strBadge || null,
    country: mapCountry(t.strCountry),
    sport,
    scope: 'global',
    teamType: 'club',
    externalId: String(t.idTeam),
    shortName: t.strTeamShort || null,
    alternateName: t.strTeamAlternate || null,
    foundedYear: toInt(t.intFormedYear),
    stadium: t.strStadium || null,
    stadiumCapacity: toInt(t.intStadiumCapacity),
    city: t.strLocation || null,
    website: t.strWebsite || null,
    description: t.strDescriptionEN || null,
  };
}

function mapPlayer(p, sport) {
  return {
    name: (p.strPlayer || '').trim(),
    logo: p.strCutout || p.strThumb || null,
    country: mapCountry(p.strNationality),
    sport,
    scope: 'global',
    teamType: 'individual',
    externalId: `p:${p.idPlayer}`,
    shortName: null,
    alternateName: p.strPlayerAlternate || null,
    foundedYear: null,
    stadium: null,
    stadiumCapacity: null,
    city: p.strBirthLocation || null,
    website: p.strWebsite || null,
    description: p.strDescriptionEN || null,
  };
}

async function upsert(Team, payload) {
  const [, created] = await Team.findOrCreate({
    where: { externalId: payload.externalId },
    defaults: payload,
  });
  if (created) return 'added';
  await Team.update(payload, { where: { externalId: payload.externalId } });
  return 'updated';
}

async function run({ dryRun, reset }) {
  if (!API_KEY) throw new Error('Chýba TSDB_API_KEY');

  const { Team } = require('../models');

  if (reset && fs.existsSync(PROGRESS_FILE)) fs.unlinkSync(PROGRESS_FILE);
  const done = loadProgress();

  const seen = new Set();
  const stats = { added: 0, updated: 0, skipped: 0, failed: [] };
  const unmapped = new Set();

  let i = 0;
  for (const comp of COMPETITIONS) {
    i++;
    const key = `${comp.league}|${comp.mode}`;
    if (done.has(key)) continue;

    let containers;
    try {
      const res = await get(`search_all_teams.php?l=${encodeURIComponent(comp.league)}`);
      containers = res.teams || [];
    } catch (e) {
      stats.failed.push(`${comp.league}: ${e.message}`);
      await sleep(RATE_LIMIT_MS);
      continue;
    }
    await sleep(RATE_LIMIT_MS);

    const expected = SPORT_TO_TSDB[comp.sport];
    containers = containers.filter((c) => !expected || c.strSport === expected);

    let a = 0;
    let u = 0;

    if (comp.mode === 'teams') {
      for (const c of containers) {
        const payload = mapTeam(c, comp.sport);
        if (!payload.name) continue;
        if (seen.has(payload.externalId)) {
          stats.skipped++;
          continue;
        }
        seen.add(payload.externalId);

        const raw = (c.strCountry || '').trim();
        if (raw && !COUNTRY_MAP[raw]) unmapped.add(raw);
        if (dryRun) continue;

        const r = await upsert(Team, payload);
        r === 'added' ? a++ : u++;
      }
    } else {
      for (const c of containers) {
        let players;
        try {
          const res = await get(`lookup_all_players.php?id=${c.idTeam}`);
          players = res.player || [];
        } catch (e) {
          stats.failed.push(`${comp.league} / ${c.strTeam}: ${e.message}`);
          await sleep(RATE_LIMIT_MS);
          continue;
        }
        await sleep(RATE_LIMIT_MS);

        for (const p of players) {
          if (expected && p.strSport !== expected) continue;

          const payload = mapPlayer(p, comp.sport);
          if (!payload.name) continue;
          if (seen.has(payload.externalId)) {
            stats.skipped++;
            continue;
          }
          seen.add(payload.externalId);

          const raw = (p.strNationality || '').trim();
          if (raw && !COUNTRY_MAP[raw]) unmapped.add(raw);
          if (dryRun) continue;

          const r = await upsert(Team, payload);
          r === 'added' ? a++ : u++;
        }
      }
    }

    stats.added += a;
    stats.updated += u;

    if (!dryRun) {
      done.add(key);
      saveProgress(done);
    }

    console.log(
      `[${String(i).padStart(2)}/${COMPETITIONS.length}] ${comp.league} (${comp.mode}) — ${containers.length} kont. (+${a} ~${u})`
    );
  }

  console.log('\n──────────────────────────────');
  console.log(`Pridané      : ${stats.added}`);
  console.log(`Aktualizované: ${stats.updated}`);
  console.log(`Duplicity    : ${stats.skipped}`);
  console.log(`Zlyhania     : ${stats.failed.length}`);
  console.log('──────────────────────────────');

  if (unmapped.size) {
    console.log('\n⚠ Nenamapované krajiny (uložené ako "other"):');
    [...unmapped].sort().forEach((c) => console.log(`  ${c}`));
  }
  if (stats.failed.length) {
    console.log('\nZlyhania:');
    stats.failed.forEach((f) => console.log(`  ${f}`));
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const db = require('../models');

  db.sequelize
    .authenticate()
    .then(() => run({ dryRun: args.includes('--dry-run'), reset: args.includes('--reset') }))
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Zlyhalo:', err.message);
      process.exit(1);
    });
}

module.exports = { run };