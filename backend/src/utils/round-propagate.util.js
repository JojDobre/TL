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

const { Round, Match } = require('../models');

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

module.exports = { propagateRoundSchedule, propagateMatchTime, findCloneRounds };
