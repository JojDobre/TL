// backend/src/utils/duel.util.js
//
// SÚBOJ 1 NA 1 v jednom kole. Skóre sa nikde neukladá — vždy sa spočíta
// z bodov tipov oboch hráčov v kole. Súboj je „skončený“, keď kolo skončilo
// a žiadny zápas už nečaká na výsledok (alebo sú všetky zápasy vyhodnotené).

const { Duel, Round, League, Match, Tip, User, UserLeague, Sequelize } = require('../models');

const { Op } = Sequelize;

// je kolo uzavreté (všetky zápasy vyhodnotené / zrušené, alebo po konci kola nič nečaká)?
function roundDone(round, matches, now = new Date()) {
  if (!matches.length) return now > new Date(round.endDate);
  const pending = matches.some((m) => m.status === 'scheduled' || m.status === 'in_progress');
  return !pending && (now > new Date(round.endDate) || matches.every((m) => m.status === 'finished' || m.status === 'canceled'));
}

// skóre súboja + stav. duel musí mať roundId, challengerId, opponentId, status.
async function duelScore(duel, now = new Date()) {
  const round = duel.Round || await Round.findByPk(duel.roundId);
  const matches = await Match.findAll({ where: { roundId: duel.roundId }, attributes: ['id', 'status', 'matchTime', 'homeScore', 'awayScore', 'tipType', 'homeTeamId', 'awayTeamId'], order: [['matchTime', 'ASC']] });
  const tips = matches.length ? await Tip.findAll({
    where: { matchId: matches.map((m) => m.id), userId: [duel.challengerId, duel.opponentId] },
    attributes: ['userId', 'matchId', 'homeScore', 'awayScore', 'winner', 'points', 'isJoker'],
  }) : [];
  const pts = { [duel.challengerId]: 0, [duel.opponentId]: 0 };
  tips.forEach((t) => { pts[t.userId] = (pts[t.userId] || 0) + (t.points || 0); });
  const done = roundDone(round, matches, now);
  let state = duel.status;                       // pending | declined | canceled
  if (duel.status === 'accepted') state = done ? 'finished' : (now >= new Date(round.startDate) ? 'live' : 'ready');
  const a = pts[duel.challengerId] || 0;
  const b = pts[duel.opponentId] || 0;
  return {
    round, matches, tips, done, state,
    challengerPts: a, opponentPts: b,
    winnerId: state === 'finished' && a !== b ? (a > b ? duel.challengerId : duel.opponentId) : null,
    draw: state === 'finished' && a === b,
  };
}

// môže hráč vyzvať súpera na kolo? vracia chybovú hlášku alebo null
async function validateChallenge(meId, opponentId, round, now = new Date()) {
  if (!round) return 'Kolo neexistuje.';
  if (!opponentId || Number(opponentId) === Number(meId)) return 'Vyber súpera.';
  if (now >= new Date(round.endDate)) return 'Kolo už skončilo — vyzvi súpera na ďalšie.';
  const league = round.League || await League.findByPk(round.leagueId);
  if (!league || league.isTemplate) return 'V tejto lige sa súboje nedajú.';
  const [me, opp] = await Promise.all([
    UserLeague.findOne({ where: { userId: meId, leagueId: round.leagueId } }),
    UserLeague.findOne({ where: { userId: opponentId, leagueId: round.leagueId } }),
  ]);
  if (!me) return 'Súboj môžeš vyhlásiť len v lige, ktorej si členom.';
  if (!opp) return 'Súper nie je členom tejto ligy.';
  const oppUser = await User.findByPk(opponentId, { attributes: ['id', 'active', 'isBot'] });
  if (!oppUser || oppUser.active === false) return 'Súper neexistuje.';
  if (oppUser.isBot) return 'Tohto hráča nemožno vyzvať.';
  const exists = await Duel.findOne({
    where: {
      roundId: round.id, status: { [Op.in]: ['pending', 'accepted'] },
      [Op.or]: [{ challengerId: meId, opponentId }, { challengerId: opponentId, opponentId: meId }],
    },
  });
  if (exists) return 'S týmto hráčom už v tomto kole súboj máš.';
  const open = await Duel.count({ where: { challengerId: meId, status: 'pending' } });
  if (open >= 10) return 'Máš priveľa nevybavených výziev (max. 10). Počkaj, kým ich súperi prijmú.';
  return null;
}

module.exports = { duelScore, roundDone, validateChallenge };
