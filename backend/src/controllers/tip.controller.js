// backend/src/controllers/tip.controller.js
//
// Zadávanie a načítanie tipov hráča. Prepísané na produkčnú kvalitu:
//  - UZÁVIERKA tipu = začiatok zápasu (matchTime), najneskôr koniec kola (endDate).
//    Tip sa dá zadať/zmeniť len kým now < matchTime AJ now < round.endDate.
//  - kontrola stavu zápasu (dokončený/zrušený/prebiehajúci sa netipuje)
//  - validácia skóre (celé nezáporné čísla) a víťaza
//  - asyncHandler + ApiError, žiadne debug logy, žiadny únik chýb

const { Tip, Match, User, Round, League, Team, UserLeague, Season, Sequelize } = require('../models');
const { Op } = Sequelize;
const { ApiError, asyncHandler } = require('../middleware/error.middleware');
const achievements = require('../utils/achievement.engine');
const { isLeagueLocked } = require('../utils/league.utils');

const validScore = (v) => Number.isInteger(v) && v >= 0 && v <= 99;

// GET /api/tips/match/:matchId — vlastný tip pre zápas
const getUserTipForMatch = asyncHandler(async (req, res) => {
  const tip = await Tip.findOne({ where: { userId: req.userId, matchId: req.params.matchId } });
  res.status(200).json({ success: true, data: tip });
});

// GET /api/tips/user?roundId= — vlastné tipy (voliteľne filtrované kolom)
const getUserTips = asyncHandler(async (req, res) => {
  const { roundId } = req.query;

  const matchInclude = {
    model: Match,
    required: true,
    include: [
      { model: Team, as: 'homeTeam' },
      { model: Team, as: 'awayTeam' },
      { model: Round },
    ],
  };
  // filter kolom priamo cez asociáciu (čistejšie než dva dotazy)
  if (roundId) matchInclude.where = { roundId };

  const tips = await Tip.findAll({
    where: { userId: req.userId },
    include: [matchInclude],
  });

  res.status(200).json({ success: true, data: tips });
});

// POST /api/tips — vytvor alebo uprav vlastný tip
const createOrUpdateTip = asyncHandler(async (req, res) => {
  const { matchId, homeScore, awayScore, winner } = req.body;
  const userId = req.userId;

  if (!matchId) throw new ApiError(400, 'Chýba zápas.');

  const match = await Match.findByPk(matchId, {
    include: [{ model: Round, attributes: ['id', 'startDate', 'endDate', 'leagueId'] }],
  });
  if (!match) throw new ApiError(404, 'Zápas nebol nájdený.');

  // musíš byť členom ligy, do ktorej zápas patrí
  const leagueId = match.Round ? match.Round.leagueId : null;
  if (!leagueId) throw new ApiError(400, 'Zápas nemá platné kolo/ligu.');
  const membership = await UserLeague.findOne({ where: { userId, leagueId } });
  if (!membership) {
    throw new ApiError(403, 'Tipovať môžeš len v lige, ktorej si členom. Najprv sa pripoj do ligy.');
  }

  // liga (alebo jej sezóna) ukončená → netipuje sa
  const league = await League.findByPk(leagueId, { include: [{ model: Season, attributes: ['id', 'endDate', 'ended'] }] });
  if (isLeagueLocked(league)) {
    throw new ApiError(403, 'Liga je ukončená — tipovanie nie je možné.');
  }

  // stav zápasu: po štarte / dokončený / zrušený sa netipuje
  if (match.status && match.status !== 'scheduled') {
    throw new ApiError(403, 'Tipovať možno len zápasy, ktoré sa ešte nezačali.');
  }

  // UZÁVIERKA: tip sa uzavrie pri začiatku zápasu, najneskôr na konci kola
  const now = new Date();
  const matchStart = new Date(match.matchTime);
  const roundEnd = match.Round ? new Date(match.Round.endDate) : null;
  const deadline = roundEnd && roundEnd < matchStart ? roundEnd : matchStart;
  if (now >= deadline) {
    throw new ApiError(403, 'Tipovanie pre tento zápas je už uzavreté.');
  }

  // validácia podľa typu tipu
  if (match.tipType === 'exact_score') {
    if (!validScore(homeScore) || !validScore(awayScore)) {
      throw new ApiError(400, 'Zadaj platný presný výsledok (celé nezáporné čísla).');
    }
  } else if (match.tipType === 'winner') {
    if (!['home', 'away', 'draw'].includes(winner)) {
      throw new ApiError(400, 'Zadaj platného víťaza (home/away/draw).');
    }
  } else if (match.tipType === 'winner_no_draw') {
    if (!['home', 'away'].includes(winner)) {
      throw new ApiError(400, 'Zadaj víťaza (home/away) — remíza tu nie je možná.');
    }
  }

  // priprav hodnoty
  const values = { userId, matchId, submitted: true };
  if (match.tipType === 'exact_score') {
    values.homeScore = homeScore;
    values.awayScore = awayScore;
    values.winner = homeScore > awayScore ? 'home' : homeScore < awayScore ? 'away' : 'draw';
  } else {
    values.winner = winner;
    values.homeScore = null;
    values.awayScore = null;
  }

  // vytvor alebo aktualizuj
  let tip = await Tip.findOne({ where: { userId, matchId } });
  if (tip) {
    Object.assign(tip, values);
    await tip.save();
  } else {
    try {
      tip = await Tip.create({ ...values, points: 0 });
    } catch (e) {
      // súbeh (dvojklik): tip medzitým vznikol — unikátny index (user, match)
      // zabránil duplicite, takže ho len aktualizujeme
      if (e && e.name !== 'SequelizeUniqueConstraintError') throw e;
      tip = await Tip.findOne({ where: { userId, matchId } });
      Object.assign(tip, values);
      await tip.save();
    }
  }

  // achievementy viazané na podanie tipu (prvý tip, počty, denná séria)
  achievements.evaluateInBackground([userId]);

  res.status(200).json({ success: true, message: 'Tip bol úspešne uložený.', data: tip });
});

// je tip na zápas ešte otvorený? (rovnaká uzávierka ako pri tipovaní)
function isOpen(match, now = new Date()) {
  if (match.status && match.status !== 'scheduled') return false;
  const start = new Date(match.matchTime);
  const roundEnd = match.Round && match.Round.endDate ? new Date(match.Round.endDate) : null;
  const deadline = roundEnd && roundEnd < start ? roundEnd : start;
  return now < deadline;
}

// POST /api/tips/joker { matchId, on } — nasadiť / zrušiť ŽOLÍKA (dvojnásobné
// body). Najviac jeden v kole; presunúť sa dá, kým sa pôvodný zápas nezačal.
const setJoker = asyncHandler(async (req, res) => {
  const userId = req.userId;
  const matchId = Number(req.body.matchId);
  const on = req.body.on !== false && req.body.on !== 'false';
  if (!matchId) throw new ApiError(400, 'Chýba zápas.');

  const match = await Match.findByPk(matchId, { include: [{ model: Round, attributes: ['id', 'startDate', 'endDate', 'leagueId'] }] });
  if (!match || !match.Round) throw new ApiError(404, 'Zápas nebol nájdený.');
  const league = await League.findByPk(match.Round.leagueId, { include: [{ model: Season, attributes: ['id', 'endDate', 'ended'] }] });
  if (!league || !league.jokerEnabled) throw new ApiError(403, 'Žolík nie je v tejto lige povolený.');
  if (isLeagueLocked(league)) throw new ApiError(403, 'Liga je ukončená.');
  if (!(await UserLeague.findOne({ where: { userId, leagueId: league.id } }))) {
    throw new ApiError(403, 'Žolíka môžeš nasadiť len v lige, ktorej si členom.');
  }
  if (!isOpen(match)) throw new ApiError(403, 'Zápas sa už začal — žolíka tu už nemožno meniť.');

  const tip = await Tip.findOne({ where: { userId, matchId } });
  if (!tip) throw new ApiError(400, 'Najprv zápas tipni, potom nasaď žolíka.');

  let movedFrom = null;
  if (on) {
    // žolík na inom zápase toho istého kola?
    const other = await Tip.findOne({
      where: { userId, isJoker: true, matchId: { [Op.ne]: matchId } },
      include: [{ model: Match, required: true, where: { roundId: match.roundId }, include: [{ model: Round, attributes: ['id', 'endDate'] }] }],
    });
    if (other) {
      if (!isOpen(other.Match)) throw new ApiError(409, 'Žolíka v tomto kole už máš na zápase, ktorý sa začal.');
      other.isJoker = false;
      await other.save({ hooks: false });
      movedFrom = other.matchId;
    }
  }
  tip.isJoker = on;
  await tip.save({ hooks: false });
  res.json({ success: true, on, movedFrom, message: on ? (movedFrom ? 'Žolík presunutý — za tento zápas dostaneš dvojnásobok.' : 'Žolík nasadený — za tento zápas dostaneš dvojnásobok.') : 'Žolík zrušený.' });
});

module.exports = {
  setJoker,
  getUserTipForMatch,
  getUserTips,
  createOrUpdateTip,
};