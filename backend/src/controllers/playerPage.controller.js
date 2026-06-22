// backend/src/controllers/playerPage.controller.js
//
// Verejný profil hráča (/player/:id). Read-only pohľad na iného používateľa:
// verejné štatistiky, forma za posledné kolá, odznaky, spoločné súťaže s
// prihláseným (porovnanie pozícií) a najlepšie momenty (najlepšie kolá).
// Len reálne dáta; čo sa nedá odvodiť, sa vynechá alebo má neutrálny stav.

const { Tip, Match, Round, League, Season, Team, User, UserLeague, Sequelize } = require('../models');
const { Op } = Sequelize;
const { asyncHandler } = require('../middleware/error.middleware');
const { evaluateUser } = require('../utils/achievement.engine');

const DEFAULT_EXACT = 10;
const abbr2 = (n) => (n || '?').substring(0, 2).toUpperCase();

// rebríček ligy (mapa userId -> body) z bodov tipov vo všetkých kolách ligy
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

// GET /player/:id
const playerPage = asyncHandler(async (req, res) => {
  const targetId = Number(req.params.id);
  const meId = req.userId ? Number(req.userId) : null;

  // ak si pozerá vlastné ID, presmeruj na /profile
  if (meId && meId === targetId) return res.redirect('/profile');

  const user = await User.findByPk(targetId, { attributes: { exclude: ['password', 'email'] } });
  if (!user) return res.status(404).render('error-page', { message: 'Hráč sa nenašiel.' });

  // všetky tipy hráča s kontextom (kolo, liga) — pre štatistiky, formu, momenty
  const tips = await Tip.findAll({
    where: { userId: targetId },
    include: [{
      model: Match,
      attributes: ['id', 'roundId', 'status', 'tipType', 'homeScore', 'awayScore'],
      include: [
        { model: Team, as: 'homeTeam', attributes: ['name'] },
        { model: Team, as: 'awayTeam', attributes: ['name'] },
        {
          model: Round, attributes: ['id', 'name', 'leagueId', 'startDate'],
          include: [{ model: League, attributes: ['id', 'name', 'type', 'scoringSystem'] }],
        },
      ],
    }],
  });

  // ── verejné štatistiky + per-round agregát (forma) ──
  let totalPoints = 0; let evaluated = 0; let exactCount = 0;
  const roundAgg = {}; // roundId -> { name, leagueName, start, points }
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
      if (!roundAgg[round.id]) roundAgg[round.id] = { name: round.name, leagueName: league ? league.name : '', start: round.startDate || null, points: 0 };
      roundAgg[round.id].points += (t.points || 0);
    }
  }
  const accuracy = evaluated > 0 ? Math.round((exactCount / evaluated) * 100) : null;

  // forma: posledných 8 kôl podľa dátumu; W = nad priemerom, L = pod, — = okolo
  const roundsArr = Object.values(roundAgg).sort((a, b) => {
    const ta = a.start ? new Date(a.start).getTime() : 0; const tb = b.start ? new Date(b.start).getTime() : 0; return ta - tb;
  });
  const avgRoundPts = roundsArr.length ? roundsArr.reduce((s, r) => s + r.points, 0) / roundsArr.length : 0;
  const form = roundsArr.slice(-8).map((r) => {
    if (avgRoundPts <= 0) return 'd';
    if (r.points > avgRoundPts * 1.15) return 'w';
    if (r.points < avgRoundPts * 0.85) return 'l';
    return 'd';
  });

  // najlepšia séria kôl s bodmi (rovnaký princíp ako engine point_streak, naprieč)
  // jednoduchá verzia: najdlhšia séria po sebe (zoradené dátumom) s points>0
  let bestStreak = 0; let cur = 0;
  roundsArr.forEach((r) => { cur = r.points > 0 ? cur + 1 : 0; if (cur > bestStreak) bestStreak = cur; });

  // ── pozície v ligách hráča → najlepšia pozícia ──
  const tMems = await UserLeague.findAll({ where: { userId: targetId }, attributes: ['leagueId'] });
  const targetLeagueIds = tMems.map((m) => m.leagueId);
  let bestRank = null;
  const boards = {}; // leagueId -> board (cache pre spoločné súťaže)
  for (const lid of targetLeagueIds) {
    const board = await leagueBoard(lid);
    boards[lid] = board;
    const r = rankOf(board, targetId);
    if (r !== null && (bestRank === null || r < bestRank)) bestRank = r;
  }

  // ── odznaky (verejné, earned) ──
  let badges = [];
  let badgeCount = 0;
  try {
    const { items, earnedCount } = await evaluateUser(targetId);
    badgeCount = earnedCount;
    badges = items.filter((b) => b.earned).slice(0, 8).map((b) => ({ name: b.name, icon: b.icon, rarity: b.rarity }));
  } catch (e) { badges = []; }

  // ── spoločné súťaže s prihláseným (prienik líg) ──
  let shared = [];
  if (meId) {
    const myMems = await UserLeague.findAll({ where: { userId: meId }, attributes: ['leagueId'] });
    const myLeagueIds = new Set(myMems.map((m) => m.leagueId));
    const commonIds = targetLeagueIds.filter((id) => myLeagueIds.has(id));
    if (commonIds.length) {
      const leagues = await League.findAll({
        where: { id: { [Op.in]: commonIds } },
        attributes: ['id', 'name', 'type'],
        include: [{ model: Season, attributes: ['name'] }],
      });
      for (const l of leagues) {
        const board = boards[l.id] || await leagueBoard(l.id);
        shared.push({
          id: l.id, name: l.name, type: l.type,
          abbr: abbr2(l.name),
          theirRank: rankOf(board, targetId),
          myRank: rankOf(board, meId),
        });
      }
    }
  }

  // ── najlepšie momenty (top 3 kolá podľa bodov) ──
  const moments = roundsArr
    .filter((r) => r.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3)
    .map((r) => ({ points: r.points, label: r.name, context: r.leagueName }));

  const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username;

  res.render('player', {
    player: {
      id: user.id,
      name,
      username: user.username,
      role: user.role,
      initials: ([user.firstName, user.lastName].filter(Boolean).map((x) => x[0]).join('') || user.username[0] || '?').toUpperCase(),
      createdAt: user.createdAt,
    },
    stats: { totalPoints, bestRank, accuracy, bestStreak },
    form,
    badges, badgeCount,
    shared,
    moments,
    isLoggedIn: !!meId,
  });
});

module.exports = { playerPage };
