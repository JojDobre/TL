// backend/src/controllers/autoResults.controller.js
//
// Administrácia automatických výsledkov (prepojenie oficiálnej ligy/šablóny
// so súťažou v TheSportsDB). Všetko len pre webového admina.

const { League, Round, Match, Sequelize } = require('../models');
const { ApiError, asyncHandler } = require('../middleware/error.middleware');
const tsdb = require('../services/thesportsdb');
const autoResults = require('../utils/auto-results');

const { Op } = Sequelize;

// Automatické výsledky len pre OFICIÁLNE ligy/šablóny spravované adminom.
// Klony (templateId) výsledky dedia zo šablóny, preto sa neprepájajú.
async function loadLinkableLeague(id) {
  const league = await League.findByPk(id);
  if (!league) throw new ApiError(404, 'Liga nebola nájdená.');
  if (league.templateId) throw new ApiError(400, 'Liga je naklonovaná zo šablóny — výsledky preberá zo šablóny. Prepoj šablónu.');
  if (!league.isTemplate && league.type !== 'official') {
    throw new ApiError(400, 'Automatické výsledky sú dostupné len pre oficiálne ligy a šablóny.');
  }
  return league;
}

const providerErr = (e) => {
  if (e instanceof tsdb.ProviderError) throw new ApiError(503, `${e.message}. Skús to o chvíľu.`);
  throw e;
};

// GET /api/admin/tsdb/league/:extId
const lookupLeague = asyncHandler(async (req, res) => {
  const extId = String(req.params.extId || '').trim();
  if (!/^\d{1,10}$/.test(extId)) throw new ApiError(400, 'ID súťaže je číslo (napr. 4328).');
  const l = await tsdb.lookupLeague(extId).catch(providerErr);
  if (!l) throw new ApiError(404, 'Súťaž s týmto ID v TheSportsDB neexistuje.');
  res.json({ success: true, data: l });
});

// GET /api/admin/tsdb/search?country=&sport=
const searchLeagues = asyncHandler(async (req, res) => {
  const country = String(req.query.country || '').trim().slice(0, 60);
  const sport = String(req.query.sport || 'Soccer').trim().slice(0, 40);
  if (!country) throw new ApiError(400, 'Zadaj krajinu.');
  const list = await tsdb.searchLeagues(country, sport).catch(providerErr);
  res.json({ success: true, data: list });
});

// POST /api/leagues/:id/auto-results
const saveLink = asyncHandler(async (req, res) => {
  const league = await loadLinkableLeague(req.params.id);
  const extId = String(req.body.externalLeagueId || '').trim();
  const season = String(req.body.externalSeason || '').trim();
  if (!/^\d{1,10}$/.test(extId)) throw new ApiError(400, 'Zadaj ID súťaže z TheSportsDB (číslo).');
  if (!/^\d{4}(-\d{4})?$/.test(season)) throw new ApiError(400, 'Sezónu zadaj v tvare 2026-2027 (alebo 2026).');

  const changed = league.externalLeagueId !== extId || league.externalSeason !== season;
  league.externalSource = autoResults.SOURCE;
  league.externalLeagueId = extId;
  league.externalSeason = season;
  league.autoResults = req.body.autoResults !== false;
  league.autoSyncFixtures = req.body.autoSyncFixtures !== false;
  league.externalSyncCursor = req.body.importAll ? (league.externalSyncCursor || 1) : null;
  if (changed) { league.externalSyncedAt = null; league.externalSyncNote = null; }
  await league.save();

  // prvá synchronizácia hneď na pozadí (nečakáme na ňu)
  autoResults.runOnce({ leagueId: league.id }).catch(() => {});
  res.json({ success: true, message: 'Prepojenie uložené. Synchronizácia beží na pozadí.' });
});

// DELETE /api/leagues/:id/auto-results
const removeLink = asyncHandler(async (req, res) => {
  const league = await loadLinkableLeague(req.params.id);
  league.externalSource = null;
  league.externalLeagueId = null;
  league.externalSeason = null;
  league.externalSyncCursor = null;
  league.externalSyncNote = null;
  await league.save();
  res.json({ success: true, message: 'Liga bola odpojená. Kolá a zápasy ostali bez zmeny.' });
});

// POST /api/leagues/:id/auto-results/run — synchronizácia + výsledky teraz
const runNow = asyncHandler(async (req, res) => {
  const league = await loadLinkableLeague(req.params.id);
  if (!league.externalLeagueId) throw new ApiError(400, 'Liga nie je prepojená.');
  const st = autoResults.state;
  if (st.backoffUntil > Date.now()) {
    throw new ApiError(429, 'TheSportsDB dočasne obmedzil požiadavky — synchronizácia sa spustí automaticky neskôr.');
  }
  if (st.running) throw new ApiError(409, 'Synchronizácia už práve beží.');
  league.externalSyncedAt = null;   // vynúti synchronizáciu programu
  await league.save();
  autoResults.runOnce({ leagueId: league.id }).catch(() => {});
  res.json({ success: true, message: 'Synchronizácia spustená — výsledok uvidíš o chvíľu.' });
});

// POST /api/leagues/:id/auto-results/enable-matches — zapni automatiku pre všetky zápasy
const enableMatches = asyncHandler(async (req, res) => {
  const league = await loadLinkableLeague(req.params.id);
  const roundIds = (await Round.findAll({ where: { leagueId: league.id }, attributes: ['id'] })).map((r) => r.id);
  let n = 0;
  if (roundIds.length) {
    [n] = await Match.update(
      { autoResults: true, autoAttempts: 0, autoCheckedAt: null, autoAlertedAt: null },
      { where: { roundId: { [Op.in]: roundIds }, autoResults: false } },
    );
  }
  res.json({ success: true, message: `Automatické vyhodnotenie zapnuté pre ${n} zápasov.` });
});

module.exports = { lookupLeague, searchLeagues, saveLink, removeLink, runNow, enableMatches };
