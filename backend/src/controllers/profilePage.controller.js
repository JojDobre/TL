// backend/src/controllers/profilePage.controller.js
//
// Profil prihláseného hráča (/profile). Základné údaje účtu + posledné tipy +
// súhrnné štatistiky (odkaz na /stats). Len reálne dáta.

const { Tip, Match, Round, League, Team, User, UserLeague, Sequelize } = require('../models');
const { asyncHandler } = require('../middleware/error.middleware');

// GET /profile
const profilePage = asyncHandler(async (req, res) => {
  const meId = Number(req.session.userId);
  const user = await User.findByPk(meId, { attributes: { exclude: ['password'] } });
  if (!user) return res.redirect('/login');

  // posledné tipy (8) s kontextom zápasu
  const recentTips = await Tip.findAll({
    where: { userId: meId },
    include: [{
      model: Match,
      attributes: ['id', 'homeScore', 'awayScore', 'status', 'tipType'],
      include: [
        { model: Team, as: 'homeTeam', attributes: ['name'] },
        { model: Team, as: 'awayTeam', attributes: ['name'] },
        { model: Round, attributes: ['name'], include: [{ model: League, attributes: ['name'] }] },
      ],
    }],
    order: [['createdAt', 'DESC']],
    limit: 8,
  });

  // súhrnné štatistiky (rovnaká logika ako /stats, zjednodušená)
  const allTips = await Tip.findAll({ where: { userId: meId }, include: [{ model: Match, attributes: ['status', 'tipType'] }] });
  let totalPoints = 0; let evaluated = 0; let hits = 0;
  allTips.forEach((t) => {
    totalPoints += t.points || 0;
    if (t.Match && t.Match.status === 'finished') { evaluated += 1; if ((t.points || 0) > 0) hits += 1; }
  });
  const accuracy = evaluated > 0 ? Math.round((hits / evaluated) * 100) : null;

  const abbr = (n) => (n || '?').substring(0, 3).toUpperCase();
  const recent = recentTips.map((t) => {
    const m = t.Match;
    const home = m && m.homeTeam ? m.homeTeam.name : '—';
    const away = m && m.awayTeam ? m.awayTeam.name : '—';
    const tipStr = m && m.tipType === 'winner'
      ? (t.winner === 'home' ? '1' : t.winner === 'draw' ? 'X' : t.winner === 'away' ? '2' : '–')
      : ((t.homeScore != null ? t.homeScore : '–') + ':' + (t.awayScore != null ? t.awayScore : '–'));
    return {
      home, away, homeAbbr: abbr(home), awayAbbr: abbr(away),
      context: (m && m.Round && m.Round.League ? m.Round.League.name : '') + (m && m.Round ? ' · ' + m.Round.name : ''),
      tip: tipStr,
      points: t.points || 0,
      finished: m && m.status === 'finished',
    };
  });

  // moje ligy s pozíciou (max 3) — pre bočný panel
  const Op = Sequelize.Op;
  const lMems = await UserLeague.findAll({ where: { userId: meId } });
  const myLeagueIds = lMems.map((m) => m.leagueId);
  const topLeagues = [];
  if (myLeagueIds.length) {
    const leagues = await League.findAll({ where: { id: { [Op.in]: myLeagueIds } }, attributes: ['id', 'name', 'type'], limit: 3 });
    for (const l of leagues) {
      const rounds = await Round.findAll({ where: { leagueId: l.id }, attributes: ['id'] });
      const roundIds = rounds.map((r) => r.id);
      let rank = null;
      if (roundIds.length) {
        const tips = await Tip.findAll({ include: [{ model: Match, attributes: ['id'], where: { roundId: { [Op.in]: roundIds } }, required: true }, { model: User, attributes: ['id'] }] });
        const byUser = {};
        tips.forEach((t) => { if (!t.User) return; byUser[t.User.id] = (byUser[t.User.id] || 0) + (t.points || 0); });
        const board = Object.entries(byUser).map(([uid, pts]) => ({ uid: Number(uid), pts })).sort((a, b) => b.pts - a.pts);
        const idx = board.findIndex((b) => b.uid === meId);
        if (idx >= 0) rank = idx + 1;
      }
      topLeagues.push({ id: l.id, name: l.name, type: l.type, rank, abbr: (l.name || '?').substring(0, 2).toUpperCase() });
    }
  }

  res.render('profile', {
    profile: {
      name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      username: user.username,
      email: user.email || '',
      role: user.role,
      initials: ([user.firstName, user.lastName].filter(Boolean).map((x) => x[0]).join('') || user.username[0] || '?').toUpperCase(),
      createdAt: user.createdAt,
    },
    summary: { totalPoints, accuracy, tipsCount: allTips.length, evaluated },
    recent,
    topLeagues,
  });
});

module.exports = { profilePage };
