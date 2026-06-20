// backend/src/controllers/homePage.controller.js
//
// Domovská stránka (/). Štruktúra je 1:1 zo šablóny index.html.
// Dáta:
//  - hero live-karta + floating bubliny: STATICKÝ vizuál zo šablóny (ilustračné),
//    text/CTA hero sa prepína guest vs prihlásený podľa currentUserId
//  - štatistiky (tipéri, ligy, tipy): reálne počty z DB
//  - oficiálne sezóny + top komunitné sezóny: reálne z DB (logika ako /seasons)
//  - blížiace sa zápasy:
//      * prihlásený  -> 2 najbližšie tipovateľné zápasy v jeho ligách
//      * neprihlásený -> 2 najbližšie oficiálne zápasy ako UKÁŽKA (nedá sa tipovať)

const { Season, User, League, Round, Match, Tip, Team, UserSeason, UserLeague, Sequelize } = require('../models');
const { Op } = Sequelize;
const { seasonStatus } = require('../utils/season.utils');
const { asyncHandler } = require('../middleware/error.middleware');

const abbr = (n) => (n || '?').substring(0, 3).toUpperCase();

// GET /
const homePage = asyncHandler(async (req, res) => {
  const meId = req.userId ? Number(req.userId) : null; // z attachUser

  // ---- GLOBÁLNE ŠTATISTIKY (reálne počty) ----
  const [usersCount, leaguesCount, tipsCount] = await Promise.all([
    User.count(),
    League.count(),
    Tip.count(),
  ]);

  // ---- SEZÓNY (rovnaká logika viditeľnosti ako /seasons) ----
  const seasons = await Season.findAll({ order: [['createdAt', 'DESC']] });
  const withCounts = await Promise.all(seasons.map(async (season) => {
    const lc = await League.count({ where: { seasonId: season.id } });
    let pc = 0;
    try { pc = await season.countParticipants(); } catch { /* nič */ }
    return { ...season.toJSON(), leaguesCount: lc, participantsCount: pc, status: seasonStatus(season) };
  }));
  // verejné (neskryté) sezóny
  const visible = withCounts.filter((s) => !s.hidden);
  const official = visible.filter((s) => s.type === 'official').slice(0, 3);
  // top komunitné = najviac účastníkov
  const community = visible
    .filter((s) => s.type === 'community')
    .sort((a, b) => (b.participantsCount || 0) - (a.participantsCount || 0))
    .slice(0, 4);

  // ---- BLÍŽIACE SA ZÁPASY ----
  const now = new Date();
  let upcoming = [];      // pole zápasov na zobrazenie (max 2)
  let upcomingMode = 'guest'; // 'user' alebo 'guest' (ukážka)

  if (meId) {
    // prihlásený: najbližšie tipovateľné zápasy v ligách, kde je člen
    upcomingMode = 'user';
    const lMems = await UserLeague.findAll({ where: { userId: meId }, attributes: ['leagueId'] });
    const myLeagueIds = lMems.map((m) => m.leagueId);
    if (myLeagueIds.length) {
      const rounds = await Round.findAll({ where: { leagueId: { [Op.in]: myLeagueIds } }, attributes: ['id'] });
      const roundIds = rounds.map((r) => r.id);
      if (roundIds.length) {
        const matches = await Match.findAll({
          where: { roundId: { [Op.in]: roundIds }, status: 'scheduled', matchTime: { [Op.gt]: now } },
          include: [
            { model: Team, as: 'homeTeam', attributes: ['name'] },
            { model: Team, as: 'awayTeam', attributes: ['name'] },
            { model: Round, attributes: ['id', 'name', 'leagueId'], include: [{ model: League, attributes: ['id', 'name'] }] },
          ],
          order: [['matchTime', 'ASC']],
          limit: 2,
        });
        upcoming = matches.map((m) => ({
          id: m.id,
          roundId: m.Round ? m.Round.id : null,
          leagueName: m.Round && m.Round.League ? m.Round.League.name : '—',
          home: m.homeTeam ? m.homeTeam.name : '—',
          away: m.awayTeam ? m.awayTeam.name : '—',
          homeAbbr: abbr(m.homeTeam ? m.homeTeam.name : ''),
          awayAbbr: abbr(m.awayTeam ? m.awayTeam.name : ''),
          time: m.matchTime,
        }));
      }
    }
  } else {
    // neprihlásený: najbližšie OFICIÁLNE zápasy ako ukážka (nedá sa tipovať)
    upcomingMode = 'guest';
    // ligy patriace oficiálnym sezónam
    const officialSeasonIds = withCounts.filter((s) => s.type === 'official').map((s) => s.id);
    if (officialSeasonIds.length) {
      const offLeagues = await League.findAll({ where: { seasonId: { [Op.in]: officialSeasonIds } }, attributes: ['id'] });
      const offLeagueIds = offLeagues.map((l) => l.id);
      if (offLeagueIds.length) {
        const offRounds = await Round.findAll({ where: { leagueId: { [Op.in]: offLeagueIds } }, attributes: ['id'] });
        const offRoundIds = offRounds.map((r) => r.id);
        if (offRoundIds.length) {
          const matches = await Match.findAll({
            where: { roundId: { [Op.in]: offRoundIds }, status: 'scheduled', matchTime: { [Op.gt]: now } },
            include: [
              { model: Team, as: 'homeTeam', attributes: ['name'] },
              { model: Team, as: 'awayTeam', attributes: ['name'] },
              { model: Round, attributes: ['id', 'name', 'leagueId'], include: [{ model: League, attributes: ['id', 'name'] }] },
            ],
            order: [['matchTime', 'ASC']],
            limit: 2,
          });
          upcoming = matches.map((m) => ({
            id: m.id,
            leagueName: m.Round && m.Round.League ? m.Round.League.name : '—',
            home: m.homeTeam ? m.homeTeam.name : '—',
            away: m.awayTeam ? m.awayTeam.name : '—',
            homeAbbr: abbr(m.homeTeam ? m.homeTeam.name : ''),
            awayAbbr: abbr(m.awayTeam ? m.awayTeam.name : ''),
            time: m.matchTime,
          }));
        }
      }
    }
  }

  res.render('index', {
    stats: { usersCount, leaguesCount, tipsCount },
    official,
    community,
    upcoming,
    upcomingMode,
  });
});

module.exports = { homePage };
