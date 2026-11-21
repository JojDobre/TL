// backend/src/controllers/adminImport.controller.js
//
// IMPORT SÚŤAŽE z TheSportsDB do novej ŠABLÓNY (administrácia).
// Admin vyhľadá súťaž (krajina + šport, alebo ID), skontroluje ju a jedným
// klikom z nej vytvorí šablónu prepojenú so súťažou. Kolá a zápasy sa potom
// sťahujú POSTUPNE pravidelným behom utils/auto-results.js (pár kôl na beh,
// v rámci limitu bezplatného API) — import celej sezóny teda chvíľu trvá.
// Tímy sa založia automaticky aj s logami.

const { League, Round, Match, Sequelize } = require('../models');
const { ApiError, asyncHandler } = require('../middleware/error.middleware');
const tsdb = require('../services/thesportsdb');
const autoResults = require('../utils/auto-results');
const dt = require('../utils/datetime.util');

const { Op } = Sequelize;
const DEFAULT_SCORING = { exactScore: 10, correctGoals: 1, correctWinner: 3, goalDifference: 2 };

// šport v appke → názov športu v TheSportsDB (pre vyhľadávanie)
const TSDB_SPORTS = [
  ['Soccer', 'Futbal'], ['Ice Hockey', 'Hokej'], ['Basketball', 'Basketbal'], ['Handball', 'Hádzaná'],
  ['Volleyball', 'Volejbal'], ['American Football', 'Americký futbal'], ['Rugby', 'Rugby'],
];

async function uniqueJoinCode() {
  for (let i = 0; i < 20; i++) {
    const code = ('TPL' + Math.random().toString(36).substring(2, 5)).toUpperCase().substring(0, 6);
    // eslint-disable-next-line no-await-in-loop
    if (!(await League.findOne({ where: { joinCode: code }, attributes: ['id'] }))) return code;
  }
  throw new ApiError(500, 'Nepodarilo sa vytvoriť kód šablóny, skús znova.');
}

// GET /admin/import — vyhľadanie súťaže + prehľad importov
const importPage = asyncHandler(async (req, res) => {
  const linked = await League.findAll({
    where: { isTemplate: true, externalSource: autoResults.SOURCE, externalLeagueId: { [Op.ne]: null } },
    order: [['createdAt', 'DESC']],
    limit: 50,
  });
  const ids = linked.map((l) => l.id);
  const [roundRows, matchRows] = ids.length ? await Promise.all([
    Round.findAll({ where: { leagueId: ids }, attributes: ['leagueId', [Sequelize.fn('COUNT', Sequelize.col('id')), 'n']], group: ['leagueId'], raw: true }),
    Match.findAll({
      attributes: [[Sequelize.col('Round.league_id'), 'leagueId'], [Sequelize.fn('COUNT', Sequelize.col('Match.id')), 'n']],
      include: [{ model: Round, attributes: [], where: { leagueId: ids }, required: true }],
      group: [Sequelize.col('Round.league_id')], raw: true,
    }),
  ]) : [[], []];
  const rc = new Map(roundRows.map((r) => [Number(r.leagueId), Number(r.n)]));
  const mc = new Map(matchRows.map((r) => [Number(r.leagueId), Number(r.n)]));
  const st = autoResults.state;
  res.render('adminImport', {
    sports: TSDB_SPORTS,
    imports: linked.map((l) => ({
      id: l.id, name: l.name, image: l.image, extId: l.externalLeagueId, season: l.externalSeason,
      importing: !!l.externalSyncCursor, cursor: l.externalSyncCursor, syncedAt: l.externalSyncedAt,
      note: l.externalSyncNote, rounds: rc.get(l.id) || 0, matches: mc.get(l.id) || 0,
    })),
    logos: await autoResults.logoStatus(),
    provider: {
      backoffUntil: st.backoffUntil > Date.now() ? dt.fmtDateTime(new Date(st.backoffUntil)) : null,
      lastRunAt: st.lastRunAt, running: st.running, intervalMin: autoResults.CFG.intervalMin,
      maxRequests: autoResults.CFG.maxRequests,
    },
  });
});

// POST /api/admin/import { externalLeagueId, externalSeason, name }
const createImport = asyncHandler(async (req, res) => {
  const userId = Number(req.session.userId);
  const extId = String(req.body.externalLeagueId || '').trim();
  if (!/^\d{1,10}$/.test(extId)) throw new ApiError(400, 'Vyber súťaž (ID z TheSportsDB je číslo).');

  // údaje o súťaži poslala stránka z náhľadu (načítaný z TheSportsDB) — netreba
  // ďalší request do fronty; bez nich (napr. volanie API priamo) sa načítajú
  let info = null;
  const bodyName = String(req.body.leagueName || '').trim();
  if (bodyName) {
    const badge = String(req.body.badge || '').trim();
    info = {
      name: bodyName.slice(0, 100),
      sport: String(req.body.sport || '').trim().slice(0, 40) || null,
      country: String(req.body.country || '').trim().slice(0, 60) || null,
      badge: /^https:\/\/[^\s"'<>]+$/.test(badge) ? badge.slice(0, 250) : null,
      currentSeason: null,
    };
  } else {
    try { info = await tsdb.lookupLeague(extId); } catch (e) {
      if (e instanceof tsdb.ProviderError) throw new ApiError(503, `${e.message}. Skús to o chvíľu.`);
      throw e;
    }
    if (!info) throw new ApiError(404, 'Súťaž s týmto ID v TheSportsDB neexistuje.');
  }

  const season = String(req.body.externalSeason || info.currentSeason || '').trim();
  if (!/^\d{4}(-\d{4})?$/.test(season)) throw new ApiError(400, 'Sezónu zadaj v tvare 2026-2027 (alebo 2026).');

  const dup = await League.findOne({
    where: { isTemplate: true, externalSource: autoResults.SOURCE, externalLeagueId: extId, externalSeason: season },
    attributes: ['id', 'name'],
  });
  if (dup) throw new ApiError(409, `Táto súťaž a sezóna už je naimportovaná ako šablóna „${dup.name}“.`);

  const name = (String(req.body.name || '').trim() || `${info.name} ${season.replace('-', '/')}`).slice(0, 120);
  const tpl = await League.create({
    name,
    description: [info.sport, info.country].filter(Boolean).join(' · ') || null,
    type: 'official',
    isTemplate: true,
    seasonId: null,
    creatorId: userId,
    joinCode: await uniqueJoinCode(),
    password: null,
    hasPassword: false,
    active: true,
    image: info.badge || null,
    scoringSystem: DEFAULT_SCORING,
    scoringLocked: false,
    templateId: null,
    // prepojenie + postupný import celej sezóny od 1. kola
    externalSource: autoResults.SOURCE,
    externalLeagueId: extId,
    externalSeason: season,
    autoResults: true,
    autoSyncFixtures: true,
    externalSyncCursor: 1,
    externalSyncNote: 'Import čaká na prvý beh synchronizácie…',
  });

  // prvé kolá hneď na pozadí; zvyšok dokončia pravidelné behy
  autoResults.runOnce({ leagueId: tpl.id }).catch(() => {});
  res.status(201).json({
    success: true,
    id: tpl.id,
    message: `Šablóna „${name}“ vytvorená. Kolá a zápasy sa naimportujú postupne (pár kôl každých ${autoResults.CFG.intervalMin} min).`,
    redirect: `/admin/templates/${tpl.id}/edit`,
  });
});

// GET /api/admin/import/status — priebeh importov (pre obnovovanie stránky)
const importStatus = asyncHandler(async (req, res) => {
  const linked = await League.findAll({
    where: { isTemplate: true, externalSource: autoResults.SOURCE, externalLeagueId: { [Op.ne]: null } },
    attributes: ['id', 'externalSyncCursor', 'externalSyncNote', 'externalSyncedAt'],
  });
  res.json({
    success: true,
    data: linked.map((l) => ({ id: l.id, importing: !!l.externalSyncCursor, note: l.externalSyncNote, syncedAt: l.externalSyncedAt })),
    logos: await autoResults.logoStatus(),
  });
});

// POST /api/admin/logos/run — skontrolovať tímy bez loga hneď (v rámci limitu)
const runLogos = asyncHandler(async (req, res) => {
  const st = autoResults.state;
  if (st.backoffUntil > Date.now()) throw new ApiError(429, 'TheSportsDB dočasne obmedzil požiadavky — logá sa doplnia automaticky neskôr.');
  if (st.running) throw new ApiError(409, 'Synchronizácia práve beží, skús o chvíľu.');
  autoResults.runOnce().catch(() => {});
  res.json({ success: true, message: `Spustené — skontroluje sa až ${autoResults.CFG.logosPerRun} tímov bez loga.` });
});

module.exports = { importPage, createImport, importStatus, runLogos };
