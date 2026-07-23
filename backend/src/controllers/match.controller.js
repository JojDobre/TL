// backend/src/controllers/match.controller.js
//
// Správa zápasov + VYHODNOTENIE (srdce bodovania). Prepísané na produkčnú kvalitu:
//  - JEDNA bodovacia funkcia calculatePoints (predtým bola duplikovaná v updateMatch
//    aj evaluateMatch, každá inak — to dávalo rôzne body za ten istý tip)
//  - body ráta IBA evaluateMatch; updateMatch slúži len na úpravu zápasu (NErátá body)
//  - asyncHandler + ApiError, žiadne debug logy, žiadny únik chýb
//  - zápas s tipmi sa nedá zmazať (ochrana dát)
//  - jednotné oprávnenia (tvorca sezóny/ligy, admin sezóny, globálny admin)
//  - validácia skóre (celé nezáporné čísla)

const { Match, Round, Team, League, Season, User, UserSeason, Sequelize, Tip, UserLeague } = require('../models');
const { Op } = Sequelize;
const { ApiError, asyncHandler } = require('../middleware/error.middleware');
const { isLeagueLocked } = require('../utils/league.utils');
const notify = require('../utils/notification.service');
// Parsovanie času z formulárov v slovenskej zóne (viď utils/datetime.util.js)
const { parseLocalInput } = require('../utils/datetime.util');
// Propagácia času zápasu zo šablóny do klonov
const { propagateMatchTime } = require('../utils/round-propagate.util');

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

// oprávnenie spravovať zápas (tvorca sezóny/ligy, admin sezóny, globálny admin)
const canManageMatch = async (match, userId) => {
  if (!userId) return false;
  const user = await User.findByPk(userId);
  if (user && user.role === 'admin') return true;
  const season = match.Round && match.Round.League && match.Round.League.Season;
  const league = match.Round && match.Round.League;
  if (league && league.creatorId === userId) return true;
  if (season && season.creatorId === userId) return true;
  if (season) {
    const seasonRole = await UserSeason.findOne({ where: { userId, seasonId: season.id, role: 'admin' } });
    if (seasonRole) return true;
  }
  if (league) {
    const lRole = await UserLeague.findOne({ where: { userId, leagueId: league.id, role: 'admin' } });
    if (lRole) return true;
  }
  return false;
};

// načítaj zápas s celým kontextom (kolo → liga → sezóna)
const loadMatchWithContext = (id, withTips = false) => {
  const include = [
    {
      model: Round,
      include: [{
        model: League,
        attributes: ['id', 'seasonId', 'scoringSystem', 'creatorId', 'isTemplate'],
        include: [{ model: Season, attributes: ['id', 'creatorId'] }],
      }],
    },
  ];
  if (withTips) include.push({ model: Tip });
  return Match.findByPk(id, { include });
};

// validácia skóre: celé nezáporné číslo
const validScore = (v) => Number.isInteger(v) && v >= 0 && v <= 99;

// GET /api/matches?roundId=
const getAllMatches = asyncHandler(async (req, res) => {
  const where = {};
  if (req.query.roundId) where.roundId = req.query.roundId;

  const matches = await Match.findAll({
    where,
    include: [
      { model: Round, attributes: ['id', 'name', 'leagueId'] },
      { model: Team, as: 'homeTeam' },
      { model: Team, as: 'awayTeam' },
    ],
    order: [['matchTime', 'ASC']],
  });

  res.status(200).json({ success: true, data: matches });
});

// GET /api/matches/:id
const getMatchById = asyncHandler(async (req, res) => {
  const match = await Match.findByPk(req.params.id, {
    include: [
      { model: Round, include: [{ model: League, include: [{ model: Season }] }] },
      { model: Team, as: 'homeTeam' },
      { model: Team, as: 'awayTeam' },
    ],
  });
  if (!match) throw new ApiError(404, 'Zápas nebol nájdený.');
  res.status(200).json({ success: true, data: match });
});

// POST /api/matches
const createMatch = asyncHandler(async (req, res) => {
  const { roundId, homeTeamId, awayTeamId, matchTime, tipType } = req.body;
  const userId = req.userId;

  if (!roundId || !homeTeamId || !awayTeamId || !matchTime) {
    throw new ApiError(400, 'Vyplň kolo, oba tímy aj čas zápasu.');
  }
  if (homeTeamId === awayTeamId) {
    throw new ApiError(400, 'Domáci a hosťujúci tím nemôžu byť rovnaké.');
  }

  const round = await Round.findByPk(roundId, {
    include: [{ model: League, include: [{ model: Season, attributes: ['id', 'creatorId'] }] }],
  });
  if (!round) throw new ApiError(404, 'Kolo nebolo nájdené.');

  if (!(await canManageMatch({ Round: round }, userId))) {
    throw new ApiError(403, 'Nemáš oprávnenie vytvoriť zápas v tomto kole.');
  }

  const [homeTeam, awayTeam] = await Promise.all([Team.findByPk(homeTeamId), Team.findByPk(awayTeamId)]);
  if (!homeTeam || !awayTeam) throw new ApiError(404, 'Jeden alebo oba tímy neboli nájdené.');

  // Čas z <input type="datetime-local"> prichádza bez zóny ("2026-08-15T18:00").
  // parseLocalInput ho vyhodnotí ako slovenský čas — bez toho by ho server
  // bežiaci v UTC uložil o 2 hodiny posunutý.
  const when = parseLocalInput(matchTime);
  if (!when) throw new ApiError(400, 'Neplatný čas zápasu.');

  const newMatch = await Match.create({
    roundId, homeTeamId, awayTeamId,
    matchTime: when,
    tipType: ['winner', 'winner_no_draw', 'exact_score'].includes(tipType) ? tipType : 'exact_score',
    status: 'scheduled',
  });

  res.status(201).json({ success: true, message: 'Zápas bol úspešne vytvorený.', data: newMatch });
});

// PUT /api/matches/:id  — úprava zápasu (NErátá body; na to je evaluate)
const updateMatch = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { homeTeamId, awayTeamId, matchTime, status, tipType } = req.body;
  const userId = req.userId;

  const match = await loadMatchWithContext(id);
  if (!match) throw new ApiError(404, 'Zápas nebol nájdený.');

  if (!(await canManageMatch(match, userId))) {
    throw new ApiError(403, 'Nemáš oprávnenie upraviť tento zápas.');
  }

  if (homeTeamId && awayTeamId && homeTeamId === awayTeamId) {
    throw new ApiError(400, 'Domáci a hosťujúci tím nemôžu byť rovnaké.');
  }
  if (homeTeamId) match.homeTeamId = homeTeamId;
  if (awayTeamId) match.awayTeamId = awayTeamId;
  if (matchTime) {
    const when = parseLocalInput(matchTime);
    if (!when) throw new ApiError(400, 'Neplatný čas zápasu.');
    match.matchTime = when;
  }
  if (status) match.status = status;
  if (tipType) match.tipType = ['winner', 'winner_no_draw', 'exact_score'].includes(tipType) ? tipType : 'exact_score';

  await match.save();

  // Ak zápas patrí do ŠABLÓNY a menil sa čas, prenes ho do klonov.
  let timePropagated = 0;
  if (matchTime) {
    const ownerLeague = (match.Round && match.Round.League)
      || (match.Round ? await League.findByPk(match.Round.leagueId) : null);
    if (ownerLeague && ownerLeague.isTemplate) {
      try { timePropagated = await propagateMatchTime(match); }
      catch (e) { /* propagácia nesmie zhodiť uloženie zápasu */ }
    }
  }

  res.status(200).json({
    success: true,
    message: timePropagated
      ? `Zápas bol úspešne upravený. Čas sa preniesol do ${timePropagated} klonovaných zápasov.`
      : 'Zápas bol úspešne upravený. (Na zadanie výsledku a body použi vyhodnotenie.)',
    data: match,
  });
});

// POST /api/matches/:id/evaluate — zadá výsledok a PREPOČÍTA body (jediné miesto)
// Po vyhodnotení ORIGINÁLNEHO zápasu prepočíta všetky KLONOVANÉ zápasy
// (sourceMatchId = originál). Do klonov zapíše skóre/status z originálu (kvôli
// zobrazeniu) a prepočíta ich tipy s bodovaním ICH vlastnej ligy.
async function propagateToClones(sourceMatch) {
  const clones = await Match.findAll({
    where: { sourceMatchId: sourceMatch.id },
    include: [{ model: Tip }, { model: Round, include: [{ model: League, attributes: ['scoringSystem'] }] }],
  });
  const tipperIds = [];
  for (const clone of clones) {
    clone.homeScore = sourceMatch.homeScore;
    clone.awayScore = sourceMatch.awayScore;
    clone.status = sourceMatch.status;
    await clone.save();

    const scoring = (clone.Round && clone.Round.League && clone.Round.League.scoringSystem) || DEFAULT_SCORING;
    for (const tip of clone.Tips || []) {
      tip.points = clone.status === 'canceled' ? 0 : calculatePoints(tip, clone, scoring);
      await tip.save();
      tipperIds.push(tip.userId);
    }
  }
  return tipperIds;
}

// Automatické vyhodnotenie achievementov po vyhodnotení zápasu — zdieľaný
// helper z achievement.engine (beží na pozadí, nesmie zhodiť HTTP odpoveď).
const { evaluateInBackground: evaluateAchievementsInBackground } = require('../utils/achievement.engine');

const evaluateMatch = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { homeScore, awayScore, status } = req.body;
  const userId = req.userId;

  const match = await loadMatchWithContext(id, true);
  if (!match) throw new ApiError(404, 'Zápas nebol nájdený.');

  if (!(await canManageMatch(match, userId))) {
    throw new ApiError(403, 'Nemáš oprávnenie vyhodnotiť tento zápas.');
  }

  // KLON sa nevyhodnocuje samostatne — výsledok dedí z originálu
  if (match.sourceMatchId) {
    throw new ApiError(400, 'Tento zápas je súčasťou ligy zo šablóny — výsledok spravuje admin v oficiálnej lige.');
  }

  const newStatus = status || 'finished';

  // zrušený zápas: 0 bodov všetkým, skóre sa neberie do úvahy
  if (newStatus === 'canceled') {
    match.status = 'canceled';
    await match.save();
    for (const tip of match.Tips || []) { tip.points = 0; await tip.save(); }
    await propagateToClones(match);
    await notify.matchCanceled(match, match.Round, match.Tips || []);
    return res.status(200).json({ success: true, message: 'Zápas bol zrušený, body vynulované.', data: match });
  }

  // VYMAZANIE VÝSLEDKU: vráť zápas do stavu pred vyhodnotením — zmaž skóre,
  // status späť na 'scheduled' a vynuluj body všetkým tipom (inak by ostali
  // pridelené z predošlého vyhodnotenia a skreslili rebríček).
  if (newStatus === 'scheduled') {
    match.status = 'scheduled';
    match.homeScore = null;
    match.awayScore = null;
    await match.save();
    for (const tip of match.Tips || []) { tip.points = 0; await tip.save(); }
    await propagateToClones(match);
    return res.status(200).json({ success: true, message: 'Výsledok vymazaný, body vrátené späť.', data: match });
  }

  // inak vyžadujeme platné skóre
  if (!validScore(homeScore) || !validScore(awayScore)) {
    throw new ApiError(400, 'Zadaj platné skóre (celé nezáporné čísla).');
  }

  // zápas bez remízy (tenis, šípky…) nesmie skončiť nerozhodne
  if (match.tipType === 'winner_no_draw' && Number(homeScore) === Number(awayScore)) {
    throw new ApiError(400, 'Tento zápas nemôže skončiť remízou — musí mať víťaza.');
  }

  match.homeScore = homeScore;
  match.awayScore = awayScore;
  match.status = newStatus;
  await match.save();

  // prepočítaj body len ak je zápas dokončený
  if (match.status === 'finished') {
    const scoring = (match.Round && match.Round.League && match.Round.League.scoringSystem) || DEFAULT_SCORING;
    for (const tip of match.Tips || []) {
      tip.points = calculatePoints(tip, match, scoring);
      await tip.save();
    }
    await notify.matchEvaluated(match, match.Round, match.Tips || []);
  }

  // prepíš výsledok aj do prípadných klonov a prepočítaj ich tipy
  const cloneTipperIds = await propagateToClones(match);

  // achievementy: vyhodnoť na pozadí všetkých tipujúcich (originál + klony)
  if (match.status === 'finished') {
    evaluateAchievementsInBackground([
      ...(match.Tips || []).map((t) => t.userId),
      ...cloneTipperIds,
    ]);
  }

  res.status(200).json({
    success: true,
    message: 'Zápas bol vyhodnotený a body pripočítané.',
    data: match,
  });
});

// DELETE /api/matches/:id — zápas s tipmi sa nedá zmazať
const deleteMatch = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.userId;

  const match = await loadMatchWithContext(id);
  if (!match) throw new ApiError(404, 'Zápas nebol nájdený.');

  if (!(await canManageMatch(match, userId))) {
    throw new ApiError(403, 'Nemáš oprávnenie vymazať tento zápas.');
  }

  const tipCount = await Tip.count({ where: { matchId: id } });
  if (tipCount > 0) {
    throw new ApiError(400, 'Zápas nemožno vymazať, pretože už obsahuje tipy.');
  }

  await match.destroy();
  res.status(200).json({ success: true, message: 'Zápas bol úspešne vymazaný.' });
});

// POST /api/rounds/:id/matches/bulk  { rows: "Domáci;Hosť;2026-06-10 20:00;typ\n..." }
// Hromadné pridanie zápasov z CSV/textu. Tímy sa hľadajú podľa názvu v súpiske
// ligy (case-insensitive). Typ (4. stĺpec) je voliteľný: "winner"/"vitaz" → víťaz.
const bulkCreateMatches = asyncHandler(async (req, res) => {
  const roundId = req.params.id;
  const userId = req.userId;
  const text = (req.body.rows || '').trim();
  if (!text) throw new ApiError(400, 'Zadaj aspoň jeden riadok.');

  const round = await Round.findByPk(roundId, {
    include: [{ model: League, include: [{ model: Season, attributes: ['id', 'creatorId', 'endDate', 'ended'] }] }],
  });
  if (!round) throw new ApiError(404, 'Kolo nebolo nájdené.');
  if (!(await canManageMatch({ Round: round }, userId))) {
    throw new ApiError(403, 'Nemáš oprávnenie pridávať zápasy do tohto kola.');
  }
  const league = round.League;
  if (league.templateId) throw new ApiError(400, 'Liga zo šablóny — zápasy sa nedajú pridávať.');
  if (isLeagueLocked(league)) throw new ApiError(400, 'Liga je ukončená — zápasy sa nedajú pridávať.');

  // súpiska ligy → mapa názov(lowercase) → tím
  const teams = await league.getTeams();
  const byName = {};
  teams.forEach((t) => { byName[t.name.trim().toLowerCase()] = t; });

  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  let added = 0;
  const errors = [];

  for (let i = 0; i < lines.length; i++) {
    // oddeľovač ; alebo tab alebo viac medzier (čas obsahuje medzeru, preto ;)
    const parts = lines[i].split(/[;\t]/).map((p) => p.trim());
    if (parts.length < 3) { errors.push(`Riadok ${i + 1}: čakám aspoň „domáci; hosť; čas".`); continue; }
    const [homeName, awayName, timeStr, typeStr] = parts;
    const home = byName[(homeName || '').toLowerCase()];
    const away = byName[(awayName || '').toLowerCase()];
    if (!home) { errors.push(`Riadok ${i + 1}: tím „${homeName}" nie je v súpiske ligy.`); continue; }
    if (!away) { errors.push(`Riadok ${i + 1}: tím „${awayName}" nie je v súpiske ligy.`); continue; }
    if (home.id === away.id) { errors.push(`Riadok ${i + 1}: tímy sú rovnaké.`); continue; }
    const when = parseLocalInput(timeStr.replace(' ', 'T'));
    if (!when) { errors.push(`Riadok ${i + 1}: neplatný čas „${timeStr}".`); continue; }
    const tt = (typeStr || '').trim().toLowerCase();
    const tipType = /^(winner_no_draw|no_draw|1x2_nodraw|bez_remizy)$/.test(tt) ? 'winner_no_draw' : (/^(winner|víťaz|vitaz|1x2)$/i.test(tt) ? 'winner' : 'exact_score');
    await Match.create({ roundId: round.id, homeTeamId: home.id, awayTeamId: away.id, matchTime: when, tipType, status: 'scheduled' });
    added += 1;
  }

  res.status(201).json({ success: true, message: `Pridaných ${added} zápasov.`, added, errors });
});

module.exports = {
  getAllMatches,
  getMatchById,
  createMatch,
  bulkCreateMatches,
  updateMatch,
  evaluateMatch,
  deleteMatch,
  calculatePoints, // exportované kvôli testom / znovupoužitiu
};