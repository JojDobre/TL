// backend/src/controllers/page.controller.js
//
// Controllery, ktoré VYKRESĽUJÚ EJS stránky (server-rendered HTML s dátami).
// Logika načítania dát je rovnaká ako v API controlleroch — líši sa len tým,
// že na konci je res.render(...) namiesto res.json(...).

const { Season, User, League, Round, Match, Tip, Team, UserSeason, UserLeague, Sequelize, sequelize } = require('../models');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const { seasonStatus, isSeasonLocked, canViewSeasonContent } = require('../utils/season.utils');
const { deleteSeason } = require('../utils/delete.util');
const { cloneTemplateInto } = require('../utils/league-clone.util');
const { asyncHandler } = require('../middleware/error.middleware');
const { leagueDetailPage, manageLeaguePage } = require('./leaguePage.controller');

// where klauzula pre DOSTUPNÉ šablóny: now musí byť v okne [availableFrom, availableTo]
// (prázdne hranice = bez obmedzenia). Použité pri ponuke šablón v tvorbe ligy.
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

const generateInviteCode = () => uuidv4().substring(0, 6).toUpperCase();
const SEASON_LIMITS = { player: 1, vip: 2 };

// GET /seasons
const seasonsPage = asyncHandler(async (req, res) => {
  const meId = req.userId ? Number(req.userId) : null;
  // ID sezón, ktorých je prihlásený členom (skryté sezóny smie vidieť, ak je v nich)
  let mySeasonIds = [];
  if (meId) {
    const mem = await UserSeason.findAll({ where: { userId: meId }, attributes: ['seasonId'] });
    mySeasonIds = mem.map((m) => m.seasonId);
  }

  const seasons = await Season.findAll({
    include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] }],
    order: [['createdAt', 'DESC']],
  });
  const withCounts = await Promise.all(seasons.map(async (season) => {
    const leaguesCount = await League.count({ where: { seasonId: season.id } });
    let participantsCount = 0;
    try { participantsCount = await season.countParticipants(); } catch { /* nič */ }
    return { ...season.toJSON(), leaguesCount, participantsCount, status: seasonStatus(season) };
  }));

  // skryté sezóny zo zoznamu vypadnú — okrem tých, kde je užívateľ člen/tvorca
  const visible = withCounts.filter((s) =>
    !s.hidden || (meId && (s.creatorId === meId || mySeasonIds.includes(s.id))));

  const official = visible.filter((s) => s.type === 'official');
  const community = visible.filter((s) => s.type === 'community');
  res.render('seasons', { official, community });
});

// GET /seasons/:id
const seasonDetailPage = asyncHandler(async (req, res) => {
  const season = await Season.findByPk(req.params.id, {
    include: [{ model: User, as: 'creator', attributes: ['id', 'username', 'firstName', 'lastName'] }],
  });
  if (!season) return res.status(404).render('error-page', { message: 'Sezóna nebola nájdená.' });

  // STANDALONE (samostatná liga / turnaj): sezóna je len obal pre jednu ligu.
  // Detail vykreslíme cez leagueDetailPage so šablónou standaloneDetail.
  if (season.mode === 'standalone') {
    const league = await League.findOne({ where: { seasonId: season.id }, order: [['createdAt', 'ASC']] });
    if (league) {
      req.params.id = String(league.id);
      req._standaloneView = true;
      return leagueDetailPage(req, res);
    }
    // ak by liga chýbala (nemalo by nastať), pokračuj klasickým detailom sezóny
  }

  const meId = req.userId ? Number(req.userId) : null;

  // je prihlásený členom / tvorcom / globálnym adminom?
  let isMember = false;
  let isGlobalAdmin = false;
  if (meId) {
    const membership = await UserSeason.findOne({ where: { userId: meId, seasonId: season.id } });
    isMember = !!membership;
    const u = await User.findByPk(meId);
    isGlobalAdmin = u && u.role === 'admin';
  }
  const isCreator = meId && season.creatorId === meId;
  const canManage = isCreator || isGlobalAdmin || false;
  // tvorba ligy: v oficiálnej len správca/admin; v community ktorýkoľvek člen; nikdy ak ended
  const ended = seasonStatus(season) === 'ended';
  const canCreateLeague = !ended && (canManage || (season.type === 'community' && isMember));

  const status = seasonStatus(season);

  // SÚKROMIE: ak je súkromná a nemám prístup → zamknutý detail (len pole na heslo)
  const canView = canViewSeasonContent(season, { isMember, isCreator, isGlobalAdmin });
  if (!canView) {
    return res.render('seasonDetail', {
      season: { ...season.toJSON(), status, locked: true, participantsCount: null, leaguesCount: null },
      leagues: [], leaderboard: [], joinError: null,
      restricted: true, canManage: false, status,
    });
  }

  let participantsCount = 0;
  try { participantsCount = await season.countParticipants(); } catch { /* nič */ }
  const leagues = await League.findAll({ where: { seasonId: season.id }, order: [['createdAt', 'ASC']] });
  // počet členov každej ligy (priamo z UserLeague)
  const leaguesWithCounts = [];
  for (const l of leagues) {
    const mc = await UserLeague.count({ where: { leagueId: l.id } });
    leaguesWithCounts.push({ ...l.toJSON(), membersCount: mc });
  }

  // súhrnný rebríček (agregácia bodov z tipov vo všetkých ligách sezóny)
  let leaderboard = [];
  try {
    const tips = await Tip.findAll({
      include: [
        // required:true na celej reťazi → INNER JOIN, takže where {seasonId}
        // skutočne odfiltruje tipy z iných sezón (inak LEFT JOIN vráti všetky tipy).
        { model: Match, required: true, include: [{ model: Round, required: true, include: [{ model: League, required: true, where: { seasonId: season.id } }] }] },
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
    leaderboard = Object.values(byUser).sort((a, b) => b.totalPoints - a.totalPoints);
  } catch (e) { leaderboard = []; }

  // ===== NOVINKY V SEZÓNE (odvodené z existujúcich dát) =====
  // typy: nová liga, nové kolo (vytvorené), spustené kolo (otvorené na tip),
  // vyhodnotené kolo (všetky zápasy finished), zrušený zápas.
  const leagueIds = leagues.map((l) => l.id);
  const leagueNameById = {};
  leagues.forEach((l) => { leagueNameById[l.id] = l.name; });
  const now = new Date();
  const activity = [];

  // nové ligy
  leagues.forEach((l) => {
    activity.push({
      title: 'Nová liga: ' + l.name,
      desc: 'V sezóne pribudla nová liga.',
      tagText: 'Liga', tagClass: 'tag-gold',
      at: l.createdAt,
    });
  });

  if (leagueIds.length) {
    const rounds = await Round.findAll({
      where: { leagueId: { [Sequelize.Op.in]: leagueIds } },
      attributes: ['id', 'name', 'leagueId', 'startDate', 'createdAt'],
    });
    const roundIds = rounds.map((r) => r.id);

    // počty zápasov a vyhodnotených zápasov na kolo (pre detekciu vyhodnoteného kola)
    let counts = {};
    if (roundIds.length) {
      const matches = await Match.findAll({
        where: { roundId: { [Sequelize.Op.in]: roundIds } },
        attributes: ['id', 'roundId', 'status'],
      });
      matches.forEach((m) => {
        if (!counts[m.roundId]) counts[m.roundId] = { total: 0, finished: 0, lastFinishedAt: null };
        counts[m.roundId].total += 1;
        if (m.status === 'finished') counts[m.roundId].finished += 1;
      });
    }

    rounds.forEach((r) => {
      const lname = leagueNameById[r.leagueId] || '';
      // vytvorené kolo
      activity.push({
        title: r.name + ' pridané · ' + lname,
        desc: 'Pribudlo nové kolo do ligy.',
        tagText: 'Nové kolo', tagClass: 'tag-info',
        at: r.createdAt,
      });
      // spustené kolo (otvorené na tip) — len ak start už nastal
      if (r.startDate && new Date(r.startDate) <= now) {
        activity.push({
          title: r.name + ' otvorené · ' + lname,
          desc: 'Kolo je otvorené na tipovanie.',
          tagText: 'Tipovanie', tagClass: 'tag-warning',
          at: r.startDate,
        });
      }
      // vyhodnotené kolo — všetky zápasy finished (a aspoň jeden existuje)
      const c = counts[r.id];
      if (c && c.total > 0 && c.finished === c.total) {
        activity.push({
          title: r.name + ' vyhodnotené · ' + lname,
          desc: 'Body boli pridelené hráčom.',
          tagText: 'Vyhodnotené', tagClass: 'tag-success',
          at: r.startDate || r.createdAt,
        });
      }
    });

    // zrušené zápasy
    if (roundIds.length) {
      const canceled = await Match.findAll({
        where: { roundId: { [Sequelize.Op.in]: roundIds }, status: 'canceled' },
        include: [{ model: Team, as: 'homeTeam', attributes: ['name'] }, { model: Team, as: 'awayTeam', attributes: ['name'] }],
        attributes: ['id', 'updatedAt'],
      });
      canceled.forEach((m) => {
        const h = m.homeTeam ? m.homeTeam.name : '?';
        const a = m.awayTeam ? m.awayTeam.name : '?';
        activity.push({
          title: 'Zápas ' + h + ' — ' + a + ' zrušený',
          desc: 'Body sa za tento zápas neprideľujú.',
          tagText: 'Zrušené', tagClass: 'tag-danger',
          at: m.updatedAt,
        });
      });
    }
  }
  activity.sort((x, y) => new Date(y.at) - new Date(x.at));
  const news = activity.slice(0, 5);

  // ===== TVOJ PROGRESS V SEZÓNE (pre prihláseného člena) =====
  let progress = null;
  if (meId && isMember) {
    const idx = leaderboard.findIndex((e) => (e.user ? e.user.id : null) === meId);
    const myPoints = idx >= 0 ? leaderboard[idx].totalPoints : 0;
    const myRank = idx >= 0 ? idx + 1 : null;
    // odohrané / celkové kolá v sezóne
    let totalRounds = 0; let playedRounds = 0;
    if (leagueIds.length) {
      const rs = await Round.findAll({ where: { leagueId: { [Sequelize.Op.in]: leagueIds } }, attributes: ['id', 'endDate'] });
      totalRounds = rs.length;
      const now = new Date();
      playedRounds = rs.filter((r) => r.endDate && new Date(r.endDate) < now).length;
    }
    progress = {
      myPoints, myRank,
      totalPlayers: leaderboard.length,
      playedRounds, totalRounds,
      progressPct: totalRounds > 0 ? Math.round((playedRounds / totalRounds) * 100) : 0,
    };
  }

  res.render('seasonDetail', {
    season: { ...season.toJSON(), participantsCount, leaguesCount: leagues.length, status },
    leagues: leaguesWithCounts,
    leaderboard,
    news,
    progress,
    joinError: null,
    restricted: false,
    canManage,
    isMember,
    isCreator,
    canCreateLeague,
    status,
  });
});

// GET /seasons/create
const createSeasonPage = asyncHandler(async (req, res) => {
  // šablóny (oficiálne ligy označené ako isTemplate) — ponúkajú sa pri samostatnej lige
  const templates = await League.findAll({
    where: availableTemplateWhere(),
    attributes: ['id', 'name', 'description'],
    order: [['name', 'ASC']],
  });
  res.render('createSeason', { error: null, templates: templates.map((t) => t.toJSON()) });
});

// POST /seasons/create
const createSeasonSubmit = asyncHandler(async (req, res) => {
  const { name, description, image, type, startDate, endDate, password, isPrivate, hidden } = req.body;
  const userId = Number(req.session.userId);
  const user = await User.findByPk(userId);
  if (!user) return res.redirect('/login');

  const back = async (error) => {
    const templates = await League.findAll({
      where: availableTemplateWhere(),
      attributes: ['id', 'name', 'description'],
      order: [['name', 'ASC']],
    });
    return res.status(400).render('createSeason', { error, templates: templates.map((t) => t.toJSON()) });
  };

  if (!name || !name.trim()) return await back('Názov sezóny je povinný.');

  // limit počtu AKTÍVNYCH sezón podľa roly (ended sa nepočítajú)
  const limit = SEASON_LIMITS[user.role];
  if (limit !== undefined) {
    const mine = await Season.findAll({ where: { creatorId: userId } });
    const activeCount = mine.filter((s) => seasonStatus(s) !== 'ended').length;
    if (activeCount >= limit) {
      return await back(user.role === 'player'
        ? 'Máš už maximálny počet aktívnych sezón (1). Ukonči niektorú, alebo prejdi na VIP.'
        : `Máš už maximálny počet aktívnych sezón (${limit}). Ukonči niektorú pre vytvorenie ďalšej.`);
    }
  }

  // oficiálnu sezónu môže vytvoriť LEN admin
  const seasonType = (type === 'official' && user.role === 'admin') ? 'official' : 'community';
  const participantLimit = seasonType === 'community' ? 100 : null;

  // dátumy (voliteľné, ale ak sú obe, koniec musí byť po začiatku)
  let start = startDate ? new Date(startDate) : null;
  let end = endDate ? new Date(endDate) : null;
  if (start && isNaN(start)) start = null;
  if (end && isNaN(end)) end = null;
  if (start && end && end <= start) return await back('Koniec sezóny musí byť po jej začiatku.');
  if (end && end <= new Date()) return await back('Dátum ukončenia musí byť v budúcnosti (alebo nechaj prázdne pre sezónu bez konca).');

  // ===== SAMOSTATNÁ LIGA (TURNAJ) =====
  // Vytvoríme sezónu mode='standalone' + práve jednu ligu v nej (transakčne).
  // Detail aj správa potom bežia cez ligu (pozri seasonDetailPage / manageSeasonPage).
  if (req.body.mode === 'standalone') {
    const leagueType = (req.body.leagueType === 'official' && user.role === 'admin') ? 'official' : 'custom';

    // šablóna (voliteľná) — over, že existuje a je to platná šablóna
    let template = null;
    if (req.body.templateId) {
      template = await League.findOne({ where: { id: req.body.templateId, ...availableTemplateWhere() } });
      if (!template) return await back('Vybraná šablóna neexistuje.');
    }

    // heslo LIGY (pripojenie do turnaja ide cez ID ligy)
    let leaguePwHash = null;
    const lgPw = req.body.leaguePassword;
    if (lgPw && lgPw.trim()) leaguePwHash = await bcrypt.hash(lgPw.trim(), 10);

    // unikátny join kód ligy
    let joinCode;
    for (let i = 0; i < 10; i++) {
      const code = uuidv4().substring(0, 6).toUpperCase();
      if (!(await League.findOne({ where: { joinCode: code } }))) { joinCode = code; break; }
    }

    let newSeasonId = null;
    let newLeague = null;
    try {
      await sequelize.transaction(async (t) => {
        const season = await Season.create({
          name: name.trim(), description: description || null, image: image || null,
          type: seasonType, mode: 'standalone', inviteCode: generateInviteCode(),
          creatorId: userId, active: true, participantLimit,
          startDate: start, endDate: end, ended: false,
          password: null, hasPassword: false, hidden: false,
        }, { transaction: t });

        const league = await League.create({
          name: name.trim(), description: description || null,
          type: leagueType, joinCode, password: leaguePwHash, hasPassword: !!leaguePwHash,
          seasonId: season.id, creatorId: userId,
          scoringSystem: { exactScore: 10, correctWinner: 3, goalDifference: 2, correctGoals: 1 },
          scoringLocked: false, active: true, isTemplate: false,
          templateId: template ? template.id : null,
        }, { transaction: t });

        // zakladateľ = admin v lige aj v sezóne
        await UserLeague.create({ userId, leagueId: league.id, role: 'admin', joinedAt: new Date() }, { transaction: t });
        await UserSeason.create({ userId, seasonId: season.id, role: 'admin', joinedAt: new Date() }, { transaction: t });

        newSeasonId = season.id;
        newLeague = league;
      });
    } catch (e) {
      return await back('Nepodarilo sa vytvoriť samostatnú ligu. Skús to znova.');
    }

    // klonovanie zo šablóny — až po commite (rovnako ako pri tvorbe ligy).
    // Ak klon zlyhá, turnaj ostane bez kôl a používateľ ich doplní v správe.
    if (template && newLeague) {
      try { await cloneTemplateInto(template, newLeague); } catch (e) { /* ticho — turnaj ostane prázdny */ }
    }

    return res.redirect('/seasons/' + newSeasonId);
  }

  // heslo + súkromie — len pre community (oficiálne sú vždy verejné)
  let passwordHash = null;
  let priv = false;
  let hide = false;
  if (seasonType === 'community' && (isPrivate === 'on' || isPrivate === 'true')) {
    if (!password || !password.trim()) return await back('Súkromná sezóna musí mať heslo.');
    passwordHash = await bcrypt.hash(password.trim(), 10);
    priv = true;
    hide = (hidden === 'on' || hidden === 'true');
  }

  const season = await Season.create({
    name: name.trim(), description, image: image || null,
    type: seasonType, inviteCode: generateInviteCode(),
    creatorId: userId, active: true, participantLimit,
    startDate: start, endDate: end, ended: false,
    password: passwordHash, hasPassword: priv, hidden: hide,
  });
  try { await season.addParticipant(userId, { through: { role: 'admin' } }); } catch (e) { /* nič */ }

  res.redirect('/seasons/' + season.id);
});

// POST /seasons/join   (cez invite kód ALEBO id, s heslom ak je súkromná)
const joinSeasonSubmit = asyncHandler(async (req, res) => {
  const { inviteCode, seasonId, password } = req.body;
  const userId = Number(req.session.userId);
  if (!userId) return res.redirect('/login');

  // nájdi sezónu podľa id (z detailu) alebo invite kódu (z dialógu)
  let season = null;
  if (seasonId) season = await Season.findByPk(seasonId);
  if (!season && inviteCode) season = await Season.findOne({ where: { inviteCode: (inviteCode || '').toUpperCase() } });

  // FALLBACK: zadaný kód nie je sezóna → skús ho ako join kód LIGY.
  // Toto rieši standalone turnaje (zobrazené ID je ID ligy) aj bežné ligy.
  if (!season && inviteCode) {
    const league = await League.findOne({ where: { joinCode: (inviteCode || '').trim().toUpperCase() } });
    if (league && league.active) {
      if (league.hasPassword) {
        const ok = password && await bcrypt.compare(password, league.password || '');
        if (!ok) return res.redirect('/leagues/' + league.id);
      }
      const [, created] = await UserLeague.findOrCreate({
        where: { userId, leagueId: league.id },
        defaults: { userId, leagueId: league.id, role: 'player', joinedAt: new Date() },
      });
      await UserSeason.findOrCreate({
        where: { userId, seasonId: league.seasonId },
        defaults: { userId, seasonId: league.seasonId, role: 'player', joinedAt: new Date() },
      });
      if (created) {
        try {
          const notify = require('../utils/notification.service');
          const joiner = await User.findByPk(userId, { attributes: ['username'] });
          await notify.memberJoined(league, userId, joiner ? joiner.username : null);
        } catch (e) { /* notifikácia nesmie zhodiť pripojenie */ }
      }
      // standalone → na detail turnaja (/seasons/:id), bežná liga → na ligu
      const parent = await Season.findByPk(league.seasonId, { attributes: ['id', 'mode'] });
      if (parent && parent.mode === 'standalone') return res.redirect('/seasons/' + league.seasonId);
      return res.redirect('/leagues/' + league.id);
    }
  }

  if (!season) return res.redirect('/seasons');

  // ukončená sezóna — nedá sa pripojiť
  if (isSeasonLocked(season)) return res.redirect('/seasons/' + season.id);

  // súkromná → over heslo
  if (season.hasPassword) {
    const ok = password && await bcrypt.compare(password, season.password || '');
    if (!ok) {
      // späť na detail s chybou hesla
      return res.status(401).render('seasonDetail', {
        season: { ...season.toJSON(), status: seasonStatus(season), locked: true },
        leagues: [], leaderboard: [], joinError: 'Nesprávne heslo sezóny.',
        restricted: true, canManage: false, status: seasonStatus(season),
      });
    }
  }

  await UserSeason.findOrCreate({
    where: { userId, seasonId: season.id },
    defaults: { userId, seasonId: season.id, role: 'player', joinedAt: new Date() },
  });
  res.redirect('/seasons/' + season.id);
});

// GET /seasons/:id/manage — úprava sezóny (len tvorca/admin)
const manageSeasonPage = asyncHandler(async (req, res) => {
  const userId = Number(req.session.userId);
  const season = await Season.findByPk(req.params.id);
  if (!season) return res.status(404).render('error-page', { message: 'Sezóna nebola nájdená.' });

  // STANDALONE: správa beží cez manageLeague (manageStandalone view) tej jednej ligy.
  if (season.mode === 'standalone') {
    const league = await League.findOne({ where: { seasonId: season.id }, order: [['createdAt', 'ASC']] });
    if (league) {
      req.params.id = String(league.id);
      req._standaloneManageView = true;
      return manageLeaguePage(req, res);
    }
  }

  const u = await User.findByPk(userId);
  const allowed = season.creatorId === userId || (u && u.role === 'admin');
  if (!allowed) return res.status(403).render('error-page', { message: 'Nemáš oprávnenie spravovať túto sezónu.' });

  // členovia sezóny
  const memberships = await UserSeason.findAll({ where: { seasonId: season.id } });
  const members = [];
  for (const m of memberships) {
    const mu = await User.findByPk(m.userId, { attributes: ['id', 'username', 'firstName', 'lastName'] });
    if (mu) members.push({ ...mu.toJSON(), role: m.role, isCreator: mu.id === season.creatorId, joinedAt: m.createdAt });
  }
  members.sort((a, b) => (b.isCreator - a.isCreator) || (a.username || '').localeCompare(b.username || ''));

  // súhrn
  const leaguesCount = await League.count({ where: { seasonId: season.id } });
  const creator = await User.findByPk(season.creatorId, { attributes: ['username', 'firstName', 'lastName'] });
  const creatorName = creator ? ([creator.firstName, creator.lastName].filter(Boolean).join(' ') || creator.username) : '—';

  res.render('manageSeason', {
    season: { ...season.toJSON(), status: seasonStatus(season) },
    members,
    summary: { membersCount: members.length, leaguesCount, creatorName },
    error: null,
  });
});

// POST /seasons/:id/manage
const manageSeasonSubmit = asyncHandler(async (req, res) => {
  const userId = Number(req.session.userId);
  const { name, description, image, startDate, endDate, isPrivate, password, removePassword, hidden } = req.body;
  const season = await Season.findByPk(req.params.id);
  if (!season) return res.redirect('/seasons');

  const u = await User.findByPk(userId);
  const allowed = season.creatorId === userId || (u && u.role === 'admin');
  if (!allowed) return res.status(403).render('error-page', { message: 'Nemáš oprávnenie spravovať túto sezónu.' });

  const back = async (error) => {
    const memberships = await UserSeason.findAll({ where: { seasonId: season.id } });
    const members = [];
    for (const m of memberships) {
      const mu = await User.findByPk(m.userId, { attributes: ['id', 'username', 'firstName', 'lastName'] });
      if (mu) members.push({ ...mu.toJSON(), role: m.role, isCreator: mu.id === season.creatorId, joinedAt: m.createdAt });
    }
    members.sort((a, b) => (b.isCreator - a.isCreator) || (a.username || '').localeCompare(b.username || ''));
    const leaguesCount = await League.count({ where: { seasonId: season.id } });
    const creator = await User.findByPk(season.creatorId, { attributes: ['username', 'firstName', 'lastName'] });
    const creatorName = creator ? ([creator.firstName, creator.lastName].filter(Boolean).join(' ') || creator.username) : '—';
    return res.status(400).render('manageSeason', {
      season: { ...season.toJSON(), status: seasonStatus(season) },
      members,
      summary: { membersCount: members.length, leaguesCount, creatorName },
      error,
    });
  };

  // ukončenú sezónu nemožno upravovať
  if (isSeasonLocked(season)) return await back('Sezóna je ukončená a uzamknutá, nedá sa upravovať.');
  if (!name || !name.trim()) return await back('Názov sezóny je povinný.');

  let start = startDate ? new Date(startDate) : null;
  let end = endDate ? new Date(endDate) : null;
  if (start && isNaN(start)) start = null;
  if (end && isNaN(end)) end = null;
  if (start && end && end <= start) return await back('Koniec sezóny musí byť po jej začiatku.');
  if (end && end <= new Date()) return await back('Dátum ukončenia musí byť v budúcnosti (alebo nechaj prázdne pre sezónu bez konca).');

  season.name = name.trim();
  season.description = description || null;
  season.image = image || null;
  season.startDate = start;
  season.endDate = end;

  // súkromie/heslo — len pre community
  if (season.type === 'community') {
    if (removePassword === 'on' || removePassword === 'true') {
      season.password = null; season.hasPassword = false; season.hidden = false;
    } else if (isPrivate === 'on' || isPrivate === 'true') {
      if (password && password.trim()) {
        season.password = await bcrypt.hash(password.trim(), 10);
        season.hasPassword = true;
      } else if (!season.hasPassword) {
        return await back('Súkromná sezóna musí mať heslo.');
      }
      season.hidden = (hidden === 'on' || hidden === 'true');
    } else {
      // odškrtnuté súkromie = verejná
      season.password = null; season.hasPassword = false; season.hidden = false;
    }
  }

  // STANDALONE: drž názov a popis ligy zhodné so sezónou (turnaj = jedna liga)
  if (season.mode === 'standalone') {
    const lg = await League.findOne({ where: { seasonId: season.id }, order: [['createdAt', 'ASC']] });
    if (lg) {
      lg.name = season.name;
      lg.description = season.description;
      await lg.save();
    }
  }

  await season.save();
  res.redirect('/seasons/' + season.id);
});

// POST /seasons/:id/end — ukončenie sezóny (uzamknutie)
// POST /seasons/:id/end — prepínač: ukončiť ALEBO znovu otvoriť sezónu.
// Formulár v manageSeason.ejs posiela na rovnaký endpoint pre oba prípady,
// preto tu rozhodujeme podľa aktuálneho stavu sezóny.
const endSeasonSubmit = asyncHandler(async (req, res) => {
  const userId = Number(req.session.userId);
  const season = await Season.findByPk(req.params.id);
  if (!season) return res.redirect('/seasons');

  const u = await User.findByPk(userId);
  const allowed = season.creatorId === userId || (u && u.role === 'admin');
  if (!allowed) return res.status(403).render('error-page', { message: 'Nemáš oprávnenie spravovať túto sezónu.' });

  const isEnded = seasonStatus(season) === 'ended';

  if (!isEnded) {
    // --- UKONČIŤ ---
    season.ended = true;
    season.active = false;
    await season.save();
    return res.redirect('/seasons/' + season.id);
  }

  // --- ZNOVU OTVORIŤ ---
  // 1) kontrola limitu aktívnych sezón podľa roly (admin = bez limitu).
  //    Limit sa viaže na rolu TVORCU sezóny, nie na obnovujúceho admina.
  const ownerId = season.creatorId;
  const owner = ownerId === userId ? u : await User.findByPk(ownerId);
  const limit = owner ? SEASON_LIMITS[owner.role] : undefined;
  if (limit !== undefined) {
    // počet INÝCH aktívnych sezón tvorcu (túto práve obnovovanú nerátame)
    const mine = await Season.findAll({ where: { creatorId: ownerId } });
    const otherActive = mine.filter((s) => s.id !== season.id && seasonStatus(s) !== 'ended').length;
    if (otherActive >= limit) {
      const msg = owner.role === 'player'
        ? 'Nedá sa obnoviť — už existuje iná aktívna sezóna (limit 1). Najprv ju ukonči, alebo prejdi na VIP.'
        : `Nedá sa obnoviť — dosiahnutý limit aktívnych sezón (${limit}). Najprv ukonči inú sezónu.`;
      return res.status(400).render('error-page', { message: msg });
    }
  }

  // 2) odomknutie. Ak endDate už ubehol, seasonStatus by sezónu hneď znova
  //    označil ako 'ended' → vyčistíme prešlý endDate, aby ostala aktívna.
  season.ended = false;
  season.active = true;
  if (season.endDate && new Date(season.endDate) < new Date()) {
    season.endDate = null;
  }
  await season.save();
  return res.redirect('/seasons/' + season.id);
});

// helper: je tvorca/admin sezóny?
async function isSeasonManager(season, userId) {
  if (!userId) return false;
  if (season.creatorId === userId) return true;
  const u = await User.findByPk(userId);
  if (u && u.role === 'admin') return true;
  const role = await UserSeason.findOne({ where: { userId, seasonId: season.id } });
  return !!(role && role.role === 'admin');
}

// POST /seasons/:id/delete — zmazať sezónu (len tvorca/globálny admin)
const deleteSeasonSubmit = asyncHandler(async (req, res) => {
  const userId = Number(req.session.userId);
  const season = await Season.findByPk(req.params.id);
  if (!season) return res.redirect('/seasons');

  const u = await User.findByPk(userId);
  const allowed = season.creatorId === userId || (u && u.role === 'admin');
  if (!allowed) return res.status(403).render('error-page', { message: 'Nemáš oprávnenie zmazať túto sezónu.' });

  await deleteSeason(season.id);
  res.redirect('/seasons');
});

// POST /seasons/:id/leave — opustiť sezónu (člen). Tvorca nemôže opustiť.
const leaveSeasonSubmit = asyncHandler(async (req, res) => {
  const userId = Number(req.session.userId);
  const season = await Season.findByPk(req.params.id);
  if (!season) return res.redirect('/seasons');
  if (season.creatorId === userId) {
    return res.status(400).render('error-page', { message: 'Zakladateľ nemôže opustiť sezónu — môžeš ju ukončiť alebo zmazať.' });
  }
  await UserSeason.destroy({ where: { userId, seasonId: season.id } });
  // opustenie sezóny → odchod aj zo všetkých jej líg
  await removeUserFromSeasonLeagues(season.id, userId);
  res.redirect('/seasons');
});

// GET /seasons/:id/members — správa členov (tvorca/admin)
const seasonMembersPage = asyncHandler(async (req, res) => {
  const userId = Number(req.session.userId);
  const season = await Season.findByPk(req.params.id);
  if (!season) return res.status(404).render('error-page', { message: 'Sezóna nebola nájdená.' });
  if (!(await isSeasonManager(season, userId))) {
    return res.status(403).render('error-page', { message: 'Nemáš oprávnenie spravovať členov.' });
  }
  const memberships = await UserSeason.findAll({ where: { seasonId: season.id } });
  const members = [];
  for (const m of memberships) {
    const u = await User.findByPk(m.userId, { attributes: ['id', 'username', 'firstName', 'lastName'] });
    if (u) members.push({ ...u.toJSON(), role: m.role, isCreator: u.id === season.creatorId });
  }
  members.sort((a, b) => (b.isCreator - a.isCreator) || (a.username || '').localeCompare(b.username || ''));
  res.render('seasonMembers', { season: season.toJSON(), members });
});

// Pomocník: odober používateľa zo VŠETKÝCH líg danej sezóny.
// Volá sa pri vyhodení člena zo sezóny aj pri dobrovoľnom opustení sezóny —
// člen mimo sezóny nesmie ostať v žiadnej jej lige.
async function removeUserFromSeasonLeagues(seasonId, targetUserId) {
  // ID všetkých líg patriacich sezóne
  const leagues = await League.findAll({ where: { seasonId }, attributes: ['id'] });
  const leagueIds = leagues.map((l) => l.id);
  if (leagueIds.length === 0) return;
  // zmaž členstvá používateľa v týchto ligách (tipy ostávajú kvôli histórii)
  await UserLeague.destroy({ where: { userId: targetUserId, leagueId: { [Sequelize.Op.in]: leagueIds } } });
}

// POST /seasons/:id/members/:userId — akcia s členom (promote/demote/remove)
const seasonMemberAction = asyncHandler(async (req, res) => {
  const userId = Number(req.session.userId);
  const targetId = Number(req.params.userId);
  const action = req.body.action;
  const season = await Season.findByPk(req.params.id);
  if (!season) return res.redirect('/seasons');
  if (!(await isSeasonManager(season, userId))) {
    return res.status(403).render('error-page', { message: 'Nemáš oprávnenie spravovať členov.' });
  }
  // tvorcu sa nedotýkame
  if (targetId === season.creatorId) {
    return res.redirect('/seasons/' + season.id + '/manage');
  }
  if (action === 'remove') {
    await UserSeason.destroy({ where: { userId: targetId, seasonId: season.id } });
    // vyhodenie zo sezóny → vyhodenie aj zo všetkých jej líg
    await removeUserFromSeasonLeagues(season.id, targetId);
  } else if (action === 'promote') {
    await UserSeason.update({ role: 'admin' }, { where: { userId: targetId, seasonId: season.id } });
  } else if (action === 'demote') {
    await UserSeason.update({ role: 'player' }, { where: { userId: targetId, seasonId: season.id } });
  }
  res.redirect('/seasons/' + season.id + '/manage');
});

// GET /join — samostatná stránka na pripojenie cez ID/kód
const joinPage = asyncHandler(async (req, res) => {
  res.render('join', {
    error: (req.query.error || null),
    needPassword: req.query.pw === '1',
    code: (req.query.code || '').toUpperCase(),
  });
});

// POST /join — pripojenie cez kód: skúsi ligu (joinCode) aj sezónu (inviteCode).
// Jedno pole "code" + voliteľné heslo. Po úspechu presmeruje na detail.
const joinSubmit = asyncHandler(async (req, res) => {
  const userId = Number(req.session.userId);
  if (!userId) return res.redirect('/login');

  const code = (req.body.code || '').trim().toUpperCase();
  const password = req.body.password || '';
  if (!code) return res.redirect('/join?error=' + encodeURIComponent('Zadaj ID alebo kód.'));

  const back = (msg, extra) => res.redirect('/join?code=' + encodeURIComponent(code) +
    '&error=' + encodeURIComponent(msg) + (extra || ''));

  // 1) skús LIGU podľa joinCode
  const league = await League.findOne({ where: { joinCode: code } });
  if (league && league.active) {
    if (league.hasPassword) {
      const ok = password && await bcrypt.compare(password, league.password || '');
      if (!ok) return back(password ? 'Nesprávne heslo ligy.' : 'Táto liga je chránená heslom.', '&pw=1');
    }
    const [, created] = await UserLeague.findOrCreate({
      where: { userId, leagueId: league.id },
      defaults: { userId, leagueId: league.id, role: 'player', joinedAt: new Date() },
    });
    await UserSeason.findOrCreate({
      where: { userId, seasonId: league.seasonId },
      defaults: { userId, seasonId: league.seasonId, role: 'player', joinedAt: new Date() },
    });
    if (created) {
      try {
        const notify = require('../utils/notification.service');
        const joiner = await User.findByPk(userId, { attributes: ['username'] });
        await notify.memberJoined(league, userId, joiner ? joiner.username : null);
      } catch (e) { /* notifikácia nesmie zhodiť pripojenie */ }
    }
    return res.redirect('/leagues/' + league.id);
  }

  // 2) skús SEZÓNU podľa inviteCode
  const season = await Season.findOne({ where: { inviteCode: code } });
  if (season) {
    if (isSeasonLocked(season)) return back('Táto sezóna je už ukončená.');
    if (season.hasPassword) {
      const ok = password && await bcrypt.compare(password, season.password || '');
      if (!ok) return back(password ? 'Nesprávne heslo sezóny.' : 'Táto sezóna je chránená heslom.', '&pw=1');
    }
    await UserSeason.findOrCreate({
      where: { userId, seasonId: season.id },
      defaults: { userId, seasonId: season.id, role: 'player', joinedAt: new Date() },
    });
    return res.redirect('/seasons/' + season.id);
  }

  // 3) kód nenájdený
  return back('Nenašli sme ligu ani sezónu s týmto ID.');
});

module.exports = {
  seasonsPage,
  seasonDetailPage,
  createSeasonPage,
  createSeasonSubmit,
  joinSeasonSubmit,
  joinPage,
  joinSubmit,
  manageSeasonPage,
  manageSeasonSubmit,
  endSeasonSubmit,
  deleteSeasonSubmit,
  leaveSeasonSubmit,
  seasonMembersPage,
  seasonMemberAction,
};