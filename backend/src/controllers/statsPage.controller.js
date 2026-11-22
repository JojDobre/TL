// backend/src/controllers/statsPage.controller.js
//
// Štatistiky prihláseného hráča (/stats). Agregácia z jeho VYHODNOTENÝCH tipov
// naprieč všetkými ligami. Len reálne dáta; trendy/história poradia (ktoré
// netrackujeme) sa nezobrazujú.

const { Tip, Match, Round, Team, League, User, sequelize, Sequelize } = require('../models');
const { tipQualityWeight } = require('../utils/accuracy.util');
const { asyncHandler } = require('../middleware/error.middleware');
const { cached } = require('../utils/standings.util');
const dt = require('../utils/datetime.util');

const DAY_MS = 24 * 60 * 60 * 1000;
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: dt.TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const dayKey = (d) => dayFmt.format(d);   // YYYY-MM-DD v zóne appky

// Body všetkých hráčov v oficiálnych ligách — agregované v SQL (nie stovky
// tisíc tipov do pamäte servera, to blokovalo celý server). Všetko pred
// 30-dňovým oknom = jeden riadok na hráča (h = 0), v okne po hodinách
// vyhodnotenia (Match.updatedAt). Rovnaké pre všetkých → cache 2 min.
function officialPointsByHour(windowStart) {
  return cached(`stats:rankAgg:${dayKey(windowStart)}`, 2 * 60 * 1000, async () => {
    const rows = await sequelize.query(`
      SELECT t.user_id AS userId,
             CASE WHEN m.updated_at < :start THEN 0 ELSE FLOOR(UNIX_TIMESTAMP(m.updated_at) / 3600) END AS h,
             SUM(t.points) AS points
      FROM tips t
      JOIN matches m ON m.id = t.match_id AND m.status = 'finished'
      JOIN rounds r ON r.id = m.round_id
      JOIN leagues l ON l.id = r.league_id AND l.type = 'official'
      WHERE t.points IS NOT NULL
      GROUP BY t.user_id, h`, { replacements: { start: windowStart }, type: Sequelize.QueryTypes.SELECT });
    return rows.map((r) => ({ userId: Number(r.userId), h: Number(r.h), points: Number(r.points) || 0 }));
  });
}

// VÝVOJ POZÍCIE V REBRÍČKU — posledných 30 dní: pozícia naprieč VŠETKÝMI
// oficiálnymi ligami spolu, z kumulatívnych bodov ku koncu každého dňa.
async function rankProgressOf(meId) {
  const todayKey = dayKey(new Date());
  // začiatok okna: polnoc (v zóne appky) pred 29 dňami — s rezervou o deň
  // skôr, presné rozdelenie podľa dní urobí dayKey nižšie
  const days = [];
  for (let i = 29; i >= 0; i--) days.push(dayKey(new Date(Date.now() - i * DAY_MS)));
  if (days[days.length - 1] !== todayKey) days.push(todayKey);
  const startKey = days[0];
  const windowStart = new Date(Date.now() - 31 * DAY_MS);
  windowStart.setUTCMinutes(0, 0, 0);

  const rows = await officialPointsByHour(windowStart);
  if (!rows.length) return [];
  const cumByUser = new Map();
  const perDay = new Map();   // day -> Map(user -> points)
  rows.forEach((r) => {
    const k = r.h === 0 ? null : dayKey(new Date(r.h * 3600 * 1000));
    if (k === null || k < startKey) { cumByUser.set(r.userId, (cumByUser.get(r.userId) || 0) + r.points); return; }
    if (!perDay.has(k)) perDay.set(k, new Map());
    const m = perDay.get(k);
    m.set(r.userId, (m.get(r.userId) || 0) + r.points);
  });
  const out = [];
  days.slice(-30).forEach((k) => {
    const per = perDay.get(k);
    if (per) per.forEach((p, uid) => cumByUser.set(uid, (cumByUser.get(uid) || 0) + p));
    if (!cumByUser.has(meId)) return;
    const myTotal = cumByUser.get(meId);
    let rank = 1;
    cumByUser.forEach((p) => { if (p > myTotal) rank += 1; });
    out.push({ date: k, rank, points: myTotal, players: cumByUser.size });
  });
  return out;
}

// GET /stats
const statsPage = asyncHandler(async (req, res) => {
  const meId = Number(req.session.userId);
  const me = await User.findByPk(meId, { attributes: ['firstName', 'lastName', 'username'] });
  const displayName = me ? ([me.firstName, me.lastName].filter(Boolean).join(' ') || me.username) : '';
  const username = me ? me.username : '';

  // všetky moje tipy s načítaným zápasom (a kolom kvôli zoskupeniu)
  const tips = await Tip.findAll({
    where: { userId: meId },
    include: [{ model: Match, attributes: ['id', 'status', 'tipType', 'roundId', 'homeScore', 'awayScore'], include: [
      { model: Round, attributes: ['id', 'name', 'endDate', 'leagueId'], include: [{ model: League, attributes: ['id', 'name'] }] },
      { model: Team, as: 'homeTeam', attributes: ['id', 'name', 'logo'] },
      { model: Team, as: 'awayTeam', attributes: ['id', 'name', 'logo'] },
    ] }],
    order: [['createdAt', 'ASC']],
  });

  // Vážená presnosť tipu — cez zdieľanú utilitu (accuracy.util).

  let totalPoints = 0;
  let evaluated = 0;
  let exact = 0;       // presný výsledok (váha 1.0)
  let partial = 0;     // čiastočne trafil (váha 0.25/0.5)
  let zero = 0;        // 0 na vyhodnotenom
  let weightSum = 0;   // súčet váh (pre váženú presnosť)
  const byRound = {};  // roundId -> { name, endDate, points }
  const byTeam = {};   // teamId -> { name, logo, tips, weight }

  function addTeam(team) {
    if (!team) return null;
    if (!byTeam[team.id]) byTeam[team.id] = { name: team.name, logo: team.logo || null, tips: 0, weight: 0 };
    return byTeam[team.id];
  }

  tips.forEach((t) => {
    const m = t.Match;
    if (!m || m.status !== 'finished') return;
    evaluated += 1;
    const p = t.points || 0;
    totalPoints += p;

    const w = tipQualityWeight(t, m);  // 0 / 0.25 / 0.5 / 1.0
    weightSum += w;
    if (w >= 1) exact += 1;
    else if (w > 0) partial += 1;
    else zero += 1;

    if (m.Round) {
      const rid = m.Round.id;
      if (!byRound[rid]) byRound[rid] = { name: m.Round.name, endDate: m.Round.endDate, leagueName: m.Round.League ? m.Round.League.name : '', points: 0 };
      byRound[rid].points += p;
    }

    // úspešnosť per tím — pripočítaj váhu (nie binárne) k obom tímom zápasu
    [m.homeTeam, m.awayTeam].forEach((team) => {
      const rec = addTeam(team);
      if (rec) { rec.tips += 1; rec.weight += w; }
    });
  });

  // vážená presnosť = priemer váh × 100
  const accuracy = evaluated > 0 ? Math.round((weightSum / evaluated) * 100) : null;

  // body za posledných ~12 kôl (zoradené podľa endDate)
  const rounds = Object.values(byRound)
    .sort((a, b) => new Date(a.endDate || 0) - new Date(b.endDate || 0))
    .slice(-12);
  const roundPoints = rounds.map((r) => r.points);
  // ── VÝVOJ POZÍCIE V REBRÍČKU — posledných 30 dní ──────────────────────
  // Pozícia hráča naprieč VŠETKÝMI oficiálnymi ligami spolu (ako leaderboards),
  // počítaná z kumulatívnych bodov ku koncu každého dňa (23:59). Body pribúdajú
  // podľa toho, kedy bol zápas vyhodnotený (Match.updatedAt pre finished zápasy).
  const rankProgress = await rankProgressOf(meId);

  const avgPerRound = roundPoints.length ? (roundPoints.reduce((a, b) => a + b, 0) / roundPoints.length) : 0;
  const bestRound = roundPoints.length ? Math.max(...roundPoints) : 0;
  const playedRoundsCount = Object.keys(byRound).length;

  // TOP TÍMY podľa presnosti (min. 2 tipy, aby % bolo zmysluplné), top 6
  const topTeams = Object.values(byTeam)
    .filter((t) => t.tips >= 2)
    .map((t) => ({ name: t.name, logo: t.logo, tips: t.tips, scored: Math.round(t.weight * 10) / 10, accuracy: Math.round((t.weight / t.tips) * 100) }))
    .sort((a, b) => b.accuracy - a.accuracy || b.tips - a.tips)
    .slice(0, 6);

  res.render('stats', {
    displayName, username,
    stats: {
      totalPoints,
      tipsCount: tips.length,
      evaluated,
      exact, partial, zero,
      accuracy,
      avgPerRound: Math.round(avgPerRound * 10) / 10,
      bestRound,
      playedRoundsCount,
    },
    roundBars: rounds.map((r) => ({ name: r.name, leagueName: r.leagueName || '', endDate: r.endDate, points: r.points })),
    topTeams,
    rankProgress,
  });
});

module.exports = { statsPage };