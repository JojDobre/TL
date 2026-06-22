// backend/src/controllers/statsPage.controller.js
//
// Štatistiky prihláseného hráča (/stats). Agregácia z jeho VYHODNOTENÝCH tipov
// naprieč všetkými ligami. Len reálne dáta; trendy/história poradia (ktoré
// netrackujeme) sa nezobrazujú.

const { Tip, Match, Round, Team, League, User, Sequelize } = require('../models');
const Op = Sequelize.Op;
const { asyncHandler } = require('../middleware/error.middleware');

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

  // Váha úspešnosti tipu (0–1) podľa toho, čo hráč trafil — prepočítané priamo
  // z tipu a výsledku zápasu (nezávisí od bodovacieho systému ligy):
  //   presný výsledok        → 1.0
  //   správny víťaz/remíza    → 0.5
  //   gólový rozdiel ALEBO počet gólov jedného tímu → 0.25
  //   inak                   → 0
  // Pri tipe typu 'winner' sa dá dosiahnuť len 0.5 (trafený víťaz) alebo 0.
  function tipQualityWeight(tip, match) {
    const hs = match.homeScore;
    const as = match.awayScore;
    if (hs == null || as == null) return 0;
    const actual = hs > as ? 'home' : (hs < as ? 'away' : 'draw');
    if (match.tipType === 'winner') {
      return tip.winner && tip.winner === actual ? 0.5 : 0;
    }
    if (tip.homeScore == null || tip.awayScore == null) return 0;
    if (tip.homeScore === hs && tip.awayScore === as) return 1.0;
    const tipOutcome = tip.homeScore > tip.awayScore ? 'home' : (tip.homeScore < tip.awayScore ? 'away' : 'draw');
    if (tipOutcome === actual) return 0.5;
    if ((tip.homeScore - tip.awayScore) === (hs - as)) return 0.25;
    if (tip.homeScore === hs || tip.awayScore === as) return 0.25;
    return 0;
  }

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
  let rankProgress = [];
  const officialLeagues = await League.findAll({ where: { type: 'official' }, attributes: ['id'] });
  const offLeagueIds = officialLeagues.map((l) => l.id);

  if (offLeagueIds.length) {
    const offRounds = await Round.findAll({
      where: { leagueId: { [Op.in]: offLeagueIds } },
      attributes: ['id'],
    });
    const offRoundIds = offRounds.map((r) => r.id);

    if (offRoundIds.length) {
      const allTips = await Tip.findAll({
        where: { points: { [Op.ne]: null } },
        attributes: ['userId', 'points', 'matchId'],
        include: [{
          model: Match,
          attributes: ['id', 'roundId', 'status', 'updatedAt'],
          where: { status: 'finished', roundId: { [Op.in]: offRoundIds } },
          required: true,
        }],
      });

      if (allTips.length) {
        function dayKey(d) {
          const x = new Date(d);
          return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
        }
        const pointsByDayUser = {};
        allTips.forEach((t) => {
          const when = t.Match.updatedAt || t.Match.createdAt;
          const k = dayKey(when);
          if (!pointsByDayUser[k]) pointsByDayUser[k] = {};
          pointsByDayUser[k][t.userId] = (pointsByDayUser[k][t.userId] || 0) + (t.points || 0);
        });

        const today = new Date();
        const startWin = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        startWin.setDate(startWin.getDate() - 29); // 30 dní vrátane dnes
        const startKey = dayKey(startWin);

        const cumByUser = {};
        const allDays = Object.keys(pointsByDayUser).sort();
        // 1) napočítaj všetko PRED oknom do kumulatívu
        allDays.forEach((k) => {
          if (k < startKey) {
            const per = pointsByDayUser[k];
            Object.keys(per).forEach((uid) => { cumByUser[uid] = (cumByUser[uid] || 0) + per[uid]; });
          }
        });
        // 2) prejdi 30 dní okna
        for (let i = 0; i < 30; i++) {
          const d = new Date(startWin);
          d.setDate(startWin.getDate() + i);
          const k = dayKey(d);
          const per = pointsByDayUser[k];
          if (per) {
            Object.keys(per).forEach((uid) => { cumByUser[uid] = (cumByUser[uid] || 0) + per[uid]; });
          }
          if (cumByUser[meId] != null) {
            const myTotal = cumByUser[meId];
            let rank = 1;
            Object.keys(cumByUser).forEach((uid) => { if (cumByUser[uid] > myTotal) rank += 1; });
            rankProgress.push({ date: k, rank, points: myTotal, players: Object.keys(cumByUser).length });
          }
        }
      }
    }
  }

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