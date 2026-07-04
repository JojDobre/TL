// backend/src/bots/bot-engine.js  (v2 — plnohodnotní hráči)
//
// Simulovaní hráči sa správajú ako reálni používatelia platformy:
//   HRÁČSKA rola (všetci):
//     - postupne vstupujú do oficiálnych sezón a ich verejných líg,
//     - vstupujú do verejných komunitných súťaží iných botov,
//     - tipujú otvorené zápasy vo VŠETKÝCH svojich ligách (oficiálne aj
//       komunitné) — rešpektujú deadline presne ako tip.controller.
//   ZAKLADATEĽSKÁ rola (~12 % botov):
//     - vytvárajú standalone turnaje (klon šablóny) AJ klasické sezóny,
//     - vo vlastnej bežiacej klasickej sezóne si vytvoria ligu,
//     - do vlastnej ligy si poskladajú súpisku z EXISTUJÚCICH globálnych
//       tímov (vlastné tímy NEVYTVÁRAJÚ — požiadavka),
//     - vytvárajú kolá a v nich zápasy medzi tímami zo súpisky,
//     - po odohraní zápasy vyhodnocujú (ako admin ligy) — body počíta
//       ta istá funkcia calculatePoints ako v appke.
//
// Boti neobchádzajú žiadne pravidlá platformy: rovnaké limity ako hráči
// (žiadne umelé stropy navyše, tempo riadi len pravdepodobnosť persony).

const {
  User, Season, League, Round, Match, Tip, Team, UserSeason, UserLeague, sequelize, Sequelize,
} = require('../models');
const { Op } = Sequelize;
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { botLeagueName } = require('./bot-names');
const { cloneTemplateInto } = require('../utils/league-clone.util');
const { calculatePoints } = require('../controllers/match.controller');

const DAY = 24 * 60 * 60 * 1000;
const DEFAULT_SCORING = { exactScore: 10, correctWinner: 3, goalDifference: 2, correctGoals: 1 };

// Botie súťaže sú CHRÁNENÉ HESLOM: vo verejných zoznamoch vidno, že existujú
// (so zámkom), ale obsah (zápasy/kolá) vidia len členovia — heslo je náhodné
// a nikde sa neukladá, takže sa reálny používateľ dnu nedostane.
async function randomSeasonPassword() {
  return bcrypt.hash(crypto.randomBytes(18).toString('hex'), 10);
}

// ── deterministická náhodnosť ────────────────────────────────────────────────
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function persona(userId) {
  const rnd = mulberry32(userId * 7919 + 13);
  return {
    activity: 0.15 + rnd() * 0.75,     // šanca konať na tick
    coverage: 0.5 + rnd() * 0.5,       // podiel zápasov, ktoré otipuje
    homeBias: 0.35 + rnd() * 0.25,     // favoritizmus domácich
    wildness: rnd(),                   // sklon k vyšším skóre
    joinAffinity: 0.05 + rnd() * 0.25, // ochota vstúpiť do súťaže na tick
    isCreator: rnd() < 0.12,           // zakladateľ obsahu
    contentDrive: 0.2 + rnd() * 0.6,   // ako usilovne tvorí obsah na tick
    favSport: rnd() < 0.7 ? 'football' : 'hockey',
    rnd,
  };
}

// ── generovanie tipov a výsledkov ────────────────────────────────────────────
const GOAL_WEIGHTS = {
  football: [0.26, 0.34, 0.22, 0.11, 0.05, 0.02],
  hockey:   [0.08, 0.18, 0.26, 0.22, 0.14, 0.08, 0.04],
  default:  [0.20, 0.30, 0.25, 0.15, 0.07, 0.03],
};
function sampleGoals(sport, rnd, wildness) {
  const w = GOAL_WEIGHTS[sport] || GOAL_WEIGHTS.default;
  const shift = wildness > 0.75 ? 1 : 0;
  let r = rnd(); let acc = 0;
  for (let g = 0; g < w.length; g++) { acc += w[g]; if (r <= acc) return g + shift; }
  return (w.length - 1) + shift;
}
function sportOf(match) {
  return (match.homeTeam && match.homeTeam.sport) || (match.awayTeam && match.awayTeam.sport) || 'default';
}
function isOpen(match, now) {
  if (match.status && match.status !== 'scheduled') return false;
  const start = new Date(match.matchTime);
  const roundEnd = match.Round && match.Round.endDate ? new Date(match.Round.endDate) : null;
  const deadline = roundEnd && roundEnd < start ? roundEnd : start;
  return now < deadline;
}
function makeTipValues(match, p) {
  const type = match.tipType || 'exact_score';
  if (type === 'winner' || type === 'winner_no_draw') {
    const r = p.rnd();
    if (type === 'winner_no_draw') return { winner: r < p.homeBias + 0.15 ? 'home' : 'away' };
    if (r < p.homeBias) return { winner: 'home' };
    if (r < p.homeBias + 0.22) return { winner: 'draw' };
    return { winner: 'away' };
  }
  const sport = sportOf(match);
  let home = sampleGoals(sport, p.rnd, p.wildness);
  let away = sampleGoals(sport, p.rnd, p.wildness);
  if (p.rnd() < p.homeBias - 0.3 && home < away) [home, away] = [away, home];
  return { homeScore: home, awayScore: away };
}
// náhodný realistický VÝSLEDOK zápasu (na vyhodnotenie vo vlastnej lige)
function makeResult(sport, rnd) {
  return { homeScore: sampleGoals(sport, rnd, 0.4), awayScore: sampleGoals(sport, rnd, 0.4) };
}

// ── HRÁČSKE kroky ────────────────────────────────────────────────────────────

async function getBots() {
  return User.findAll({ where: { isBot: true, active: true }, attributes: ['id', 'username'] });
}

// vstup do oficiálnych sezón + verejných komunitných súťaží
async function ensureMemberships(bots, log) {
  const seasons = await Season.findAll({
    where: { ended: false, password: null, hidden: false },
    attributes: ['id', 'type'],
  });
  if (!seasons.length) return;
  let joins = 0;
  for (const bot of bots) {
    const p = persona(bot.id);
    for (const season of seasons) {
      // do oficiálnych vstupujú ochotne, do cudzích komunitných menej často
      const prob = season.type === 'official' ? p.joinAffinity : p.joinAffinity * 0.3;
      if (Math.random() > prob) continue;
      const already = await UserSeason.findOne({ where: { userId: bot.id, seasonId: season.id } });
      if (already) continue;
      await UserSeason.create({ userId: bot.id, seasonId: season.id, role: 'player', joinedAt: new Date() });
      const leagues = await League.findAll({
        where: { seasonId: season.id, isTemplate: false, active: true, hasPassword: false },
        attributes: ['id'],
      });
      for (const lg of leagues) {
        const inLg = await UserLeague.findOne({ where: { userId: bot.id, leagueId: lg.id } });
        if (!inLg) await UserLeague.create({ userId: bot.id, leagueId: lg.id, role: 'player', joinedAt: new Date() });
      }
      joins++;
    }
  }
  if (joins) log(`členstvá: +${joins} vstupov do sezón`);
}

// tipovanie vo VŠETKÝCH ligách člena (oficiálne aj komunitné)
async function tipOpenMatches(bots, log) {
  const now = new Date();
  let placed = 0;
  for (const bot of bots) {
    const p = persona(bot.id);
    if (Math.random() > p.activity) continue;
    const memberships = await UserLeague.findAll({ where: { userId: bot.id }, attributes: ['leagueId'] });
    if (!memberships.length) continue;
    const leagueIds = memberships.map((m) => m.leagueId);
    const matches = await Match.findAll({
      where: { status: 'scheduled' },
      include: [
        { model: Round, attributes: ['id', 'endDate', 'leagueId'], where: { leagueId: { [Op.in]: leagueIds } }, required: true },
        { model: Team, as: 'homeTeam', attributes: ['sport'] },
        { model: Team, as: 'awayTeam', attributes: ['sport'] },
      ],
      limit: 80,
    });
    for (const match of matches) {
      if (!isOpen(match, now)) continue;
      if (Math.random() > p.coverage) continue;
      const existing = await Tip.findOne({ where: { userId: bot.id, matchId: match.id } });
      if (existing) continue;
      await Tip.create({ userId: bot.id, matchId: match.id, ...makeTipValues(match, p), points: 0 });
      placed++;
    }
  }
  if (placed) log(`tipy: +${placed}`);
}

// ── ZAKLADATEĽSKÉ kroky (životný cyklus vlastného obsahu) ────────────────────

// 1) tvorba súťaží: standalone turnaj (klon šablóny) ALEBO klasická sezóna
async function createCompetitions(bots, log) {
  if (Math.random() > 0.15) return; // rast má byť pomalý — max ~1 súťaž/tick
  const creators = bots.filter((b) => persona(b.id).isCreator);
  if (!creators.length) return;
  const creator = creators[Math.floor(Math.random() * creators.length)];
  const p = persona(creator.id);

  // tempo brzdi počet už vlastnených súťaží (žiadny tvrdý limit — ako hráči)
  const owned = await Season.count({ where: { creatorId: creator.id } });
  if (Math.random() < owned * 0.4) return;

  const name = `${botLeagueName(creator.id * 31 + owned)} ${new Date().getFullYear()}`;
  const standalone = Math.random() < 0.6;

  if (standalone) {
    const template = await League.findOne({ where: { isTemplate: true, active: true } });
    let newLeague = null;
    await sequelize.transaction(async (t) => {
      const season = await Season.create({
        name, description: 'Tipovačka partie — pridaj sa a ukáž, čo vieš!',
        type: 'community', mode: 'standalone', inviteCode: uuidv4().substring(0, 6).toUpperCase(),
        creatorId: creator.id, active: true, participantLimit: null,
        startDate: new Date(), endDate: null, ended: false,
        password: await randomSeasonPassword(), hasPassword: true, hidden: false, // zamknuté heslom — vidno ich, ale dnu len členovia
      }, { transaction: t });
      const league = await League.create({
        name, description: null, type: 'custom', joinCode: uuidv4().substring(0, 6).toUpperCase(),
        password: null, hasPassword: false, seasonId: season.id, creatorId: creator.id,
        scoringSystem: DEFAULT_SCORING, scoringLocked: false, active: true,
        isTemplate: false, templateId: template ? template.id : null,
      }, { transaction: t });
      await UserLeague.create({ userId: creator.id, leagueId: league.id, role: 'admin', joinedAt: new Date() }, { transaction: t });
      await UserSeason.create({ userId: creator.id, seasonId: season.id, role: 'admin', joinedAt: new Date() }, { transaction: t });
      newLeague = league;
    });
    if (template && newLeague) { try { await cloneTemplateInto(template, newLeague); } catch (e) { /* prázdny turnaj */ } }
    log(`súťaž: standalone '${name}' (${creator.username})`);
  } else {
    // klasická sezóna — ligy, kolá a zápasy do nej pribudnú v ďalších tickoch
    const season = await Season.create({
      name: `Sezóna ${name}`, description: 'Naša vlastná tipovacia sezóna.',
      type: 'community', mode: 'classic', inviteCode: uuidv4().substring(0, 6).toUpperCase(),
      creatorId: creator.id, active: true, participantLimit: null,
      startDate: new Date(), endDate: new Date(Date.now() + 120 * DAY), ended: false,
      password: await randomSeasonPassword(), hasPassword: true, hidden: false, // zamknuté heslom — vidno ich, ale dnu len členovia
    });
    await UserSeason.create({ userId: creator.id, seasonId: season.id, role: 'admin', joinedAt: new Date() });
    log(`súťaž: klasická sezóna '${season.name}' (${creator.username})`);
  }

  // pár botov sa hneď pridá
  const fresh = await Season.findOne({ where: { creatorId: creator.id }, order: [['createdAt', 'DESC']] });
  const joiners = bots.filter((b) => b.id !== creator.id && Math.random() < 0.08).slice(0, 10);
  for (const j of joiners) {
    await UserSeason.create({ userId: j.id, seasonId: fresh.id, role: 'player', joinedAt: new Date() }).catch(() => {});
    const lgs = await League.findAll({ where: { seasonId: fresh.id }, attributes: ['id'] });
    for (const lg of lgs) await UserLeague.create({ userId: j.id, leagueId: lg.id, role: 'player', joinedAt: new Date() }).catch(() => {});
  }
}

// 2) vo vlastnej bežiacej KLASICKEJ sezóne založ ligu (ak žiadnu nemá)
async function createLeaguesInOwnSeasons(bots, log) {
  for (const bot of bots) {
    const p = persona(bot.id);
    if (!p.isCreator || Math.random() > p.contentDrive * 0.4) continue;
    const seasons = await Season.findAll({ where: { creatorId: bot.id, ended: false, mode: 'classic' }, attributes: ['id', 'name'] });
    for (const season of seasons) {
      const count = await League.count({ where: { seasonId: season.id } });
      if (count >= 2 && Math.random() < 0.9) continue; // väčšinou stačí 1–2 ligy
      const useTemplate = Math.random() < 0.5;
      const template = useTemplate ? await League.findOne({ where: { isTemplate: true, active: true } }) : null;
      const league = await League.create({
        name: `${season.name} — liga ${count + 1}`, description: null, type: 'custom',
        joinCode: uuidv4().substring(0, 6).toUpperCase(), password: null, hasPassword: false,
        seasonId: season.id, creatorId: bot.id, scoringSystem: DEFAULT_SCORING,
        scoringLocked: false, active: true, isTemplate: false, templateId: template ? template.id : null,
      });
      await UserLeague.create({ userId: bot.id, leagueId: league.id, role: 'admin', joinedAt: new Date() });
      if (template) { try { await cloneTemplateInto(template, league); } catch (e) { /* prázdna */ } }
      // členovia sezóny sa pridajú do novej ligy
      const members = await UserSeason.findAll({ where: { seasonId: season.id }, attributes: ['userId'] });
      for (const m of members) {
        if (m.userId === bot.id) continue;
        await UserLeague.create({ userId: m.userId, leagueId: league.id, role: 'player', joinedAt: new Date() }).catch(() => {});
      }
      log(`liga: '${league.name}' v sezóne #${season.id} (${bot.username})`);
      return; // max 1 nová liga na tick
    }
  }
}

// 3) súpiska vlastnej ligy — LEN existujúce globálne tímy (nič nevytvárame)
async function buildRosters(bots, log) {
  const { LeagueTeam } = require('../models');
  for (const bot of bots) {
    const p = persona(bot.id);
    if (!p.isCreator || Math.random() > p.contentDrive * 0.6) continue;
    const leagues = await League.findAll({ where: { creatorId: bot.id, isTemplate: false, active: true, templateId: null }, attributes: ['id', 'name'] });
    for (const lg of leagues) {
      const rosterCount = await LeagueTeam.count({ where: { leagueId: lg.id } });
      if (rosterCount >= 6) continue;
      const teams = await Team.findAll({ where: { scope: 'global', sport: p.favSport }, attributes: ['id'], limit: 40 });
      if (teams.length < 4) continue;
      const shuffled = teams.sort(() => Math.random() - 0.5).slice(0, 8 + Math.floor(Math.random() * 5));
      for (const t of shuffled) {
        await LeagueTeam.create({ leagueId: lg.id, teamId: t.id }).catch(() => {});
      }
      log(`súpiska: ${shuffled.length} tímov → '${lg.name}'`);
      return;
    }
  }
}

// 4) kolo vo vlastnej lige, ak žiadne budúce nemá
async function createRounds(bots, log) {
  for (const bot of bots) {
    const p = persona(bot.id);
    if (!p.isCreator || Math.random() > p.contentDrive * 0.5) continue;
    const leagues = await League.findAll({ where: { creatorId: bot.id, isTemplate: false, active: true, templateId: null }, attributes: ['id', 'name'] });
    for (const lg of leagues) {
      const { LeagueTeam } = require('../models');
      if ((await LeagueTeam.count({ where: { leagueId: lg.id } })) < 4) continue; // najprv súpiska
      const upcoming = await Round.count({ where: { leagueId: lg.id, endDate: { [Op.gt]: new Date() } } });
      if (upcoming > 0) continue;
      const n = (await Round.count({ where: { leagueId: lg.id } })) + 1;
      const start = new Date(Date.now() + (1 + Math.floor(Math.random() * 2)) * DAY);
      const end = new Date(start.getTime() + (5 + Math.floor(Math.random() * 4)) * DAY);
      const round = await Round.create({ name: `${n}. kolo`, leagueId: lg.id, startDate: start, endDate: end });
      log(`kolo: '${round.name}' v '${lg.name}'`);
      return;
    }
  }
}

// 5) zápasy v najnovšom kole vlastnej ligy — párovanie tímov zo súpisky
async function createMatches(bots, log) {
  const { LeagueTeam } = require('../models');
  for (const bot of bots) {
    const p = persona(bot.id);
    if (!p.isCreator || Math.random() > p.contentDrive * 0.6) continue;
    const leagues = await League.findAll({ where: { creatorId: bot.id, isTemplate: false, active: true, templateId: null }, attributes: ['id', 'name'] });
    for (const lg of leagues) {
      const round = await Round.findOne({ where: { leagueId: lg.id, endDate: { [Op.gt]: new Date() } }, order: [['startDate', 'ASC']] });
      if (!round) continue;
      const existing = await Match.count({ where: { roundId: round.id } });
      if (existing >= 4) continue;
      const roster = await LeagueTeam.findAll({ where: { leagueId: lg.id }, attributes: ['teamId'] });
      if (roster.length < 4) continue;
      const ids = roster.map((r) => r.teamId).sort(() => Math.random() - 0.5);
      const pairs = [];
      for (let i = 0; i + 1 < ids.length && pairs.length < 4 + Math.floor(Math.random() * 3); i += 2) pairs.push([ids[i], ids[i + 1]]);
      const rs = new Date(round.startDate).getTime();
      const re = new Date(round.endDate).getTime();
      for (const [home, away] of pairs) {
        const matchTime = new Date(rs + Math.random() * Math.max(re - rs - 2 * 3600 * 1000, 3600 * 1000));
        await Match.create({
          roundId: round.id, homeTeamId: home, awayTeamId: away, matchTime,
          tipType: Math.random() < 0.85 ? 'exact_score' : 'winner', status: 'scheduled',
        });
      }
      log(`zápasy: +${pairs.length} v '${round.name}' (${lg.name})`);
      return;
    }
  }
}

// 6) vyhodnotenie odohraných zápasov vo VLASTNÝCH ligách (ako admin ligy).
// Výsledok je náhodný realistický; body počíta calculatePoints z appky.
async function evaluateOwnMatches(bots, log) {
  const creatorIds = bots.filter((b) => persona(b.id).isCreator).map((b) => b.id);
  if (!creatorIds.length) return;
  const now = new Date();
  const due = await Match.findAll({
    where: { status: 'scheduled', matchTime: { [Op.lt]: new Date(now.getTime() - 2 * 3600 * 1000) } },
    include: [
      { model: Round, attributes: ['id', 'leagueId'], required: true,
        include: [{ model: League, attributes: ['id', 'creatorId', 'scoringSystem', 'type', 'isTemplate'], where: { creatorId: { [Op.in]: creatorIds }, isTemplate: false }, required: true }] },
      { model: Team, as: 'homeTeam', attributes: ['sport'] },
      { model: Team, as: 'awayTeam', attributes: ['sport'] },
    ],
    limit: 12,
  });
  let done = 0;
  for (const match of due) {
    const league = match.Round.League;
    const rnd = mulberry32(match.id * 104729 + 7);
    const result = makeResult(sportOf(match), rnd);
    match.homeScore = result.homeScore;
    match.awayScore = result.awayScore;
    match.status = 'finished';
    await match.save();
    // prepočet bodov všetkých tipov — rovnaká funkcia ako v appke
    const scoring = league.scoringSystem || DEFAULT_SCORING;
    const tips = await Tip.findAll({ where: { matchId: match.id } });
    for (const tip of tips) {
      tip.points = calculatePoints(tip, match, scoring);
      await tip.save();
    }
    done++;
  }
  if (done) log(`vyhodnotenie: ${done} zápasov vo vlastných ligách`);
}

// ── verejné API ──────────────────────────────────────────────────────────────
async function tick({ verbose = true } = {}) {
  const log = (m) => { if (verbose) console.log(`[bots] ${m}`); };
  const bots = await getBots();
  if (!bots.length) { log('žiadni boti — najprv spusti create'); return; }
  log(`tick — aktívnych botov: ${bots.length}`);
  await ensureMemberships(bots, log);
  await createCompetitions(bots, log);
  await createLeaguesInOwnSeasons(bots, log);
  await buildRosters(bots, log);
  await createRounds(bots, log);
  await createMatches(bots, log);
  await tipOpenMatches(bots, log);
  await evaluateOwnMatches(bots, log);
  log('tick hotový');
}

module.exports = { tick, persona, makeTipValues, isOpen, sampleGoals, makeResult };