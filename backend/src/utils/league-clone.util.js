// backend/src/utils/league-clone.util.js
//
// Naklonovanie ligy zo šablóny (oficiálnej ligy s isTemplate=true) do cieľovej
// sezóny. Skopíruje KOLÁ a ZÁPASY (tímy, dátumy, typ tipovania). Každý klonovaný
// zápas má sourceMatchId = id originálneho zápasu → výsledok sa potom číta
// z originálu (jeden zdroj pravdy, žiadny sync).
//
// Nastavenia ligy (názov, bodovanie) sa NEpreberajú zo šablóny — tie si zadá
// používateľ pri tvorbe (liga je plne nastaviteľná).

const { League, Round, Match } = require('../models');

// Vytvorí klon. Vstup:
//   template     — inštancia League (šablóna)
//   targetLeague — už vytvorená cieľová liga (klon), do ktorej kopírujeme kolá/zápasy
// Vráti počet skopírovaných kôl a zápasov.
async function cloneTemplateInto(template, targetLeague) {
  // načítaj kolá šablóny so zápasmi
  const rounds = await Round.findAll({
    where: { leagueId: template.id },
    include: [{ model: Match }],
    order: [['startDate', 'ASC']],
  });

  let roundsCopied = 0;
  let matchesCopied = 0;

  for (const r of rounds) {
    const newRound = await Round.create({
      name: r.name,
      description: r.description,
      leagueId: targetLeague.id,
      startDate: r.startDate,
      endDate: r.endDate,
      active: r.active,
    });
    roundsCopied += 1;

    const matches = r.Matches || [];
    for (const m of matches) {
      await Match.create({
        roundId: newRound.id,
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        matchTime: m.matchTime,
        tipType: m.tipType,
        // výsledok sa NEkopíruje do vlastných polí — číta sa z originálu
        homeScore: null,
        awayScore: null,
        status: 'scheduled',
        sourceMatchId: m.id,   // odkaz na originál
      });
      matchesCopied += 1;
    }
  }

  return { roundsCopied, matchesCopied };
}

module.exports = { cloneTemplateInto };
