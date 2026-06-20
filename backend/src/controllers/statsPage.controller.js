// backend/src/controllers/statsPage.controller.js
//
// Štatistiky prihláseného hráča (/stats). Agregácia z jeho VYHODNOTENÝCH tipov
// naprieč všetkými ligami. Len reálne dáta; trendy/história poradia (ktoré
// netrackujeme) sa nezobrazujú.

const { Tip, Match, Round, Team, League, User, Sequelize } = require('../models');
const Op = Sequelize.Op;
const { asyncHandler } = require('../middleware/error.middleware');

// rozhodne, či tip dostal "plné" body (presný výsledok) — porovná s typom zápasu
function isExactHit(tip, match, exactPoints) {
  return (match.tipType !== 'winner') && (tip.points || 0) >= exactPoints;
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
    include: [{ model: Match, attributes: ['id', 'status', 'tipType', 'roundId'], include: [
      { model: Round, attributes: ['id', 'name', 'endDate', 'leagueId'], include: [{ model: League, attributes: ['id', 'name'] }] },
      { model: Team, as: 'homeTeam', attributes: ['id', 'name', 'logo'] },
      { model: Team, as: 'awayTeam', attributes: ['id', 'name', 'logo'] },
    ] }],
    order: [['createdAt', 'ASC']],
  });

  let totalPoints = 0;
  let evaluated = 0;
  let exact = 0;       // presný výsledok (plné body)
  let partial = 0;     // niečo trafil (>0, ale nie plné)
  let zero = 0;        // 0 bodov na vyhodnotenom
  const byRound = {};  // roundId -> { name, endDate, points }
  const byTeam = {};   // teamId -> { name, logo, tips, scored }

  function addTeam(team) {
    if (!team) return null;
    if (!byTeam[team.id]) byTeam[team.id] = { name: team.name, logo: team.logo || null, tips: 0, scored: 0 };
    return byTeam[team.id];
  }

  // hrubý odhad "plných" bodov: ak existuje tip s presným výsledkom, býva to
  // najvyššia hodnota; použijeme 10 ako default prah (typický exactScore),
  // ale presnejšie: tip má plné body, ak rovná sa max možnému — to nevieme bez
  // scoringu ligy, preto exact = tip.points sa rovná bodom za presný (>=10
  // pri default). Pre robustnosť berieme: exact ak points >= 10 a typ nie je winner.
  const EXACT_THRESHOLD = 10;

  tips.forEach((t) => {
    const m = t.Match;
    if (!m || m.status !== 'finished') return;
    evaluated += 1;
    const p = t.points || 0;
    totalPoints += p;
    if (isExactHit(t, m, EXACT_THRESHOLD)) exact += 1;
    else if (p > 0) partial += 1;
    else zero += 1;

    if (m.Round) {
      const rid = m.Round.id;
      if (!byRound[rid]) byRound[rid] = { name: m.Round.name, endDate: m.Round.endDate, leagueName: m.Round.League ? m.Round.League.name : '', points: 0 };
      byRound[rid].points += p;
    }

    // presnosť per tím — započítaj oba tímy zápasu
    [m.homeTeam, m.awayTeam].forEach((team) => {
      const rec = addTeam(team);
      if (rec) { rec.tips += 1; if (p > 0) rec.scored += 1; }
    });
  });

  const accuracy = evaluated > 0 ? Math.round(((exact + partial) / evaluated) * 100) : null;

  // body za posledných ~12 kôl (zoradené podľa endDate)
  const rounds = Object.values(byRound)
    .sort((a, b) => new Date(a.endDate || 0) - new Date(b.endDate || 0))
    .slice(-12);
  const roundPoints = rounds.map((r) => r.points);
  // ── VÝVOJ POZÍCIE V REBRÍČKU (len oficiálne ligy) ──────────────────────
  // Rank po každom oficiálnom kole: kumulatívne body VŠETKÝCH hráčov v
  // oficiálnych ligách, po každom kole (chronologicky) určíme moju pozíciu.
  let rankProgress = [];
  const officialLeagues = await League.findAll({ where: { type: 'official' }, attributes: ['id', 'name'] });
  const offLeagueIds = officialLeagues.map((l) => l.id);
  const leagueNameById = {};
  officialLeagues.forEach((l) => { leagueNameById[l.id] = l.name; });

  if (offLeagueIds.length) {
    const offRounds = await Round.findAll({
      where: { leagueId: { [Op.in]: offLeagueIds } },
      attributes: ['id', 'name', 'endDate', 'leagueId'],
      order: [['endDate', 'ASC']],
    });
    const offRoundIds = offRounds.map((r) => r.id);

    if (offRoundIds.length) {
      const allTips = await Tip.findAll({
        where: { points: { [Op.ne]: null } },
        attributes: ['userId', 'points', 'matchId'],
        include: [{ model: Match, attributes: ['id', 'roundId', 'status'], where: { status: 'finished', roundId: { [Op.in]: offRoundIds } }, required: true }],
      });
      const pointsByRoundUser = {}; // roundId -> { userId -> body }
      allTips.forEach((t) => {
        const rid = t.Match.roundId;
        if (!pointsByRoundUser[rid]) pointsByRoundUser[rid] = {};
        pointsByRoundUser[rid][t.userId] = (pointsByRoundUser[rid][t.userId] || 0) + (t.points || 0);
      });

      const cumByUser = {};
      offRounds.forEach((r) => {
        const perUser = pointsByRoundUser[r.id];
        if (!perUser) return;
        Object.keys(perUser).forEach((uid) => { cumByUser[uid] = (cumByUser[uid] || 0) + perUser[uid]; });
        if (cumByUser[meId] == null) return;
        const myTotal = cumByUser[meId];
        let rank = 1;
        Object.keys(cumByUser).forEach((uid) => { if (cumByUser[uid] > myTotal) rank += 1; });
        rankProgress.push({
          roundName: r.name,
          leagueName: leagueNameById[r.leagueId] || '',
          endDate: r.endDate,
          rank,
          points: myTotal,
          players: Object.keys(cumByUser).length,
        });
      });
    }
  }

  const avgPerRound = roundPoints.length ? (roundPoints.reduce((a, b) => a + b, 0) / roundPoints.length) : 0;
  const bestRound = roundPoints.length ? Math.max(...roundPoints) : 0;
  const playedRoundsCount = Object.keys(byRound).length;

  // TOP TÍMY podľa presnosti (min. 2 tipy, aby % bolo zmysluplné), top 6
  const topTeams = Object.values(byTeam)
    .filter((t) => t.tips >= 2)
    .map((t) => ({ name: t.name, logo: t.logo, tips: t.tips, scored: t.scored, accuracy: Math.round((t.scored / t.tips) * 100) }))
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