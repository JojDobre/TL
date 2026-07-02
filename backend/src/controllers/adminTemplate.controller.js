// backend/src/controllers/adminTemplate.controller.js
//
// Admin správa ŠABLÓN líg. Šablóna = League{ isTemplate:true, seasonId:null }.
// Editor aj vyhodnotenie bežia cez existujúce API (/api/leagues/:id/teams,
// /api/rounds, /api/matches, /api/matches/:id/evaluate) — admin nimi prejde,
// lebo canManageLeague() vracia pre rolu 'admin' true. Vyhodnotenie zdrojového
// zápasu šablóny automaticky propaguje výsledok do všetkých klonov.

const { League, Round, Match, Team, Tip, LeagueTeam, UserLeague, Sequelize } = require('../models');
const { Op } = Sequelize;
const { asyncHandler } = require('../middleware/error.middleware');
const { SPORTS, COUNTRIES, sportLabel, countryLabel } = require('../utils/team.constants');

const DEFAULT_SCORING = { exactScore: 10, correctWinner: 3, goalDifference: 2, correctGoals: 1 };

// pomocná: stav dostupnosti šablóny podľa okna
function availability(tpl) {
  const now = new Date();
  const from = tpl.availableFrom ? new Date(tpl.availableFrom) : null;
  const to = tpl.availableTo ? new Date(tpl.availableTo) : null;
  if (from && now < from) return 'upcoming';   // ešte nezačala
  if (to && now > to) return 'expired';         // už skončila
  return 'active';                              // dostupná
}

// GET /admin/templates — zoznam šablón
const templatesListPage = asyncHandler(async (req, res) => {
  const templates = await League.findAll({
    where: { isTemplate: true },
    order: [['createdAt', 'DESC']],
  });

  const rows = [];
  for (const t of templates) {
    const roundIds = (await Round.findAll({ where: { leagueId: t.id }, attributes: ['id'] })).map((r) => r.id);
    const matchesCount = roundIds.length
      ? await Match.count({ where: { roundId: { [Op.in]: roundIds } } })
      : 0;
    const finishedCount = roundIds.length
      ? await Match.count({ where: { roundId: { [Op.in]: roundIds }, status: { [Op.in]: ['finished', 'canceled'] } } })
      : 0;
    const clonesCount = await League.count({ where: { templateId: t.id } });
    rows.push({
      id: t.id,
      name: t.name,
      availableFrom: t.availableFrom,
      availableTo: t.availableTo,
      status: availability(t),
      roundsCount: roundIds.length,
      matchesCount,
      finishedCount,
      clonesCount,
    });
  }

  res.render('adminTemplates', { templates: rows, query: req.query });
});

// POST /admin/templates/create — vytvorenie (z modalu): názov + okno dostupnosti
const templateCreate = asyncHandler(async (req, res) => {
  const userId = Number(req.session.userId);
  const { name, availableFrom, availableTo } = req.body;

  if (!name || !name.trim()) {
    return res.redirect('/admin/templates?err=' + encodeURIComponent('Názov šablóny je povinný.'));
  }

  const from = availableFrom ? new Date(availableFrom) : null;
  const to = availableTo ? new Date(availableTo) : null;
  if (from && isNaN(from)) return res.redirect('/admin/templates?err=' + encodeURIComponent('Neplatný začiatok dostupnosti.'));
  if (to && isNaN(to)) return res.redirect('/admin/templates?err=' + encodeURIComponent('Neplatný koniec dostupnosti.'));
  if (from && to && to <= from) return res.redirect('/admin/templates?err=' + encodeURIComponent('Koniec dostupnosti musí byť po začiatku.'));

  // unikátny join kód (šablóna ho reálne nepoužíva, ale stĺpec je NOT NULL unique)
  let joinCode;
  for (let i = 0; i < 12; i++) {
    const code = ('TPL' + Math.random().toString(36).substring(2, 5)).toUpperCase().substring(0, 6);
    if (!(await League.findOne({ where: { joinCode: code } }))) { joinCode = code; break; }
  }

  const tpl = await League.create({
    name: name.trim(),
    description: null,
    type: 'official',
    isTemplate: true,
    seasonId: null,
    creatorId: userId,
    joinCode,
    password: null,
    hasPassword: false,
    active: true,
    scoringSystem: DEFAULT_SCORING,
    scoringLocked: false,
    templateId: null,
    availableFrom: from,
    availableTo: to,
  });

  res.redirect('/admin/templates/' + tpl.id + '/edit');
});

// GET /admin/templates/:id/edit — all-in-one editor (tímy + kolá + zápasy)
const templateEditPage = asyncHandler(async (req, res) => {
  const tpl = await League.findOne({ where: { id: req.params.id, isTemplate: true } });
  if (!tpl) return res.status(404).render('error-page', { message: 'Šablóna nebola nájdená.' });

  // tímy v súpiske
  const teams = await tpl.getTeams({ order: [['name', 'ASC']] });

  // kolá so zápasmi (a názvami tímov)
  const rounds = await Round.findAll({
    where: { leagueId: tpl.id },
    include: [{
      model: Match,
      include: [
        { model: Team, as: 'homeTeam', attributes: ['id', 'name'] },
        { model: Team, as: 'awayTeam', attributes: ['id', 'name'] },
      ],
    }],
    order: [['startDate', 'ASC']],
  });

  const roundData = rounds.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    startDate: r.startDate,
    endDate: r.endDate,
    matches: (r.Matches || [])
      .sort((a, b) => new Date(a.matchTime) - new Date(b.matchTime))
      .map((m) => ({
        id: m.id,
        homeTeam: m.homeTeam ? m.homeTeam.name : '?',
        awayTeam: m.awayTeam ? m.awayTeam.name : '?',
        matchTime: m.matchTime,
        tipType: m.tipType,
        status: m.status,
      })),
  }));

  res.render('adminTemplateEdit', {
    template: { id: tpl.id, name: tpl.name, availableFrom: tpl.availableFrom, availableTo: tpl.availableTo },
    teams: teams.map((t) => ({ id: t.id, name: t.name, teamType: t.teamType, sport: t.sport, country: t.country, scope: t.scope })),
    rounds: roundData,
    sports: SPORTS,
    countries: COUNTRIES,
  });
});

// POST /admin/templates/:id/meta — úprava názvu a okna dostupnosti
const templateUpdateMeta = asyncHandler(async (req, res) => {
  const tpl = await League.findOne({ where: { id: req.params.id, isTemplate: true } });
  if (!tpl) return res.status(404).render('error-page', { message: 'Šablóna nebola nájdená.' });

  const { name, availableFrom, availableTo } = req.body;
  if (name && name.trim()) tpl.name = name.trim();
  tpl.availableFrom = availableFrom ? new Date(availableFrom) : null;
  tpl.availableTo = availableTo ? new Date(availableTo) : null;
  if (tpl.availableFrom && isNaN(tpl.availableFrom)) tpl.availableFrom = null;
  if (tpl.availableTo && isNaN(tpl.availableTo)) tpl.availableTo = null;
  await tpl.save();

  res.redirect('/admin/templates/' + tpl.id + '/edit');
});

// POST /admin/templates/:id/delete — vymazanie šablóny
// Klony (ligy s templateId) ostávajú; len stratia zdroj výsledkov, čo je v poriadku.
const templateDelete = asyncHandler(async (req, res) => {
  const tpl = await League.findOne({ where: { id: req.params.id, isTemplate: true } });
  if (!tpl) return res.status(404).render('error-page', { message: 'Šablóna nebola nájdená.' });

  const roundIds = (await Round.findAll({ where: { leagueId: tpl.id }, attributes: ['id'] })).map((r) => r.id);
  if (roundIds.length) {
    const matchIds = (await Match.findAll({ where: { roundId: { [Op.in]: roundIds } }, attributes: ['id'] })).map((m) => m.id);
    if (matchIds.length) {
      // tipy na zápasy šablóny (bežne by nemali existovať, ale FK by mazanie zablokoval)
      await Tip.destroy({ where: { matchId: { [Op.in]: matchIds } } });
      await Match.destroy({ where: { id: { [Op.in]: matchIds } } });
    }
    await Round.destroy({ where: { id: { [Op.in]: roundIds } } });
  }
  // súpiska šablóny (league_teams má NOT NULL FK na leagues — bez tohto by
  // tpl.destroy() spadol na constraint chybe) + prípadné členstvá
  await LeagueTeam.destroy({ where: { leagueId: tpl.id } });
  await UserLeague.destroy({ where: { leagueId: tpl.id } });
  await tpl.destroy();

  res.redirect('/admin/templates');
});

// GET /admin/templates/:id/evaluate — všetky zápasy šablóny zoskupené po kolách
const templateEvaluatePage = asyncHandler(async (req, res) => {
  const tpl = await League.findOne({ where: { id: req.params.id, isTemplate: true } });
  if (!tpl) return res.status(404).render('error-page', { message: 'Šablóna nebola nájdená.' });

  const rounds = await Round.findAll({
    where: { leagueId: tpl.id },
    include: [{
      model: Match,
      include: [
        { model: Team, as: 'homeTeam', attributes: ['id', 'name'] },
        { model: Team, as: 'awayTeam', attributes: ['id', 'name'] },
      ],
    }],
    order: [['startDate', 'ASC']],
  });

  let totalMatches = 0;
  let evaluatedMatches = 0;
  const roundData = rounds.map((r) => {
    const matches = (r.Matches || [])
      .sort((a, b) => new Date(a.matchTime) - new Date(b.matchTime))
      .map((m) => {
        totalMatches += 1;
        if (m.status === 'finished' || m.status === 'canceled') evaluatedMatches += 1;
        return {
          id: m.id,
          homeTeam: m.homeTeam ? m.homeTeam.name : '?',
          awayTeam: m.awayTeam ? m.awayTeam.name : '?',
          matchTime: m.matchTime,
          tipType: m.tipType,
          status: m.status,
          homeScore: m.homeScore,
          awayScore: m.awayScore,
        };
      });
    return { id: r.id, name: r.name, description: r.description, matches };
  });

  res.render('adminTemplateEvaluate', {
    template: { id: tpl.id, name: tpl.name },
    rounds: roundData,
    totalMatches,
    evaluatedMatches,
  });
});

module.exports = {
  templatesListPage,
  templateCreate,
  templateEditPage,
  templateUpdateMeta,
  templateDelete,
  templateEvaluatePage,
};