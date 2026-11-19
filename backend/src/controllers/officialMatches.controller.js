// backend/src/controllers/officialMatches.controller.js
//
// API: zápasy z oficiálnych súťaží do vlastného kola (viď utils/official-matches.js).
// Oprávnenie rovnaké ako na pridávanie zápasov do kola (správca ligy/sezóny, admin).

const { Round, League, Season } = require('../models');
const { ApiError, asyncHandler } = require('../middleware/error.middleware');
const { isLeagueLocked } = require('../utils/league.utils');
const { canManageMatch } = require('./match.controller');
const om = require('../utils/official-matches');

async function loadRound(req, { forWrite } = {}) {
  const round = await Round.findByPk(req.params.id, {
    include: [{ model: League, include: [{ model: Season, attributes: ['id', 'creatorId', 'endDate', 'ended'] }] }],
  });
  if (!round) throw new ApiError(404, 'Kolo nebolo nájdené.');
  if (!(await canManageMatch({ Round: round }, req.userId))) {
    throw new ApiError(403, 'Nemáš oprávnenie pridávať zápasy do tohto kola.');
  }
  try { om.assertTargetLeague(round.League); } catch (e) { throw new ApiError(e.status || 400, e.message); }
  if (forWrite && isLeagueLocked(round.League)) throw new ApiError(400, 'Liga je ukončená — zápasy sa nedajú pridávať.');
  return round;
}

const wrap = (e) => { if (e instanceof om.OfficialMatchError) throw new ApiError(e.status, e.message); throw e; };

// GET /api/rounds/:id/official-sources — oficiálne súťaže s budúcimi zápasmi
const sources = asyncHandler(async (req, res) => {
  await loadRound(req);
  res.json({ success: true, data: await om.listSources() });
});

// GET /api/rounds/:id/official-matches?template=ID — budúce zápasy súťaže
const upcoming = asyncHandler(async (req, res) => {
  const round = await loadRound(req);
  const tplId = Number(req.query.template);
  if (!Number.isInteger(tplId) || tplId <= 0) throw new ApiError(400, 'Vyber oficiálnu súťaž.');
  const data = await om.listUpcoming(tplId, round.leagueId).catch(wrap);
  res.json({ success: true, data });
});

// POST /api/rounds/:id/official-matches { matchIds: [...], tipType }
const add = asyncHandler(async (req, res) => {
  const round = await loadRound(req, { forWrite: true });
  const r = await om.addToRound(round, req.body && req.body.matchIds, req.body && req.body.tipType).catch(wrap);
  let message = r.added ? `Pridaných ${r.added} ${r.added === 1 ? 'zápas' : (r.added < 5 ? 'zápasy' : 'zápasov')}.` : 'Žiadny zápas nebol pridaný.';
  if (r.extendedTo) message += ' Koniec kola sa predĺžil do výkopu posledného zápasu.';
  res.status(r.added ? 201 : 200).json({ success: r.added > 0 || !r.skipped.length, message, added: r.added, skipped: r.skipped, extendedTo: r.extendedTo });
});

module.exports = { sources, upcoming, add };
