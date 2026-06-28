// backend/src/utils/accuracy.util.js
//
// Jednotný výpočet "presnosti tipu" naprieč celou aplikáciou (stats, leaderboards,
// profil, player, compare, rebríčky líg/kôl/sezón). Presnosť je VÁŽENÁ podľa
// kvality tipu:
//   presný výsledok                                   → 1.0
//   správny víťaz/remíza                              → 0.5
//   gólový rozdiel ALEBO počet gólov jedného tímu     → 0.25
//   inak                                              → 0
//   tip typu 'winner': trafený víťaz                  → 1.0, inak 0
//     (pri tipe len na víťaza existuje len správne/nesprávne)
//
// Sú dva spôsoby, ako získať váhu:
//  1) tipQualityWeight(tip, match) — keď máme reálne skóre zápasu aj tip
//     (najpresnejšie; nezávisí od bodovacieho systému ligy).
//  2) weightFromPoints(points, tipType, scoring) — keď máme len body a bodovací
//     systém ligy (napr. v rebríčkoch, kde sa skóre nenačítava). Odvodí váhu
//     z toho, koľko bodov tip získal.

const DEFAULT_SCORING = { exactScore: 10, correctWinner: 3, goalDifference: 2, correctGoals: 1 };

// Typy tipovania, kde sa tipuje len víťaz (1/X/2 alebo 1/2) — nie presné skóre.
// winner = s možnou remízou, winner_no_draw = bez remízy (tenis, šípky…).
function isWinnerType(tipType) {
  return tipType === 'winner' || tipType === 'winner_no_draw';
}

// Váha priamo z tipu a výsledku zápasu (0 / 0.25 / 0.5 / 1).
function tipQualityWeight(tip, match) {
  if (!match) return 0;
  const hs = match.homeScore;
  const as = match.awayScore;
  if (hs == null || as == null) return 0;
  const actual = hs > as ? 'home' : (hs < as ? 'away' : 'draw');

  if (isWinnerType(match.tipType)) {
    // tip len na víťaza (1/X/2 alebo 1/2): existuje len správne/nesprávne → 1.0 alebo 0
    return tip && tip.winner && tip.winner === actual ? 1.0 : 0;
  }
  if (!tip || tip.homeScore == null || tip.awayScore == null) return 0;
  if (tip.homeScore === hs && tip.awayScore === as) return 1.0;
  const tipOutcome = tip.homeScore > tip.awayScore ? 'home' : (tip.homeScore < tip.awayScore ? 'away' : 'draw');
  if (tipOutcome === actual) return 0.5;
  if ((tip.homeScore - tip.awayScore) === (hs - as)) return 0.25;
  if (tip.homeScore === hs || tip.awayScore === as) return 0.25;
  return 0;
}

// Váha odvodená z bodov (keď nemáme skóre, len points + bodovací systém).
// points >= exactScore  → 1.0
// points == correctWinner → 0.5
// points == goalDifference alebo correctGoals → 0.25
// 0 → 0
function weightFromPoints(points, tipType, scoring) {
  const s = scoring || DEFAULT_SCORING;
  const p = points || 0;
  if (p <= 0) return 0;
  // tip na víťaza vie získať len "correctWinner" body; trafený = plný úspech (1.0)
  if (isWinnerType(tipType)) {
    return p >= (s.correctWinner || 3) ? 1.0 : 0;
  }
  if (p >= (s.exactScore || 10)) return 1.0;
  if (p >= (s.correctWinner || 3)) return 0.5;
  // gólový rozdiel (2) alebo počet gólov jedného tímu (1)
  if (p >= (s.correctGoals || 1)) return 0.25;
  return 0;
}

// Presnosť (0–100) z poľa tipov, ak máme skóre zápasov (tip.Match s homeScore/awayScore).
// Berie len vyhodnotené (finished) zápasy. Vracia null ak nie je čo počítať.
function accuracyFromTipsWithScores(tips, getMatch) {
  let evaluated = 0;
  let weightSum = 0;
  tips.forEach((t) => {
    const m = getMatch ? getMatch(t) : t.Match;
    if (!m || m.status !== 'finished') return;
    evaluated += 1;
    weightSum += tipQualityWeight(t, m);
  });
  return evaluated > 0 ? Math.round((weightSum / evaluated) * 100) : null;
}

module.exports = {
  DEFAULT_SCORING,
  isWinnerType,
  tipQualityWeight,
  weightFromPoints,
  accuracyFromTipsWithScores,
};