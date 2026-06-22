// backend/src/controllers/comparePage.controller.js
//
// Porovnanie dvoch hráčov hlava na hlavu (/compare?with=:id). Porovnáva
// prihláseného používateľa (ja) s cieľovým hráčom (with): celkové štatistiky,
// postavenie v spoločných súťažiach a spoločné kolá (kde obaja tipovali).
// Len reálne dáta.

const { Tip, Match, Round, League, Season, User, UserLeague, Sequelize } = require('../models');
const { Op } = Sequelize;
const { asyncHandler } = require('../middleware/error.middleware');
const { evaluateUser } = require('../utils/achievement.engine');

const DEFAULT_EXACT = 10;

// agregáty jedného hráča (body, presnosť, séria, presné výsledky, per-round body)
async function playerStats(userId) {
  const tips = await Tip.findAll({
    where: { userId },
    include: [{
      model: Match,
      attributes: ['id', 'roundId', 'status', 'tipType'],
      include: [{
        model: Round, attributes: ['id', 'name', 'leagueId', 'startDate'],
        include: [{ model: League, attributes: ['id', 'name', 'scoringSystem'] }],
      }],
    }],
  });

  let totalPoints = 0; let evaluated = 0; let exactCount = 0;
  const roundAgg = {}; // roundId -> { name, leagueId, leagueName, start, points }
  for (const t of tips) {
    totalPoints += t.points || 0;
    const m = t.Match; if (!m) continue;
    const round = m.Round; const league = round && round.League;
    const exactPts = (league && league.scoringSystem && league.scoringSystem.exactScore) || DEFAULT_EXACT;
    if (m.status === 'finished') {
      evaluated += 1;
      if (m.tipType !== 'winner' && (t.points || 0) >= exactPts) exactCount += 1;
    }
    if (round) {
      if (!roundAgg[round.id]) roundAgg[round.id] = { name: round.name, leagueId: round.leagueId, leagueName: league ? league.name : '', start: round.startDate || null, points: 0 };
      roundAgg[round.id].points += (t.points || 0);
    }
  }
  const accuracy = evaluated > 0 ? Math.round((exactCount / evaluated) * 100) : 0;

  // najdlhšia séria kôl s bodmi (zoradené dátumom)
  const arr = Object.values(roundAgg).sort((a, b) => {
    const ta = a.start ? new Date(a.start).getTime() : 0; const tb = b.start ? new Date(b.start).getTime() : 0; return ta - tb;
  });
  let bestStreak = 0; let cur = 0;
  arr.forEach((r) => { cur = r.points > 0 ? cur + 1 : 0; if (cur > bestStreak) bestStreak = cur; });

  return { totalPoints, accuracy, exactCount, bestStreak, roundAgg };
}

// rebríček ligy (userId -> body)
async function leagueBoard(leagueId) {
  const rounds = await Round.findAll({ where: { leagueId }, attributes: ['id'] });
  const roundIds = rounds.map((r) => r.id);
  const byUser = {};
  if (!roundIds.length) return byUser;
  const tips = await Tip.findAll({
    include: [{ model: Match, attributes: ['id'], where: { roundId: { [Op.in]: roundIds } }, required: true }],
    attributes: ['userId', 'points'],
  });
  tips.forEach((t) => { byUser[t.userId] = (byUser[t.userId] || 0) + (t.points || 0); });
  return byUser;
}
function rankOf(board, userId) {
  const arr = Object.entries(board).map(([uid, pts]) => ({ uid: Number(uid), pts })).sort((a, b) => b.pts - a.pts);
  const idx = arr.findIndex((x) => x.uid === Number(userId));
  return idx >= 0 ? idx + 1 : null;
}
function nameOf(u) { return [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username; }
function initials(u) { return ([u.firstName, u.lastName].filter(Boolean).map((x) => x[0]).join('') || u.username[0] || '?').toUpperCase(); }

// GET /compare?with=:id
const comparePage = asyncHandler(async (req, res) => {
  const meId = Number(req.session.userId);
  const otherId = Number(req.query.with);

  if (!otherId || otherId === meId) {
    return res.status(400).render('error-page', { message: 'Vyber hráča, s ktorým sa chceš porovnať.' });
  }

  const [me, other] = await Promise.all([
    User.findByPk(meId, { attributes: { exclude: ['password', 'email'] } }),
    User.findByPk(otherId, { attributes: { exclude: ['password', 'email'] } }),
  ]);
  if (!other) return res.status(404).render('error-page', { message: 'Hráč sa nenašiel.' });

  const [meStats, otherStats] = await Promise.all([playerStats(meId), playerStats(otherId)]);

  // odznaky oboch (počet)
  let meBadges = 0; let otherBadges = 0;
  try { meBadges = (await evaluateUser(meId)).earnedCount; } catch { /* nič */ }
  try { otherBadges = (await evaluateUser(otherId)).earnedCount; } catch { /* nič */ }

  // ── spoločné súťaže (prienik líg) ──
  const [meMems, otherMems] = await Promise.all([
    UserLeague.findAll({ where: { userId: meId }, attributes: ['leagueId'] }),
    UserLeague.findAll({ where: { userId: otherId }, attributes: ['leagueId'] }),
  ]);
  const meLeagueIds = new Set(meMems.map((m) => m.leagueId));
  const commonIds = [...new Set(otherMems.map((m) => m.leagueId))].filter((id) => meLeagueIds.has(id));

  const sharedStandings = [];
  let myBestPositions = 0; let otherBestPositions = 0; // kto je vyššie vo viacerých ligách
  if (commonIds.length) {
    const leagues = await League.findAll({ where: { id: { [Op.in]: commonIds } }, attributes: ['id', 'name'] });
    for (const l of leagues) {
      const board = await leagueBoard(l.id);
      const myRank = rankOf(board, meId);
      const otherRank = rankOf(board, otherId);
      if (myRank && otherRank) {
        if (myRank < otherRank) myBestPositions += 1; else if (otherRank < myRank) otherBestPositions += 1;
      }
      sharedStandings.push({ name: l.name, myRank, otherRank });
    }
  }

  // ── spoločné kolá (kde obaja tipovali) — porovnanie bodov za kolo ──
  const sharedRounds = [];
  let myRoundWins = 0; let otherRoundWins = 0;
  Object.keys(meStats.roundAgg).forEach((rid) => {
    if (otherStats.roundAgg[rid]) {
      const mine = meStats.roundAgg[rid];
      const theirs = otherStats.roundAgg[rid];
      sharedRounds.push({
        name: mine.name, leagueName: mine.leagueName,
        start: mine.start,
        myPoints: mine.points, otherPoints: theirs.points,
      });
      if (mine.points > theirs.points) myRoundWins += 1;
      else if (theirs.points > mine.points) otherRoundWins += 1;
    }
  });
  // najnovšie kolá hore, zobrazíme posledných 10
  sharedRounds.sort((a, b) => {
    const ta = a.start ? new Date(a.start).getTime() : 0; const tb = b.start ? new Date(b.start).getTime() : 0; return tb - ta;
  });
  const sharedRoundsTop = sharedRounds.slice(0, 6);

  // celkové vedenie podľa pozícií v spoločných ligách
  let leadLabel = 'Nerozhodne';
  let leadStyle = 'background:var(--surface-3);color:var(--text-3)';
  if (myBestPositions > otherBestPositions) { leadLabel = `Vedieš ${myBestPositions} : ${otherBestPositions}`; leadStyle = 'background:var(--success-soft);color:var(--success)'; }
  else if (otherBestPositions > myBestPositions) { leadLabel = `Prehrávaš ${myBestPositions} : ${otherBestPositions}`; leadStyle = 'background:var(--danger-soft);color:var(--danger)'; }
  else if (myBestPositions + otherBestPositions > 0) { leadLabel = `Stav ${myBestPositions} : ${otherBestPositions}`; }

  // najlepšia pozícia každého (naprieč spoločnými ligami) pre VS banner
  const myVsRank = sharedStandings.reduce((best, s) => (s.myRank && (best === null || s.myRank < best) ? s.myRank : best), null);
  const otherVsRank = sharedStandings.reduce((best, s) => (s.otherRank && (best === null || s.otherRank < best) ? s.otherRank : best), null);

  // pomocná funkcia pre šírky barov (podiel z oboch hodnôt)
  function split(a, b) {
    const sum = (a || 0) + (b || 0);
    if (sum <= 0) return [50, 50];
    return [Math.round((a / sum) * 100), Math.round((b / sum) * 100)];
  }

  res.render('compare', {
    me: { name: nameOf(me), username: me.username, initials: initials(me), vsRank: myVsRank },
    other: { id: other.id, name: nameOf(other), username: other.username, initials: initials(other), vsRank: otherVsRank },
    lead: { label: leadLabel, style: leadStyle },
    metrics: [
      { label: 'Celkové body', a: meStats.totalPoints, b: otherStats.totalPoints, split: split(meStats.totalPoints, otherStats.totalPoints) },
      { label: 'Presnosť tipov', a: meStats.accuracy, b: otherStats.accuracy, suffix: ' %', split: split(meStats.accuracy, otherStats.accuracy) },
      { label: 'Najdlhšia séria', a: meStats.bestStreak, b: otherStats.bestStreak, split: split(meStats.bestStreak, otherStats.bestStreak) },
      { label: 'Presné výsledky', a: meStats.exactCount, b: otherStats.exactCount, split: split(meStats.exactCount, otherStats.exactCount) },
      { label: 'Odznaky', a: meBadges, b: otherBadges, split: split(meBadges, otherBadges) },
    ],
    sharedStandings,
    sharedRounds: sharedRoundsTop,
    roundWins: { me: myRoundWins, other: otherRoundWins, total: sharedRounds.length },
    hasShared: commonIds.length > 0,
  });
});

module.exports = { comparePage };
