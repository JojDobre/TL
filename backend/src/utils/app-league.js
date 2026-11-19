// backend/src/utils/app-league.js
//
// PRIDANIE SA DO LIGY A VYTVORENIE LIGY Z MOBILNEJ APLIKÁCIE
//
// Rovnaké pravidlá ako na webe (page.controller joinSubmit / createSeasonSubmit
// mode=standalone), len s JSON odpoveďami pre appku:
//   • pridanie cez kód: najprv ID ligy (joinCode), potom pozývací kód sezóny,
//   • pridanie jedným ťuknutím do verejnej oficiálnej ligy,
//   • vytvorenie ligy = samostatná liga (sezóna mode='standalone' + 1 liga),
//     voliteľne zo šablóny oficiálnej súťaže, voliteľne s heslom.
// Chyby sa hlásia kódom (AppLeagueError.code), text preloží controller.

const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const {
  League, Season, User, UserLeague, UserSeason, Sequelize, sequelize,
} = require('../models');
const { isLeagueLocked } = require('./league.utils');
const { isSeasonLocked, seasonStatus } = require('./season.utils');
const { cloneTemplateInto } = require('./league-clone.util');

const { Op } = Sequelize;
const SEASON_LIMITS = { player: 1, vip: 2 }; // rovnako ako web (page.controller)
const TIP_TYPES = ['exact_score', 'winner', 'winner_no_draw'];
const NAME_MAX = 60;

class AppLeagueError extends Error {
  constructor(code, status = 400, extra = {}) { super(code); this.code = code; this.status = status; Object.assign(this, extra); }
}

function availableTemplateWhere() {
  const now = new Date();
  return {
    isTemplate: true,
    [Op.and]: [
      { [Op.or]: [{ availableFrom: null }, { availableFrom: { [Op.lte]: now } }] },
      { [Op.or]: [{ availableTo: null }, { availableTo: { [Op.gte]: now } }] },
    ],
  };
}

async function notifyJoined(league, userId) {
  try {
    const notify = require('./notification.service');
    const joiner = await User.findByPk(userId, { attributes: ['username'] });
    await notify.memberJoined(league, userId, joiner ? joiner.username : null);
  } catch (e) { /* notifikácia nesmie zhodiť pripojenie */ }
}

// členstvo v lige (+ v jej sezóne); vracia true, ak je hráč v lige nový
async function addMember(league, userId) {
  const [, created] = await UserLeague.findOrCreate({
    where: { userId, leagueId: league.id },
    defaults: { userId, leagueId: league.id, role: 'player', joinedAt: new Date() },
  });
  await UserSeason.findOrCreate({
    where: { userId, seasonId: league.seasonId },
    defaults: { userId, seasonId: league.seasonId, role: 'player', joinedAt: new Date() },
  });
  if (created) await notifyJoined(league, userId);
  return created;
}

async function checkPassword(hash, password) {
  if (!password) throw new AppLeagueError('needPassword', 401, { needPassword: true });
  if (!(await bcrypt.compare(String(password), hash || ''))) throw new AppLeagueError('badPassword', 401, { needPassword: true });
}

// Pridanie cez kód (ID ligy alebo kód sezóny). Vracia { leagueId } alebo
// { seasonId } (kód sezóny s viacerými ligami — hráč si ligu vyberie na webe).
async function joinByCode(userId, rawCode, password) {
  const code = String(rawCode || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!code) throw new AppLeagueError('emptyCode');
  if (code.length > 32) throw new AppLeagueError('notFound', 404);

  const league = await League.findOne({ where: { joinCode: code, isTemplate: false }, include: [{ model: Season }] });
  if (league) {
    if (!league.active) throw new AppLeagueError('notFound', 404);
    if (isLeagueLocked(league)) throw new AppLeagueError('ended');
    const already = await UserLeague.findOne({ where: { userId, leagueId: league.id } });
    if (!already && league.hasPassword) await checkPassword(league.password, password);
    const created = await addMember(league, userId);
    return { leagueId: league.id, created };
  }

  const season = await Season.findOne({ where: { inviteCode: code } });
  if (season) {
    if (isSeasonLocked(season)) throw new AppLeagueError('ended');
    const already = await UserSeason.findOne({ where: { userId, seasonId: season.id } });
    if (!already && season.hasPassword) await checkPassword(season.password, password);
    await UserSeason.findOrCreate({
      where: { userId, seasonId: season.id },
      defaults: { userId, seasonId: season.id, role: 'player', joinedAt: new Date() },
    });
    // sezóna s jedinou ligou → rovno do ligy
    const leagues = await League.findAll({ where: { seasonId: season.id, isTemplate: false, active: true }, attributes: ['id', 'seasonId', 'hasPassword', 'ended', 'name'] });
    if (leagues.length === 1 && !leagues[0].hasPassword && !leagues[0].ended) {
      const created = await addMember(leagues[0], userId);
      return { leagueId: leagues[0].id, created };
    }
    return { seasonId: season.id, created: !already };
  }
  throw new AppLeagueError('notFound', 404);
}

// Verejné oficiálne ligy, do ktorých sa dá pridať jedným ťuknutím.
function isPublicOfficial(league) {
  const s = league.Season;
  return league.type === 'official' && !league.isTemplate && league.active && !league.hasPassword
    && s && !s.hasPassword && !s.hidden && !isLeagueLocked(league);
}

async function listOfficial(userId) {
  const leagues = await League.findAll({
    where: { type: 'official', isTemplate: false, active: true, ended: false, hasPassword: false },
    include: [{ model: Season, required: true, where: { hasPassword: false, hidden: false } }],
    attributes: ['id', 'name', 'image', 'type', 'isTemplate', 'active', 'ended', 'hasPassword', 'seasonId', 'templateId', 'externalLeagueId'],
  });
  const open = leagues.filter(isPublicOfficial);
  if (!open.length) return [];
  const ids = open.map((l) => l.id);
  const [counts, mine] = await Promise.all([
    UserLeague.findAll({ where: { leagueId: ids }, attributes: ['leagueId', [Sequelize.fn('COUNT', Sequelize.col('user_id')), 'n']], group: ['leagueId'], raw: true }),
    UserLeague.findAll({ where: { leagueId: ids, userId }, attributes: ['leagueId'], raw: true }),
  ]);
  const byId = new Map(counts.map((c) => [Number(c.leagueId), Number(c.n)]));
  const member = new Set(mine.map((m) => Number(m.leagueId)));
  return open
    .map((l) => ({
      id: l.id, name: l.name, image: l.image || (l.Season && l.Season.image) || null,
      seasonName: l.Season ? l.Season.name : '', players: byId.get(l.id) || 0,
      member: member.has(l.id), auto: !!(l.externalLeagueId || l.templateId),
    }))
    .sort((a, b) => (a.member - b.member) || (b.players - a.players) || a.name.localeCompare(b.name, 'sk'))
    .slice(0, 30);
}

async function joinOfficial(userId, leagueId) {
  const league = await League.findByPk(Number(leagueId), { include: [{ model: Season }] });
  if (!league || !isPublicOfficial(league)) throw new AppLeagueError('notFound', 404);
  const created = await addMember(league, userId);
  return { leagueId: league.id, created };
}

// Šablóny oficiálnych súťaží, z ktorých sa dá založiť liga.
async function listTemplates() {
  const rows = await League.findAll({ where: availableTemplateWhere(), attributes: ['id', 'name', 'image', 'description'], order: [['name', 'ASC']] });
  return rows.map((t) => ({ id: t.id, name: t.name, image: t.image || null, description: t.description || '' }));
}

// Môže hráč založiť ďalšiu ligu? (limit aktívnych sezón podľa roly, ako web)
async function createAllowance(userId) {
  const user = await User.findByPk(userId, { attributes: ['id', 'role'] });
  if (!user) return { ok: false, limit: 0 };
  const limit = SEASON_LIMITS[user.role];
  if (limit === undefined) return { ok: true, limit: null };
  const mine = await Season.findAll({ where: { creatorId: userId } });
  const active = mine.filter((s) => seasonStatus(s) !== 'ended').length;
  return { ok: active < limit, limit, active, role: user.role };
}

async function uniqueJoinCode() {
  for (let i = 0; i < 12; i++) {
    const code = uuidv4().substring(0, 6).toUpperCase();
    if (!(await League.findOne({ where: { joinCode: code }, attributes: ['id'] }))) return code;
  }
  throw new AppLeagueError('failed', 500);
}

// Vytvorí samostatnú ligu. Vracia { leagueId, seasonId, joinCode, fromTemplate }.
async function createLeague(userId, { name, templateId, tipType, password }) {
  const nm = String(name || '').trim().replace(/\s+/g, ' ');
  if (!nm) throw new AppLeagueError('nameRequired');
  if (nm.length > NAME_MAX) throw new AppLeagueError('nameTooLong');
  const allow = await createAllowance(userId);
  if (!allow.ok) throw new AppLeagueError('limit', 403, { limit: allow.limit });

  let template = null;
  if (templateId) {
    template = await League.findOne({ where: { id: Number(templateId), ...availableTemplateWhere() } });
    if (!template) throw new AppLeagueError('templateMissing');
  }
  const type = TIP_TYPES.includes(tipType) ? tipType : 'exact_score';
  const pw = String(password || '').trim();
  const pwHash = pw ? await bcrypt.hash(pw, 10) : null;
  const joinCode = await uniqueJoinCode();
  const inviteCode = uuidv4().substring(0, 6).toUpperCase();

  let league = null;
  await sequelize.transaction(async (transaction) => {
    const season = await Season.create({
      name: nm, description: null, image: null,
      type: 'community', mode: 'standalone', inviteCode,
      creatorId: userId, active: true, participantLimit: 100,
      startDate: null, endDate: null, ended: false,
      password: null, hasPassword: false, hidden: false,
    }, { transaction });
    league = await League.create({
      name: nm, description: null, image: null,
      type: 'custom', joinCode, password: pwHash, hasPassword: !!pwHash,
      seasonId: season.id, creatorId: userId,
      scoringSystem: { exactScore: 10, correctWinner: 3, goalDifference: 2, correctGoals: 1 },
      scoringLocked: false, active: true, isTemplate: false,
      templateId: template ? template.id : null,
    }, { transaction });
    await UserLeague.create({ userId, leagueId: league.id, role: 'admin', joinedAt: new Date() }, { transaction });
    await UserSeason.create({ userId, seasonId: season.id, role: 'admin', joinedAt: new Date() }, { transaction });
  });
  // kolá zo šablóny až po commite (ako web) — ak zlyhá, liga ostane bez kôl
  let cloned = true;
  if (template) {
    try { await cloneTemplateInto(template, league, type); } catch (e) { cloned = false; }
  }
  try { require('./achievement.engine').evaluateInBackground([userId]); } catch (e) { /* nič */ }
  return { leagueId: league.id, seasonId: league.seasonId, joinCode, fromTemplate: !!template, cloned };
}

module.exports = {
  AppLeagueError, joinByCode, joinOfficial, listOfficial, listTemplates, createAllowance, createLeague, NAME_MAX,
};
