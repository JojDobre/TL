// backend/src/controllers/appPage.controller.js
//
// Obrazovky MOBILNEJ APLIKÁCIE (/app/*). Používa ich appka z Google Play
// (TWA) a nainštalovaná PWA; web v prehliadači ich nikde neodkazuje.
// Všetky výpočty (body, poradie, uzávierky) sú rovnaké ako na webe — appka
// je len iný vzhľad nad tými istými dátami.

const {
  User, League, Season, Round, Match, Tip, Team, UserLeague, Notification,
  Achievement, UserAchievement, Sequelize,
} = require('../models');
const { asyncHandler } = require('../middleware/error.middleware');
const {
  standings, leaderboardWithUsers, roundCounts, accuracyOf, cached, precomputed, leagueStandingsMap, leagueLeaderboard, officialLeagueIds, leagueRankHistory,
} = require('../utils/standings.util');
const { isLeagueLocked } = require('../utils/league.utils');
const { seasonStatus } = require('../utils/season.utils');
const dt = require('../utils/datetime.util');

const { Op } = Sequelize;
const DAY = 24 * 3600 * 1000;
const TZ = dt.TZ;

// ── pomocné ──────────────────────────────────────────────────────────────────

const GRADS = [
  ['#25874b', '#0f3d22'], ['#5a2ca0', '#2a1450'], ['#2a6fd6', '#123d82'], ['#d43545', '#7d1220'],
  ['#1d8a99', '#0c4450'], ['#c2702c', '#6b3a0f'], ['#7c5cff', '#3b1f8f'], ['#b8327a', '#5e0f3a'],
];
const grad = (seed) => {
  const s = String(seed || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const g = GRADS[h % GRADS.length];
  return `linear-gradient(135deg,${g[0]},${g[1]})`;
};
const AV_COLORS = ['#3d7bd8', '#d0457a', '#c27a2c', '#4b8f6e', '#6b5bd2', '#a0503b', '#2f7f99', '#8a4fc2'];
const avColor = (id) => AV_COLORS[Math.abs(Number(id) || 0) % AV_COLORS.length];

// "Niké liga" → "NL", "MS 2026 — hlavná" → "MS", "Premier League 2026" → "PL"
function initials(name, max = 2) {
  const words = String(name || '?').split(/\s+/).filter((w) => /\p{L}/u.test(w));
  if (!words.length) return '?';
  // skratka na začiatku (MS, NHL, EPL) ostáva celá
  if (/^\p{Lu}{2,4}$/u.test(words[0])) return words[0];
  const s = words.length >= 2 ? words.slice(0, max).map((w) => w[0]).join('') : words[0].slice(0, max);
  return s.toUpperCase();
}
// skloňovanie: pl(1,'hráč','hráči','hráčov')
function pl(n, one, few, many) {
  const a = Math.abs(Number(n) || 0);
  if (a === 1) return one;
  if (a >= 2 && a <= 4) return few;
  return many;
}
const MONTHS_GEN = ['januára', 'februára', 'marca', 'apríla', 'mája', 'júna', 'júla', 'augusta', 'septembra', 'októbra', 'novembra', 'decembra'];
function teamAbbr(team) {
  if (!team) return '?';
  if (team.shortName && team.shortName.length <= 4) return team.shortName.toUpperCase();
  const n = String(team.name || '?').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const w = n.split(/\s+/).filter((x) => x.length > 2 && !/^(fc|fk|sk|mfk|afc|hc|hk|ac|as|cf)$/i.test(x));
  return ((w[0] || n).slice(0, 3)).toUpperCase();
}
function userName(u) {
  if (!u) return 'Hráč';
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username || 'Hráč';
}
function userInitials(u) {
  if (!u) return '?';
  const s = [u.firstName, u.lastName].filter(Boolean).map((x) => x[0]).join('') || (u.username || '?').slice(0, 2);
  return s.toUpperCase();
}
const dayKey = (d) => new Date(d).toLocaleDateString('en-CA', { timeZone: TZ });
const hm = (d) => dt.fmtTime(d);

// "o 45 min", "o 2 h 14 min", "o 3 dni"
function untilLabel(ms) {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 60) return `o ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `o ${h} h ${m % 60} min`;
  const d = Math.round(h / 24);
  return `o ${d} ${d === 1 ? 'deň' : (d < 5 ? 'dni' : 'dní')}`;
}
const WD = ['ne', 'po', 'ut', 'st', 'št', 'pi', 'so'];
function weekdayIdx(d) {
  const wd = new Date(d).toLocaleDateString('en-US', { timeZone: TZ, weekday: 'short' });
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
}
function whenLabel(d, now) {
  const k = dayKey(d);
  const today = dayKey(now);
  const tomorrow = dayKey(new Date(now.getTime() + DAY));
  if (k === today) return `dnes ${hm(d)}`;
  if (k === tomorrow) return `zajtra ${hm(d)}`;
  const date = new Date(d).toLocaleDateString('sk-SK', { timeZone: TZ, day: 'numeric', month: 'numeric' });
  return `${WD[weekdayIdx(d)]} ${date} ${hm(d)}`;
}

// prihlásenie pre appku — neprihlásený ide na úvodné obrazovky
function appLogin(req, res, next) {
  if (!req.session || !req.session.userId) return res.redirect('/app/welcome');
  res.locals.pl = pl;
  return next();
}

// Ligy prihláseného s poradím, posunom za týždeň a ďalšími údajmi pre karty.
async function myLeagueCards(meId) {
  const mems = await UserLeague.findAll({ where: { userId: meId }, attributes: ['leagueId'] });
  const ids = mems.map((m) => m.leagueId);
  if (!ids.length) return [];
  const leagues = await League.findAll({
    where: { id: ids },
    include: [{ model: Season, attributes: ['id', 'name', 'type', 'mode', 'ended', 'endDate', 'startDate', 'prizes', 'showPrizes', 'image'] }],
    order: [['createdAt', 'DESC']],
  });
  // oficiálne ligy z vopred prepočítaných rebríčkov, komunitné živo
  const [nowBy, thenBy, rounds, memberRows] = await Promise.all([
    leagueStandingsMap(ids),
    leagueStandingsMap(ids, { weekAgo: true }),
    roundCounts(ids),
    UserLeague.findAll({
      where: { leagueId: ids },
      attributes: ['leagueId', [Sequelize.fn('COUNT', Sequelize.col('user_id')), 'n']],
      group: ['leagueId'], raw: true,
    }),
  ]);
  const members = new Map(memberRows.map((r) => [Number(r.leagueId), Number(r.n)]));

  // avatary prvých troch zo všetkých líg naraz
  const topIds = new Set();
  nowBy.forEach((rows) => rows.slice(0, 3).forEach((r) => topIds.add(r.userId)));
  const topUsers = topIds.size
    ? new Map((await User.findAll({ where: { id: [...topIds] }, attributes: ['id', 'username', 'firstName', 'lastName', 'profileImage'] })).map((u) => [u.id, u]))
    : new Map();

  return leagues.map((l) => {
    const rows = nowBy.get(l.id) || [];
    const idx = rows.findIndex((r) => r.userId === meId);
    const prevRows = thenBy.get(l.id) || [];
    const prevIdx = prevRows.findIndex((r) => r.userId === meId);
    const rank = idx >= 0 ? idx + 1 : null;
    const prevRank = prevIdx >= 0 ? prevIdx + 1 : null;
    const rc = rounds.get(l.id) || { total: 0, played: 0 };
    let prizes = [];
    if (l.Season && l.Season.showPrizes !== false) {
      try { prizes = JSON.parse(l.Season.prizes || '[]') || []; } catch (e) { prizes = []; }
    }
    return {
      id: l.id,
      name: l.name,
      image: l.image || (l.Season && l.Season.image) || null,
      grad: grad(l.name),
      initials: initials(l.name),
      type: l.type,
      seasonName: l.Season ? l.Season.name : null,
      isOfficial: l.type === 'official' || (l.Season && l.Season.type === 'official'),
      ended: isLeagueLocked(l),
      players: members.get(l.id) || rows.length,
      ranked: rows.length,
      rank,
      points: idx >= 0 ? rows[idx].points : 0,
      accuracy: idx >= 0 ? accuracyOf(rows[idx]) : null,
      move: (rank && prevRank) ? prevRank - rank : 0,
      gapToLeader: (idx > 0) ? rows[0].points - rows[idx].points : 0,
      gapUp: (idx > 0) ? rows[idx - 1].points - rows[idx].points : 0,
      topPct: (rank && rows.length) ? Math.max(1, Math.round((rank / rows.length) * 100)) : null,
      roundsTotal: rc.total,
      roundsPlayed: rc.played,
      hasPrizes: prizes.length > 0,
      top3: rows.slice(0, 3).map((r) => {
        const u = topUsers.get(r.userId);
        return { id: r.userId, initials: userInitials(u), color: avColor(r.userId), image: u ? u.profileImage : null };
      }),
    };
  });
}

// Moje poradie po každom z posledných n odohraných kôl ligy (pre graf).
async function rankHistory(leagueId, meId, n = 8) {
  // jeden dotaz na celú ligu; oficiálne ligy z vopred prepočítanej pamäte
  const hist = await leagueRankHistory(leagueId, n);
  return hist.map((h) => h.ranks.get(meId)).filter((r) => r != null);
}

// SVG cesta pre malý graf (hodnoty → body v ramčeku w×h). invert: menšie = vyššie (poradie)
function sparkPath(values, w = 300, h = 40, invert = false) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values.map((v, i) => {
    const x = 2 + (i * (w - 4)) / (values.length - 1);
    const norm = (v - min) / span;
    const y = 4 + (invert ? norm : 1 - norm) * (h - 8);
    return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

// Otvorené zápasy na tipovanie vo všetkých mojich ligách (+ moje tipy).
async function openMatches(meId) {
  const now = new Date();
  const mems = await UserLeague.findAll({ where: { userId: meId }, attributes: ['leagueId'] });
  const leagueIds = mems.map((m) => m.leagueId);
  if (!leagueIds.length) return [];
  const rounds = await Round.findAll({
    where: { leagueId: leagueIds, startDate: { [Op.lte]: now }, endDate: { [Op.gt]: now } },
    include: [{ model: League, attributes: ['id', 'name', 'ended', 'image'], include: [{ model: Season, attributes: ['id', 'ended', 'endDate', 'startDate'] }] }],
  });
  const openRounds = rounds.filter((r) => !isLeagueLocked(r.League));
  if (!openRounds.length) return [];
  const roundById = new Map(openRounds.map((r) => [r.id, r]));
  const matches = await Match.findAll({
    where: { roundId: [...roundById.keys()], status: 'scheduled', matchTime: { [Op.gt]: now } },
    include: [
      { model: Team, as: 'homeTeam', attributes: ['id', 'name', 'shortName', 'logo'] },
      { model: Team, as: 'awayTeam', attributes: ['id', 'name', 'shortName', 'logo'] },
    ],
    order: [['matchTime', 'ASC']],
  });
  const tips = matches.length
    ? await Tip.findAll({ where: { userId: meId, matchId: matches.map((m) => m.id) }, attributes: ['matchId', 'homeScore', 'awayScore', 'winner'] })
    : [];
  const tipBy = new Map(tips.map((t) => [t.matchId, t]));
  return matches.map((m) => {
    const r = roundById.get(m.roundId);
    const deadline = new Date(Math.min(new Date(m.matchTime).getTime(), new Date(r.endDate).getTime()));
    const t = tipBy.get(m.id);
    const tipped = !!(t && (m.tipType === 'exact_score' ? (t.homeScore != null && t.awayScore != null) : t.winner));
    return {
      id: m.id,
      type: m.tipType,
      time: m.matchTime,
      deadline,
      leagueId: r.League.id,
      leagueName: r.League.name,
      roundId: r.id,
      roundName: r.name,
      roundEnd: r.endDate,
      home: { name: m.homeTeam ? m.homeTeam.name : '?', abbr: teamAbbr(m.homeTeam), logo: m.homeTeam && m.homeTeam.logo, grad: grad(m.homeTeam && m.homeTeam.name) },
      away: { name: m.awayTeam ? m.awayTeam.name : '?', abbr: teamAbbr(m.awayTeam), logo: m.awayTeam && m.awayTeam.logo, grad: grad(m.awayTeam && m.awayTeam.name) },
      tip: t ? { home: t.homeScore, away: t.awayScore, winner: t.winner } : null,
      tipped,
    };
  }).filter((m) => m.deadline > now).sort((a, b) => a.deadline - b.deadline);
}

// ── obrazovky ────────────────────────────────────────────────────────────────

// GET /app — vstup appky
const entry = (req, res) => res.redirect(req.session && req.session.userId ? '/app/home' : '/app/welcome');

// GET /app/welcome — úvodné obrazovky (len pri prvom spustení)
const welcome = (req, res) => {
  if (req.session && req.session.userId) return res.redirect('/app/home');
  res.render('app/welcome', { title: 'Vitaj', screen: 'welcome', hideTabbar: true });
};

// GET /app/home — Domov
const home = asyncHandler(async (req, res) => {
  const meId = Number(req.session.userId);
  const now = new Date();
  const [me, leagues, matches] = await Promise.all([
    User.findByPk(meId, { attributes: ['id', 'username', 'firstName', 'lastName', 'profileImage'] }),
    myLeagueCards(meId),
    openMatches(meId),
  ]);

  // karta uzávierky: kolo s najbližšou uzávierkou netipnutého zápasu
  const byRound = new Map();
  matches.forEach((m) => {
    if (!byRound.has(m.roundId)) byRound.set(m.roundId, { leagueId: m.leagueId, leagueName: m.leagueName, roundName: m.roundName, total: 0, tipped: 0, next: null });
    const r = byRound.get(m.roundId);
    r.total += 1;
    if (m.tipped) r.tipped += 1;
    else if (!r.next || m.deadline < r.next) r.next = m.deadline;
  });
  const pending = [...byRound.values()].filter((r) => r.next).sort((a, b) => a.next - b.next);
  let deadline = null;
  if (pending.length) {
    const r = pending[0];
    deadline = { ...r, missing: r.total - r.tipped, until: untilLabel(r.next - now), pct: r.total ? Math.round((r.tipped / r.total) * 100) : 0 };
  }
  const allTipped = !deadline && matches.length > 0;

  // body za posledných 7 dní (+ graf po dňoch) a porovnanie s týždňom predtým
  const recent = await Tip.findAll({
    where: { userId: meId },
    attributes: ['points'],
    include: [{ model: Match, attributes: ['matchTime'], required: true, where: { status: 'finished', matchTime: { [Op.gte]: new Date(now - 14 * DAY) } } }],
    raw: true, nest: true,
  });
  const days = Array.from({ length: 7 }, (_, i) => dayKey(new Date(now - (6 - i) * DAY)));
  const perDay = Object.fromEntries(days.map((d) => [d, 0]));
  let week = 0; let prevWeek = 0;
  recent.forEach((t) => {
    const at = new Date(t.Match.matchTime);
    if (now - at <= 7 * DAY) {
      week += t.points || 0;
      const k = dayKey(at);
      if (k in perDay) perDay[k] += t.points || 0;
    } else prevWeek += t.points || 0;
  });
  let acc = 0;
  const cumul = days.map((d) => (acc += perDay[d]));
  const [mine] = await standings({ userIds: [meId] });
  const active = leagues.filter((l) => !l.ended);
  const best = active.filter((l) => l.rank).sort((a, b) => a.rank - b.rank)[0] || null;

  res.render('app/home', {
    title: 'Domov', screen: 'home', appTab: 'home',
    me: { name: (me && (me.firstName || me.username)) || '', initials: userInitials(me), image: me && me.profileImage, color: avColor(meId) },
    greeting: (() => {
      const h = Number(now.toLocaleString('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }));
      return h < 10 ? 'Dobré ráno' : (h < 18 ? 'Dobrý deň' : 'Dobrý večer');
    })(),
    deadline,
    allTipped,
    openCount: matches.length,
    week, weekDiff: week - prevWeek,
    spark: sparkPath(cumul, 120, 34),
    accuracy: mine ? accuracyOf(mine) : null,
    best,
    leagues: active.slice(0, 6),
  });
});

// GET /app/tipovat — všetky otvorené zápasy
const tipovat = asyncHandler(async (req, res) => {
  const meId = Number(req.session.userId);
  const now = new Date();
  const all = await openMatches(meId);
  const leagueFilter = req.query.liga ? Number(req.query.liga) : null;

  const chips = [];
  const seen = new Map();
  all.forEach((m) => {
    if (!seen.has(m.leagueId)) { seen.set(m.leagueId, { id: m.leagueId, name: m.leagueName, count: 0 }); chips.push(seen.get(m.leagueId)); }
    seen.get(m.leagueId).count += 1;
  });
  const list = leagueFilter ? all.filter((m) => m.leagueId === leagueFilter) : all;

  const today = dayKey(now);
  const tomorrow = dayKey(new Date(now.getTime() + DAY));
  const groups = [];
  const gmap = new Map();
  list.forEach((m) => {
    const k = dayKey(m.deadline);
    if (!gmap.has(k)) {
      const d = new Date(m.deadline);
      const g = {
        key: k,
        short: k === today ? 'dnes' : WD[weekdayIdx(d)],
        num: Number(d.toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric' })),
        title: k === today ? 'Dnes' : (k === tomorrow ? 'Zajtra'
          : d.toLocaleDateString('sk-SK', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' })),
        matches: [], untipped: 0,
      };
      gmap.set(k, g); groups.push(g);
    }
    const g = gmap.get(k);
    const ms = m.deadline - now;
    g.matches.push({ ...m, soon: ms < 3 * 3600 * 1000, when: ms < 3 * 3600 * 1000 ? `${hm(m.deadline)} · ${untilLabel(ms)}` : whenLabel(m.deadline, now) });
    if (!m.tipped) g.untipped += 1;
  });

  res.render('app/tipovat', {
    title: 'Tipovať', screen: 'tipovat', appTab: 'tip',
    chips, leagueFilter, groups,
    total: list.length,
    tipped: list.filter((m) => m.tipped).length,
  });
});

// GET /app/rebricky — prehľad mojich líg
const rebricky = asyncHandler(async (req, res) => {
  const meId = Number(req.session.userId);
  const leagues = await myLeagueCards(meId);
  const active = leagues.filter((l) => !l.ended);
  const ended = leagues.filter((l) => l.ended);
  // graf vývoja poradia len pre prvé 3 aktívne ligy (šetrí dotazy)
  for (const l of active.slice(0, 3)) {
    const hist = await rankHistory(l.id, meId);
    l.spark = sparkPath(hist, 300, 40, true);
    l.bestRank = hist.length ? Math.min(...hist) : null;
    l.histLen = hist.length;
  }
  res.render('app/rebricky', { title: 'Rebríčky', screen: 'rebricky', appTab: 'rank', active, ended });
});

// prístup k rebríčku/lige: člen, admin, alebo verejná súťaž
async function canSeeLeague(league, meId) {
  const member = await UserLeague.findOne({ where: { userId: meId, leagueId: league.id } });
  if (member) return { ok: true, member: true };
  const me = await User.findByPk(meId, { attributes: ['role'] });
  if (me && me.role === 'admin') return { ok: true, member: false };
  const s = league.Season;
  const isPublic = !league.hasPassword && !(s && (s.hasPassword || s.hidden));
  return { ok: isPublic, member: false };
}

// GET /app/rebricky/:id — rebríček ligy (alebo "celkovo" = oficiálne ligy za rok)
const rebricek = asyncHandler(async (req, res) => {
  const meId = Number(req.session.userId);
  const period = ['kolo', 'mesiac'].includes(req.query.obdobie) ? req.query.obdobie : 'celkovo';
  const now = new Date();
  const weekAgo = new Date(now - 7 * DAY);
  let title; let opts; let prevOpts = null; let leagueId = null;

  if (req.params.id === 'celkovo') {
    title = 'Celkový rebríček';
    const ids = await cached('app:official-leagues', 5 * 60 * 1000, async () => (await League.findAll({
      where: { type: 'official', isTemplate: false }, attributes: ['id'],
    })).map((l) => l.id));
    const yearAgo = new Date(now); yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    opts = { leagueIds: ids, roundEndFrom: yearAgo, finishedOnly: true };
    if (period === 'mesiac') opts = { leagueIds: ids, finishedOnly: true, matchTimeFrom: new Date(now - 30 * DAY) };
    if (period === 'celkovo') prevOpts = { ...opts, roundEndBefore: weekAgo };
  } else {
    leagueId = Number(req.params.id);
    const league = await League.findByPk(leagueId, { include: [{ model: Season, attributes: ['id', 'hasPassword', 'hidden'] }] });
    if (!league) return res.redirect('/app/rebricky');
    const access = await canSeeLeague(league, meId);
    if (!access.ok) return res.redirect(`/leagues/${leagueId}`);
    title = league.name;
    if (period === 'kolo') {
      const last = await Round.findOne({ where: { leagueId, startDate: { [Op.lte]: now } }, order: [['startDate', 'DESC']], attributes: ['id', 'name'] });
      opts = { roundIds: last ? [last.id] : [] };
    } else if (period === 'mesiac') {
      opts = { leagueIds: [leagueId], matchTimeFrom: new Date(now - 30 * DAY) };
    } else {
      opts = { leagueIds: [leagueId] };
      prevOpts = { leagueIds: [leagueId], roundEndBefore: weekAgo };
    }
  }

  // celkový rebríček a oficiálne ligy: vopred prepočítané (standings.util —
  // precomputed); komunitné ligy živo. Časové hranice si funkcia počíta sama,
  // aby sa dala na pozadí prepočítať znova.
  const big = req.params.id === 'celkovo' || (leagueId && (await officialLeagueIds([leagueId])).has(leagueId));
  const key = `app:rb:${req.params.id}:${period}:${(opts.roundIds || []).join(',')}`;
  const build = async () => {
    const n = new Date();
    const wA = new Date(n - 7 * DAY);
    const o = { ...opts };
    if (o.matchTimeFrom) o.matchTimeFrom = new Date(n - 30 * DAY);
    if (o.roundEndFrom) { const y = new Date(n); y.setFullYear(y.getFullYear() - 1); o.roundEndFrom = y; }
    const rows = await leaderboardWithUsers(o);
    let prev = [];
    if (prevOpts) prev = await standings({ ...prevOpts, ...(o.roundEndFrom ? { roundEndFrom: o.roundEndFrom } : {}), roundEndBefore: wA });
    return { rows, prev };
  };
  const { rows, prev } = big ? await precomputed(key, build) : await build();
  const prevRank = new Map();
  prev.forEach((r, i) => prevRank.set(r.userId, i + 1));
  const list = rows.map((r, i) => ({
    rank: i + 1,
    userId: r.user.id,
    name: userName(r.user),
    initials: userInitials(r.user),
    image: r.user.profileImage || null,
    color: avColor(r.user.id),
    points: r.totalPoints,
    exact: r.exact || 0,
    move: prevRank.has(r.user.id) ? prevRank.get(r.user.id) - (i + 1) : 0,
    me: r.user.id === meId,
  }));
  const meRow = list.find((x) => x.me) || null;
  const meAbove = meRow && meRow.rank > 1 ? list[meRow.rank - 2] : null;

  const myLeagues = await myLeagueCards(meId);
  res.render('app/rebricek', {
    title, screen: 'rebricek', appTab: 'rank',
    leagueId, isGlobal: req.params.id === 'celkovo', period,
    top3: list.slice(0, 3),
    rest: list.slice(3, 100),
    total: list.length,
    meRow,
    meGap: meRow && meAbove ? meAbove.points - meRow.points : 0,
    options: myLeagues.map((l) => ({ id: l.id, name: l.name })),
    baseUrl: `/app/rebricky/${req.params.id}`,
  });
});

// GET /app/liga/:id — detail ligy (kolá, rebríček, ceny, pravidlá)
const liga = asyncHandler(async (req, res) => {
  const meId = Number(req.session.userId);
  const league = await League.findByPk(req.params.id, {
    include: [{ model: Season }],
  });
  if (!league) return res.redirect('/app/home');
  const access = await canSeeLeague(league, meId);
  if (!access.ok) return res.redirect(`/leagues/${league.id}`);
  const now = new Date();
  const season = league.Season;

  const rounds = await Round.findAll({ where: { leagueId: league.id }, order: [['startDate', 'ASC']] });
  const roundIds = rounds.map((r) => r.id);
  const [matchRows, myTipRows, membersCount, top] = await Promise.all([
    roundIds.length ? Match.findAll({
      where: { roundId: roundIds },
      attributes: ['roundId', [Sequelize.fn('COUNT', Sequelize.col('id')), 'n'],
        [Sequelize.fn('SUM', Sequelize.literal("CASE WHEN status IN ('finished','canceled') THEN 1 ELSE 0 END")), 'done']],
      group: ['roundId'], raw: true,
    }) : [],
    roundIds.length ? Tip.findAll({
      where: { userId: meId },
      attributes: [[Sequelize.col('Match.round_id'), 'roundId'], [Sequelize.fn('COUNT', Sequelize.col('Tip.id')), 'n']],
      include: [{ model: Match, attributes: [], where: { roundId: roundIds }, required: true }],
      group: [Sequelize.col('Match.round_id')], raw: true,
    }) : [],
    UserLeague.count({ where: { leagueId: league.id } }),
    leagueLeaderboard(league.id),
  ]);
  const mBy = new Map(matchRows.map((r) => [Number(r.roundId), { n: Number(r.n), done: Number(r.done) }]));
  const tBy = new Map(myTipRows.map((r) => [Number(r.roundId), Number(r.n)]));
  const roundList = rounds.map((r) => {
    const st = now < new Date(r.startDate) ? 'scheduled' : (now <= new Date(r.endDate) ? 'open' : 'finished');
    const m = mBy.get(r.id) || { n: 0, done: 0 };
    return {
      id: r.id, name: r.name, status: st,
      matches: m.n, done: m.done, myTips: tBy.get(r.id) || 0,
      when: st === 'scheduled' ? `otvorí sa ${whenLabel(r.startDate, now)}`
        : (st === 'open' ? `uzávierka ${whenLabel(r.endDate, now)}` : dt.fmtDate(r.endDate)),
    };
  });
  // najprv otvorené, potom naplánované, nakoniec odohrané (najnovšie hore)
  const order = { open: 0, scheduled: 1, finished: 2 };
  roundList.sort((a, b) => (order[a.status] - order[b.status])
    || (a.status === 'finished' ? b.id - a.id : a.id - b.id));
  const played = roundList.filter((r) => r.status === 'finished').length;

  let prizes = [];
  if (season && season.showPrizes !== false) {
    try { prizes = (JSON.parse(season.prizes || '[]') || []).filter((p) => p && p.prize); } catch (e) { prizes = []; }
  }
  const rules = season && season.showRules !== false ? (season.rules || '') : '';
  const s = league.scoringSystem || { exactScore: 10, correctWinner: 3, goalDifference: 2, correctGoals: 1 };
  const meIdx = top.findIndex((r) => r.user.id === meId);

  res.render('app/liga', {
    title: league.name, screen: 'liga', appTab: 'home',
    league: {
      id: league.id, name: league.name, image: league.image || (season && season.image) || null,
      grad: grad(league.name), initials: initials(league.name),
      isOfficial: league.type === 'official' || (season && season.type === 'official'),
      ended: isLeagueLocked(league),
      auto: !!(league.externalLeagueId || league.templateId),
      member: access.member,
    },
    seasonName: season ? season.name : null,
    membersCount,
    roundsTotal: rounds.length,
    roundsPlayed: played,
    hasOpen: roundList.some((r) => r.status === 'open'),
    rounds: roundList,
    top5: top.slice(0, 5).map((r, i) => ({ rank: i + 1, name: userName(r.user), initials: userInitials(r.user), image: r.user.profileImage, color: avColor(r.user.id), points: r.totalPoints, me: r.user.id === meId })),
    myRank: meIdx >= 0 ? meIdx + 1 : null,
    myPoints: meIdx >= 0 ? top[meIdx].totalPoints : 0,
    prizes,
    rules,
    scoring: s,
  });
});

// GET /app/notifikacie
const NOTI_GROUPS = {
  tipy: ['deadline', 'new_round'],
  vysledky: ['result', 'canceled'],
  ligy: ['member', 'season'],
  ostatne: ['achievement', 'admin', 'sysadmin'],
};
const notifikacie = asyncHandler(async (req, res) => {
  const meId = Number(req.session.userId);
  const f = NOTI_GROUPS[req.query.f] ? req.query.f : 'vsetky';
  const where = { userId: meId };
  if (f !== 'vsetky') where.type = NOTI_GROUPS[f];
  const [rows, unreadTips] = await Promise.all([
    Notification.findAll({ where, order: [['createdAt', 'DESC']], limit: 80 }),
    Notification.count({ where: { userId: meId, read: false, type: NOTI_GROUPS.tipy } }),
  ]);
  const now = new Date();
  const today = dayKey(now);
  const yest = dayKey(new Date(now - DAY));
  const groups = [];
  rows.forEach((n) => {
    const k = dayKey(n.createdAt);
    const label = k === today ? 'Dnes' : (k === yest ? 'Včera' : 'Staršie');
    let g = groups[groups.length - 1];
    if (!g || g.label !== label) { g = { label, items: [] }; groups.push(g); }
    g.items.push({
      id: n.id, type: n.type, title: n.title, message: n.message,
      link: n.link || null, read: !!n.read,
      time: k === today || k === yest ? hm(n.createdAt) : dt.fmtDateShort(n.createdAt),
    });
  });
  res.render('app/notifikacie', { title: 'Notifikácie', screen: 'notifikacie', appTab: 'noti', groups, f, unreadTips });
});

// GET /app/profil
const ICON_BY_CRITERIA = {
  first_tip: 'check', tips_total: 'check', exact_total: 'target', exact_in_round: 'target', perfect_round: 'target',
  point_streak: 'flame', exact_streak: 'flame', daily_streak: 'flame', podium: 'trophy', podium_official: 'trophy',
  league_winner: 'trophy', total_points: 'star', official_points: 'star', collector: 'medal', rarity_count: 'medal',
};
const RARITY_STYLE = {
  common: { bg: 'rgba(31,212,151,.16)', line: 'rgba(31,212,151,.45)', fg: '#1fd497' },
  rare: { bg: 'rgba(124,92,255,.22)', line: 'rgba(124,92,255,.5)', fg: '#9d83ff' },
  epic: { bg: 'rgba(255,77,109,.2)', line: 'rgba(255,77,109,.45)', fg: '#ff4d6d' },
  legendary: { bg: 'rgba(250,204,21,.22)', line: 'rgba(250,204,21,.5)', fg: '#facc15' },
};
const profil = asyncHandler(async (req, res) => {
  const meId = Number(req.session.userId);
  const [me, [mine], tipsCount, owned, totalBadges] = await Promise.all([
    User.findByPk(meId, { attributes: ['id', 'username', 'firstName', 'lastName', 'profileImage', 'createdAt', 'role'] }),
    standings({ userIds: [meId] }),
    Tip.count({ where: { userId: meId } }),
    UserAchievement.findAll({ where: { userId: meId }, order: [['dateAwarded', 'DESC']], limit: 5, raw: true }),
    Achievement.count(),
  ]);
  const earnedCount = await UserAchievement.count({ where: { userId: meId } });
  const defs = owned.length ? await Achievement.findAll({ where: { id: owned.map((o) => o.achievementId) }, raw: true }) : [];
  const defBy = new Map(defs.map((d) => [d.id, d]));
  const badges = owned.map((o) => defBy.get(o.achievementId)).filter(Boolean).map((d) => ({
    name: d.name, icon: ICON_BY_CRITERIA[d.criteria] || 'medal', style: RARITY_STYLE[d.rarity] || RARITY_STYLE.common,
  }));
  res.render('app/profil', {
    title: 'Profil', screen: 'profil', appTab: 'profile',
    me: {
      name: userName(me), username: me ? me.username : '', initials: userInitials(me), image: me && me.profileImage,
      since: me ? (() => {
        const [y, m] = new Date(me.createdAt).toLocaleDateString('en-CA', { timeZone: TZ }).split('-');
        return `${MONTHS_GEN[Number(m) - 1]} ${y}`;
      })() : '',
      isAdmin: !!(me && me.role === 'admin'),
    },
    stats: { points: mine ? mine.points : 0, accuracy: mine ? accuracyOf(mine) : null, exact: mine ? mine.exact : 0, tips: tipsCount },
    badges, earnedCount, totalBadges,
    placeholders: Math.max(0, 5 - badges.length),
  });
});

module.exports = {
  appLogin, entry, welcome, home, tipovat, rebricky, rebricek, liga, notifikacie, profil,
  _internal: { initials, teamAbbr, untilLabel, whenLabel, sparkPath, pl },
};
