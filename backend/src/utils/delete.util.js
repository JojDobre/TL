// backend/src/utils/delete.util.js
//
// Bezpečné mazanie ligy a sezóny. Cudzie kľúče nemajú onDelete:CASCADE, preto
// upratujeme ručne v správnom poradí, celé v transakcii (buď všetko, alebo nič).
//
// Poradie pri lige: tipy → zápasy → kolá → členstvá (user_leagues) →
//                   súpiska (league_teams) → liga.
// Sezóna: najprv všetky jej ligy (rovnako), potom členstvá sezóny → sezóna.

const { League, Round, Match, Tip, UserLeague, UserSeason, LeagueTeam, sequelize, Sequelize } = require('../models');
const { Op } = Sequelize;

// Zmaže jednu ligu aj so všetkým, čo od nej závisí. Beží v poskytnutej transakcii.
async function deleteLeagueInternal(leagueId, t) {
  // kolá ligy
  const rounds = await Round.findAll({ where: { leagueId }, attributes: ['id'], transaction: t });
  const roundIds = rounds.map((r) => r.id);

  if (roundIds.length) {
    // zápasy v týchto kolách
    const matches = await Match.findAll({ where: { roundId: { [Op.in]: roundIds } }, attributes: ['id'], transaction: t });
    const matchIds = matches.map((m) => m.id);

    if (matchIds.length) {
      // tipy na tieto zápasy
      await Tip.destroy({ where: { matchId: { [Op.in]: matchIds } }, transaction: t });
      // POZN.: ak je toto šablóna a existujú KLONY s sourceMatchId, tie ostanú,
      // ale ich zápasy stratia zdroj. Mazanie šablóny preto blokujeme vyššie.
      await Match.destroy({ where: { id: { [Op.in]: matchIds } }, transaction: t });
    }
    await Round.destroy({ where: { id: { [Op.in]: roundIds } }, transaction: t });
  }

  await UserLeague.destroy({ where: { leagueId }, transaction: t });
  await LeagueTeam.destroy({ where: { leagueId }, transaction: t });
  await League.destroy({ where: { id: leagueId }, transaction: t });
}

// Verejné: zmaž ligu (vlastná transakcia).
async function deleteLeague(leagueId) {
  return sequelize.transaction(async (t) => {
    await deleteLeagueInternal(leagueId, t);
  });
}

// Verejné: zmaž sezónu vrátane všetkých jej líg a členstiev.
async function deleteSeason(seasonId) {
  return sequelize.transaction(async (t) => {
    const leagues = await League.findAll({ where: { seasonId }, attributes: ['id'], transaction: t });
    for (const lg of leagues) {
      await deleteLeagueInternal(lg.id, t);
    }
    await UserSeason.destroy({ where: { seasonId }, transaction: t });
    const { Season } = require('../models');
    await Season.destroy({ where: { id: seasonId }, transaction: t });
  });
}

module.exports = { deleteLeague, deleteSeason };
