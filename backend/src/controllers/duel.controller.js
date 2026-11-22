// backend/src/controllers/duel.controller.js
//
// SÚBOJE 1 NA 1 (obrazovky appky + API).
//   GET  /app/suboje              — moje súboje (výzvy, prebiehajúce, skončené)
//   GET  /app/suboj/novy?kolo=ID  — výber súpera z ligy kola
//   GET  /app/suboj/:id           — detail súboja (skóre, zápas po zápase)
//   POST /api/duels               { roundId, opponentId }
//   POST /api/duels/:id/:action   accept | decline | cancel

const { Duel, Round, League, Season, Match, Team, User, UserLeague, Sequelize } = require('../models');
const { ApiError, asyncHandler } = require('../middleware/error.middleware');
const { duelScore, validateChallenge } = require('../utils/duel.util');
const notify = require('../utils/notification.service');
const app = require('./appPage.controller');

const { Op } = Sequelize;
const { initials, teamAbbr } = app._internal;
const USER_ATTRS = ['id', 'username', 'firstName', 'lastName', 'profileImage'];
const AV = ['linear-gradient(135deg,#7c5cff,#3b1f8f)', 'linear-gradient(135deg,#1fa37a,#0c4d3a)', 'linear-gradient(135deg,#2a6fd6,#123d82)', 'linear-gradient(135deg,#d43545,#7d1220)', 'linear-gradient(135deg,#c2702c,#6b3a0f)', 'linear-gradient(135deg,#b8327a,#5e0f3a)'];
const avColor = (id) => AV[Math.abs(Number(id) || 0) % AV.length];
const nameOf = (u) => (u ? ([u.firstName, u.lastName].filter(Boolean).join(' ') || u.username) : '?');
const person = (u) => ({ id: u ? u.id : 0, name: nameOf(u), initials: initials(nameOf(u)), image: u && u.profileImage, color: avColor(u && u.id) });

// GET /app/suboje
const list = asyncHandler(async (req, res) => {
  const meId = Number(req.session.userId);
  const duels = await Duel.findAll({
    where: { [Op.or]: [{ challengerId: meId }, { opponentId: meId }], status: { [Op.ne]: 'canceled' } },
    include: [
      { model: Round, attributes: ['id', 'name', 'startDate', 'endDate', 'leagueId'], include: [{ model: League, attributes: ['id', 'name'] }] },
      { model: User, as: 'challenger', attributes: USER_ATTRS },
      { model: User, as: 'opponent', attributes: USER_ATTRS },
    ],
    order: [['createdAt', 'DESC']],
    limit: 60,
  });
  const now = new Date();
  const rows = [];
  for (const d of duels) {
    // eslint-disable-next-line no-await-in-loop
    const sc = d.status === 'accepted' ? await duelScore(d, now) : { state: d.status, challengerPts: 0, opponentPts: 0 };
    const meIsCh = d.challengerId === meId;
    const opp = meIsCh ? d.opponent : d.challenger;
    const mine = meIsCh ? sc.challengerPts : sc.opponentPts;
    const theirs = meIsCh ? sc.opponentPts : sc.challengerPts;
    rows.push({
      id: d.id, state: sc.state, incoming: d.status === 'pending' && !meIsCh,
      opp: person(opp), mine, theirs,
      round: d.Round ? d.Round.name : '', league: d.Round && d.Round.League ? d.Round.League.name : '',
      result: sc.state === 'finished' ? (mine > theirs ? 'win' : (mine < theirs ? 'loss' : 'draw')) : null,
    });
  }
  const finished = rows.filter((r) => r.state === 'finished');
  res.render('app/suboje', {
    title: req.L.t('duel.title'), screen: 'suboje', appTab: 'profile',
    incoming: rows.filter((r) => r.incoming),
    active: rows.filter((r) => !r.incoming && ['pending', 'ready', 'live'].includes(r.state)),
    finished: finished.slice(0, 20),
    record: {
      w: finished.filter((r) => r.result === 'win').length,
      l: finished.filter((r) => r.result === 'loss').length,
      d: finished.filter((r) => r.result === 'draw').length,
    },
  });
});

// GET /app/suboj/novy?kolo=ID
const newPage = asyncHandler(async (req, res) => {
  const meId = Number(req.session.userId);
  const round = await Round.findByPk(req.query.kolo, { include: [{ model: League, include: [{ model: Season, attributes: ['id', 'name'] }] }] });
  if (!round || !round.League) return res.redirect('/app/suboje');
  const member = await UserLeague.findOne({ where: { userId: meId, leagueId: round.leagueId } });
  if (!member) return res.redirect(`/app/kolo/${round.id}`);
  const closed = new Date() >= new Date(round.endDate);
  const mems = await UserLeague.findAll({ where: { leagueId: round.leagueId, userId: { [Op.ne]: meId } }, attributes: ['userId'] });
  const users = mems.length ? await User.findAll({
    where: { id: mems.map((m) => m.userId), active: { [Op.ne]: false }, ...(User.rawAttributes.isBot ? { isBot: { [Op.not]: true } } : {}) },
    attributes: USER_ATTRS, order: [['username', 'ASC']], limit: 300,
  }) : [];
  const taken = new Set((await Duel.findAll({
    where: { roundId: round.id, status: { [Op.in]: ['pending', 'accepted'] }, [Op.or]: [{ challengerId: meId }, { opponentId: meId }] },
    attributes: ['challengerId', 'opponentId'],
  })).map((d) => (d.challengerId === meId ? d.opponentId : d.challengerId)));
  res.render('app/suboj-novy', {
    title: req.L.t('duel.new'), screen: 'suboj-novy', appTab: 'home',
    round: { id: round.id, name: round.name, closed },
    league: { id: round.League.id, name: round.League.name, grad: '', initials: initials(round.League.name), image: round.League.image },
    players: users.map((u) => ({ ...person(u), username: u.username, taken: taken.has(u.id) })),
  });
});

// GET /app/suboj/:id
const detail = asyncHandler(async (req, res) => {
  const meId = Number(req.session.userId);
  const d = await Duel.findByPk(req.params.id, {
    include: [
      { model: Round, include: [{ model: League, attributes: ['id', 'name', 'image', 'scoringSystem'] }] },
      { model: User, as: 'challenger', attributes: USER_ATTRS },
      { model: User, as: 'opponent', attributes: USER_ATTRS },
    ],
  });
  if (!d || (d.challengerId !== meId && d.opponentId !== meId)) return res.redirect('/app/suboje');
  const now = new Date();
  const sc = await duelScore(d, now);
  const meIsCh = d.challengerId === meId;
  const me = person(meIsCh ? d.challenger : d.opponent);
  const opp = person(meIsCh ? d.opponent : d.challenger);
  const mine = meIsCh ? sc.challengerPts : sc.opponentPts;
  const theirs = meIsCh ? sc.opponentPts : sc.challengerPts;
  const teamIds = [...new Set(sc.matches.flatMap((m) => [m.homeTeamId, m.awayTeamId]).filter(Boolean))];
  const teams = teamIds.length ? await Team.findAll({ where: { id: teamIds }, attributes: ['id', 'name', 'shortName', 'logo'] }) : [];
  const teamBy = new Map(teams.map((t) => [t.id, t]));
  const tipBy = new Map(sc.tips.map((t) => [`${t.userId}:${t.matchId}`, t]));
  const tipText = (m, t) => {
    if (!t) return null;
    if (m.tipType === 'exact_score') return t.homeScore != null ? `${t.homeScore}:${t.awayScore}` : null;
    return t.winner ? ({ home: '1', draw: 'X', away: '2' })[t.winner] : null;
  };
  const oppId = meIsCh ? d.opponentId : d.challengerId;
  const matches = sc.matches.map((m) => {
    const started = m.status !== 'scheduled' || new Date(m.matchTime) <= now;
    const my = tipBy.get(`${meId}:${m.id}`);
    const their = tipBy.get(`${oppId}:${m.id}`);
    const h = teamBy.get(m.homeTeamId); const a = teamBy.get(m.awayTeamId);
    return {
      home: { name: h ? h.name : '?', abbr: teamAbbr(h), logo: h && h.logo },
      away: { name: a ? a.name : '?', abbr: teamAbbr(a), logo: a && a.logo },
      result: m.status === 'finished' && m.homeScore != null ? `${m.homeScore}:${m.awayScore}` : null,
      state: m.status === 'finished' ? 'finished' : (m.status === 'canceled' ? 'canceled' : (started ? 'live' : 'waiting')),
      myTip: tipText(m, my), myPts: m.status === 'finished' && my ? (my.points || 0) : null, myJoker: !!(my && my.isJoker),
      // tip súpera až po začiatku zápasu (inak by sa dal odpísať)
      oppTip: started ? tipText(m, their) : (their ? 'hidden' : null),
      oppPts: m.status === 'finished' && their ? (their.points || 0) : null, oppJoker: started && !!(their && their.isJoker),
    };
  });
  const result = sc.state === 'finished' ? (mine > theirs ? 'win' : (mine < theirs ? 'loss' : 'draw')) : null;
  const { L } = req;
  const share = (sc.state === 'finished' || sc.state === 'live') ? {
    variant: 'duel', league: d.Round.League.name, round: d.Round.name, initials: initials(d.Round.League.name),
    me: { name: me.name, initials: me.initials, pts: mine }, opp: { name: opp.name, initials: opp.initials, pts: theirs },
    result, url: 'https://tifo.sk',
    labels: {
      ...app._internal.shareLabels(L),
      duel: L.t('share.duel'), win: L.t('share.win'), loss: L.t('share.loss'), draw: L.t('share.draw'), live: L.t('share.liveDuel'),
      cta: L.t('share.cta'), pts: L.tn(mine, 'point'), text: L.t('share.duelText', { a: mine, b: theirs, o: opp.name }),
    },
  } : null;
  res.render('app/suboj', {
    title: L.t('duel.title'), screen: 'suboj', appTab: 'home',
    duel: { id: d.id, state: sc.state, incoming: d.status === 'pending' && !meIsCh, outgoing: d.status === 'pending' && meIsCh, result },
    round: { id: d.Round.id, name: d.Round.name },
    league: { id: d.Round.League.id, name: d.Round.League.name, initials: initials(d.Round.League.name), image: d.Round.League.image },
    me, opp, mine, theirs, matches, share,
  });
});

// POST /api/duels { roundId, opponentId }
const apiCreate = asyncHandler(async (req, res) => {
  const meId = Number(req.session.userId);
  const opponentId = Number(req.body.opponentId);
  const round = await Round.findByPk(req.body.roundId, { include: [{ model: League }] });
  const err = await validateChallenge(meId, opponentId, round);
  if (err) throw new ApiError(400, err);
  const duel = await Duel.create({ roundId: round.id, challengerId: meId, opponentId, status: 'pending' });
  const meU = await User.findByPk(meId, { attributes: USER_ATTRS });
  notify.duelChallenge(duel, nameOf(meU), round.name).catch(() => {});
  res.status(201).json({ success: true, id: duel.id, redirect: `/app/suboj/${duel.id}`, message: 'Výzva odoslaná.' });
});

// POST /api/duels/:id/:action
const apiAction = asyncHandler(async (req, res) => {
  const meId = Number(req.session.userId);
  const d = await Duel.findByPk(req.params.id, { include: [{ model: Round }] });
  if (!d || (d.challengerId !== meId && d.opponentId !== meId)) throw new ApiError(404, 'Súboj neexistuje.');
  const action = req.params.action;
  if (d.status !== 'pending') throw new ApiError(409, 'Súboj už bol vybavený.');
  if (action === 'cancel') {
    if (d.challengerId !== meId) throw new ApiError(403, 'Zrušiť môže len ten, kto vyzval.');
    await d.update({ status: 'canceled' });
    return res.json({ success: true, redirect: '/app/suboje', message: 'Výzva zrušená.' });
  }
  if (d.opponentId !== meId) throw new ApiError(403, 'Na výzvu odpovedá súper.');
  const meU = await User.findByPk(meId, { attributes: USER_ATTRS });
  if (action === 'accept') {
    if (new Date() >= new Date(d.Round.endDate)) throw new ApiError(409, 'Kolo už skončilo.');
    await d.update({ status: 'accepted' });
    notify.duelAccepted(d, nameOf(meU), d.Round.name).catch(() => {});
    return res.json({ success: true, message: 'Súboj prijatý. Veľa šťastia!' });
  }
  if (action === 'decline') {
    await d.update({ status: 'declined' });
    notify.duelDeclined(d, nameOf(meU), d.Round.name).catch(() => {});
    return res.json({ success: true, message: 'Súboj odmietnutý.' });
  }
  throw new ApiError(400, 'Neznáma akcia.');
});

module.exports = { list, newPage, detail, apiCreate, apiAction };
