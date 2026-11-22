// backend/src/utils/joker.util.js
//
// ŽOLÍK: hráč si v kole označí jeden zápas s dvojnásobnými bodmi (ak to liga
// povolí). Presunúť ho môže, kým sa zápas so žolíkom nezačal.

const { Tip, Match, Sequelize } = require('../models');

const { Op } = Sequelize;

// kolá (z roundIds), v ktorých má hráč žolíka na zápase, ktorý sa už začal
async function lockedJokerRounds(userId, roundIds, now = new Date()) {
  if (!userId || !roundIds || !roundIds.length) return new Set();
  const used = await Tip.findAll({
    where: { userId, isJoker: true },
    attributes: ['matchId'],
    include: [{ model: Match, required: true, attributes: ['id', 'roundId', 'status', 'matchTime'], where: { roundId: { [Op.in]: roundIds } } }],
  });
  return new Set(used
    .filter((t) => t.Match.status !== 'scheduled' || new Date(t.Match.matchTime) <= now)
    .map((t) => t.Match.roundId));
}

module.exports = { lockedJokerRounds };
