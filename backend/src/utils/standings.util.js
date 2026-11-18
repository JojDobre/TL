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

  const byLeague = opts.groupBy === 'league';
  const sql = `
    SELECT ${byLeague ? 'r.league_id AS leagueId,' : ''}
           t.user_id AS userId,
           COALESCE(SUM(t.points), 0) AS points,
           COUNT(*) AS tips,
           SUM(CASE WHEN m.status = 'finished' THEN 1 ELSE 0 END) AS evaluated,
           SUM(CASE WHEN m.status = 'finished' THEN ${WEIGHT_SQL} ELSE 0 END) AS weightSum
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
  if (!prefix) { memo.clear(); return; }
  for (const k of memo.keys()) if (k.startsWith(prefix)) memo.delete(k);
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
};
