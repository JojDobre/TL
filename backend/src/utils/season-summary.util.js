// backend/src/utils/season-summary.util.js
//
// SEZÓNNE ZHRNUTIE hráča („moja sezóna“): body, poradie, presné výsledky,
// presnosť, odohrané kolá, najlepšie kolo a tím, na ktorom získal najviac bodov.
// Slúži pre kartu na zdieľanie (public/js/share-card.js, štýl „season“).

const { sequelize, Sequelize } = require('../models');
const { standings, seasonLeaderboard, accuracyOf } = require('./standings.util');

const select = (sql, replacements) => sequelize.query(sql, { replacements, type: Sequelize.QueryTypes.SELECT });

// null, ak hráč v sezóne nemá žiadny vyhodnotený tip
async function seasonSummary(userId, seasonId) {
  const [mine] = await standings({ seasonId, userIds: [userId] });
  if (!mine || !mine.evaluated) return null;
  const [board, rounds, teams] = await Promise.all([
    seasonLeaderboard(seasonId),
    select(`
      SELECT r.id, r.name, COALESCE(SUM(t.points), 0) AS pts
        FROM tips t JOIN matches m ON m.id = t.match_id JOIN rounds r ON r.id = m.round_id
        JOIN leagues l ON l.id = r.league_id
       WHERE t.user_id = ? AND l.season_id = ? AND m.status = 'finished'
       GROUP BY r.id, r.name ORDER BY pts DESC, r.end_date DESC`, [userId, seasonId]),
    select(`
      SELECT tm.name, SUM(x.pts) AS pts, COUNT(*) AS n FROM (
        SELECT m.home_team_id AS team_id, t.points AS pts FROM tips t JOIN matches m ON m.id = t.match_id
          JOIN rounds r ON r.id = m.round_id JOIN leagues l ON l.id = r.league_id
         WHERE t.user_id = ? AND l.season_id = ? AND m.status = 'finished'
        UNION ALL
        SELECT m.away_team_id, t.points FROM tips t JOIN matches m ON m.id = t.match_id
          JOIN rounds r ON r.id = m.round_id JOIN leagues l ON l.id = r.league_id
         WHERE t.user_id = ? AND l.season_id = ? AND m.status = 'finished'
      ) x JOIN teams tm ON tm.id = x.team_id
      GROUP BY tm.id, tm.name HAVING n >= 2 ORDER BY pts DESC, n DESC LIMIT 1`, [userId, seasonId, userId, seasonId]),
  ]);
  const idx = board.findIndex((r) => r.user && r.user.id === Number(userId));
  const best = rounds[0] && Number(rounds[0].pts) > 0 ? { name: rounds[0].name, pts: Number(rounds[0].pts) } : null;
  return {
    points: mine.points,
    rank: idx >= 0 ? idx + 1 : null,
    players: board.length,
    exact: mine.exact,
    accuracy: accuracyOf(mine),
    tips: mine.tips,
    rounds: rounds.length,
    best,
    team: teams[0] && Number(teams[0].pts) > 0 ? teams[0].name : null,
  };
}

module.exports = { seasonSummary };
