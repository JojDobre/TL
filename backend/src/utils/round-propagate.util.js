// backend/src/utils/round-propagate.util.js
//
// Propagácia TERMÍNOV zo šablóny do klonov.
//
// Klonovaná liga má vlastné Round/Match záznamy (výsledky sa čítajú z originálu
// cez Match.sourceMatchId). Správca klonu ale kolá zo šablóny upravovať nemôže,
// takže keď admin posunie kolo alebo zápas v šablóne, musí sa zmena preniesť
// do všetkých klonov — inak by tam ostali staré termíny.
//
// Propagácia je ABSOLÚTNA: klon dostane presne ten čas, ktorý je v šablóne.
// Robí sa aj pri kolách, kde už hráči tipovali (posun uzávierky je zámer admina).

const { Round, Match, Tip } = require('../models');

// Kolá klonov patriace k zdrojovému kolu šablóny.
// Staré klony (vytvorené pred pridaním sourceRoundId) sa dohľadajú cez
// Match.sourceMatchId — a rovno sa im sourceRoundId doplní (backfill), aby
// ďalšia propagácia už bežala priamo.
async function findCloneRounds(sourceRound) {
  const direct = await Round.findAll({ where: { sourceRoundId: sourceRound.id } });
  const seen = new Set(direct.map((r) => r.id));

  // backfill: nájdi zápasy klonov, ktoré ukazujú na zápasy tohto kola
  const srcMatches = await Match.findAll({
    where: { roundId: sourceRound.id },
    attributes: ['id'],
  });
  const srcIds = srcMatches.map((m) => m.id);
  if (srcIds.length) {
    const cloneMatches = await Match.findAll({
      where: { sourceMatchId: srcIds },
      attributes: ['roundId'],
      group: ['roundId'],
    });
    const roundIds = cloneMatches.map((m) => m.roundId).filter((id) => !seen.has(id));
    if (roundIds.length) {
      const extra = await Round.findAll({ where: { id: roundIds } });
      for (const r of extra) {
        if (r.id === sourceRound.id) continue;   // šablóna samotná
        r.sourceRoundId = sourceRound.id;
        await r.save();
        seen.add(r.id);
        direct.push(r);
      }
    }
  }
  return direct;
}

// Prenesie názov a termíny kola zo šablóny do klonov.
// Vracia počet aktualizovaných kôl.
async function propagateRoundSchedule(sourceRound) {
  const clones = await findCloneRounds(sourceRound);
  for (const clone of clones) {
    clone.name = sourceRound.name;
    clone.description = sourceRound.description;
    clone.startDate = sourceRound.startDate;
    clone.endDate = sourceRound.endDate;
    await clone.save();
  }
  return clones.length;
}

// Prenesie čas (a typ tipovania sa NEmení — ten si volí vlastník klonu pri
// tvorbe ligy) zo zápasu šablóny do jeho klonov.
// Vracia počet aktualizovaných zápasov.
async function propagateMatchTime(sourceMatch) {
  const clones = await Match.findAll({ where: { sourceMatchId: sourceMatch.id } });
  for (const clone of clones) {
    clone.matchTime = sourceMatch.matchTime;
    await clone.save();
  }
  return clones.length;
}

// Typ tipovania pre nový klonovaný zápas.
// Klon si typ volí pri vytvorení ligy, ale voľba sa nikde neukladá — je len na
// jednotlivých zápasoch. Preto ho odvodíme z prevažujúceho typu v danom kole
// klonu (resp. v celej lige klonu); ak sa nedá, použije sa typ zo šablóny.
async function inferTipType(cloneRound, fallback) {
  const existing = await Match.findAll({
    where: { roundId: cloneRound.id },
    attributes: ['tipType'],
  });
  let pool = existing;
  if (!pool.length) {
    const siblingRounds = await Round.findAll({
      where: { leagueId: cloneRound.leagueId },
      attributes: ['id'],
    });
    const ids = siblingRounds.map((r) => r.id);
    if (ids.length) {
      pool = await Match.findAll({ where: { roundId: ids }, attributes: ['tipType'] });
    }
  }
  if (!pool.length) return fallback;

  const tally = {};
  for (const m of pool) tally[m.tipType] = (tally[m.tipType] || 0) + 1;
  let best = fallback; let bestN = -1;
  for (const [type, n] of Object.entries(tally)) {
    if (n > bestN) { best = type; bestN = n; }
  }
  return best;
}

// Zápas pridaný do kola ŠABLÓNY sa musí objaviť aj vo všetkých klonoch toho kola.
// Vracia počet vytvorených klonovaných zápasov.
async function propagateMatchCreate(sourceMatch, sourceRound) {
  const cloneRounds = await findCloneRounds(sourceRound);
  let created = 0;
  for (const cr of cloneRounds) {
    // idempotencia — ak už klon existuje, nevytváraj druhý
    const exists = await Match.findOne({
      where: { roundId: cr.id, sourceMatchId: sourceMatch.id },
    });
    if (exists) continue;

    await Match.create({
      roundId: cr.id,
      homeTeamId: sourceMatch.homeTeamId,
      awayTeamId: sourceMatch.awayTeamId,
      matchTime: sourceMatch.matchTime,
      tipType: await inferTipType(cr, sourceMatch.tipType),
      status: sourceMatch.status || 'scheduled',
      sourceMatchId: sourceMatch.id,
    });
    created += 1;
  }
  return created;
}

// Zápas zmazaný zo ŠABLÓNY sa musí zmazať aj v klonoch — vrátane už zadaných
// tipov (tie by inak ostali visieť na neexistujúcom zápase a rátali sa do bodov).
// Vracia { matches, tips } — počty zmazaných záznamov.
async function propagateMatchDelete(sourceMatchId) {
  const clones = await Match.findAll({ where: { sourceMatchId } });
  if (!clones.length) return { matches: 0, tips: 0 };

  const ids = clones.map((m) => m.id);
  const tips = await Tip.destroy({ where: { matchId: ids } });
  for (const clone of clones) await clone.destroy();
  return { matches: clones.length, tips };
}

module.exports = {
  propagateRoundSchedule,
  propagateMatchTime,
  propagateMatchCreate,
  propagateMatchDelete,
  findCloneRounds,
};
