// backend/src/services/thesportsdb.js
//
// Klient pre TheSportsDB (https://www.thesportsdb.com) — bezplatné API
// (verejný kľúč "123", bez registrácie a bez platenia).
//
// LIMITY BEZPLATNÉHO KĽÚČA:
//   • ~30 requestov za minútu — klient preto robí medzi requestami pauzu
//     (TSDB_DELAY_MS, predvolene 3000 ms = 20 req/min, s rezervou),
//   • niektoré endpointy vracajú obmedzený počet záznamov (eventsseason 15,
//     eventsnextleague 1), preto sa program aj výsledky čítajú PO KOLÁCH
//     (eventsround vracia celé kolo).
//
// Pri prekročení limitu (HTTP 429) alebo výpadku vyhodí RateLimitError /
// ProviderError — volajúci (utils/auto-results.js) si zapamätá, dokedy má
// počkať, a pokračuje neskôr tam, kde skončil.
//
// .env:
//   TSDB_API_KEY=123        – vlastný kľúč (Patreon) zvýši limity; predvolene free
//   TSDB_DELAY_MS=3000      – pauza medzi requestami

const https = require('https');

const API_KEY = process.env.TSDB_API_KEY || '123';
const DELAY_MS = Number(process.env.TSDB_DELAY_MS || 3000);
const BASE = `https://www.thesportsdb.com/api/v1/json/${API_KEY}`;
const TIMEOUT_MS = 20000;

class ProviderError extends Error {}
class RateLimitError extends ProviderError {}

let lastRequestAt = 0;
let queue = Promise.resolve();
let requestCount = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function rawGet(pathname) {
  return new Promise((resolve, reject) => {
    const req = https.get(`${BASE}/${pathname}`, { headers: { 'User-Agent': 'tifo-results/1.0' } }, (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { buf += c; });
      res.on('end', () => {
        if (res.statusCode === 429) return reject(new RateLimitError('TheSportsDB: prekročený limit requestov (429)'));
        if (res.statusCode >= 500) return reject(new ProviderError(`TheSportsDB: chyba servera ${res.statusCode}`));
        if (res.statusCode !== 200) return reject(new ProviderError(`TheSportsDB: HTTP ${res.statusCode}`));
        // pri preťažení vracia niekedy HTML namiesto JSON
        try { resolve(JSON.parse(buf)); } catch (e) { reject(new RateLimitError('TheSportsDB: neplatná odpoveď (pravdepodobne limit)')); }
      });
    });
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new ProviderError('TheSportsDB: timeout')));
    req.on('error', (e) => reject(e instanceof ProviderError ? e : new ProviderError(`TheSportsDB: ${e.message}`)));
  });
}

// Všetky requesty idú cez jednu frontu s pauzou → nikdy nepresiahneme limit,
// ani keď beží synchronizácia programu a výsledkov naraz.
function get(pathname) {
  const run = async () => {
    const wait = lastRequestAt + DELAY_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    requestCount++;
    return rawGet(pathname);
  };
  const p = queue.then(run, run);
  queue = p.catch(() => {});
  return p;
}

// ── parsovanie udalostí ──────────────────────────────────────────────────────

// Čas zápasu ako Date (UTC). strTimestamp je UTC bez zóny ("2026-11-08T16:30:00"),
// niekedy so zónou ("…+00:00"). Záloha: dateEvent + strTime (tiež UTC).
function eventTime(e) {
  const ts = e && e.strTimestamp ? String(e.strTimestamp).trim() : '';
  if (ts) {
    const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(ts);
    const d = new Date(hasZone ? ts : `${ts}Z`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (e && e.dateEvent) {
    const t = String(e.strTime || '00:00:00').replace(/([zZ]|[+-]\d{2}:?\d{2})$/, '').slice(0, 8) || '00:00:00';
    const d = new Date(`${e.dateEvent}T${t.length === 5 ? `${t}:00` : t}Z`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

const toScore = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

// Stav udalosti pre naše účely:
//   'finished'  – odohrané, skóre je konečné
//   'live'      – práve sa hrá (výsledok ešte nezapisujeme)
//   'postponed' – odložené (čas sa zmení)
//   'canceled'  – zrušené
//   'problem'   – prerušené / kontumované (vyžaduje rozhodnutie admina)
//   'scheduled' – ešte sa nehralo
function eventState(e) {
  const s = String((e && e.strStatus) || '').trim().toUpperCase();
  const home = toScore(e && e.intHomeScore);
  const away = toScore(e && e.intAwayScore);
  if (e && String(e.strPostponed || '').toLowerCase() === 'yes') return 'postponed';
  if (/^(PST|POSTP|POSTPONED|MATCH POSTPONED|DELAYED|TBD)/.test(s)) return 'postponed';
  if (/^(CANC|CANCELLED|CANCELED|MATCH CANCELLED)/.test(s)) return 'canceled';
  // prerušené / kontumované — automaticky nič nerobíme, rozhodne admin
  if (/^(ABD|ABANDONED|AWD|AWARDED|WO|INT|INTERRUPTED|SUSP)/.test(s)) return 'problem';
  if (/^(FT|AET|PEN|AP|FINISHED|MATCH FINISHED|AOT|AFTER OT|AFTER PENALTIES|ENDED|FINAL|AW)/.test(s)
    || /^(FT|FINAL)\b/.test(s) || s === 'AFTER EXTRA TIME' || s === 'AFTER SO' || s === 'SO') {
    return home !== null && away !== null ? 'finished' : 'scheduled';
  }
  if (/^(1H|2H|HT|ET|BT|LIVE|IN PLAY|Q[1-4]|OT|P[1-3]|BREAK|1ST|2ND|3RD)/.test(s)) return 'live';
  if (/^(NS|NOT STARTED|SCHEDULED|TIME TO BE DEFINED)/.test(s) || s === '') {
    // bez stavu, ale so skóre a dávno po začiatku → berieme ako odohraté
    // (rozhoduje volajúci podľa času, tu len signalizujeme skóre)
    return 'scheduled';
  }
  return home !== null && away !== null ? 'finished' : 'scheduled';
}

function normalizeEvent(e) {
  return {
    id: String(e.idEvent),
    round: Number.isFinite(parseInt(e.intRound, 10)) ? parseInt(e.intRound, 10) : null,
    season: e.strSeason || null,
    time: eventTime(e),
    homeTeamExtId: e.idHomeTeam ? String(e.idHomeTeam) : null,
    awayTeamExtId: e.idAwayTeam ? String(e.idAwayTeam) : null,
    homeTeamName: e.strHomeTeam || '',
    awayTeamName: e.strAwayTeam || '',
    homeBadge: e.strHomeTeamBadge || null,
    awayBadge: e.strAwayTeamBadge || null,
    homeScore: toScore(e.intHomeScore),
    awayScore: toScore(e.intAwayScore),
    status: String(e.strStatus || ''),
    state: eventState(e),
    sport: e.strSport || null,
    country: e.strCountry || null,
  };
}

// ── endpointy ────────────────────────────────────────────────────────────────

async function eventsRound(leagueId, round, season) {
  const q = `eventsround.php?id=${encodeURIComponent(leagueId)}&r=${encodeURIComponent(round)}&s=${encodeURIComponent(season)}`;
  const j = await get(q);
  return (j && Array.isArray(j.events) ? j.events : []).map(normalizeEvent);
}

async function lookupEvent(eventId) {
  const j = await get(`lookupevent.php?id=${encodeURIComponent(eventId)}`);
  const e = j && Array.isArray(j.events) ? j.events[0] : null;
  return e ? normalizeEvent(e) : null;
}

// Najbližší zápas súťaže (free kľúč vráti len 1) — z neho zistíme aktuálne kolo.
async function nextLeagueEvent(leagueId) {
  const j = await get(`eventsnextleague.php?id=${encodeURIComponent(leagueId)}`);
  const e = j && Array.isArray(j.events) ? j.events[0] : null;
  return e ? normalizeEvent(e) : null;
}

async function lastLeagueEvent(leagueId) {
  const j = await get(`eventspastleague.php?id=${encodeURIComponent(leagueId)}`);
  const e = j && Array.isArray(j.events) ? j.events[0] : null;
  return e ? normalizeEvent(e) : null;
}

async function lookupLeague(leagueId) {
  const j = await get(`lookupleague.php?id=${encodeURIComponent(leagueId)}`);
  const l = j && Array.isArray(j.leagues) ? j.leagues[0] : null;
  if (!l) return null;
  return {
    id: String(l.idLeague),
    name: l.strLeague,
    sport: l.strSport,
    country: l.strCountry,
    currentSeason: l.strCurrentSeason || null,
    badge: l.strBadge || null,
  };
}

// Vyhľadanie súťaží podľa krajiny a športu (pre prepojenie v administrácii).
async function searchLeagues(country, sport) {
  const q = `search_all_leagues.php?c=${encodeURIComponent(country || '')}&s=${encodeURIComponent(sport || 'Soccer')}`;
  const j = await get(q);
  const arr = (j && (j.countries || j.countrys || j.leagues)) || [];
  return arr.map((l) => ({
    id: String(l.idLeague), name: l.strLeague, sport: l.strSport, country: l.strCountry,
    currentSeason: l.strCurrentSeason || null,
  }));
}

// TheSportsDB šport → kód športu v appke (utils/team.constants.js)
const SPORT_MAP = {
  soccer: 'football', 'ice hockey': 'hockey', basketball: 'basketball', handball: 'handball',
  volleyball: 'volleyball', tennis: 'tennis', 'american football': 'americanfootball',
  rugby: 'rugby', motorsport: 'motorsport', fighting: 'fighting', cycling: 'cycling',
};
const sportCode = (s) => SPORT_MAP[String(s || '').toLowerCase()] || 'other';

module.exports = {
  eventsRound,
  lookupEvent,
  nextLeagueEvent,
  lastLeagueEvent,
  lookupLeague,
  searchLeagues,
  eventTime,
  eventState,
  normalizeEvent,
  sportCode,
  requestCount: () => requestCount,
  ProviderError,
  RateLimitError,
};
