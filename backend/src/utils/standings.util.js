// backend/src/utils/standings.util.js
//
// Agregácie pre rebríčky a počty — počítané v SQL namiesto načítania všetkých
// tipov do pamäte a ich sčítania v JS.
//
// PREČO: pôvodne každá stránka s rebríčkom načítala VŠETKY tipy ligy/sezóny
// (aj s join-mi na zápas, kolo, používateľa) a sčítala ich v JS. Pri desiatkach
// tisíc tipov to boli stovky ms až sekundy na request. SUM/COUNT ... GROUP BY
// nad indexovanými stĺpcami vráti to isté za zlomok času.
//
// Výsledky sú zhodné s pôvodnou logikou:
//   points    = SUM(tips.points)
//   evaluated = počet tipov na zápasy so stavom 'finished'
//   weightSum = súčet „kvality tipu" (viď accuracy.util.tipQualityWeight —
//               SQL výraz nižšie je jej presný ekvivalent)

const { sequelize, Sequelize } = require('../models');
const { QueryTypes } = Sequelize;

// SQL ekvivalent accuracy.util.tipQualityWeight(tip, match)
const WEIGHT_SQL = `(
  CASE
    WHEN m.home_score IS NULL OR m.away_score IS NULL THEN 0
    WHEN m.tip_type IN ('winner','winner_no_draw') THEN
      CASE WHEN t.winner = (CASE WHEN m.home_score > m.away_score THEN 'home'
                                 WHEN m.home_score < m.away_score THEN 'away'
                                 ELSE 'draw' END) THEN 1 ELSE 0 END
    WHEN t.home_score IS NULL OR t.away_score IS NULL THEN 0
    WHEN t.home_score = m.home_score AND t.away_score = m.away_score THEN 1
    WHEN SIGN(t.home_score - t.away_score) = SIGN(m.home_score - m.away_score) THEN 0.5
    WHEN (t.home_score - t.away_score) = (m.home_score - m.away_score) THEN 0.25
    WHEN t.home_score = m.home_score OR t.away_score = m.away_score THEN 0.25
    ELSE 0
  END)`;

const ids = (arr) => [...new Set((arr || []).map(Number).filter(Number.isFinite))];

function select(sql, replacements) {
  return sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
}

function toRow(r) {
  return {
    userId: Number(r.userId),
    points: Number(r.points) || 0,
    tips: Number(r.tips) || 0,
    evaluated: Number(r.evaluated) || 0,
    weightSum: Number(r.weightSum) || 0,
    exact: Number(r.exact) || 0,
  };
}

// Vážená presnosť v % (alebo null, ak hráč nemá vyhodnotené tipy).
function accuracyOf(row) {
  return row && row.evaluated > 0 ? Math.round((row.weightSum / row.evaluated) * 100) : null;
}

/**
 * Rebríček (body + presnosť na hráča) pre danú množinu tipov.
 *
 * Filtre (stačí jeden, kombinovať sa dajú):
 *   leagueIds, roundIds, seasonId, matchIds, userIds
 *   finishedOnly   – len tipy na vyhodnotené zápasy
 *   roundEndFrom   – len kolá s endDate >= dátum
 *   groupBy        – 'user' (predvolené) alebo 'league' (vráti aj leagueId)
 *
 * Vracia pole zoradené podľa bodov zostupne.
 */
async function standings(opts = {}) {
  const where = [];
  const rep = [];
  let needLeague = false;

  if (opts.leagueIds) {
    const l = ids(opts.leagueIds);
    if (!l.length) return [];
    where.push('r.league_id IN (?)'); rep.push(l);
  }
  if (opts.roundIds) {
    const r = ids(opts.roundIds);
    if (!r.length) return [];
    where.push('m.round_id IN (?)'); rep.push(r);
  }
  if (opts.matchIds) {
    const m = ids(opts.matchIds);
    if (!m.length) return [];
    where.push('t.match_id IN (?)'); rep.push(m);
  }
  if (opts.userIds) {
    const u = ids(opts.userIds);
    if (!u.length) return [];
    where.push('t.user_id IN (?)'); rep.push(u);
  }
  if (opts.seasonId != null) {
    needLeague = true;
    where.push('l.season_id = ?'); rep.push(Number(opts.seasonId));
  }
  if (opts.finishedOnly) where.push("m.status = 'finished'");
  if (opts.roundEndFrom) { where.push('r.end_date >= ?'); rep.push(opts.roundEndFrom); }
  if (opts.roundEndBefore) { where.push('r.end_date < ?'); rep.push(opts.roundEndBefore); }
  if (opts.matchTimeFrom) { where.push('m.match_time >= ?'); rep.push(opts.matchTimeFrom); }

  const byLeague = opts.groupBy === 'league';
  const sql = `
    SELECT ${byLeague ? 'r.league_id AS leagueId,' : ''}
           t.user_id AS userId,
           COALESCE(SUM(t.points), 0) AS points,
           COUNT(*) AS tips,
           SUM(CASE WHEN m.status = 'finished' THEN 1 ELSE 0 END) AS evaluated,
           SUM(CASE WHEN m.status = 'finished' THEN ${WEIGHT_SQL} ELSE 0 END) AS weightSum,
           SUM(CASE WHEN m.status = 'finished' AND m.tip_type = 'exact_score'
                     AND t.home_score = m.home_score AND t.away_score = m.away_score THEN 1 ELSE 0 END) AS exact
      FROM tips t
      JOIN matches m ON m.id = t.match_id
      JOIN rounds r ON r.id = m.round_id
      ${needLeague ? 'JOIN leagues l ON l.id = r.league_id' : ''}
     ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     GROUP BY ${byLeague ? 'r.league_id, ' : ''}t.user_id
     ORDER BY points DESC, t.user_id ASC`;

  const rows = await select(sql, rep);
  return rows.map((r) => (byLeague ? { leagueId: Number(r.leagueId), ...toRow(r) } : toRow(r)));
}

/**
 * Rebríček aj s údajmi používateľov: [{ user, totalPoints, tipsCount,
 * evaluated, weightSum, accuracy }] zoradený podľa bodov. Hráči, ktorí už
 * neexistujú, sa vynechajú (rovnako ako pôvodné `if (!tip.User) return`).
 */
const USER_ATTRS = ['id', 'username', 'firstName', 'lastName', 'role', 'profileImage'];
async function leaderboardWithUsers(opts, userAttrs = USER_ATTRS) {
  const rows = await standings(opts);
  if (!rows.length) return [];
  const { User } = require('../models');
  const users = await User.findAll({
    where: { id: rows.map((r) => r.userId) },
    attributes: [...new Set(['id', ...userAttrs])],
  });
  const byId = new Map(users.map((u) => [u.id, u.toJSON()]));
  return rows.filter((r) => byId.has(r.userId)).map((r) => ({
    user: byId.get(r.userId),
    totalPoints: r.points,
    tipsCount: r.tips,
    evaluated: r.evaluated,
    weightSum: r.weightSum,
    accuracy: accuracyOf(r),
    exact: r.exact,
  }));
}

/**
 * Body hráčov z tipov na zápasy, ktorých kolo skončilo pred `before`
 * (používa sa na „skokanov týždňa" — stav rebríčka spred týždňa).
 */
async function pointsBefore({ leagueIds, roundEndFrom, before }) {
  const l = ids(leagueIds);
  if (!l.length) return new Map();
  const rows = await select(`
    SELECT t.user_id AS userId, COALESCE(SUM(t.points), 0) AS points
      FROM tips t
      JOIN matches m ON m.id = t.match_id
      JOIN rounds r ON r.id = m.round_id
     WHERE r.league_id IN (?) AND m.status = 'finished'
       AND r.end_date >= ? AND r.end_date < ?
     GROUP BY t.user_id`, [l, roundEndFrom, before]);
  return new Map(rows.map((r) => [Number(r.userId), Number(r.points) || 0]));
}

/**
 * Počty pre zoznamy sezón — 3 dotazy pre VŠETKY sezóny naraz (namiesto 2–5
 * dotazov na každú sezónu).
 * Vracia Map(seasonId → { leaguesCount, participantsCount, matchesCount }).
 */
async function seasonCounts(seasonIds, { matches = false } = {}) {
  const s = ids(seasonIds);
  const out = new Map(s.map((id) => [id, { leaguesCount: 0, participantsCount: 0, matchesCount: 0 }]));
  if (!s.length) return out;

  const [leagues, members, matchRows] = await Promise.all([
    select('SELECT season_id AS id, COUNT(*) AS n FROM leagues WHERE season_id IN (?) GROUP BY season_id', [s]),
    select('SELECT season_id AS id, COUNT(*) AS n FROM user_seasons WHERE season_id IN (?) GROUP BY season_id', [s]),
    matches
      ? select(`SELECT l.season_id AS id, COUNT(*) AS n
                  FROM matches m JOIN rounds r ON r.id = m.round_id JOIN leagues l ON l.id = r.league_id
                 WHERE l.season_id IN (?) GROUP BY l.season_id`, [s])
      : Promise.resolve([]),
  ]);
  for (const r of leagues) out.get(Number(r.id)).leaguesCount = Number(r.n);
  for (const r of members) out.get(Number(r.id)).participantsCount = Number(r.n);
  for (const r of matchRows) out.get(Number(r.id)).matchesCount = Number(r.n);
  return out;
}

/**
 * Počty kôl na ligu: Map(leagueId → { total, played }) — played = kolá,
 * ktorých uzávierka (endDate) už prešla.
 */
async function roundCounts(leagueIds, now = new Date()) {
  const l = ids(leagueIds);
  const out = new Map();
  if (!l.length) return out;
  const rows = await select(`
    SELECT league_id AS id, COUNT(*) AS total,
           SUM(CASE WHEN end_date IS NOT NULL AND end_date < ? THEN 1 ELSE 0 END) AS played
      FROM rounds WHERE league_id IN (?) GROUP BY league_id`, [now, l]);
  for (const r of rows) out.set(Number(r.id), { total: Number(r.total) || 0, played: Number(r.played) || 0 });
  return out;
}

// Jednoduchá krátkodobá cache v pamäti procesu (napr. pre globálne počty na
// úvodnej stránke). Platnosť v ms; invalidate() ju vyprázdni (po vyhodnotení).
const memo = new Map();
async function cached(key, ttlMs, fn) {
  const hit = memo.get(key);
  if (hit && hit.until > Date.now()) return hit.value;
  const value = await fn();
  memo.set(key, { value, until: Date.now() + ttlMs });
  return value;
}
function invalidate(prefix) {
  if (!prefix) { memo.clear(); markPrecomputedStale(); return; }
  for (const k of memo.keys()) if (k.startsWith(prefix)) memo.delete(k);
}

// ── VOPRED PREPOČÍTANÉ VEĽKÉ REBRÍČKY ───────────────────────────────────────
//
// Rebríčky s tisíckami tipov (celkový rebríček, oficiálne ligy a sezóny) sa
// nepočítajú pri každom otvorení stránky. Výsledok sa drží v pamäti a:
//   • po vyhodnotení zápasu (invalidate) sa označí ako zastaraný a o pár
//     sekúnd sa na pozadí prepočíta (PRECOMPUTE_DELAY_MS),
//   • pre istotu sa všetky používané rebríčky prepočítajú raz za hodinu,
//   • kým beží prepočet, stránka dostane posledný hotový výsledok — nikto
//     nečaká na výpočet (okrem úplne prvého otvorenia po štarte servera).
// Komunitné ligy (málo hráčov) sa počítajú živo pri každom otvorení.
const PRECOMPUTE_DELAY_MS = Number(process.env.PRECOMPUTE_DELAY_MS || 15000);
const PRECOMPUTE_MAX_AGE = 60 * 60 * 1000;     // hodinový prepočet
const PRECOMPUTE_KEEP = 48 * 60 * 60 * 1000;   // nepoužívané dlhšie → zahodiť
const PRECOMPUTE_MAX_KEYS = 400;
const big = new Map();   // key → { value, at, stale, pending, fn, used }
let warmTimer = null;

function refreshKey(key, entry) {
  if (entry.pending) return entry.pending;
  entry.pending = (async () => {
    try {
      const value = await entry.fn();
      entry.value = value;
      entry.hasValue = true;
      entry.at = Date.now();
      entry.stale = false;
      return value;
    } finally {
      entry.pending = null;
    }
  })();
  entry.pending.catch((e) => {
    console.error(`[standings] prepočet ${key} zlyhal:`, e.message);
    if (!entry.hasValue) big.delete(key);
  });
  return entry.pending;
}

// Vráti vopred prepočítaný výsledok. fn musí byť samostatná (časové hranice
// si počíta sama), aby sa dala neskôr zavolať znova na pozadí.
function precomputed(key, fn) {
  let e = big.get(key);
  if (!e) {
    if (big.size >= PRECOMPUTE_MAX_KEYS) {
      // vyhoď najdlhšie nepoužitý
      let oldest = null;
      for (const [k, v] of big) if (!v.pending && (!oldest || v.used < oldest[1].used)) oldest = [k, v];
      if (oldest) big.delete(oldest[0]);
    }
    e = { fn, used: Date.now(), stale: false, hasValue: false };
    big.set(key, e);
  }
  e.fn = fn;
  e.used = Date.now();
  if (e.hasValue) {
    if (e.stale || Date.now() - e.at > PRECOMPUTE_MAX_AGE) refreshKey(key, e).catch(() => {});
    return Promise.resolve(e.value);
  }
  return refreshKey(key, e);
}

// Po vyhodnotení: všetko označ ako zastarané a po krátkej pauze prepočítaj
// (viac vyhodnotení za sebou → jeden prepočet).
function markPrecomputedStale() {
  for (const e of big.values()) e.stale = true;
  if (warmTimer) clearTimeout(warmTimer);
  warmTimer = setTimeout(() => { warmTimer = null; warmAll(true).catch(() => {}); }, PRECOMPUTE_DELAY_MS);
  if (warmTimer.unref) warmTimer.unref();
}

async function warmAll(onlyStale) {
  const now = Date.now();
  for (const [key, e] of [...big]) {
    if (now - e.used > PRECOMPUTE_KEEP) { big.delete(key); continue; }
    if (onlyStale && !e.stale && now - (e.at || 0) < PRECOMPUTE_MAX_AGE) continue;
    try { await refreshKey(key, e); } catch (err) { /* zalogované v refreshKey */ }
    await new Promise((r) => setTimeout(r, 50));   // nech prepočet nezahltí server
  }
}

const hourly = setInterval(() => { warmAll(false).catch(() => {}); }, PRECOMPUTE_MAX_AGE);
if (hourly.unref) hourly.unref();

// Je liga „veľká" (oficiálna) → rebríček sa berie z vopred prepočítaných.
const officialCache = new Map();
async function officialLeagueIds(ids) {
  const want = ids.filter((id) => !officialCache.has(id));
  if (want.length) {
    const { League, Season } = require('../models');
    const rows = await League.findAll({
      where: { id: want }, attributes: ['id', 'type', 'isTemplate'],
      include: [{ model: Season, attributes: ['type'] }],
    });
    rows.forEach((l) => officialCache.set(l.id, l.type === 'official' || l.isTemplate || !!(l.Season && l.Season.type === 'official')));
  }
  return new Set(ids.filter((id) => officialCache.get(id)));
}

// Rebríček (body, presnosť, presné tipy) pre viac líg naraz: Map(leagueId → rows).
// Oficiálne ligy z vopred prepočítaných rebríčkov, komunitné živo jedným dotazom.
//   opts.weekAgo = true → stav spred týždňa (kolá skončené pred týždňom)
async function leagueStandingsMap(leagueIds, opts = {}) {
  const ids = ids2(leagueIds);
  const out = new Map(ids.map((id) => [id, []]));
  if (!ids.length) return out;
  const official = await officialLeagueIds(ids);
  const live = ids.filter((id) => !official.has(id));
  const weekBound = () => new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const tasks = [...official].map((id) => precomputed(
    `league:${id}:${opts.weekAgo ? 'week' : 'all'}`,
    () => standings(opts.weekAgo ? { leagueIds: [id], roundEndBefore: weekBound() } : { leagueIds: [id] }),
  ).then((rows) => out.set(id, rows)));
  if (live.length) {
    tasks.push(standings({ leagueIds: live, groupBy: 'league', ...(opts.weekAgo ? { roundEndBefore: weekBound() } : {}) })
      .then((rows) => rows.forEach((r) => out.get(r.leagueId).push(r))));
  }
  await Promise.all(tasks);
  return out;
}
const ids2 = (arr) => [...new Set((arr || []).map(Number).filter(Number.isFinite))];

// Vývoj poradia v lige po každom z posledných n odohraných kôl (pre graf).
// Jeden agregovaný dotaz (body hráča po kolách) + kumulatívne poradie v JS —
// namiesto n samostatných výpočtov rebríčka. Výsledok:
//   [{ roundId, ranks: Map(userId → poradie) }, …] od najstaršieho kola.
// Poradie zodpovedá standings(): body zostupne, pri zhode userId vzostupne.
async function computeRankHistory(leagueId, n) {
  const rows = await select(`
    SELECT m.round_id AS roundId, r.end_date AS endDate, t.user_id AS userId,
           COALESCE(SUM(t.points), 0) AS points
      FROM tips t
      JOIN matches m ON m.id = t.match_id
      JOIN rounds r ON r.id = m.round_id
     WHERE r.league_id = ? AND r.end_date <= ?
     GROUP BY m.round_id, r.end_date, t.user_id`, [Number(leagueId), new Date()]);
  // kolá podľa konca; kolá s rovnakým koncom sa započítavajú spolu
  const ends = [...new Set(rows.map((r) => new Date(r.endDate).getTime()))].sort((a, b) => a - b);
  const byEnd = new Map(ends.map((e) => [e, []]));
  rows.forEach((r) => byEnd.get(new Date(r.endDate).getTime()).push(r));
  const total = new Map();
  const out = [];
  ends.forEach((e, idx) => {
    byEnd.get(e).forEach((r) => total.set(Number(r.userId), (total.get(Number(r.userId)) || 0) + (Number(r.points) || 0)));
    if (idx < ends.length - n) return;
    const sorted = [...total.entries()].sort((a, b) => (b[1] - a[1]) || (a[0] - b[0]));
    const ranks = new Map(sorted.map(([uid], i) => [uid, i + 1]));
    out.push({ end: e, ranks });
  });
  return out;
}
async function leagueRankHistory(leagueId, n = 8) {
  const id = Number(leagueId);
  const official = await officialLeagueIds([id]);
  const fn = () => computeRankHistory(id, n);
  return official.has(id) ? precomputed(`rankhist:${id}:${n}`, fn) : fn();
}

// Príprava veľkých rebríčkov hneď po štarte servera (na pozadí, postupne),
// aby ani prvý návštevník po nasadení nečakal na výpočet.
async function warmOfficial() {
  const { League, Season } = require('../models');
  const leagues = await League.findAll({
    where: { ended: false },
    attributes: ['id', 'type', 'isTemplate', 'seasonId'],
    include: [{ model: Season, attributes: ['id', 'type', 'ended'] }],
  });
  const official = leagues.filter((l) => (l.type === 'official' || (l.Season && l.Season.type === 'official'))
    && !(l.Season && l.Season.ended));
  for (const l of official) {
    officialCache.set(l.id, true);
    await leagueStandingsMap([l.id]);
    await leagueStandingsMap([l.id], { weekAgo: true });
    await leagueRankHistory(l.id);
    await new Promise((r) => setTimeout(r, 30));
  }
  const seasonIds = [...new Set(official.map((l) => l.seasonId).filter(Boolean))];
  for (const sid of seasonIds) { await seasonLeaderboard(sid); await new Promise((r) => setTimeout(r, 30)); }
  return official.length;
}

// Rebríček jednej ligy aj s používateľmi (oficiálna → vopred prepočítaný).
async function leagueLeaderboard(leagueId) {
  const id = Number(leagueId);
  const official = await officialLeagueIds([id]);
  const fn = () => leaderboardWithUsers({ leagueIds: [id] });
  return official.has(id) ? precomputed(`leagueU:${id}`, fn) : fn();
}

// Rebríček sezóny aj s používateľmi (oficiálna → vopred prepočítaný).
async function seasonLeaderboard(seasonId) {
  const id = Number(seasonId);
  const { Season } = require('../models');
  const season = await Season.findByPk(id, { attributes: ['id', 'type'] });
  const fn = () => leaderboardWithUsers({ seasonId: id });
  return season && season.type === 'official' ? precomputed(`seasonU:${id}`, fn) : fn();
}

module.exports = {
  WEIGHT_SQL,
  standings,
  leaderboardWithUsers,
  pointsBefore,
  accuracyOf,
  seasonCounts,
  roundCounts,
  cached,
  invalidate,
  precomputed,
  leagueStandingsMap,
  leagueLeaderboard,
  seasonLeaderboard,
  leagueRankHistory,
  warmOfficial,
  officialLeagueIds,
};
