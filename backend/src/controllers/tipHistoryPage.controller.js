// backend/src/controllers/tipHistoryPage.controller.js
//
// História tipov (/tip-history) — kompletný prehľad tipov prihláseného hráča
// s výsledkami a získanými bodmi. Filtre (sezóna/liga/výsledok) cez query param.

const { Tip, Match, Round, League, Season, Team, Sequelize } = require('../models');
const { Op } = Sequelize;
const { asyncHandler } = require('../middleware/error.middleware');
const { tipQualityWeight } = require('../utils/accuracy.util');

const DEFAULT_EXACT = 10;
const abbr = (n) => (n || '?').substring(0, 3).toUpperCase();

// určí kvalitu tipu: 'exact' (presný), 'partial' (nejaké body), 'zero' (0), 'canceled', 'pending'
function tipQuality(tip, match, exactPts) {
  if (!match) return 'pending';
  if (match.status === 'canceled') return 'canceled';
  if (match.status !== 'finished') return 'pending';
  const pts = tip.points || 0;
  if (match.tipType !== 'winner' && pts >= exactPts) return 'exact';
  if (pts > 0) return 'partial';
  return 'zero';
}

// GET /tip-history
const tipHistoryPage = asyncHandler(async (req, res) => {
  const meId = Number(req.session.userId);

  // filtre z query (voliteľné)
  const fSeason = req.query.sezona ? Number(req.query.sezona) : null;
  const fLeague = req.query.liga ? Number(req.query.liga) : null;
  const fResult = req.query.vysledok || null; // 'exact' | 'zero'

  // všetky tipy hráča s plným kontextom
  const tips = await Tip.findAll({
    where: { userId: meId },
    include: [{
      model: Match,
      include: [
        { model: Team, as: 'homeTeam', attributes: ['name'] },
        { model: Team, as: 'awayTeam', attributes: ['name'] },
        {
          model: Round,
          attributes: ['id', 'name', 'leagueId', 'startDate'],
          include: [{
            model: League,
            attributes: ['id', 'name', 'seasonId', 'scoringSystem'],
            include: [{ model: Season, attributes: ['id', 'name', 'type'] }],
          }],
        },
      ],
    }],
    order: [['createdAt', 'DESC']],
  });

  // dropdown zoznamy (sezóny/ligy z tipov hráča)
  const seasonMap = {};
  const leagueMap = {};

  // summary
  let totalTips = 0; let exactCount = 0; let totalPoints = 0; let evaluatedCount = 0; let weightSum = 0;

  const rows = [];
  for (const t of tips) {
    const m = t.Match;
    const round = m && m.Round;
    const league = round && round.League;
    const season = league && league.Season;
    const exactPts = (league && league.scoringSystem && league.scoringSystem.exactScore) || DEFAULT_EXACT;

    // naplň dropdown mapy
    if (season) seasonMap[season.id] = season.name;
    if (league) leagueMap[league.id] = { name: league.name, seasonId: season ? season.id : null };

    // summary (rátame zo všetkých, bez ohľadu na filter)
    totalTips += 1;
    totalPoints += (t.points || 0);
    const quality = tipQuality(t, m, exactPts);
    if (quality === 'exact') exactCount += 1;
    if (m && m.status === 'finished') { evaluatedCount += 1; weightSum += tipQualityWeight(t, m); }

    // aplikuj filtre na riadky
    if (fSeason && (!season || season.id !== fSeason)) continue;
    if (fLeague && (!league || league.id !== fLeague)) continue;
    if (fResult === 'exact' && quality !== 'exact') continue;
    if (fResult === 'zero' && quality !== 'zero') continue;

    // formát tipu a výsledku
    const tipStr = (m && m.tipType === 'winner')
      ? (t.winner === 'home' ? '1' : t.winner === 'away' ? '2' : t.winner === 'draw' ? 'X' : '—')
      : ((t.homeScore != null && t.awayScore != null) ? `${t.homeScore}:${t.awayScore}` : '—');
    const resStr = (m && m.homeScore != null && m.awayScore != null) ? `${m.homeScore}:${m.awayScore}` : '—';

    rows.push({
      date: round && round.startDate ? round.startDate : t.createdAt,
      roundName: round ? round.name : '—',
      home: m && m.homeTeam ? m.homeTeam.name : '—',
      away: m && m.awayTeam ? m.awayTeam.name : '—',
      homeAbbr: abbr(m && m.homeTeam ? m.homeTeam.name : ''),
      leagueName: league ? league.name : '—',
      seasonName: season ? season.name : '',
      tipStr, resStr,
      points: t.points || 0,
      quality,
    });
  }

  const accuracy = evaluatedCount > 0 ? Math.round((weightSum / evaluatedCount) * 100) : null;

  res.render('tip-history', {
    rows,
    summary: { totalTips, exactCount, totalPoints, accuracy },
    seasons: Object.entries(seasonMap).map(([id, name]) => ({ id: Number(id), name })),
    leagues: Object.entries(leagueMap).map(([id, v]) => ({ id: Number(id), name: v.name })),
    filters: { season: fSeason, league: fLeague, result: fResult },
    shownCount: rows.length,
  });
});

module.exports = { tipHistoryPage };