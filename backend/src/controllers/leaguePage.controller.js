// backend/src/controllers/leaguePage.controller.js
//
// EJS stránka detailu ligy. Načíta ligu, jej kolá (so stavom a počtom zápasov),
// rebríček ligy a info o členstve prihláseného hráča.

const { League, Season, Round, Match, Tip, User, UserLeague, UserSeason, Sequelize } = require('../models');
const bcrypt = require('bcrypt');
const { seasonStatus, isSeasonLocked } = require('../utils/season.utils');
const { cloneTemplateInto } = require('../utils/league-clone.util');
const { deleteLeague } = require('../utils/delete.util');
const { SPORTS, COUNTRIES } = require('../utils/team.constants');
const { asyncHandler } = require('../middleware/error.middleware');

const DEFAULT_SCORING = { exactScore: 10, correctGoals: 1, correctWinner: 3, goalDifference: 2 };

// stav kola podľa dátumov: 'open' | 'finished' | 'scheduled'
function roundStatus(round) {
  const now = new Date();
  const start = new Date(round.startDate);
  const end = new Date(round.endDate);
  if (now < start) return 'scheduled';   // ešte sa neotvorilo
  if (now > end) return 'finished';       // po uzávierke
  return 'open';                          // prebieha tipovanie
}

// GET /leagues/:id
const leagueDetailPage = asyncHandler(async (req, res) => {
  const league = await League.findByPk(req.params.id, {
    include: [
      { model: Season, attributes: ['id', 'name'] },
      { model: Round, attributes: ['id', 'name', 'description', 'startDate', 'endDate', 'active'] },
    ],
  });
  if (!league) return res.status(404).render('error-page', { message: 'Liga nebola nájdená.' });

  const meId = req.userId || null;

  // kolá so stavom a počtom zápasov + (voliteľne) koľko hráč už tipol
  const rounds = await Promise.all((league.Rounds || [])
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
    .map(async (round) => {
      const matchesCount = await Match.count({ where: { roundId: round.id } });
      let myTips = 0;
      if (meId) {
        myTips = await Tip.count({
          where: { userId: meId },
          include: [{ model: Match, where: { roundId: round.id }, required: true }],
        });
      }
      return { ...round.toJSON(), status: roundStatus(round), matchesCount, myTips };
    }));

  // rebríček ligy
  const exactScore = (league.scoringSystem && league.scoringSystem.exactScore) || DEFAULT_SCORING.exactScore;
  const tips = await Tip.findAll({
    include: [
      { model: Match, required: true, include: [{ model: Round, where: { leagueId: league.id }, required: true }] },
      { model: User, attributes: ['id', 'username', 'firstName', 'lastName'] },
    ],
  });
  const byUser = {};
  tips.forEach((tip) => {
    if (!tip.User) return;
    const uid = tip.User.id;
    if (!byUser[uid]) byUser[uid] = { user: tip.User.toJSON(), totalPoints: 0 };
    byUser[uid].totalPoints += tip.points || 0;
  });
  const leaderboard = Object.values(byUser).sort((a, b) => b.totalPoints - a.totalPoints);

  // členstvo a počty
  let membersCount = 0;
  try { membersCount = await league.countMembers(); } catch { /* nič */ }
  const myMembership = meId ? await UserLeague.findOne({ where: { userId: meId, leagueId: league.id } }) : null;
  const myRank = meId ? (leaderboard.findIndex((e) => e.user.id === meId) + 1) || null : null;
  const myPoints = myRank ? leaderboard[myRank - 1].totalPoints : 0;

  const playedRounds = rounds.filter((r) => r.status === 'finished').length;

  // môže prihlásený spravovať ligu? (tvorca ligy/sezóny, admin sezóny, glob. admin)
  let canManage = false;
  if (meId) {
    const u = await User.findByPk(meId);
    const sRole = await UserSeason.findOne({ where: { userId: meId, seasonId: league.seasonId } });
    canManage = league.creatorId === meId
      || (u && u.role === 'admin')
      || (sRole && sRole.role === 'admin');
  }

  res.render('leagueDetail', {
    league: { ...league.toJSON(), membersCount, scoringSystem: league.scoringSystem || DEFAULT_SCORING },
    rounds,
    leaderboard,
    isMember: !!myMembership,
    isCreator: league.creatorId === meId,
    myRank,
    myPoints,
    playedRounds,
    canManage,
  });
});

// POST /leagues/join — pripojenie do ligy z formulára (page)
const joinLeagueSubmit = asyncHandler(async (req, res) => {
  const { joinCode, password } = req.body;
  const userId = Number(req.session.userId);
  if (!userId) return res.redirect('/login');

  const league = await League.findOne({ where: { joinCode: (joinCode || '').trim().toUpperCase() } });
  if (!league || !league.active) return res.redirect('/seasons');

  // ak má heslo, over ho — pri zlom hesle naspäť na ligu
  if (league.hasPassword) {
    const ok = password && await bcrypt.compare(password, league.password || '');
    if (!ok) return res.redirect('/leagues/' + league.id);
  }

  // findOrCreate: ak už členstvo existuje, nič nevytvára (žiadny duplicitný PRIMARY)
  await UserLeague.findOrCreate({
    where: { userId, leagueId: league.id },
    defaults: { userId, leagueId: league.id, role: 'player', joinedAt: new Date() },
  });
  // členstvo v sezóne tiež cez findOrCreate
  await UserSeason.findOrCreate({
    where: { userId, seasonId: league.seasonId },
    defaults: { userId, seasonId: league.seasonId, role: 'player', joinedAt: new Date() },
  });

  res.redirect('/leagues/' + league.id);
});

// GET /leagues/create?season=:id — formulár na vytvorenie ligy
const createLeaguePage = asyncHandler(async (req, res) => {
  const seasonId = req.query.season;
  if (!seasonId) return res.redirect('/seasons');
  const season = await Season.findByPk(seasonId, { attributes: ['id', 'name', 'type'] });
  if (!season) return res.status(404).render('error-page', { message: 'Sezóna nebola nájdená.' });

  // dostupné šablóny (oficiálne ligy označené ako šablóna) — na výber pri klonovaní
  const templates = await League.findAll({
    where: { isTemplate: true },
    attributes: ['id', 'name', 'description'],
    order: [['name', 'ASC']],
  });

  res.render('createLeague', {
    season: season.toJSON(),
    templates: templates.map((t) => t.toJSON()),
    error: null,
  });
});

// POST /leagues/create — vytvorenie ligy z formulára
const createLeagueSubmit = asyncHandler(async (req, res) => {
  const { name, description, seasonId, type, password, exactScore, correctWinner, goalDifference, correctGoals } = req.body;
  const userId = Number(req.session.userId);
  if (!userId) return res.redirect('/login');

  const season = await Season.findByPk(seasonId, { attributes: ['id', 'name', 'creatorId', 'ended', 'endDate'] });
  const renderErr = (msg) => res.status(400).render('createLeague', { season: season ? season.toJSON() : { id: seasonId, name: '' }, error: msg });

  if (!season) return res.redirect('/seasons');
  if (isSeasonLocked(season)) return renderErr('Sezóna je ukončená — nedajú sa v nej vytvárať ligy.');
  if (!name || !name.trim()) return renderErr('Názov ligy je povinný.');

  const user = await User.findByPk(userId);
  // oprávnenie: tvorca sezóny, admin sezóny, globálny admin
  const seasonRole = await UserSeason.findOne({ where: { userId, seasonId } });
  const isSeasonAdmin = seasonRole && seasonRole.role === 'admin';
  if (season.creatorId !== userId && !isSeasonAdmin && user.role !== 'admin') {
    return renderErr('Nemáš oprávnenie vytvoriť ligu v tejto sezóne.');
  }

  // limit AKTÍVNYCH líg podľa roly (ligy v ukončených sezónach sa nepočítajú)
  const LIMITS = { player: 5, vip: 10 };
  const limit = LIMITS[user.role];
  if (limit !== undefined) {
    const myLeagues = await League.findAll({
      where: { creatorId: userId },
      include: [{ model: Season, attributes: ['ended', 'endDate'] }],
    });
    const activeCount = myLeagues.filter((l) => !l.Season || !isSeasonLocked(l.Season)).length;
    if (activeCount >= limit) return renderErr(`Máš už maximálny počet aktívnych líg (${limit}) pre tvoju rolu. Ukonči sezónu alebo prejdi na vyššiu rolu.`);
  }

  const leagueType = (type === 'official' && user.role === 'admin') ? 'official' : 'custom';
  // šablóna: len admin, len pri oficiálnej lige
  const markTemplate = leagueType === 'official' && user.role === 'admin'
    && (req.body.isTemplate === 'on' || req.body.isTemplate === 'true');

  // bodovanie z formulára (s rozumnými predvolenými hodnotami)
  const num = (v, d) => { const n = parseInt(v, 10); return Number.isInteger(n) && n >= 0 ? n : d; };
  const scoringSystem = {
    exactScore: num(exactScore, 10),
    correctWinner: num(correctWinner, 3),
    goalDifference: num(goalDifference, 2),
    correctGoals: num(correctGoals, 1),
  };

  // heslo (hashované)
  let passwordHash = null;
  if (password && password.trim()) passwordHash = await bcrypt.hash(password.trim(), 10);

  // unikátny join kód
  let joinCode;
  for (let i = 0; i < 10; i++) {
    const code = require('uuid').v4().substring(0, 6).toUpperCase();
    if (!(await League.findOne({ where: { joinCode: code } }))) { joinCode = code; break; }
  }

  // šablóna (ak vybraná) — over, že je to platná šablóna
  let template = null;
  if (req.body.templateId) {
    template = await League.findOne({ where: { id: req.body.templateId, isTemplate: true } });
    if (!template) return renderErr('Vybraná šablóna neexistuje.');
  }

  const league = await League.create({
    name: name.trim(), description: description || null,
    type: leagueType, joinCode, password: passwordHash, hasPassword: !!passwordHash,
    seasonId, creatorId: userId, scoringSystem, scoringLocked: false, active: true,
    templateId: template ? template.id : null,
    isTemplate: markTemplate,
  });

  await UserLeague.findOrCreate({
    where: { userId, leagueId: league.id },
    defaults: { userId, leagueId: league.id, role: 'admin', joinedAt: new Date() },
  });
  await UserSeason.findOrCreate({
    where: { userId, seasonId },
    defaults: { userId, seasonId, role: 'player', joinedAt: new Date() },
  });

  // ak je liga zo šablóny → naklonuj kolá a zápasy zo šablóny
  if (template) {
    try { await cloneTemplateInto(template, league); }
    catch (e) { /* ak klon zlyhá, liga ostane prázdna — používateľ dostane info v detaile */ }
    // klon má tímy/zápasy zo šablóny → rovno na detail
    return res.redirect('/leagues/' + league.id);
  }

  // klasická liga: presmeruj na úpravu, nech si používateľ hneď pridá tímy do súpisky
  res.redirect('/leagues/' + league.id + '/edit');
});

// GET /leagues/:id/edit — formulár na úpravu ligy
const editLeaguePage = asyncHandler(async (req, res) => {
  const userId = Number(req.session.userId);
  const league = await League.findByPk(req.params.id, {
    include: [{ model: Season, attributes: ['id', 'name', 'creatorId'] }],
  });
  if (!league) return res.status(404).render('error-page', { message: 'Liga nebola nájdená.' });

  // oprávnenie: tvorca ligy, tvorca sezóny, admin sezóny, globálny admin
  const user = await User.findByPk(userId);
  const seasonRole = await UserSeason.findOne({ where: { userId, seasonId: league.seasonId } });
  const allowed = league.creatorId === userId
    || (league.Season && league.Season.creatorId === userId)
    || (seasonRole && seasonRole.role === 'admin')
    || (user && user.role === 'admin');
  if (!allowed) return res.status(403).render('error-page', { message: 'Nemáš oprávnenie upraviť túto ligu.' });

  res.render('editLeague', {
    league: { ...league.toJSON(), scoringSystem: league.scoringSystem || {} },
    sports: SPORTS,
    countries: COUNTRIES,
    isClone: !!league.templateId,
    error: null,
  });
});

// POST /leagues/:id/edit — uloženie úprav
const editLeagueSubmit = asyncHandler(async (req, res) => {
  const userId = Number(req.session.userId);
  const { name, description, type, password, removePassword, exactScore, correctWinner, goalDifference, correctGoals } = req.body;

  const league = await League.findByPk(req.params.id, {
    include: [{ model: Season, attributes: ['id', 'name', 'creatorId'] }],
  });
  if (!league) return res.redirect('/seasons');

  const user = await User.findByPk(userId);
  const seasonRole = await UserSeason.findOne({ where: { userId, seasonId: league.seasonId } });
  const allowed = league.creatorId === userId
    || (league.Season && league.Season.creatorId === userId)
    || (seasonRole && seasonRole.role === 'admin')
    || (user && user.role === 'admin');
  if (!allowed) return res.status(403).render('error-page', { message: 'Nemáš oprávnenie upraviť túto ligu.' });

  const renderErr = (msg) => res.status(400).render('editLeague', { league: { ...league.toJSON(), scoringSystem: league.scoringSystem || {} }, error: msg });
  if (!name || !name.trim()) return renderErr('Názov ligy je povinný.');

  league.name = name.trim();
  league.description = description || null;
  if (type === 'official' && user.role === 'admin') league.type = 'official';
  else if (type === 'custom') league.type = 'custom';

  // bodovanie len ak nie je uzamknuté (nezačalo prvé kolo)
  if (!league.scoringLocked) {
    const num = (v, d) => { const n = parseInt(v, 10); return Number.isInteger(n) && n >= 0 ? n : d; };
    const s = league.scoringSystem || {};
    league.scoringSystem = {
      exactScore: num(exactScore, s.exactScore ?? 10),
      correctWinner: num(correctWinner, s.correctWinner ?? 3),
      goalDifference: num(goalDifference, s.goalDifference ?? 2),
      correctGoals: num(correctGoals, s.correctGoals ?? 1),
    };
  }

  // heslo: pridať/zmeniť alebo odstrániť
  if (removePassword === 'on' || removePassword === 'true') {
    league.password = null;
    league.hasPassword = false;
  } else if (password && password.trim()) {
    league.password = await bcrypt.hash(password.trim(), 10);
    league.hasPassword = true;
  }

  await league.save();
  res.redirect('/leagues/' + league.id);
});

// helper: je tvorca/admin ligy?
async function isLeagueManager(league, userId) {
  if (!userId) return false;
  if (league.creatorId === userId) return true;
  const u = await User.findByPk(userId);
  if (u && u.role === 'admin') return true;
  if (league.Season && league.Season.creatorId === userId) return true;
  const sRole = await UserSeason.findOne({ where: { userId, seasonId: league.seasonId } });
  if (sRole && sRole.role === 'admin') return true;
  const lRole = await UserLeague.findOne({ where: { userId, leagueId: league.id } });
  return !!(lRole && lRole.role === 'admin');
}

// POST /leagues/:id/delete
const deleteLeagueSubmit = asyncHandler(async (req, res) => {
  const userId = Number(req.session.userId);
  const league = await League.findByPk(req.params.id, { include: [{ model: Season, attributes: ['id', 'creatorId'] }] });
  if (!league) return res.redirect('/seasons');
  if (!(await isLeagueManager(league, userId))) {
    return res.status(403).render('error-page', { message: 'Nemáš oprávnenie zmazať túto ligu.' });
  }
  // šablónu s existujúcimi klonmi nemažeme (klony by stratili zdroj výsledkov)
  if (league.isTemplate) {
    const clones = await League.count({ where: { templateId: league.id } });
    if (clones > 0) {
      return res.status(400).render('error-page', { message: 'Túto šablónu nemožno zmazať — existujú ligy, ktoré z nej vznikli.' });
    }
  }
  const seasonId = league.seasonId;
  await deleteLeague(league.id);
  res.redirect('/seasons/' + seasonId);
});

// POST /leagues/:id/leave
const leaveLeagueSubmit = asyncHandler(async (req, res) => {
  const userId = Number(req.session.userId);
  const league = await League.findByPk(req.params.id);
  if (!league) return res.redirect('/seasons');
  if (league.creatorId === userId) {
    return res.status(400).render('error-page', { message: 'Zakladateľ nemôže opustiť ligu — môžeš ju zmazať.' });
  }
  await UserLeague.destroy({ where: { userId, leagueId: league.id } });
  res.redirect('/leagues/' + league.id);
});

// GET /leagues/:id/members
const leagueMembersPage = asyncHandler(async (req, res) => {
  const userId = Number(req.session.userId);
  const league = await League.findByPk(req.params.id, { include: [{ model: Season, attributes: ['id', 'name', 'creatorId'] }] });
  if (!league) return res.status(404).render('error-page', { message: 'Liga nebola nájdená.' });
  if (!(await isLeagueManager(league, userId))) {
    return res.status(403).render('error-page', { message: 'Nemáš oprávnenie spravovať členov.' });
  }
  const memberships = await UserLeague.findAll({ where: { leagueId: league.id } });
  const members = [];
  for (const m of memberships) {
    const u = await User.findByPk(m.userId, { attributes: ['id', 'username', 'firstName', 'lastName'] });
    if (u) members.push({ ...u.toJSON(), role: m.role, isCreator: u.id === league.creatorId });
  }
  members.sort((a, b) => (b.isCreator - a.isCreator) || (a.username || '').localeCompare(b.username || ''));
  res.render('leagueMembers', { league: league.toJSON(), members });
});

// POST /leagues/:id/members/:userId
const leagueMemberAction = asyncHandler(async (req, res) => {
  const userId = Number(req.session.userId);
  const targetId = Number(req.params.userId);
  const action = req.body.action;
  const league = await League.findByPk(req.params.id, { include: [{ model: Season, attributes: ['id', 'creatorId'] }] });
  if (!league) return res.redirect('/seasons');
  if (!(await isLeagueManager(league, userId))) {
    return res.status(403).render('error-page', { message: 'Nemáš oprávnenie spravovať členov.' });
  }
  if (targetId === league.creatorId) {
    return res.redirect('/leagues/' + league.id + '/members');
  }
  if (action === 'remove') {
    await UserLeague.destroy({ where: { userId: targetId, leagueId: league.id } });
  } else if (action === 'promote') {
    await UserLeague.update({ role: 'admin' }, { where: { userId: targetId, leagueId: league.id } });
  } else if (action === 'demote') {
    await UserLeague.update({ role: 'player' }, { where: { userId: targetId, leagueId: league.id } });
  }
  res.redirect('/leagues/' + league.id + '/members');
});

module.exports = { leagueDetailPage, joinLeagueSubmit, createLeaguePage, createLeagueSubmit, editLeaguePage, editLeagueSubmit, deleteLeagueSubmit, leaveLeagueSubmit, leagueMembersPage, leagueMemberAction };
