// backend/src/utils/official-matches.js
//
// VLASTNÉ KOLÁ SO ZÁPASMI Z OFICIÁLNYCH SÚŤAŽÍ
//
// Správca vlastnej ligy si do svojho kola vyberie jednotlivé zápasy
// z oficiálnych šablón (napr. 2 zápasy Serie A + 3 zápasy Premier League).
// Do kola sa pridá KÓPIA zápasu so sourceMatchId = originál, takže:
//   • výsledok (ručný aj automatický z TheSportsDB) sa prenesie z originálu
//     (match-evaluation.propagateToClones) a body sa spočítajú podľa
//     bodovania vlastnej ligy,
//   • zmena času originálu sa prenesie (round-propagate.propagateMatchTime),
//   • zrušenie / zmazanie originálu sa prenesie tiež.
// Zápas sa nedá vyhodnotiť ani upraviť ručne (okrem typu tipovania).

const { League, Round, Match, Team, Season, Sequelize } = require('../models');

const { Op } = Sequelize;
const TIP_TYPES = ['exact_score', 'winner', 'winner_no_draw'];
const MAX_PER_REQUEST = 50;

class OfficialMatchError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Do ktorých líg sa dajú pridávať zápasy z oficiálnych súťaží: vlastné ligy
// (nie šablóny, nie ligy naklonované zo šablóny — tie majú kolá zo šablóny).
function assertTargetLeague(league) {
  if (!league) throw new OfficialMatchError(404, 'Liga nebola nájdená.');
  if (league.isTemplate) throw new OfficialMatchError(400, 'Do šablóny sa zápasy z iných súťaží nepridávajú.');
  if (league.templateId) throw new OfficialMatchError(400, 'Liga je vytvorená zo šablóny — kolá a zápasy preberá zo šablóny.');
}

// Oficiálne súťaže (šablóny), z ktorých sa dá vyberať: majú aspoň jeden
// budúci zápas, ktorý sa ešte dá tipovať.
async function listSources() {
  const now = new Date();
  const templates = await League.findAll({
    where: { isTemplate: true, ended: false },
    attributes: ['id', 'name', 'image'],
    order: [['name', 'ASC']],
  });
  if (!templates.length) return [];
  const counts = await Match.findAll({
    attributes: [[Sequelize.col('Round.league_id'), 'leagueId'], [Sequelize.fn('COUNT', Sequelize.col('Match.id')), 'n']],
    where: { status: 'scheduled', matchTime: { [Op.gt]: now }, sourceMatchId: null },
    include: [{ model: Round, attributes: [], required: true, where: { leagueId: templates.map((t) => t.id) } }],
    group: [Sequelize.col('Round.league_id')],
    raw: true,
  });
  const byId = new Map(counts.map((c) => [Number(c.leagueId), Number(c.n)]));
  return templates
    .map((t) => ({ id: t.id, name: t.name, image: t.image || null, upcoming: byId.get(t.id) || 0 }))
    .filter((t) => t.upcoming > 0);
}

// Nadchádzajúce zápasy jednej oficiálnej súťaže + príznak, či už sú v lige.
async function listUpcoming(templateId, targetLeagueId) {
  const tpl = await League.findOne({ where: { id: Number(templateId), isTemplate: true }, attributes: ['id', 'name'] });
  if (!tpl) throw new OfficialMatchError(404, 'Oficiálna súťaž nebola nájdená.');
  const now = new Date();
  const matches = await Match.findAll({
    where: { status: 'scheduled', matchTime: { [Op.gt]: now }, sourceMatchId: null },
    include: [
      { model: Round, attributes: ['id', 'name', 'leagueId'], required: true, where: { leagueId: tpl.id } },
      { model: Team, as: 'homeTeam', attributes: ['id', 'name', 'logo'] },
      { model: Team, as: 'awayTeam', attributes: ['id', 'name', 'logo'] },
    ],
    order: [['matchTime', 'ASC']],
    limit: 300,
  });
  const already = await alreadyInLeague(targetLeagueId, matches.map((m) => m.id));
  return {
    template: { id: tpl.id, name: tpl.name },
    matches: matches.map((m) => ({
      id: m.id,
      time: m.matchTime,
      round: m.Round ? m.Round.name : '',
      home: m.homeTeam ? { name: m.homeTeam.name, logo: m.homeTeam.logo || null } : { name: '?', logo: null },
      away: m.awayTeam ? { name: m.awayTeam.name, logo: m.awayTeam.logo || null } : { name: '?', logo: null },
      added: already.has(m.id),
    })),
  };
}

// Ktoré z daných originálov už sú v nejakom kole tejto ligy.
async function alreadyInLeague(leagueId, sourceIds) {
  if (!sourceIds.length) return new Set();
  const roundIds = (await Round.findAll({ where: { leagueId }, attributes: ['id'] })).map((r) => r.id);
  if (!roundIds.length) return new Set();
  const rows = await Match.findAll({ where: { roundId: roundIds, sourceMatchId: sourceIds }, attributes: ['sourceMatchId'] });
  return new Set(rows.map((r) => r.sourceMatchId));
}

// Pridá vybrané zápasy do kola. Vracia { added, skipped: [dôvody], extendedTo }.
async function addToRound(round, matchIds, tipType) {
  const league = round.League || await League.findByPk(round.leagueId, { include: [{ model: Season }] });
  assertTargetLeague(league);
  const ids = [...new Set((Array.isArray(matchIds) ? matchIds : []).map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (!ids.length) throw new OfficialMatchError(400, 'Vyber aspoň jeden zápas.');
  if (ids.length > MAX_PER_REQUEST) throw new OfficialMatchError(400, `Naraz môžeš pridať najviac ${MAX_PER_REQUEST} zápasov.`);
  const type = TIP_TYPES.includes(tipType) ? tipType : 'exact_score';

  const now = new Date();
  const sources = await Match.findAll({
    where: { id: ids },
    include: [
      { model: Round, attributes: ['id', 'leagueId'], include: [{ model: League, attributes: ['id', 'isTemplate', 'ended', 'name'] }] },
      { model: Team, as: 'homeTeam', attributes: ['name'] },
      { model: Team, as: 'awayTeam', attributes: ['name'] },
    ],
  });
  const byId = new Map(sources.map((m) => [m.id, m]));
  const already = await alreadyInLeague(league.id, ids);

  const skipped = [];
  const toCreate = [];
  for (const id of ids) {
    const m = byId.get(id);
    const label = m ? `${m.homeTeam ? m.homeTeam.name : '?'} – ${m.awayTeam ? m.awayTeam.name : '?'}` : `#${id}`;
    if (!m || !m.Round || !m.Round.League || !m.Round.League.isTemplate || m.sourceMatchId) { skipped.push(`${label}: nie je zápas oficiálnej súťaže.`); continue; }
    if (m.Round.League.ended) { skipped.push(`${label}: súťaž je ukončená.`); continue; }
    if (m.status !== 'scheduled' || new Date(m.matchTime) <= now) { skipped.push(`${label}: zápas už začal alebo sa odohral.`); continue; }
    if (already.has(m.id)) { skipped.push(`${label}: už je v tejto lige.`); continue; }
    if (type === 'winner_no_draw') {
      // bez remízy má zmysel len tam, kde originál remízou skončiť nemôže
      if (m.tipType !== 'winner_no_draw') { skipped.push(`${label}: zápas môže skončiť remízou — vyber iný typ tipovania.`); continue; }
    }
    toCreate.push(m);
  }

  let extendedTo = null;
  if (toCreate.length) {
    await Match.sequelize.transaction(async (transaction) => {
      for (const m of toCreate) {
        await Match.create({
          roundId: round.id,
          homeTeamId: m.homeTeamId,
          awayTeamId: m.awayTeamId,
          matchTime: m.matchTime,
          tipType: type,
          status: 'scheduled',
          homeScore: null,
          awayScore: null,
          sourceMatchId: m.id,
        }, { transaction });
      }
      // kolo musí trvať aspoň do výkopu posledného pridaného zápasu, inak by
      // sa tipovanie uzavrelo skôr (uzávierka = min(koniec kola, výkop))
      const last = toCreate.reduce((a, m) => (new Date(m.matchTime) > a ? new Date(m.matchTime) : a), new Date(0));
      if (new Date(round.endDate) < last) {
        round.endDate = last;
        extendedTo = last;
        await round.save({ transaction });
      }
    });
  }
  return { added: toCreate.length, skipped, extendedTo };
}

module.exports = { OfficialMatchError, assertTargetLeague, listSources, listUpcoming, addToRound, MAX_PER_REQUEST };
