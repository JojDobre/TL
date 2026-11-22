// backend/src/controllers/appPage.controller.js
//
// Obrazovky MOBILNEJ APLIKÁCIE (/app/*). Používa ich appka z Google Play
// (TWA) a nainštalovaná PWA; web v prehliadači ich nikde neodkazuje.
// Všetky výpočty (body, poradie, uzávierky) sú rovnaké ako na webe — appka
// je len iný vzhľad nad tými istými dátami.

const {
  User, League, Season, Round, Match, Tip, Team, UserLeague, UserSeason, Notification,
  Achievement, UserAchievement, Sequelize,
} = require('../models');
const { asyncHandler } = require('../middleware/error.middleware');
const {
  standings, leaderboardWithUsers, roundCounts, accuracyOf, cached, precomputed, leagueStandingsMap, leagueLeaderboard, officialLeagueIds, leagueRankHistory,
} = require('../utils/standings.util');
const { isLeagueLocked } = require('../utils/league.utils');
const { seasonStatus, canViewSeasonContent } = require('../utils/season.utils');
const dt = require('../utils/datetime.util');
const i18n = require('../utils/app-i18n');

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

const SK = i18n.forLang('sk');
// "o 45 min", "o 2 h 14 min", "o 3 dni" (en: "in 45 min", "in 3 days")
function untilLabel(ms, L = SK) {
  const m = Math.max(0, Math.round(ms / 60000));
  let x;
  if (m < 60) x = `${m} min`;
  else if (m < 24 * 60) x = `${Math.floor(m / 60)} h ${m % 60} min`;
  else { const d = Math.round(m / 60 / 24); x = `${d} ${L.tn(d, 'day')}`; }
  return L.t('when.in', { x });
}
const WD_BY = { sk: ['ne', 'po', 'ut', 'st', 'št', 'pi', 'so'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] };
const LOCALE = { sk: 'sk-SK', en: 'en-GB' };
function weekdayIdx(d) {
  const wd = new Date(d).toLocaleDateString('en-US', { timeZone: TZ, weekday: 'short' });
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
}
function whenLabel(d, now, L = SK) {
  const k = dayKey(d);
  const today = dayKey(now);
  const tomorrow = dayKey(new Date(now.getTime() + DAY));
  if (k === today) return `${L.t('when.today')} ${hm(d)}`;
  if (k === tomorrow) return `${L.t('when.tomorrow')} ${hm(d)}`;
  const date = new Date(d).toLocaleDateString(LOCALE[L.lang], L.lang === 'en'
    ? { timeZone: TZ, day: 'numeric', month: 'short' } : { timeZone: TZ, day: 'numeric', month: 'numeric' });
  return `${WD_BY[L.lang][weekdayIdx(d)]} ${date} ${hm(d)}`;
}

// jazyk obrazovky (sk/en podľa zariadenia) — req.L + premenné pre šablóny
function useLang(req, res) {
  const L = i18n.forLang(i18n.resolveLang(req));
  req.L = L;
  Object.assign(res.locals, { lang: L.lang, t: L.t, tn: L.tn, pl, jsStrings: L.clientStrings() });
  res.vary('Accept-Language');
  return L;
}

// ZDIEĽANIE: spoločné popisky štýlov kariet a skrátený rebríček (top 5 + ja)
function shareLabels(L) {
  return {
    pick: L.t('share.pick'), shareNow: L.t('share.short'), myTips: L.t('share.myTips'), ptsShort: L.t('common.pts'),
    place: L.t('share.place'), playersW: L.t('share.playersW'), exactShort: L.t('share.exactShort'),
    variants: { classic: L.t('share.v.classic'), minimal: L.t('share.v.minimal'), matches: L.t('share.v.matches'), rank: L.t('share.v.rank'), square: L.t('share.v.square'), duel: L.t('share.v.duel'), duelLight: L.t('share.v.light'), season: L.t('share.v.season'), seasonLight: L.t('share.v.light') },
  };
}
// SEZÓNNE ZHRNUTIE → údaje pre kartu (štýl „season“) a blok na obrazovke
async function seasonShareFor(L, meId, season) {
  if (!season) return null;
  const sum = await require('../utils/season-summary.util').seasonSummary(meId, season.id).catch(() => null);
  if (!sum) return null;
  return {
    ...sum,
    card: {
      variant: 'season', season: season.name, initials: initials(season.name), grad: grad(season.name), url: 'https://tifo.sk',
      points: sum.points, rank: sum.rank, players: sum.players, exact: sum.exact, accuracy: sum.accuracy,
      rounds: sum.rounds, tips: sum.tips, best: sum.best, team: sum.team,
      labels: {
        ...shareLabels(L), yearIn: L.t('ssum.title'), pts: L.tn(sum.points, 'point'), rank: L.t('share.rankSeason'),
        exact: L.t('share.exact'), accuracy: L.t('ssum.accuracy'), roundsW: L.tn(sum.rounds, 'roundPlayed'), tips: L.tn(sum.tips, 'tip'),
        bestRound: L.t('ssum.best'), favTeam: L.t('ssum.team'), cta: L.t('share.cta'),
        text: L.t('ssum.text', { p: sum.points, s: season.name }),
      },
    },
  };
}
function shareBoard(board) {
  const top = board.slice(0, 5).map((r) => ({ rank: r.rank, name: r.name, pts: r.points, me: !!r.me }));
  const me = board.find((r) => r.me);
  if (me && me.rank > 5) top.push({ gap: true }, { rank: me.rank, name: me.name, pts: me.points, me: true });
  return top;
}

// prihlásenie pre appku — neprihlásený ide na úvodné obrazovky
function appLogin(req, res, next) {
  if (!req.session || !req.session.userId) return res.redirect('/app/welcome');
  useLang(req, res);
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
      seasonId: l.Season ? l.Season.id : null,
      seasonMode: l.Season ? l.Season.mode : null,
      seasonType: l.Season ? l.Season.type : null,
      seasonImage: l.Season ? l.Season.image : null,
      seasonEnded: l.Season ? seasonStatus(l.Season) === 'ended' : false,
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
    include: [{ model: League, attributes: ['id', 'name', 'ended', 'image', 'jokerEnabled'], include: [{ model: Season, attributes: ['id', 'name', 'ended', 'endDate', 'startDate'] }] }],
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
    ? await Tip.findAll({ where: { userId: meId, matchId: matches.map((m) => m.id) }, attributes: ['matchId', 'homeScore', 'awayScore', 'winner', 'isJoker'] })
    : [];
  const tipBy = new Map(tips.map((t) => [t.matchId, t]));
  const lockedJoker = await require('../utils/joker.util').lockedJokerRounds(meId, openRounds.filter((r) => r.League.jokerEnabled).map((r) => r.id), now);
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
      seasonId: r.League.Season ? r.League.Season.id : null,
      seasonName: r.League.Season ? r.League.Season.name : null,
      roundId: r.id,
      roundName: r.name,
      roundEnd: r.endDate,
      home: { name: m.homeTeam ? m.homeTeam.name : '?', abbr: teamAbbr(m.homeTeam), logo: m.homeTeam && m.homeTeam.logo, grad: grad(m.homeTeam && m.homeTeam.name) },
      away: { name: m.awayTeam ? m.awayTeam.name : '?', abbr: teamAbbr(m.awayTeam), logo: m.awayTeam && m.awayTeam.logo, grad: grad(m.awayTeam && m.awayTeam.name) },
      tip: t ? { home: t.homeScore, away: t.awayScore, winner: t.winner } : null,
      tipped,
      joker: r.League.jokerEnabled ? { active: !!(t && t.isJoker), locked: lockedJoker.has(r.id) } : null,
    };
  }).filter((m) => m.deadline > now).sort((a, b) => a.deadline - b.deadline);
}

// ── obrazovky ────────────────────────────────────────────────────────────────

// GET /app — vstup appky
const entry = (req, res) => res.redirect(req.session && req.session.userId ? '/app/home' : '/app/welcome');

// GET /app/welcome — úvodné obrazovky (len pri prvom spustení)
const welcome = (req, res) => {
  if (req.session && req.session.userId) return res.redirect('/app/home');
  const L = useLang(req, res);
  res.render('app/welcome', { title: L.t('title.welcome'), screen: 'welcome', hideTabbar: true });
};

// GET /app/home — Domov
const home = asyncHandler(async (req, res) => {
  const { L } = req;
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
    if (!byRound.has(m.roundId)) byRound.set(m.roundId, { roundId: m.roundId, leagueId: m.leagueId, leagueName: m.leagueName, roundName: m.roundName, total: 0, tipped: 0, next: null });
    const r = byRound.get(m.roundId);
    r.total += 1;
    if (m.tipped) r.tipped += 1;
    else if (!r.next || m.deadline < r.next) r.next = m.deadline;
  });
  const pending = [...byRound.values()].filter((r) => r.next).sort((a, b) => a.next - b.next);
  let deadline = null;
  if (pending.length) {
    const r = pending[0];
    deadline = { ...r, missing: r.total - r.tipped, until: untilLabel(r.next - now, L), pct: r.total ? Math.round((r.tipped / r.total) * 100) : 0 };
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

  // MOJE SEZÓNY (bento): ligy zoskupené podľa sezóny; samostatná liga = jedna dlaždica
  const untippedBySeason = new Map();
  matches.forEach((m) => { if (!m.tipped && m.seasonId) untippedBySeason.set(m.seasonId, (untippedBySeason.get(m.seasonId) || 0) + 1); });
  const sMap = new Map();
  leagues.forEach((l) => {
    const key = l.seasonId || `l${l.id}`;
    if (!sMap.has(key)) {
      const standalone = l.seasonMode === 'standalone' || !l.seasonId;
      const name = standalone ? l.name : (l.seasonName || l.name);
      sMap.set(key, {
        id: l.seasonId, name, image: l.seasonImage || l.image || null, grad: grad(name), initials: initials(name),
        href: standalone ? `/app/liga/${l.id}` : `/app/sezona/${l.seasonId}`,
        official: l.seasonType === 'official' || l.isOfficial, ended: l.seasonEnded && l.ended,
        leagues: 0, bestRank: null, bestLeague: null, points: 0, players: 0, move: 0,
        untipped: untippedBySeason.get(l.seasonId) || 0,
      });
    }
    const c = sMap.get(key);
    c.leagues += 1;
    c.ended = c.ended && l.ended;
    c.players = Math.max(c.players, l.players);
    if (l.rank && (!c.bestRank || l.rank < c.bestRank)) { c.bestRank = l.rank; c.bestLeague = l.name; c.points = l.points; c.move = l.move; c.topPct = l.topPct; }
  });
  const seasons = [...sMap.values()].filter((c) => !c.ended)
    .sort((a, b) => (b.untipped > 0) - (a.untipped > 0) || (a.bestRank || 1e9) - (b.bestRank || 1e9));

  res.render('app/home', {
    title: L.t('title.home'), screen: 'home', appTab: 'home',
    me: { name: (me && (me.firstName || me.username)) || '', initials: userInitials(me), image: me && me.profileImage, color: avColor(meId) },
    greeting: (() => {
      const h = Number(now.toLocaleString('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }));
      return L.t(h < 10 ? 'greet.morning' : (h < 18 ? 'greet.day' : 'greet.evening'));
    })(),
    deadline,
    allTipped,
    openCount: matches.length,
    week, weekDiff: week - prevWeek,
    spark: sparkPath(cumul, 120, 34),
    accuracy: mine ? accuracyOf(mine) : null,
    best,
    leagues: active.slice(0, 6),
    seasons: seasons.slice(0, 7),
    seasonsTotal: seasons.length,
  });
});

// GET /app/tipovat — všetky otvorené zápasy
const tipovat = asyncHandler(async (req, res) => {
  const { L } = req;
  const meId = Number(req.session.userId);
  const now = new Date();
  const all = await openMatches(meId);
  const leagueFilter = req.query.liga ? Number(req.query.liga) : null;
  // ?kolo=ID — kolo má vlastnú obrazovku (rovnaké karty zápasov)
  if (req.query.kolo) return res.redirect(`/app/kolo/${Number(req.query.kolo)}`);
  // ?sezona=ID — zápasy jednej sezóny (web /seasons/:id/zapasy)
  const seasonFilter = req.query.sezona ? Number(req.query.sezona) : null;
  const round = null;
  const seasonName = seasonFilter ? ((all.find((m) => m.seasonId === seasonFilter) || {}).seasonName
    || ((await Season.findByPk(seasonFilter, { attributes: ['name'] })) || {}).name || null) : null;

  const chips = [];
  const seen = new Map();
  all.forEach((m) => {
    if (!seen.has(m.leagueId)) { seen.set(m.leagueId, { id: m.leagueId, name: m.leagueName, count: 0 }); chips.push(seen.get(m.leagueId)); }
    seen.get(m.leagueId).count += 1;
  });
  const list = seasonFilter ? all.filter((m) => m.seasonId === seasonFilter)
    : (leagueFilter ? all.filter((m) => m.leagueId === leagueFilter) : all);

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
        short: k === today ? L.t('when.today') : WD_BY[L.lang][weekdayIdx(d)],
        num: Number(d.toLocaleDateString('en-GB', { timeZone: TZ, day: 'numeric' })),
        title: k === today ? L.t('day.today') : (k === tomorrow ? L.t('day.tomorrow')
          : d.toLocaleDateString(LOCALE[L.lang], { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' })),
        matches: [], untipped: 0,
      };
      gmap.set(k, g); groups.push(g);
    }
    const g = gmap.get(k);
    const ms = m.deadline - now;
    g.matches.push({ ...m, soon: ms < 3 * 3600 * 1000, when: ms < 3 * 3600 * 1000 ? `${hm(m.deadline)} · ${untilLabel(ms, L)}` : whenLabel(m.deadline, now, L) });
    if (!m.tipped) g.untipped += 1;
  });

  res.render('app/tipovat', {
    title: L.t('title.tip'), screen: 'tipovat', appTab: 'tip',
    chips: seasonFilter ? [] : chips, leagueFilter, groups, round, seasonFilter, seasonName,
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
  res.render('app/rebricky', { title: req.L.t('title.ranks'), screen: 'rebricky', appTab: 'rank', active, ended });
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
    title = req.L.t('title.global');
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
    if (!access.ok) return res.redirect(`/app/liga/${leagueId}`);
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
  const season = league.Season;
  // súkromná/skrytá SEZÓNA → zamknutá obrazovka sezóny (pole na heslo);
  // liga len s heslom → appková obrazovka so zámkom a pripojením cez heslo
  if (!access.ok && season && (season.hasPassword || season.hidden)) return res.redirect(`/app/sezona/${season.id}`);
  const now = new Date();
  const canManage = await require('./leaguePage.controller').isLeagueManager(league, meId);

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
      when: st === 'scheduled' ? req.L.t('round.opens', { x: whenLabel(r.startDate, now, req.L) })
        : (st === 'open' ? req.L.t('round.deadline', { x: whenLabel(r.endDate, now, req.L) }) : dt.fmtDate(r.endDate)),
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

  // turnaj (samostatná liga) = sezóna s jednou ligou → zhrnutie sezóny tu
  const mySeason = access.member && season && season.mode === 'standalone' ? await seasonShareFor(req.L, meId, season) : null;
  res.render('app/liga', {
    mySeason,
    title: league.name, screen: 'liga', appTab: 'home',
    league: {
      id: league.id, name: league.name, image: league.image || (season && season.image) || null,
      grad: grad(league.name), initials: initials(league.name),
      isOfficial: league.type === 'official' || (season && season.type === 'official'),
      ended: isLeagueLocked(league),
      auto: !!(league.externalLeagueId || league.templateId),
      member: access.member,
      locked: !access.ok,
      hasPassword: !!league.hasPassword,
      creator: league.creatorId === meId,
      // admin, ktorý oficiálnu ligu založil, v nej môže prestať súťažiť
      stopCompeting: league.creatorId === meId && league.type === 'official' && req.session.userRole === 'admin',
      joinCode: access.ok ? league.joinCode : null,
      description: access.ok ? (league.description || '') : '',
      seasonId: league.seasonId,
      standalone: !!(season && season.mode === 'standalone'),
      template: !!league.templateId,
    },
    canManage,
    noTeams: canManage && !league.templateId ? (await league.countTeams()) === 0 : false,
    seasonName: season ? season.name : null,
    membersCount,
    roundsTotal: rounds.length,
    roundsPlayed: played,
    hasOpen: roundList.some((r) => r.status === 'open'),
    openRoundId: (roundList.find((r) => r.status === 'open') || {}).id || null,
    rounds: roundList,
    top5: top.slice(0, 5).map((r, i) => ({ rank: i + 1, name: userName(r.user), initials: userInitials(r.user), image: r.user.profileImage, color: avColor(r.user.id), points: r.totalPoints, me: r.user.id === meId })),
    myRank: meIdx >= 0 ? meIdx + 1 : null,
    myPoints: meIdx >= 0 ? top[meIdx].totalPoints : 0,
    prizes,
    rules,
    scoring: s,
  });
});

// GET /app/kolo/:id — detail kola: tipovanie (rovnaké karty ako Tipovať),
// výsledky s mojimi bodmi a tipmi ostatných, rebríček kola, bodovanie
const kolo = asyncHandler(async (req, res) => {
  const { L } = req;
  const meId = Number(req.session.userId);
  const now = new Date();
  const round = await Round.findByPk(req.params.id, {
    include: [{ model: League, include: [{ model: Season }] }],
  });
  if (!round || !round.League) return res.redirect('/app/home');
  const league = round.League;
  const access = await canSeeLeague(league, meId);
  if (!access.ok) return res.redirect(`/app/liga/${league.id}`);
  const isManager = await require('./roundPage.controller').canManageRound(league, meId);
  const locked = isLeagueLocked(league);
  const status = now < new Date(round.startDate) ? 'scheduled' : (now <= new Date(round.endDate) ? 'open' : 'finished');
  const canTip = access.member && status === 'open' && !locked;

  const matches = await Match.findAll({
    where: { roundId: round.id },
    include: [
      { model: Team, as: 'homeTeam', attributes: ['id', 'name', 'shortName', 'logo'] },
      { model: Team, as: 'awayTeam', attributes: ['id', 'name', 'shortName', 'logo'] },
    ],
    order: [['matchTime', 'ASC']],
  });
  const ids = matches.map((m) => m.id);
  const tips = ids.length ? await Tip.findAll({
    where: { matchId: ids },
    include: [{ model: User, attributes: ['id', 'username', 'firstName', 'lastName', 'profileImage'] }],
  }) : [];
  const mine = new Map();
  const others = new Map();
  tips.forEach((t) => {
    if (t.userId === meId) mine.set(t.matchId, t);
    else { if (!others.has(t.matchId)) others.set(t.matchId, []); others.get(t.matchId).push(t); }
  });
  const team = (tm) => ({ name: tm ? tm.name : '?', abbr: teamAbbr(tm), logo: tm && tm.logo, grad: grad(tm && tm.name) });
  const tipText = (type, t) => {
    if (!t) return null;
    if (type === 'exact_score') return t.homeScore != null && t.awayScore != null ? `${t.homeScore}:${t.awayScore}` : null;
    return t.winner ? ({ home: '1', draw: 'X', away: '2' })[t.winner] : null;
  };

  const open = [];
  const done = [];
  // žolík: povolený v lige? je už nasadený na zápase, ktorý sa začal?
  const jokerOn = !!league.jokerEnabled;
  const jokerLocked = jokerOn && [...mine.values()].some((t) => {
    const mm = matches.find((x) => x.id === t.matchId);
    return t.isJoker && mm && (mm.status !== 'scheduled' || new Date(Math.min(new Date(mm.matchTime), new Date(round.endDate))) <= now);
  });
  matches.forEach((m) => {
    const t = mine.get(m.id);
    const deadline = new Date(Math.min(new Date(m.matchTime).getTime(), new Date(round.endDate).getTime()));
    const tipped = !!tipText(m.tipType, t);
    if (canTip && m.status === 'scheduled' && deadline > now) {
      const ms = deadline - now;
      open.push({
        id: m.id, type: m.tipType, home: team(m.homeTeam), away: team(m.awayTeam),
        tip: t ? { home: t.homeScore, away: t.awayScore, winner: t.winner } : null, tipped,
        joker: jokerOn ? { active: !!(t && t.isJoker), locked: jokerLocked } : null,
        soon: ms < 3 * 3600 * 1000, when: ms < 3 * 3600 * 1000 ? `${hm(deadline)} · ${untilLabel(ms, L)}` : whenLabel(deadline, now, L),
      });
      return;
    }
    const started = new Date(m.matchTime) <= now || m.status !== 'scheduled';
    // tipy ostatných až po začiatku zápasu (dovtedy by sa dali odpísať)
    const os = started ? (others.get(m.id) || []).map((o) => ({
      name: userName(o.User), initials: userInitials(o.User), image: o.User && o.User.profileImage, color: avColor(o.userId),
      tip: tipText(m.tipType, o), points: o.points, joker: !!o.isJoker,
    })).sort((a, b) => (b.points || 0) - (a.points || 0)) : [];
    // ako tipovali ostatní — až po začiatku zápasu
    const crowd = started ? require('../utils/crowd.util').crowdStats(m, [...(others.get(m.id) || []), ...(t ? [t] : [])]) : null;
    done.push({
      crowd,
      lone: !!(crowd && m.tipType === 'exact_score' && crowd.exactCount === 1 && crowd.exactIds[0] === meId),
      id: m.id, type: m.tipType, home: team(m.homeTeam), away: team(m.awayTeam),
      state: m.status === 'finished' ? 'finished' : (m.status === 'canceled' ? 'canceled' : (started ? 'live' : 'waiting')),
      result: m.status === 'finished' && m.homeScore != null ? `${m.homeScore}:${m.awayScore}` : null,
      when: dt.fmtDate(m.matchTime) + ' · ' + hm(m.matchTime),
      myTip: tipText(m.tipType, t), myPoints: t && m.status === 'finished' ? (t.points || 0) : null,
      myJoker: !!(t && t.isJoker),
      others: os,
    });
  });
  // ešte netipovateľné (naplánované) hore, odohrané od najnovšieho
  done.sort((a, b) => ({ waiting: 0, live: 1, finished: 2, canceled: 3 })[a.state] - ({ waiting: 0, live: 1, finished: 2, canceled: 3 })[b.state]);

  const board = (await leaderboardWithUsers({ roundIds: [round.id] }, ['id', 'username', 'firstName', 'lastName', 'profileImage']))
    .map((r, i) => ({ rank: i + 1, name: userName(r.user), initials: userInitials(r.user), image: r.user.profileImage, color: avColor(r.user.id), points: r.totalPoints, me: r.user.id === meId }));
  const meRow = board.find((r) => r.me);
  const myPoints = [...mine.values()].reduce((sum, t) => sum + (t.points || 0), 0);
  const s = league.scoringSystem || { exactScore: 10, correctWinner: 3, goalDifference: 2, correctGoals: 1 };
  const season = league.Season;

  // ZDIEĽANIE VÝSLEDKU (obrázok do story) — keď mám aspoň jeden vyhodnotený tip
  const finishedMine = matches.filter((m) => m.status === 'finished' && mine.has(m.id));
  let share = null;
  if (access.member && finishedMine.length) {
    const base = (t) => (t.isJoker ? Math.floor((t.points || 0) / 2) : (t.points || 0));
    const exact = finishedMine.filter((m) => m.tipType === 'exact_score' && base(mine.get(m.id)) >= (s.exactScore || 10)).length;
    share = {
      league: league.name, round: round.name, initials: initials(league.name), grad: grad(league.name),
      points: myPoints, rank: meRow ? meRow.rank : null, players: board.length,
      exact, hits: finishedMine.filter((m) => (mine.get(m.id).points || 0) > 0).length,
      tips: mine.size, joker: [...mine.values()].some((t) => t.isJoker),
      code: league.hasPassword ? null : league.joinCode,
      url: 'https://tifo.sk',
      matches: finishedMine.map((m) => {
        const tp = mine.get(m.id); const b = base(tp);
        const full = m.tipType === 'exact_score' ? b >= (s.exactScore || 10) : (tp.points || 0) > 0;
        return {
          home: m.homeTeam ? m.homeTeam.name : '?', away: m.awayTeam ? m.awayTeam.name : '?',
          result: m.homeScore != null ? `${m.homeScore}:${m.awayScore}` : null, tip: tipText(m.tipType, tp),
          pts: tp.points || 0, joker: !!tp.isJoker, hit: full ? 'exact' : ((tp.points || 0) > 0 ? 'part' : 'miss'),
        };
      }),
      board: shareBoard(board),
      labels: {
        ...shareLabels(L),
        got: L.t('share.got'), pts: L.tn(myPoints, 'point'), rank: L.t('share.rank'),
        exact: L.t('share.exact'), hits: L.t('share.hits'), tips: L.tn(mine.size, 'tip'),
        joker: L.t('share.joker'), cta: L.t('share.cta'), code: L.t('share.code'),
        text: L.t('share.text', { p: myPoints, r: round.name }),
      },
    };
  }

  res.render('app/kolo', {
    share,
    title: round.name, screen: 'kolo', appTab: 'home',
    round: {
      id: round.id, name: round.name, description: round.description || '', status,
      opens: whenLabel(round.startDate, now, L), deadline: whenLabel(round.endDate, now, L),
    },
    league: {
      id: league.id, name: league.name, image: league.image || (season && season.image) || null,
      grad: grad(league.name), initials: initials(league.name), member: access.member, locked,
    },
    isManager, canEdit: isManager && !league.templateId,
    canTip, open, done, jokerOn,
    total: open.length + done.length,
    tippedOpen: open.filter((m) => m.tipped).length,
    myPoints, myRank: meRow ? meRow.rank : null,
    board: board.slice(0, 20), meRow: meRow && meRow.rank > 20 ? meRow : null,
    scoring: s,
  });
});

// GET /app/sezona/:id — detail sezóny v dizajne obrazovky ligy
const sezona = asyncHandler(async (req, res) => {
  const meId = Number(req.session.userId);
  const season = await Season.findByPk(req.params.id);
  if (!season) return res.redirect('/app/home');
  const leagues = await League.findAll({ where: { seasonId: season.id, isTemplate: false }, order: [['createdAt', 'ASC']] });
  // samostatná liga (turnaj) = sezóna s jedinou ligou → obrazovka ligy
  if (season.mode === 'standalone' && leagues.length) return res.redirect(`/app/liga/${leagues[0].id}`);

  const [membership, me] = await Promise.all([
    UserSeason.findOne({ where: { userId: meId, seasonId: season.id } }),
    User.findByPk(meId, { attributes: ['role'] }),
  ]);
  const isMember = !!membership;
  const isAdmin = !!(me && me.role === 'admin');
  const isCreator = season.creatorId === meId;
  const canManage = isCreator || isAdmin;
  const status = seasonStatus(season);
  const ended = status === 'ended';
  const canCreateLeague = !ended && (canManage || !!(membership && membership.role === 'admin'));
  const canView = canViewSeasonContent(season, { isMember, isCreator, isGlobalAdmin: isAdmin });

  const base = {
    title: season.name, screen: 'sezona', appTab: 'home',
    season: {
      id: season.id, name: season.name, description: canView ? (season.description || '') : '',
      image: season.image || null, grad: grad(season.name), initials: initials(season.name),
      official: season.type === 'official', status, ended, hasPassword: !!season.hasPassword,
      inviteCode: canView ? season.inviteCode : null,
    },
    isMember, isCreator, canManage, canCreateLeague, locked: !canView,
    stopCompeting: isCreator && isAdmin && season.type === 'official',
  };
  if (!canView) return res.render('app/sezona', { ...base, mySeason: null, leagues: [], board: [], news: [], rules: '', participants: 0, myRank: null, myPoints: 0 });

  const ids = leagues.map((l) => l.id);
  const [memberRows, myRows, participants, board, news] = await Promise.all([
    ids.length ? UserLeague.findAll({ where: { leagueId: ids }, attributes: ['leagueId', [Sequelize.fn('COUNT', Sequelize.col('user_id')), 'n']], group: ['leagueId'], raw: true }) : [],
    ids.length ? UserLeague.findAll({ where: { leagueId: ids, userId: meId }, attributes: ['leagueId'], raw: true }) : [],
    UserSeason.count({ where: { seasonId: season.id } }),
    require('../utils/standings.util').seasonLeaderboard(season.id).catch(() => []),
    season.showNews !== false ? require('./page.controller').seasonNews(leagues) : [],
  ]);
  const cnt = new Map(memberRows.map((r) => [Number(r.leagueId), Number(r.n)]));
  const mineSet = new Set(myRows.map((r) => Number(r.leagueId)));
  const rows = board.map((r, i) => ({ rank: i + 1, name: userName(r.user), initials: userInitials(r.user), image: r.user && r.user.profileImage, color: avColor(r.user && r.user.id), points: r.totalPoints, me: !!(r.user && r.user.id === meId) }));
  const meRow = rows.find((r) => r.me);
  res.render('app/sezona', {
    ...base,
    mySeason: isMember ? await seasonShareFor(req.L, meId, season) : null,
    leagues: leagues.map((l) => ({
      id: l.id, name: l.name, image: l.image || season.image || null, grad: grad(l.name), initials: initials(l.name),
      players: cnt.get(l.id) || 0, member: mineSet.has(l.id), ended: isLeagueLocked(l), hasPassword: !!l.hasPassword,
    })),
    board: rows.slice(0, 100), meRow: meRow && meRow.rank > 100 ? meRow : null,
    myRank: meRow ? meRow.rank : null, myPoints: meRow ? meRow.points : 0,
    participants,
    rules: season.showRules !== false ? (season.rules || '') : '',
    news: news.map((n) => ({ title: n.title, tag: n.tagText, when: dt.fmtDate(n.at) })),
  });
});

// GET /app/notifikacie
const NOTI_GROUPS = {
  tipy: ['deadline', 'new_round'],
  vysledky: ['result', 'canceled'],
  ligy: ['member', 'season', 'duel'],
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
    const label = req.L.t(k === today ? 'day.today' : (k === yest ? 'day.yesterday' : 'day.older'));
    let g = groups[groups.length - 1];
    if (!g || g.label !== label) { g = { label, items: [] }; groups.push(g); }
    g.items.push({
      id: n.id, type: n.type, title: n.title, message: n.message,
      link: n.link || null, read: !!n.read,
      time: k === today || k === yest ? hm(n.createdAt) : dt.fmtDateShort(n.createdAt),
    });
  });
  res.render('app/notifikacie', { title: req.L.t('title.noti'), screen: 'notifikacie', appTab: 'noti', groups, f, unreadTips });
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
    title: req.L.t('title.profile'), screen: 'profil', appTab: 'profile',
    me: {
      name: userName(me), username: me ? me.username : '', initials: userInitials(me), image: me && me.profileImage,
      since: me ? (() => {
        if (req.L.lang === 'en') return new Date(me.createdAt).toLocaleDateString('en-GB', { timeZone: TZ, month: 'long', year: 'numeric' });
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

// GET /app/pridat — pridať sa do ligy (kód / oficiálne súťaže) alebo vytvoriť ligu
const appLeague = require('../utils/app-league');
const pridat = asyncHandler(async (req, res) => {
  const meId = Number(req.session.userId);
  const [official, templates, allow] = await Promise.all([
    appLeague.listOfficial(meId), appLeague.listTemplates(), appLeague.createAllowance(meId),
  ]);
  const tab = req.query.tab === 'vytvorit' ? 'vytvorit' : 'pridat';
  const code = String(req.query.code || req.query.kod || '').trim().toUpperCase().slice(0, 32);
  res.render('app/pridat', {
    title: req.L.t('title.add'), screen: 'pridat', appTab: 'home',
    tab, code,
    official: official.map((l) => ({ ...l, grad: grad(l.name), initials: initials(l.name) })),
    templates: templates.map((t) => ({ ...t, grad: grad(t.name), initials: initials(t.name) })),
    allow, nameMax: appLeague.NAME_MAX,
  });
});

function appLeagueFail(req, res, e) {
  if (!(e instanceof appLeague.AppLeagueError)) throw e;
  const L = i18n.forLang(i18n.resolveLang(req));
  const msg = L.t('join.err.' + e.code, { n: e.limit });
  return res.status(e.status || 400).json({ success: false, code: e.code, needPassword: !!e.needPassword, message: msg });
}
const leagueDest = (r) => (r.leagueId ? `/app/liga/${r.leagueId}` : `/seasons/${r.seasonId}`);

// POST /api/app/join { code, password } | { leagueId }
const apiJoin = asyncHandler(async (req, res) => {
  const meId = Number(req.session.userId);
  const b = req.body || {};
  try {
    let code = b.code;
    // zamknutá liga (bez zobrazeného kódu): pripojenie cez id + HESLO ligy;
    // bez hesla by id obišlo kód, preto len pre ligy s heslom
    if (b.sid) {
      const se = await Season.findByPk(Number(b.sid), { attributes: ['inviteCode', 'hasPassword'] });
      code = se && se.hasPassword ? se.inviteCode : '__none__';
    }
    if (b.lid) {
      const l = await League.findByPk(Number(b.lid), { attributes: ['joinCode', 'hasPassword'] });
      code = l && l.hasPassword ? l.joinCode : '__none__';
    }
    const r = b.leagueId ? await appLeague.joinOfficial(meId, b.leagueId) : await appLeague.joinByCode(meId, code, b.password);
    res.json({ success: true, created: r.created, leagueId: r.leagueId || null, redirect: leagueDest(r) });
  } catch (e) { appLeagueFail(req, res, e); }
});

// POST /api/app/leagues { name, templateId, tipType, password }
const apiCreate = asyncHandler(async (req, res) => {
  const meId = Number(req.session.userId);
  try {
    const r = await appLeague.createLeague(meId, req.body || {});
    res.status(201).json({ success: true, ...r, redirect: `/app/liga/${r.leagueId}` });
  } catch (e) { appLeagueFail(req, res, e); }
});

module.exports = {
  appLogin, entry, welcome, home, tipovat, rebricky, rebricek, liga, kolo, sezona, notifikacie, profil, pridat, apiJoin, apiCreate,
  _internal: { initials, teamAbbr, untilLabel, whenLabel, sparkPath, pl, shareLabels, shareBoard, grad, useLang, seasonShareFor },
};
