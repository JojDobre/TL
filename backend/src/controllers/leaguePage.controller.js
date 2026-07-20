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
const notify = require('../utils/notification.service');
const achievements = require('../utils/achievement.engine');

const DEFAULT_SCORING = { exactScore: 10, correctGoals: 1, correctWinner: 3, goalDifference: 2 };

// dostupné šablóny: now v okne [availableFrom, availableTo] (prázdne = bez limitu)
function availableTemplateWhere() {
  const now = new Date();
  const Op = Sequelize.Op;
  return {
    isTemplate: true,
    [Op.and]: [
      { [Op.or]: [{ availableFrom: null }, { availableFrom: { [Op.lte]: now } }] },
      { [Op.or]: [{ availableTo: null }, { availableTo: { [Op.gte]: now } }] },
    ],
  };
}

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
      { model: Season, attributes: ['id', 'name', 'creatorId', 'mode', 'showRules', 'showNews'] },
      { model: Round, attributes: ['id', 'name', 'description', 'startDate', 'endDate', 'active', 'createdAt'] },
    ],
  });
  if (!league) return res.status(404).render('error-page', { message: 'Liga nebola nájdená.' });

  // KANONICKÁ URL: standalone turnaj žije na /seasons/:id. Priamy GET
  // /leagues/:id (notifikácie, staré odkazy, drobčeky) presmeruj — inak by
  // sa ten istý turnaj zobrazoval v dvoch rôznych šablónach.
  if (!req._standaloneView && league.Season && league.Season.mode === 'standalone') {
    return res.redirect('/seasons/' + league.seasonId);
  }

  // SÚKROMIE: obsah ligy (kolá, zápasy, rebríček) podlieha heslu jej SEZÓNY.
  // Nečlen heslovanej sezóny sa cez priamu URL ligy k obsahu nedostane —
  // presmerujeme ho na detail sezóny, kde je zamknutá obrazovka s poľom na heslo.
  {
    const seasonRow = await Season.findByPk(league.seasonId, { attributes: ['id', 'hasPassword', 'creatorId'] });
    if (seasonRow && seasonRow.hasPassword) {
      const uid = req.userId ? Number(req.userId) : null;
      let allowed = false;
      if (uid) {
        if (seasonRow.creatorId === uid || league.creatorId === uid) allowed = true;
        else {
          const [sm, lm, u] = await Promise.all([
            UserSeason.findOne({ where: { userId: uid, seasonId: seasonRow.id } }),
            UserLeague.findOne({ where: { userId: uid, leagueId: league.id } }),
            User.findByPk(uid, { attributes: ['role'] }),
          ]);
          allowed = !!(sm || lm || (u && u.role === 'admin'));
        }
      }
      if (!allowed) return res.redirect(`/seasons/${seasonRow.id}`);
    }
  }

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
      { model: User, attributes: ['id', 'username', 'firstName', 'lastName', 'profileImage'] },
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

  // ===== STANDALONE EXTRAS (len pre turnaj): meta sezóny + aktuality =====
  let standaloneSeason = null;
  let news = [];
  if (req._standaloneView) {
    const s = await Season.findByPk(league.seasonId);
    if (s) {
      standaloneSeason = { ...s.toJSON(), status: seasonStatus(s) };
    }
    // aktuality odvodené z kôl turnaja (vytvorené / otvorené / vyhodnotené kolo)
    const now = new Date();
    const roundIds = rounds.map((r) => r.id);
    let evalCounts = {};
    if (roundIds.length) {
      const ms = await Match.findAll({
        where: { roundId: { [Sequelize.Op.in]: roundIds } },
        attributes: ['id', 'roundId', 'status'],
      });
      ms.forEach((m) => {
        if (!evalCounts[m.roundId]) evalCounts[m.roundId] = { total: 0, finished: 0 };
        evalCounts[m.roundId].total += 1;
        if (m.status === 'finished') evalCounts[m.roundId].finished += 1;
      });
    }
    rounds.forEach((r) => {
      news.push({ title: (r.name || 'Kolo') + ' pridané', desc: 'Pribudlo nové kolo do turnaja.', tagText: 'Nové kolo', tagClass: 'tag-info', at: r.createdAt });
      if (r.startDate && new Date(r.startDate) <= now) {
        news.push({ title: (r.name || 'Kolo') + ' otvorené', desc: 'Kolo je otvorené na tipovanie.', tagText: 'Tipovanie', tagClass: 'tag-warning', at: r.startDate });
      }
      const c = evalCounts[r.id];
      if (c && c.total > 0 && c.finished === c.total) {
        news.push({ title: (r.name || 'Kolo') + ' vyhodnotené', desc: 'Body boli pridelené hráčom.', tagText: 'Vyhodnotené', tagClass: 'tag-success', at: r.startDate || r.createdAt });
      }
    });
    news.sort((a, b) => new Date(b.at) - new Date(a.at));
    news = news.slice(0, 6);
  }

  // môže prihlásený spravovať ligu? (tvorca ligy/sezóny, admin sezóny, glob. admin)
  let canManage = false;
  let isSeasonMember = false;
  if (meId) {
    const sRole = await UserSeason.findOne({ where: { userId: meId, seasonId: league.seasonId } });
    isSeasonMember = !!sRole;
    // rovnaké oprávnenie ako isLeagueManager (POST akcie) — tlačidlá správy
    // vidí presne ten, kto ich smie použiť
    canManage = await isLeagueManager(league, meId);
  }

  res.render(req._standaloneView ? 'standaloneDetail' : 'leagueDetail', {
    league: { ...league.toJSON(), membersCount, scoringSystem: league.scoringSystem || DEFAULT_SCORING },
    rounds,
    leaderboard,
    isMember: !!myMembership,
    isSeasonMember,
    isCreator: league.creatorId === meId,
    teamsCount: await league.countTeams(),
    myRank,
    myPoints,
    playedRounds,
    canManage,
    standaloneSeason,
    news,
  });
});

// POST /leagues/join — pripojenie do ligy z formulára (page) alebo fetch (modal)
const joinLeagueSubmit = asyncHandler(async (req, res) => {
  const { joinCode, password } = req.body;
  const userId = Number(req.session.userId);
  // fetch z modalu posiela x-requested-with / accept: application/json → chceme JSON odpovede
  const wantsJson = (req.headers['x-requested-with'] === 'fetch')
    || (req.headers.accept || '').includes('application/json');
  const fail = (status, message) => {
    if (wantsJson) return res.status(status).json({ success: false, message });
    return res.redirect('/leagues/' + (league ? league.id : ''));
  };

  if (!userId) {
    if (wantsJson) return res.status(401).json({ success: false, message: 'Musíš byť prihlásený.' });
    return res.redirect('/login');
  }

  const league = await League.findOne({ where: { joinCode: (joinCode || '').trim().toUpperCase() } });
  if (!league || !league.active) {
    if (wantsJson) return res.status(404).json({ success: false, message: 'Liga sa nenašla.' });
    return res.redirect('/seasons');
  }

  // ak má heslo, over ho — pri zlom hesle chyba do modalu (JSON) alebo redirect späť
  if (league.hasPassword) {
    const ok = password && await bcrypt.compare(password, league.password || '');
    if (!ok) return fail(401, 'Nesprávne heslo. Skús to znova.');
  }

  // findOrCreate: ak už členstvo existuje, nič nevytvára (žiadny duplicitný PRIMARY)
  const [, leagueCreated] = await UserLeague.findOrCreate({
    where: { userId, leagueId: league.id },
    defaults: { userId, leagueId: league.id, role: 'player', joinedAt: new Date() },
  });
  // členstvo v sezóne tiež cez findOrCreate
  await UserSeason.findOrCreate({
    where: { userId, seasonId: league.seasonId },
    defaults: { userId, seasonId: league.seasonId, role: 'player', joinedAt: new Date() },
  });

  // notifikácia ostatným členom — len ak naozaj pribudol nový člen
  if (leagueCreated) {
    const joiner = await User.findByPk(userId, { attributes: ['username'] });
    await notify.memberJoined(league, userId, joiner ? joiner.username : null);
  }

  // standalone liga: detail žije na /seasons/:id (turnaj), nie /leagues/:id
  const parentSeason = await Season.findByPk(league.seasonId, { attributes: ['id', 'mode'] });
  const dest = (parentSeason && parentSeason.mode === 'standalone')
    ? '/seasons/' + league.seasonId
    : '/leagues/' + league.id;
  if (wantsJson) return res.json({ success: true, redirect: dest });
  res.redirect(dest);
});

// GET /leagues/create?season=:id — formulár na vytvorenie ligy
const createLeaguePage = asyncHandler(async (req, res) => {
  const seasonId = req.query.season;
  if (!seasonId) return res.redirect('/seasons');
  const season = await Season.findByPk(seasonId, { attributes: ['id', 'name', 'type', 'creatorId'] });
  if (!season) return res.status(404).render('error-page', { message: 'Sezóna nebola nájdená.' });

  // oprávnenie ako pri POST /leagues/create: tvorca sezóny / season-admin / globálny admin
  const userId = Number(req.session.userId);
  const user = await User.findByPk(userId);
  const seasonRole = await UserSeason.findOne({ where: { userId, seasonId } });
  const isSeasonAdmin = seasonRole && seasonRole.role === 'admin';
  if (season.creatorId !== userId && !isSeasonAdmin && (!user || user.role !== 'admin')) {
    return res.status(403).render('error-page', { message: 'Nemáš oprávnenie vytvoriť ligu v tejto sezóne.' });
  }

  // dostupné šablóny (oficiálne ligy označené ako šablóna) — na výber pri klonovaní
  const templates = await League.findAll({
    where: availableTemplateWhere(),
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
  const image = (req.body.image || '').trim() || null;
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
    template = await League.findOne({ where: { id: req.body.templateId, ...availableTemplateWhere() } });
    if (!template) return renderErr('Vybraná šablóna neexistuje.');
  }

  const league = await League.create({
    name: name.trim(), description: description || null, image,
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
    achievements.evaluateInBackground([userId]);
    return res.redirect('/leagues/' + league.id);
  }

  // klasická liga: na detail (upozornenie na chýbajúce tímy je v detaile)
  achievements.evaluateInBackground([userId]);
  res.redirect('/leagues/' + league.id);
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

  // bodovanie je zamknuté, ak liga už má vyhodnotený zápas (alebo bolo zamknuté skôr)
  let scoringLocked = !!league.scoringLocked;
  if (!scoringLocked) {
    const rs = await Round.findAll({ where: { leagueId: league.id }, attributes: ['id'] });
    const ids = rs.map((r) => r.id);
    if (ids.length) {
      scoringLocked = (await Match.count({ where: { roundId: { [Sequelize.Op.in]: ids }, status: 'finished' } })) > 0;
    }
  }

  res.render('editLeague', {
    league: { ...league.toJSON(), scoringSystem: league.scoringSystem || {}, scoringLocked },
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
    include: [{ model: Season, attributes: ['id', 'name', 'creatorId', 'mode'] }],
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
  if (req.body.image !== undefined) league.image = (req.body.image || '').trim() || null;
  if (type === 'official' && user.role === 'admin') league.type = 'official';
  else if (type === 'custom') league.type = 'custom';

  // bodovanie sa nedá meniť, ak liga už má vyhodnotený zápas (inak by sa
  // spätne menili už pridelené body). Kontrolujeme to dynamicky.
  const roundsOfLeague = await Round.findAll({ where: { leagueId: league.id }, attributes: ['id'] });
  const roundIdList = roundsOfLeague.map((r) => r.id);
  let hasEvaluated = false;
  if (roundIdList.length) {
    hasEvaluated = (await Match.count({ where: { roundId: { [Sequelize.Op.in]: roundIdList }, status: 'finished' } })) > 0;
  }
  if (hasEvaluated && !league.scoringLocked) {
    league.scoringLocked = true; // zamkni natrvalo
  }

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
  // standalone turnaj: späť na detail turnaja (/seasons/:id), bežná liga na ligu
  if (league.Season && league.Season.mode === 'standalone') {
    return res.redirect('/seasons/' + league.seasonId);
  }
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
  const league = await League.findByPk(req.params.id, { include: [{ model: Season, attributes: ['id', 'name', 'creatorId', 'mode', 'showRules', 'showNews'] }] });
  if (!league) return res.status(404).render('error-page', { message: 'Liga nebola nájdená.' });
  if (!(await isLeagueManager(league, userId))) {
    return res.status(403).render('error-page', { message: 'Nemáš oprávnenie spravovať členov.' });
  }
  const memberships = await UserLeague.findAll({ where: { leagueId: league.id } });
  const members = [];
  for (const m of memberships) {
    const u = await User.findByPk(m.userId, { attributes: ['id', 'username', 'firstName', 'lastName', 'profileImage'] });
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
  // návrat tam, odkiaľ akcia prišla (manage posiela from=manage,
  // standalone správa turnaja from=season-manage)
  const backUrl = req.body.from === 'season-manage'
    ? '/seasons/' + league.seasonId + '/manage'
    : (req.body.from === 'manage'
      ? '/leagues/' + league.id + '/manage'
      : '/leagues/' + league.id + '/members');
  if (targetId === league.creatorId) {
    return res.redirect(backUrl);
  }
  if (action === 'remove') {
    await UserLeague.destroy({ where: { userId: targetId, leagueId: league.id } });
  } else if (action === 'promote') {
    await UserLeague.update({ role: 'admin' }, { where: { userId: targetId, leagueId: league.id } });
  } else if (action === 'demote') {
    await UserLeague.update({ role: 'player' }, { where: { userId: targetId, leagueId: league.id } });
  }
  res.redirect(backUrl);
});

// POST /leagues/:id/end — ukončiť alebo znovuotvoriť ligu (toggle, len správca)
const endLeagueSubmit = asyncHandler(async (req, res) => {
  const userId = Number(req.session.userId);
  const league = await League.findByPk(req.params.id, { include: [{ model: Season, attributes: ['id', 'creatorId'] }] });
  if (!league) return res.redirect('/seasons');
  if (!(await isLeagueManager(league, userId))) {
    return res.status(403).render('error-page', { message: 'Nemáš oprávnenie ukončiť túto ligu.' });
  }
  // klon nemá zmysel ukončovať samostatne (riadi sa originálom), ale povolíme
  league.ended = !league.ended;
  await league.save();

  // achievementy po UKONČENÍ ligy (pódium, víťaz ligy, ukončenie súťaže)
  // — vyhodnoť všetkých členov ligy
  if (league.ended) {
    const members = await UserLeague.findAll({ where: { leagueId: league.id }, attributes: ['userId'] });
    achievements.evaluateInBackground(members.map((m) => m.userId));
  }
  res.redirect('/leagues/' + league.id);
});

// GET /leagues/:id/manage — tabová správa ligy (Členovia / Tímy / Bodovanie /
// Nastavenia + Nebezpečná zóna). Štýlovo zhodné so správou sezóny.
const manageLeaguePage = asyncHandler(async (req, res) => {
  const userId = Number(req.session.userId);
  const league = await League.findByPk(req.params.id, {
    include: [{ model: Season, attributes: ['id', 'name', 'creatorId', 'description', 'image', 'startDate', 'endDate', 'inviteCode', 'hasPassword', 'hidden', 'mode', 'ended', 'active', 'prizes', 'showPrizes', 'showRules', 'showNews'] }],
  });
  if (!league) return res.status(404).render('error-page', { message: 'Liga nebola nájdená.' });
  if (!(await isLeagueManager(league, userId))) {
    return res.status(403).render('error-page', { message: 'Nemáš oprávnenie spravovať túto ligu.' });
  }

  // členovia ligy (rovnako ako leagueMembersPage)
  const memberships = await UserLeague.findAll({ where: { leagueId: league.id } });
  const members = [];
  for (const m of memberships) {
    const mu = await User.findByPk(m.userId, { attributes: ['id', 'username', 'firstName', 'lastName', 'profileImage'] });
    if (mu) members.push({ ...mu.toJSON(), role: m.role, isCreator: mu.id === league.creatorId, joinedAt: m.createdAt });
  }
  members.sort((a, b) => (b.isCreator - a.isCreator) || (a.username || '').localeCompare(b.username || ''));

  // kolá a počet vyhodnotených zápasov → zámok bodovania
  const rounds = await Round.findAll({ where: { leagueId: league.id }, attributes: ['id'] });
  const roundIds = rounds.map((r) => r.id);
  let finishedCount = 0;
  let totalMatches = 0;
  if (roundIds.length) {
    totalMatches = await Match.count({ where: { roundId: { [Sequelize.Op.in]: roundIds } } });
    finishedCount = await Match.count({ where: { roundId: { [Sequelize.Op.in]: roundIds }, status: 'finished' } });
  }
  const scoringLocked = !!league.scoringLocked || finishedCount > 0;

  // odoslané tipy v lige
  let tipsCount = 0;
  if (roundIds.length) {
    const matchIdsRows = await Match.findAll({ where: { roundId: { [Sequelize.Op.in]: roundIds } }, attributes: ['id'] });
    const matchIds = matchIdsRows.map((m) => m.id);
    if (matchIds.length) tipsCount = await Tip.count({ where: { matchId: { [Sequelize.Op.in]: matchIds } } });
  }

  // vlastník (meno)
  const owner = await User.findByPk(league.creatorId, { attributes: ['username', 'firstName', 'lastName'] });
  const ownerName = owner ? ([owner.firstName, owner.lastName].filter(Boolean).join(' ') || owner.username) : '—';

  res.render(req._standaloneManageView ? 'manageStandalone' : 'manageLeague', {
    league: { ...league.toJSON(), scoringSystem: league.scoringSystem || DEFAULT_SCORING, scoringLocked },
    seasonName: league.Season ? league.Season.name : '',
    season: league.Season ? league.Season.toJSON() : null,
    members,
    summary: {
      membersCount: members.length,
      roundsCount: roundIds.length,
      totalMatches,
      finishedCount,
      tipsCount,
      ownerName,
    },
    // liga zo šablóny má tímy prevzaté → súpisku nemožno meniť
    teamsLocked: !!league.templateId,
    sports: SPORTS,
    countries: COUNTRIES,
    error: null,
    meId: userId,
  });
});

module.exports = { leagueDetailPage, joinLeagueSubmit, createLeaguePage, createLeagueSubmit, editLeaguePage, editLeagueSubmit, deleteLeagueSubmit, leaveLeagueSubmit, leagueMembersPage, leagueMemberAction, endLeagueSubmit, manageLeaguePage };