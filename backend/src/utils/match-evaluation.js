// backend/src/utils/match-evaluation.js
//
// Jediné miesto, kde sa zapisuje výsledok zápasu a prepočítavajú body.
// Používa ho ručné vyhodnotenie (POST /api/matches/:id/evaluate) aj automatické
// vyhodnocovanie výsledkov (utils/auto-results.js).
//
// applyResult():
//   • zapíše skóre/stav zápasu,
//   • prepočíta body všetkých tipov (hromadne — jeden UPDATE na každú
//     rôznu hodnotu bodov, nie jeden UPDATE na tip),
//   • prenesie výsledok do klonov šablóny a prepočíta ich tipy podľa
//     bodovania ich vlastnej ligy,
//   • rozošle notifikácie a spustí achievementy na pozadí,
//   • vyprázdni cache rebríčkov.

const { Match, Round, League, Season, Tip, sequelize } = require('../models');
const notify = require('./notification.service');
const { invalidate } = require('./standings.util');

const DEFAULT_SCORING = { exactScore: 10, correctGoals: 1, correctWinner: 3, goalDifference: 2 };

// výsledok zápasu z dvoch skóre: 'home' | 'away' | 'draw'
const outcome = (home, away) => (home > away ? 'home' : home < away ? 'away' : 'draw');

// typy, kde sa tipuje len víťaz (1/X/2 alebo 1/2 bez remízy)
const isWinnerType = (t) => t === 'winner' || t === 'winner_no_draw';

/**
 * Vypočíta body za JEDEN tip podľa skutočného výsledku a bodovacieho systému.
 * Jediné miesto pravdy pre bodovanie. Vracia celé číslo bodov.
 *
 * Pravidlá (predvolené): presný výsledok = exactScore (10) a NIČ ďalšie sa
 * nepripočítava (je to "plný zásah"). Inak sa sčítajú čiastkové body:
 *   - správny počet gólov domáceho tímu: correctGoals
 *   - správny počet gólov hosťujúceho tímu: correctGoals
 *   - správny víťaz/remíza: correctWinner
 *   - správny gólový rozdiel: goalDifference
 * Pri tipType 'winner' sa hodnotí len trafenie víťaza (correctWinner).
 */
function calculatePoints(tip, match, scoring) {
  const s = scoring || DEFAULT_SCORING;
  const { homeScore, awayScore, tipType } = match;

  // zrušený/nevyhodnotený zápas = 0 bodov nikomu
  if (homeScore === null || homeScore === undefined || awayScore === null || awayScore === undefined) {
    return 0;
  }
  const actual = outcome(homeScore, awayScore);

  if (isWinnerType(tipType)) {
    return tip.winner && tip.winner === actual ? s.correctWinner : 0;
  }

  // exact_score: potrebujeme tipnuté skóre
  if (tip.homeScore === null || tip.homeScore === undefined || tip.awayScore === null || tip.awayScore === undefined) {
    // hráč mal tipnúť presný výsledok, ale nemá skóre — skús aspoň víťaza, ak ho tipol
    return tip.winner && tip.winner === actual ? s.correctWinner : 0;
  }

  // presný výsledok = plný počet bodov, nič ďalšie sa nepripočítava
  if (tip.homeScore === homeScore && tip.awayScore === awayScore) {
    return s.exactScore;
  }

  let points = 0;
  if (tip.homeScore === homeScore) points += s.correctGoals;     // góly domáceho
  if (tip.awayScore === awayScore) points += s.correctGoals;     // góly hosťa
  if (outcome(tip.homeScore, tip.awayScore) === actual) points += s.correctWinner; // víťaz/remíza
  if ((tip.homeScore - tip.awayScore) === (homeScore - awayScore)) points += s.goalDifference; // gólový rozdiel
  return points;
}

// Body za tip vrátane ŽOLÍKA: ak ho hráč na tento zápas nasadil, body sa
// zdvojnásobia. Nasadiť sa dá len v lige so zapnutým žolíkom; pri vypnutí sa
// žolíky na ešte nevyhodnotených zápasoch zrušia (league.controller), takže
// isJoker = true znamená vždy dvojnásobok (aj pri opätovnom vyhodnotení).
function tipPoints(tip, match, league) {
  const base = calculatePoints(tip, match, (league && league.scoringSystem) || DEFAULT_SCORING);
  return tip.isJoker ? base * 2 : base;
}

// Hromadný zápis bodov: tipy zoskupené podľa výslednej hodnoty bodov.
async function writePoints(tips, pointsOf, transaction) {
  const groups = new Map();
  for (const tip of tips) {
    const p = pointsOf(tip);
    if (tip.points === p) continue;          // nič sa nemení
    tip.points = p;
    if (!groups.has(p)) groups.set(p, []);
    groups.get(p).push(tip.id);
  }
  for (const [points, ids] of groups) {
    // po dávkach, aby IN (...) nebol extrémne dlhý
    for (let i = 0; i < ids.length; i += 1000) {
      await Tip.update({ points }, { where: { id: ids.slice(i, i + 1000) }, transaction, hooks: false });
    }
  }
}

// Prenesie výsledok originálu do všetkých klonov (sourceMatchId = originál)
// a prepočíta ich tipy s bodovaním ICH vlastnej ligy.
async function propagateToClones(sourceMatch, transaction) {
  const clones = await Match.findAll({
    where: { sourceMatchId: sourceMatch.id },
    include: [{ model: Tip }, { model: Round, include: [{ model: League, attributes: ['scoringSystem', 'jokerEnabled'] }] }],
    transaction,
  });
  const tipperIds = [];
  for (const clone of clones) {
    clone.homeScore = sourceMatch.homeScore;
    clone.awayScore = sourceMatch.awayScore;
    clone.status = sourceMatch.status;
    await clone.save({ transaction });

    const league = clone.Round && clone.Round.League;
    const tips = clone.Tips || [];
    await writePoints(tips, (tip) => (clone.status === 'finished' ? tipPoints(tip, clone, league) : 0), transaction);
    tips.forEach((t) => tipperIds.push(t.userId));
  }
  return tipperIds;
}

// Načíta zápas s kontextom potrebným na vyhodnotenie (kolo → liga → sezóna, tipy).
function loadForEvaluation(id) {
  return Match.findByPk(id, {
    include: [
      {
        model: Round,
        include: [{
          model: League,
          attributes: ['id', 'name', 'seasonId', 'scoringSystem', 'jokerEnabled', 'creatorId', 'isTemplate'],
          include: [{ model: Season, attributes: ['id', 'creatorId'] }],
        }],
      },
      { model: Tip },
    ],
  });
}

/**
 * Zapíše výsledok zápasu a prepočíta body.
 *   result = { homeScore, awayScore, status }  status: finished | canceled | scheduled | in_progress
 *   opts.source = 'manual' | 'auto'  (zapíše sa do match.resultSource, ak stĺpec existuje)
 * Zápas musí byť načítaný s Tips a Round→League (viď loadForEvaluation).
 * Validáciu vstupu robí volajúci.
 */
async function applyResult(match, result, opts = {}) {
  const status = result.status || 'finished';
  const source = opts.source || 'manual';
  const tips = match.Tips || [];
  let message;

  const tipperIds = await sequelize.transaction(async (transaction) => {
    if (status === 'canceled') {
      // zrušený zápas: 0 bodov všetkým, skóre sa neberie do úvahy
      match.status = 'canceled';
      message = 'Zápas bol zrušený, body vynulované.';
    } else if (status === 'scheduled') {
      // vymazanie výsledku: zápas späť do stavu pred vyhodnotením
      match.status = 'scheduled';
      match.homeScore = null;
      match.awayScore = null;
      message = 'Výsledok vymazaný, body vrátené späť.';
    } else {
      match.homeScore = Number(result.homeScore);
      match.awayScore = Number(result.awayScore);
      match.status = status;
      message = 'Zápas bol vyhodnotený a body pripočítané.';
    }
    if (Match.rawAttributes.resultSource) {
      match.resultSource = status === 'scheduled' ? null : source;
    }
    await match.save({ transaction });

    const league = match.Round && match.Round.League;
    await writePoints(tips, (tip) => (match.status === 'finished' ? tipPoints(tip, match, league) : 0), transaction);

    return propagateToClones(match, transaction);
  });

  invalidate();

  // notifikácie a achievementy až po úspešnom commite.
  // Automatické dobiehanie STARÝCH zápasov (začiatok pred viac ako 2 dňami)
  // notifikácie neposiela — inak by hráči po prepojení ligy dostali desiatky
  // oznámení naraz.
  const backlog = source === 'auto' && match.matchTime
    && Date.now() - new Date(match.matchTime).getTime() > 2 * 24 * 3600 * 1000;
  if (!backlog) {
    try {
      if (match.status === 'canceled') await notify.matchCanceled(match, match.Round, tips);
      else if (match.status === 'finished') await notify.matchEvaluated(match, match.Round, tips);
    } catch (e) {
      console.error('[evaluation] notifikácia zlyhala:', e.message);
    }
  }
  if (match.status === 'finished') {
    const { evaluateInBackground } = require('./achievement.engine');
    evaluateInBackground([...tips.map((t) => t.userId), ...tipperIds]);
  }

  return { message, tipperIds };
}

module.exports = {
  DEFAULT_SCORING,
  calculatePoints,
  tipPoints,
  propagateToClones,
  loadForEvaluation,
  applyResult,
};
