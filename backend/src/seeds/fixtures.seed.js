'use strict';

require('dotenv').config();

const https = require('https');

const API_KEY = process.env.TSDB_API_KEY;
const RATE_LIMIT_MS = parseInt(process.env.TSDB_DELAY_MS || '650', 10);
const BASE = `https://www.thesportsdb.com/api/v1/json/${API_KEY}`;

const ADMIN_ID = 1;
const SEASON = '2026-2027';

const DEFAULT_SCORING = {
  exactScore: 10,
  correctGoals: 1,
  correctWinner: 3,
  goalDifference: 2,
};

const COMPETITIONS = [
  { id: '4328', name: 'English Premier League' },
  { id: '4332', name: 'Italian Serie A' },
  { id: '4331', name: 'German Bundesliga' },
  { id: '4334', name: 'French Ligue 1' },
  { id: '4335', name: 'Spanish La Liga' },
  { id: '4672', name: 'Slovak First Football League' },
  { id: '4631', name: 'Czech First League' },
  { id: '4380', name: 'NHL' },
];

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

async function uniqueJoinCode(League) {
  for (let i = 0; i < 30; i++) {
    const code = ('TPL' + Math.random().toString(36).substring(2, 5))
      .toUpperCase()
      .substring(0, 6);
    if (!(await League.findOne({ where: { joinCode: code } }))) return code;
  }
  throw new Error('Nepodarilo sa vygenerovať unikátny joinCode');
}

// čas zápasu: strTimestamp je UTC; fallback na dateEvent + strTime
function matchTimeOf(e) {
  if (e.strTimestamp) {
    const d = new Date(e.strTimestamp + (e.strTimestamp.endsWith('Z') ? '' : 'Z'));
    if (!isNaN(d)) return d;
  }
  if (e.dateEvent) {
    const d = new Date(`${e.dateEvent}T${e.strTime || '00:00:00'}Z`);
    if (!isNaN(d)) return d;
  }
  return null;
}

function statusOf(e) {
  const s = (e.strStatus || '').toUpperCase();
  const hasScore = e.intHomeScore !== null && e.intHomeScore !== '';
  if (/(POSTP|CANC|ABAN)/.test(s) || e.strPostponed === 'yes') return 'canceled';
  if (hasScore || s === 'FT' || s === 'AET' || s === 'PEN') return 'finished';
  if (/(1H|2H|HT|LIVE|IN PLAY|OT)/.test(s)) return 'in_progress';
  return 'scheduled';
}

const toScore = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
};

async function run({ dryRun }) {
  if (!API_KEY) throw new Error('Chýba TSDB_API_KEY');

  const { League, Round, Match, Team } = require('../models');

  // mapa externalId -> Team.id (len klubové/tímové záznamy)
  const allTeams = await Team.findAll({
    attributes: ['id', 'externalId'],
    where: { scope: 'global' },
  });
  const teamByExt = new Map();
  allTeams.forEach((t) => {
    if (t.externalId && !t.externalId.startsWith('p:')) teamByExt.set(t.externalId, t.id);
  });
  console.log(`Tímov v DB (s externalId): ${teamByExt.size}\n`);

  const totals = { leagues: 0, rounds: 0, matches: 0, skipped: 0 };
  const missingTeams = new Set();

  for (const comp of COMPETITIONS) {
    let events;
    try {
      const res = await get(`eventsseason.php?id=${comp.id}&s=${SEASON}`);
      events = res.events || [];
    } catch (e) {
      console.log(`✗ ${comp.name}: ${e.message}`);
      await sleep(RATE_LIMIT_MS);
      continue;
    }
    await sleep(RATE_LIMIT_MS);

    if (!events.length) {
      console.log(`— ${comp.name}: žiadne zápasy pre ${SEASON}`);
      continue;
    }

    const tplName = `${comp.name} ${SEASON}`;

    // existujúca šablóna? (dedup podľa názvu)
    let tpl = await League.findOne({ where: { name: tplName, isTemplate: true } });
    if (!tpl && !dryRun) {
      tpl = await League.create({
        name: tplName,
        description: null,
        type: 'official',
        isTemplate: true,
        seasonId: null,
        creatorId: ADMIN_ID,
        joinCode: await uniqueJoinCode(League),
        password: null,
        hasPassword: false,
        active: true,
        scoringSystem: DEFAULT_SCORING,
        scoringLocked: false,
        templateId: null,
        availableFrom: null,
        availableTo: null,
      });
      totals.leagues++;
    }

    // zoskupenie podľa intRound
    const byRound = new Map();
    for (const e of events) {
      const r = parseInt(e.intRound, 10);
      const key = Number.isFinite(r) && r > 0 ? r : 0;
      if (!byRound.has(key)) byRound.set(key, []);
      byRound.get(key).push(e);
    }

    let rCount = 0;
    let mCount = 0;

    for (const roundNo of [...byRound.keys()].sort((a, b) => a - b)) {
      const evs = byRound
        .get(roundNo)
        .map((e) => ({ e, t: matchTimeOf(e) }))
        .filter((x) => x.t)
        .sort((a, b) => a.t - b.t);

      if (!evs.length) continue;

      const first = evs[0].t;
      const last = evs[evs.length - 1].t;

      // tipovanie: 7 dní pred prvým zápasom -> koniec dňa posledného zápasu
      const startDate = new Date(first.getTime() - 7 * 24 * 60 * 60 * 1000);
      const endDate = new Date(last);
      endDate.setUTCHours(23, 59, 59, 0);

      const roundName = roundNo > 0 ? `${roundNo}. kolo` : 'Ostatné';

      if (dryRun) {
        console.log(
          `  [dry] ${comp.name} — ${roundName}: ${evs.length} zápasov, ${startDate.toISOString().slice(0, 10)} → ${endDate.toISOString().slice(0, 10)}`
        );
        rCount++;
        mCount += evs.length;
        continue;
      }

      let round = await Round.findOne({ where: { leagueId: tpl.id, name: roundName } });
      if (!round) {
        round = await Round.create({
          name: roundName,
          description: null,
          leagueId: tpl.id,
          startDate,
          endDate,
          active: true,
        });
        rCount++;
      }

      for (const { e, t } of evs) {
        const homeId = teamByExt.get(String(e.idHomeTeam));
        const awayId = teamByExt.get(String(e.idAwayTeam));

        if (!homeId || !awayId) {
          if (!homeId) missingTeams.add(`${e.idHomeTeam} ${e.strHomeTeam}`);
          if (!awayId) missingTeams.add(`${e.idAwayTeam} ${e.strAwayTeam}`);
          totals.skipped++;
          continue;
        }

        const exists = await Match.findOne({
          where: { roundId: round.id, homeTeamId: homeId, awayTeamId: awayId },
        });
        if (exists) {
          totals.skipped++;
          continue;
        }

        await Match.create({
          roundId: round.id,
          homeTeamId: homeId,
          awayTeamId: awayId,
          matchTime: t,
          homeScore: toScore(e.intHomeScore),
          awayScore: toScore(e.intAwayScore),
          status: statusOf(e),
          tipType: 'exact_score',
          sourceMatchId: null,
        });
        mCount++;
      }
    }

    totals.rounds += rCount;
    totals.matches += mCount;

    console.log(`✓ ${comp.name}: ${byRound.size} kôl, ${mCount} zápasov`);
  }

  console.log('\n──────────────────────────────');
  console.log(`Šablón vytvorených : ${totals.leagues}`);
  console.log(`Kôl vytvorených    : ${totals.rounds}`);
  console.log(`Zápasov vytvorených: ${totals.matches}`);
  console.log(`Preskočených       : ${totals.skipped}`);
  console.log('──────────────────────────────');

  if (missingTeams.size) {
    console.log('\n⚠ Chýbajúce tímy v DB (zápasy preskočené):');
    [...missingTeams].sort().forEach((t) => console.log(`  ${t}`));
  }
}

if (require.main === module) {
  const db = require('../models');
  db.sequelize
    .authenticate()
    .then(() => run({ dryRun: process.argv.includes('--dry-run') }))
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Zlyhalo:', err.message);
      process.exit(1);
    });
}

module.exports = { run };