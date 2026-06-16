// backend/src/controllers/statsPage.controller.js
//
// Štatistiky prihláseného hráča (/stats). Agregácia z jeho VYHODNOTENÝCH tipov
// naprieč všetkými ligami. Len reálne dáta; trendy/história poradia (ktoré
// netrackujeme) sa nezobrazujú.

const { Tip, Match, Round, User } = require('../models');
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
    include: [{ model: Match, attributes: ['id', 'status', 'tipType', 'roundId'], include: [{ model: Round, attributes: ['id', 'name', 'endDate'] }] }],
    order: [['createdAt', 'ASC']],
  });

  let totalPoints = 0;
  let evaluated = 0;
  let exact = 0;       // presný výsledok (plné body)
  let partial = 0;     // niečo trafil (>0, ale nie plné)
  let zero = 0;        // 0 bodov na vyhodnotenom
  const byRound = {};  // roundId -> { name, endDate, points }

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
      if (!byRound[rid]) byRound[rid] = { name: m.Round.name, endDate: m.Round.endDate, points: 0 };
      byRound[rid].points += p;
    }
  });

  const accuracy = evaluated > 0 ? Math.round(((exact + partial) / evaluated) * 100) : null;

  // body za posledných ~12 kôl (zoradené podľa endDate)
  const rounds = Object.values(byRound)
    .sort((a, b) => new Date(a.endDate || 0) - new Date(b.endDate || 0))
    .slice(-12);
  const roundPoints = rounds.map((r) => r.points);
  const avgPerRound = roundPoints.length ? (roundPoints.reduce((a, b) => a + b, 0) / roundPoints.length) : 0;
  const bestRound = roundPoints.length ? Math.max(...roundPoints) : 0;
  const playedRoundsCount = Object.keys(byRound).length;

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
    roundBars: rounds.map((r) => ({ name: r.name, points: r.points })),
  });
});

module.exports = { statsPage };
