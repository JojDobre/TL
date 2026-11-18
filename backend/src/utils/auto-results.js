// backend/src/utils/auto-results.js
//
// AUTOMATICKÉ VÝSLEDKY A PROGRAM ZÁPASOV (TheSportsDB, bezplatný kľúč)
//
// Čo robí:
//   1) SYNCHRONIZÁCIA PROGRAMU — pre oficiálne ligy/šablóny prepojené so
//      súťažou v TheSportsDB pravidelne načíta aktuálne a najbližšie kolá:
//        • vytvorí chýbajúce kolá a zápasy (aj v klonoch šablóny),
//        • upraví čas zápasu, keď sa preloží,
//        • chýbajúce tímy založí ako globálne tímy a doplní do súpisky ligy.
//      Voliteľne naimportuje celú sezónu — postupne, po pár kolách na beh.
//   2) VÝSLEDKY — zápasy, od ktorých začiatku uplynulo AUTO_RESULTS_DELAY_MIN
//      (predvolene 180 min = 3 hodiny), sa vyhodnotia výsledkom z TheSportsDB
//      tou istou logikou ako ručné vyhodnotenie (body, klony, notifikácie).
//
// Šetrenie limitom bezplatného API:
//   • jeden request = celé kolo (eventsround), nie request na zápas,
//   • každý beh má rozpočet requestov (AUTO_RESULTS_MAX_REQUESTS),
//     čo sa nestihne, dokončí sa v ďalšom behu (najstaršie zápasy prvé),
//   • pri prekročení limitu (429) / výpadku sa beh zastaví a ďalší pokus príde
//     po čakaní, ktoré sa pri opakovaní predlžuje (2, 4, 8 … max 60 min),
//   • zápas bez výsledku sa skúša znova s rastúcim odstupom (15 min → 6 h).
//
// Ručný zásah má vždy prednosť: ručne zadaný výsledok sa neprepisuje, ručne
// vymazaný výsledok vypne automatické vyhodnotenie daného zápasu.
//
// .env (všetko voliteľné):
//   AUTO_RESULTS_ENABLED=true         – vypínač celej funkcie
//   AUTO_RESULTS_INTERVAL_MIN=10      – ako často beží
//   AUTO_RESULTS_DELAY_MIN=180        – po koľkých minútach od začiatku hľadať výsledok
//   AUTO_RESULTS_MAX_REQUESTS=20      – max. requestov na TheSportsDB za jeden beh
//   AUTO_RESULTS_ALERT_HOURS=24       – po koľkých hodinách bez výsledku upozorniť admina
//   AUTO_SYNC_HOURS=6                 – ako často synchronizovať program ligy
//   AUTO_SYNC_AHEAD_ROUNDS=3          – koľko kôl dopredu udržiavať
//   AUTO_ROUND_OPEN_DAYS=7            – koľko dní pred 1. zápasom sa nové kolo otvorí

const tsdb = require('../services/thesportsdb');
const {
  League, Round, Match, Team, LeagueTeam, Season, User, Sequelize,
} = require('../models');
const { applyResult, loadForEvaluation } = require('./match-evaluation');
const {
  propagateRoundCreate, propagateRoundSchedule, propagateMatchTime, propagateMatchCreate,
} = require('./round-propagate.util');
const notify = require('./notification.service');

const { Op } = Sequelize;

const SOURCE = 'thesportsdb';
const num = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : d);
const CFG = {
  enabled: String(process.env.AUTO_RESULTS_ENABLED || 'true').toLowerCase() !== 'false',
  intervalMin: num(process.env.AUTO_RESULTS_INTERVAL_MIN, 10),
  delayMin: num(process.env.AUTO_RESULTS_DELAY_MIN, 180),
  maxRequests: num(process.env.AUTO_RESULTS_MAX_REQUESTS, 20),
  alertHours: num(process.env.AUTO_RESULTS_ALERT_HOURS, 24),
  syncHours: num(process.env.AUTO_SYNC_HOURS, 6),
  aheadRounds: num(process.env.AUTO_SYNC_AHEAD_ROUNDS, 3),
  openDays: num(process.env.AUTO_ROUND_OPEN_DAYS, 7),
  importPerRun: 4,             // koľko kôl naimportovať pri importe celej sezóny za beh
  pauseMs: num(process.env.AUTO_RESULTS_PAUSE_MS, 300),  // pauza medzi vyhodnoteniami
  maxEvaluatePerRun: num(process.env.AUTO_RESULTS_MAX_EVALUATE, 40), // strop vyhodnotení za beh
};

const MIN = 60 * 1000;
const HOUR = 60 * MIN;

// ── stav procesu (v pamäti) ─────────────────────────────────────────────────
const state = {
  running: false,
  backoffUntil: 0,
  backoffLevel: 0,
  lastRunAt: null,
  lastError: null,
  lastSummary: null,
};

class BudgetExhausted extends Error {}

class Budget {
  constructor(n) { this.left = n; this.used = 0; }
  take() {
    if (this.left <= 0) throw new BudgetExhausted('rozpočet requestov vyčerpaný');
    this.left -= 1; this.used += 1;
  }
}

// Request na poskytovateľa cez rozpočet; chyba poskytovateľa nastaví čakanie.
async function call(budget, fn) {
  if (Date.now() < state.backoffUntil) throw new BudgetExhausted('čakám po prekročení limitu');
  budget.take();
  try {
    const r = await fn();
    state.backoffLevel = 0;
    return r;
  } catch (e) {
    if (e instanceof tsdb.ProviderError) {
      state.backoffLevel = Math.min(state.backoffLevel + 1, 6);
      const waitMin = Math.min(60, 2 ** state.backoffLevel);
      state.backoffUntil = Date.now() + waitMin * MIN;
      state.lastError = `${e.message} — ďalší pokus o ${waitMin} min`;
      console.warn(`[auto-results] ${state.lastError}`);
      throw new BudgetExhausted(e.message);
    }
    throw e;
  }
}

// odstup ďalšieho pokusu o výsledok podľa počtu neúspešných pokusov
function retryDelayMs(attempts) {
  if (attempts <= 0) return 0;
  return Math.min(6 * HOUR, 15 * MIN * (2 ** (attempts - 1)));
}

const norm = (s) => String(s || '').toLowerCase()
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\b(fc|cf|sc|ac|afc|hc|hk|fk|sk|club|de|the)\b/g, '')
  .replace(/[^a-z0-9]/g, '');

// Liga smie mať automatické výsledky: prepojená, nie je klon (klony dedia).
function linkedLeagueWhere(extra = {}) {
  return {
    externalSource: SOURCE,
    externalLeagueId: { [Op.ne]: null },
    templateId: null,
    ...extra,
  };
}

// ── tímy ─────────────────────────────────────────────────────────────────────

async function ensureTeam(extId, name, badge, sport, country, cache) {
  if (!extId) return null;
  if (cache.has(extId)) return cache.get(extId);
  let team = await Team.findOne({ where: { externalId: extId } });
  if (!team) {
    team = await Team.create({
      name: name || `Tím ${extId}`,
      logo: badge || null,
      scope: 'global',
      teamType: 'club',
      sport: tsdb.sportCode(sport),
      country: country || null,
      externalId: extId,
    });
  }
  cache.set(extId, team);
  return team;
}

async function ensureRoster(leagueId, teamIds) {
  for (const teamId of teamIds) {
    // eslint-disable-next-line no-await-in-loop
    await LeagueTeam.findOrCreate({ where: { leagueId, teamId }, defaults: { leagueId, teamId } });
  }
}

// najčastejší typ tipovania v lige (nové zápasy dostanú rovnaký)
async function defaultTipType(leagueId) {
  const rows = await Match.findAll({
    attributes: ['tipType', [Sequelize.fn('COUNT', Sequelize.col('Match.id')), 'n']],
    include: [{ model: Round, attributes: [], where: { leagueId }, required: true }],
    group: ['tipType'],
    raw: true,
  });
  rows.sort((a, b) => Number(b.n) - Number(a.n));
  return rows.length ? rows[0].tipType : 'exact_score';
}

// Zmena času zápasu (+ klony). Kolo sa podľa potreby predĺži.
async function moveMatch(match, round, league, newTime) {
  match.matchTime = newTime;
  await match.save();
  if (league.isTemplate) {
    try { await propagateMatchTime(match); } catch (e) { console.error('[auto-results] propagateMatchTime:', e.message); }
  }
  if (round && new Date(round.endDate) < newTime) {
    round.endDate = endOfRound(newTime);
    await round.save();
    if (league.isTemplate) {
      try { await propagateRoundSchedule(round); } catch (e) { console.error('[auto-results] propagateRoundSchedule:', e.message); }
    }
  }
}

// koniec kola = koniec dňa posledného zápasu (rovnako ako pôvodný import)
function endOfRound(lastKickoff) {
  const d = new Date(lastKickoff);
  d.setUTCHours(23, 59, 59, 0);
  return d;
}

// ── 1) SYNCHRONIZÁCIA PROGRAMU ───────────────────────────────────────────────

async function upsertRound(league, roundNo, events, ctx) {
  const now = ctx.now;
  const evs = events
    .filter((e) => e.time && (!league.externalSeason || !e.season || e.season === league.externalSeason))
    .sort((a, b) => a.time - b.time);
  if (!evs.length) return;

  let round = await Round.findOne({ where: { leagueId: league.id, externalRound: roundNo } })
    || await Round.findOne({ where: { leagueId: league.id, externalRound: null, name: `${roundNo}. kolo` } });

  const first = evs[0].time;
  const last = evs[evs.length - 1].time;
  const upcoming = evs.filter((e) => e.time > now && e.state !== 'canceled');

  if (!round) {
    // nové kolo zakladáme len ak má ešte nejaký zápas na tipovanie
    if (!upcoming.length) return;
    round = await Round.create({
      name: `${roundNo}. kolo`,
      leagueId: league.id,
      startDate: new Date(first.getTime() - CFG.openDays * 24 * HOUR),
      endDate: endOfRound(last),
      active: true,
      externalRound: roundNo,
    });
    ctx.stats.rounds += 1;
    if (league.isTemplate) {
      try { await propagateRoundCreate(round); } catch (e) { console.error('[auto-results] propagateRoundCreate:', e.message); }
    }
  } else if (round.externalRound !== roundNo) {
    round.externalRound = roundNo;
    await round.save();
  }

  // existujúce zápasy kola + zápasy ligy s externým id (zápas mohol presunúť kolo)
  const leagueRoundIds = (await Round.findAll({ where: { leagueId: league.id }, attributes: ['id'] })).map((r) => r.id);
  const byExt = new Map((await Match.findAll({
    where: { roundId: leagueRoundIds, externalId: evs.map((e) => e.id) },
  })).map((m) => [m.externalId, m]));
  const inRound = await Match.findAll({ where: { roundId: round.id } });

  const teamIds = new Set();
  let tipType = null;
  for (const e of evs) {
    const home = await ensureTeam(e.homeTeamExtId, e.homeTeamName, e.homeBadge, e.sport, e.country, ctx.teams);
    const away = await ensureTeam(e.awayTeamExtId, e.awayTeamName, e.awayBadge, e.sport, e.country, ctx.teams);
    if (!home || !away) continue;
    teamIds.add(home.id); teamIds.add(away.id);

    let match = byExt.get(e.id)
      || inRound.find((m) => !m.externalId && m.homeTeamId === home.id && m.awayTeamId === away.id);

    if (match) {
      if (!match.externalId) { match.externalId = e.id; await match.save(); }
      // preložený zápas: uprav čas (len kým nie je vyhodnotený)
      if (match.status === 'scheduled' && match.resultSource !== 'manual'
        && Math.abs(new Date(match.matchTime) - e.time) > MIN) {
        await moveMatch(match, round, league, e.time);
        ctx.stats.moved += 1;
      }
      continue;
    }

    // nový zápas — len budúci (odohraté zápasy sa už tipovať nedajú)
    if (e.time <= now || e.state === 'canceled') continue;
    if (!tipType) tipType = await defaultTipType(league.id);
    match = await Match.create({
      roundId: round.id,
      homeTeamId: home.id,
      awayTeamId: away.id,
      matchTime: e.time,
      tipType,
      status: 'scheduled',
      externalId: e.id,
    });
    ctx.stats.matches += 1;
    if (league.isTemplate) {
      try { await propagateMatchCreate(match, round); } catch (err) { console.error('[auto-results] propagateMatchCreate:', err.message); }
    }
  }

  if (teamIds.size) await ensureRoster(league.id, [...teamIds]);

  // kolo, ktoré sa ešte neotvorilo, prispôsob termínom zápasov
  if (new Date(round.startDate) > now) {
    const newStart = new Date(first.getTime() - CFG.openDays * 24 * HOUR);
    const newEnd = endOfRound(last);
    if (+newStart !== +new Date(round.startDate) || +newEnd !== +new Date(round.endDate)) {
      round.startDate = newStart < now ? now : newStart;
      round.endDate = newEnd;
      await round.save();
      if (league.isTemplate) {
        try { await propagateRoundSchedule(round); } catch (e) { console.error('[auto-results] propagateRoundSchedule:', e.message); }
      }
    }
  }
}

async function syncLeague(league, budget, now) {
  const ctx = { now, teams: new Map(), stats: { rounds: 0, matches: 0, moved: 0 } };
  const extId = league.externalLeagueId;
  const roundsToFetch = new Set();

  // aktuálne kolo podľa najbližšieho zápasu súťaže
  let current = null;
  const next = await call(budget, () => tsdb.nextLeagueEvent(extId));
  if (next && next.round && (!league.externalSeason || next.season === league.externalSeason)) current = next.round;
  if (current) {
    for (let r = Math.max(1, current - 1); r <= current + CFG.aheadRounds; r++) roundsToFetch.add(r);
  }
  // import celej sezóny — postupne od kurzora. Odohrané kolá nemá zmysel
  // sťahovať (zápasy v minulosti sa nezakladajú), preto import začína hneď za
  // oknom okolo aktuálneho kola.
  let cursor = league.externalSyncCursor;
  if (cursor && current && cursor <= current + CFG.aheadRounds) cursor = current + CFG.aheadRounds + 1;
  const importRounds = new Set();
  if (cursor) for (let r = cursor; r < cursor + CFG.importPerRun; r++) importRounds.add(r);

  let newCursor = cursor;
  for (const r of [...new Set([...roundsToFetch, ...importRounds])].sort((a, b) => a - b)) {
    const events = await call(budget, () => tsdb.eventsRound(extId, r, league.externalSeason));
    await upsertRound(league, r, events, ctx);
    if (importRounds.has(r)) {
      // prázdne kolo = koniec sezóny → import hotový
      newCursor = (!events.length || r >= 200) ? null : r + 1;
      // priebežne ulož, aby sa po prerušení (limit API) pokračovalo tu
      league.externalSyncCursor = newCursor;
      await league.save({ fields: ['externalSyncCursor'] });
      if (newCursor === null) break;
    }
  }

  const s = ctx.stats;
  league.externalSyncCursor = newCursor;
  league.externalSyncedAt = now;
  league.externalSyncNote = `Synchronizované: ${s.rounds} nových kôl, ${s.matches} nových zápasov, `
    + `${s.moved} preložených${newCursor ? ` · import sezóny pokračuje od ${newCursor}. kola` : ''}`;
  await league.save();
  return s;
}

async function syncDueLeagues(budget, now) {
  const leagues = await League.findAll({
    where: {
      ...linkedLeagueWhere({ autoSyncFixtures: true, ended: false }),
      [Op.or]: [
        { externalSyncedAt: null },
        { externalSyncedAt: { [Op.lte]: new Date(now - CFG.syncHours * HOUR) } },
        { externalSyncCursor: { [Op.ne]: null } },
      ],
    },
    order: [['externalSyncedAt', 'ASC']],
  });
  for (const league of leagues) {
    try {
      await syncLeague(league, budget, now);
    } catch (e) {
      if (e instanceof BudgetExhausted) throw e;
      league.externalSyncNote = `Chyba synchronizácie: ${e.message}`.slice(0, 500);
      league.externalSyncedAt = now;
      await league.save();
      console.error(`[auto-results] sync ligy ${league.id}:`, e.message);
    }
  }
}

// ── 2) VÝSLEDKY ──────────────────────────────────────────────────────────────

function findEvent(match, events, teamExtById) {
  if (match.externalId) {
    const e = events.find((x) => x.id === match.externalId);
    if (e) return e;
  }
  const hExt = teamExtById.get(match.homeTeamId);
  const aExt = teamExtById.get(match.awayTeamId);
  if (hExt && aExt) {
    const e = events.find((x) => x.homeTeamExtId === hExt && x.awayTeamExtId === aExt);
    if (e) return e;
  }
  // záloha podľa názvov tímov (manuálne pridané tímy bez externého id)
  const hn = norm(match.homeTeam && match.homeTeam.name);
  const an = norm(match.awayTeam && match.awayTeam.name);
  if (hn && an) {
    return events.find((x) => norm(x.homeTeamName) === hn && norm(x.awayTeamName) === an) || null;
  }
  return null;
}

async function markAttempt(match, now, note) {
  match.autoAttempts = (match.autoAttempts || 0) + 1;
  match.autoCheckedAt = now;
  await match.save({ fields: ['autoAttempts', 'autoCheckedAt'] });
  if (note) console.log(`[auto-results] zápas ${match.id}: ${note}`);
}

// Spracuje jeden zápas podľa udalosti z TheSportsDB. Vracia 'done' | 'wait'.
async function handleMatch(match, event, now, problems) {
  const league = match.Round.League;
  if (!event) { await markAttempt(match, now); return 'wait'; }

  if (!match.externalId) {
    match.externalId = event.id;
    await match.save({ fields: ['externalId'] });
  }

  let st = event.state;
  // bez stavu, ale so skóre dlho po začiatku → odohraté
  if (st === 'scheduled' && event.homeScore !== null && event.awayScore !== null
    && event.time && now - event.time > CFG.delayMin * MIN) st = 'finished';

  if (st === 'finished') {
    if (match.tipType === 'winner_no_draw' && event.homeScore === event.awayScore) {
      problems.push(`${label(match)}: výsledok ${event.homeScore}:${event.awayScore} je remíza, ale zápas je „bez remízy" — zadaj víťaza ručne.`);
      await markAttempt(match, now);
      return 'wait';
    }
    const full = await loadForEvaluation(match.id);
    // medzitým ho mohol niekto vyhodnotiť ručne
    if (!full || !['scheduled', 'in_progress'].includes(full.status) || !full.autoResults) return 'done';
    await applyResult(full, { homeScore: event.homeScore, awayScore: event.awayScore, status: 'finished' }, { source: 'auto' });
    await Match.update({ autoAttempts: 0, autoCheckedAt: now }, { where: { id: match.id } });
    console.log(`[auto-results] vyhodnotený zápas ${match.id} (${label(match)}) ${event.homeScore}:${event.awayScore}`);
    return 'done';
  }

  if (st === 'canceled') {
    const full = await loadForEvaluation(match.id);
    if (!full || !['scheduled', 'in_progress'].includes(full.status) || !full.autoResults) return 'done';
    await applyResult(full, { status: 'canceled' }, { source: 'auto' });
    console.log(`[auto-results] zrušený zápas ${match.id} (${label(match)})`);
    return 'done';
  }

  // preložený zápas s novým termínom v budúcnosti → posuň čas, výsledok počká
  if (event.time && event.time - new Date(match.matchTime) > HOUR) {
    await moveMatch(match, match.Round, league, event.time);
    match.autoAttempts = 0; match.autoCheckedAt = null;
    await match.save({ fields: ['autoAttempts', 'autoCheckedAt'] });
    console.log(`[auto-results] zápas ${match.id} preložený na ${event.time.toISOString()}`);
    return 'wait';
  }

  if (st === 'problem') {
    problems.push(`${label(match)}: stav „${event.status}" (prerušené/kontumované) — vyhodnoť ručne.`);
  }
  await markAttempt(match, now);
  return 'wait';
}

function label(m) {
  const h = m.homeTeam ? m.homeTeam.name : `#${m.homeTeamId}`;
  const a = m.awayTeam ? m.awayTeam.name : `#${m.awayTeamId}`;
  return `${h} – ${a}`;
}

async function processResults(budget, now) {
  const cutoff = new Date(now - CFG.delayMin * MIN);
  const candidates = await Match.findAll({
    where: {
      status: { [Op.in]: ['scheduled', 'in_progress'] },
      autoResults: true,
      sourceMatchId: null,
      matchTime: { [Op.lte]: cutoff },
    },
    include: [
      {
        model: Round,
        required: true,
        attributes: ['id', 'name', 'leagueId', 'startDate', 'endDate', 'externalRound'],
        include: [{
          model: League,
          required: true,
          where: linkedLeagueWhere({ autoResults: true }),
          attributes: ['id', 'name', 'externalLeagueId', 'externalSeason', 'isTemplate', 'scoringSystem'],
        }],
      },
      { model: Team, as: 'homeTeam', attributes: ['id', 'name', 'externalId'] },
      { model: Team, as: 'awayTeam', attributes: ['id', 'name', 'externalId'] },
    ],
    order: [['matchTime', 'ASC']],
    limit: 1000,
  });

  // len zápasy, ktorým už uplynul odstup od posledného pokusu
  const due = candidates.filter((m) => !m.autoCheckedAt
    || now - new Date(m.autoCheckedAt) >= retryDelayMs(m.autoAttempts || 0));

  // zoskupenie: jeden request na kolo (alebo na zápas, ak číslo kola nepoznáme)
  const groups = new Map();
  for (const m of due) {
    const lg = m.Round.League;
    let roundNo = m.Round.externalRound;
    if (!roundNo) {
      const mm = /^(\d+)\.\s*kolo/i.exec(m.Round.name || '');
      if (mm) roundNo = Number(mm[1]);
    }
    let key; let fetcher;
    if (roundNo && lg.externalSeason) {
      key = `r:${lg.externalLeagueId}:${lg.externalSeason}:${roundNo}`;
      fetcher = () => tsdb.eventsRound(lg.externalLeagueId, roundNo, lg.externalSeason);
    } else if (m.externalId) {
      key = `e:${m.externalId}`;
      fetcher = async () => { const e = await tsdb.lookupEvent(m.externalId); return e ? [e] : []; };
    } else {
      key = `x:${m.id}`;
      fetcher = null;
    }
    if (!groups.has(key)) groups.set(key, { fetcher, matches: [] });
    groups.get(key).matches.push(m);
  }

  const teamExtById = new Map();
  due.forEach((m) => {
    if (m.homeTeam && m.homeTeam.externalId) teamExtById.set(m.homeTeamId, m.homeTeam.externalId);
    if (m.awayTeam && m.awayTeam.externalId) teamExtById.set(m.awayTeamId, m.awayTeam.externalId);
  });

  const stats = { evaluated: 0, waiting: 0, requests: 0 };
  const problems = [];
  for (const { fetcher, matches } of groups.values()) {
    // strop vyhodnotení na jeden beh — veľký nevyhodnotený backlog sa dobehne
    // postupne v ďalších behoch, nie naraz
    if (stats.evaluated >= CFG.maxEvaluatePerRun) break;
    let events = [];
    if (fetcher) {
      events = await call(budget, fetcher);
      stats.requests += 1;
    }
    for (const m of matches) {
      try {
        const r = await handleMatch(m, findEvent(m, events, teamExtById), now, problems);
        if (r === 'done') {
          stats.evaluated += 1;
          // krátka pauza po každom vyhodnotení — web má prednosť pred dobiehaním
          await new Promise((res) => setTimeout(res, CFG.pauseMs));
        } else stats.waiting += 1;
      } catch (e) {
        console.error(`[auto-results] zápas ${m.id}:`, e.message);
        await markAttempt(m, now).catch(() => {});
        stats.waiting += 1;
      }
    }
  }

  await alertAdmins(now, problems);
  return stats;
}

// Upozorni adminov na zápasy, ktoré ani po AUTO_RESULTS_ALERT_HOURS nemajú
// výsledok (alebo majú problém, ktorý treba vyriešiť ručne). Každý zápas raz.
async function alertAdmins(now, problems) {
  const late = await Match.findAll({
    where: {
      status: { [Op.in]: ['scheduled', 'in_progress'] },
      autoResults: true,
      sourceMatchId: null,
      autoAlertedAt: null,
      matchTime: { [Op.lte]: new Date(now - CFG.alertHours * HOUR) },
    },
    include: [
      { model: Round, required: true, attributes: ['id'], include: [{ model: League, required: true, attributes: ['id'], where: linkedLeagueWhere({ autoResults: true }) }] },
      { model: Team, as: 'homeTeam', attributes: ['name'] },
      { model: Team, as: 'awayTeam', attributes: ['name'] },
    ],
    limit: 50,
  });
  const lines = [...problems, ...late.map((m) => `${label(m)}: výsledok sa nepodarilo získať ani po ${CFG.alertHours} h.`)];
  if (!lines.length) return;
  try {
    await notify.adminAutoResultsIssues([...new Set(lines)]);
  } catch (e) {
    console.error('[auto-results] upozornenie adminov:', e.message);
  }
  if (late.length) await Match.update({ autoAlertedAt: now }, { where: { id: late.map((m) => m.id) } });
}

// ── behy ─────────────────────────────────────────────────────────────────────

async function runOnce({ leagueId = null, maxRequests = CFG.maxRequests } = {}) {
  if (state.running) return { skipped: 'running' };
  if (Date.now() < state.backoffUntil) return { skipped: 'backoff', until: new Date(state.backoffUntil) };
  state.running = true;
  const now = new Date();
  const budget = new Budget(maxRequests);
  const summary = { at: now, requests: 0, evaluated: 0, waiting: 0, stoppedEarly: false };
  try {
    if (leagueId) {
      const lg = await League.findOne({ where: linkedLeagueWhere({ id: leagueId }) });
      if (lg && lg.autoSyncFixtures) await syncLeague(lg, budget, now);
    } else {
      await syncDueLeagues(budget, now);
    }
    const r = await processResults(budget, now);
    summary.evaluated = r.evaluated;
    summary.waiting = r.waiting;
  } catch (e) {
    if (e instanceof BudgetExhausted) summary.stoppedEarly = true;
    else { state.lastError = e.message; console.error('[auto-results] beh zlyhal:', e); }
  } finally {
    summary.requests = budget.used;
    state.running = false;
    state.lastRunAt = now;
    state.lastSummary = summary;
  }
  if (summary.requests || summary.evaluated) {
    console.log(`[auto-results] beh: ${summary.requests} req, vyhodnotených ${summary.evaluated}, `
      + `čaká ${summary.waiting}${summary.stoppedEarly ? ' (pokračuje v ďalšom behu)' : ''}`);
  }
  return summary;
}

let timer = null;
function start() {
  if (!CFG.enabled) { console.log('[auto-results] vypnuté (AUTO_RESULTS_ENABLED=false)'); return; }
  if (timer) return;
  setTimeout(() => { runOnce().catch(() => {}); }, 90 * 1000);
  timer = setInterval(() => { runOnce().catch(() => {}); }, Math.max(1, CFG.intervalMin) * MIN);
  if (timer.unref) timer.unref();
  console.log(`[auto-results] spustené — každých ${CFG.intervalMin} min, výsledok ${CFG.delayMin} min po začiatku`);
}

// Stav pre administráciu ligy.
async function leagueStatus(leagueId) {
  const league = await League.findByPk(leagueId);
  if (!league) return null;
  const now = new Date();
  const roundIds = (await Round.findAll({ where: { leagueId }, attributes: ['id'] })).map((r) => r.id);
  const base = { roundId: roundIds, sourceMatchId: null };
  const [waiting, failing, disabled, auto] = roundIds.length ? await Promise.all([
    Match.count({ where: { ...base, status: ['scheduled', 'in_progress'], autoResults: true, matchTime: { [Op.lte]: new Date(now - CFG.delayMin * MIN) } } }),
    Match.count({ where: { ...base, status: ['scheduled', 'in_progress'], autoResults: true, autoAttempts: { [Op.gt]: 0 } } }),
    Match.count({ where: { ...base, autoResults: false, status: ['scheduled', 'in_progress'] } }),
    Match.count({ where: { ...base, resultSource: 'auto' } }),
  ]) : [0, 0, 0, 0];
  return {
    linked: !!(league.externalSource && league.externalLeagueId),
    externalLeagueId: league.externalLeagueId,
    externalSeason: league.externalSeason,
    autoResults: league.autoResults,
    autoSyncFixtures: league.autoSyncFixtures,
    syncedAt: league.externalSyncedAt,
    note: league.externalSyncNote,
    importing: !!league.externalSyncCursor,
    waiting, failing, disabled, autoEvaluated: auto,
    provider: {
      backoffUntil: state.backoffUntil > Date.now() ? new Date(state.backoffUntil) : null,
      lastRunAt: state.lastRunAt,
      lastError: state.lastError,
    },
    config: { delayMin: CFG.delayMin, intervalMin: CFG.intervalMin },
  };
}

module.exports = {
  CFG,
  SOURCE,
  state,
  start,
  runOnce,
  syncLeague,
  processResults,
  leagueStatus,
  retryDelayMs,
  _internal: { findEvent, handleMatch, upsertRound, Budget },
};
