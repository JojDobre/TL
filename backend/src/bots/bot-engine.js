// backend/src/bots/bot-engine.js  (v3 — boti len tipujú)
//
// Simulovaní hráči:
//   - postupne vstupujú do OFICIÁLNYCH sezón a ich verejných líg,
//   - tipujú otvorené zápasy vo svojich ligách — rešpektujú deadline presne
//     ako tip.controller.
//
// Boti už NEZAKLADAJÚ sezóny, ligy, kolá ani zápasy a nič nevyhodnocujú.
// Existujúce botie súťaže ostávajú v DB nedotknuté.
//
// Boti neobchádzajú žiadne pravidlá platformy: rovnaké limity ako hráči.

const {
  User, Season, League, Round, Match, Tip, Team, UserSeason, UserLeague, Sequelize,
} = require('../models');
const { Op } = Sequelize;
// Rovnaká zámka ako v tip.controller — bot nesmie mať výhodu oproti hráčovi.
const { isLeagueLocked } = require('../utils/league.utils');


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
    isCreator: rnd() < 0.12,           // (nepoužíva sa — ponechané kvôli stabilnej postupnosti rnd)
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
// Smie sa tento zápas práve tipovať? Musí platiť to isté, čo kontroluje
// tip.controller pri reálnom hráčovi — bot nesmie obísť žiadne pravidlo tým,
// že ide priamo cez DB namiesto cez API:
//   - zápas je 'scheduled' (nezrušený, nedohraný),
//   - kolo sa už OTVORILO (now >= Round.startDate) a ešte neuplynula uzávierka,
//   - liga ani jej sezóna nie sú ukončené.
function isOpen(match, now) {
  if (match.status && match.status !== 'scheduled') return false;

  const round = match.Round;
  if (!round) return false;

  // naplánované kolo — tipovanie sa ešte neotvorilo
  if (round.startDate && now < new Date(round.startDate)) return false;

  // ukončená liga / sezóna (league.League je načítaná v tipOpenMatches)
  if (round.League && isLeagueLocked(round.League)) return false;

  const start = new Date(match.matchTime);
  const roundEnd = round.endDate ? new Date(round.endDate) : null;
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

// ── HRÁČSKE kroky ────────────────────────────────────────────────────────────

async function getBots() {
  return User.findAll({ where: { isBot: true, active: true }, attributes: ['id', 'username'] });
}

// ── Brzdy vstupu botov do sezón ──────────────────────────────────────────────
//
// Bez brzdy sa každý bot na každom ticku znovu pokúša vstúpiť, takže sezóny sa
// do pár dní naplnia na 100 % — čo vyzerá umelo. Preto sa pravdepodobnosť
// vstupu násobí dvoma nezávislými faktormi: NAPLNENOSŤOU a VEKOM sezóny.

// Cudzie komunitné sezóny (založené človekom) majú tvrdý strop — nemá zmysel,
// aby súkromnú súťaž pár kamarátov zaplavili stovky botov.
const HUMAN_COMMUNITY_BOT_CAP = 8;

// Podiel botov v sezóne, od ktorého sa prísun spomaľuje (z CELKOVÉHO počtu botov).
const FILL_MID = 0.50;
const FILL_HIGH = 0.80;

// Vek, po ktorom je sezóna „usadená" a nových členov už prakticky neprijíma.
const AGE_FADE_DAYS = 30;
const AGE_FLOOR = 0.05;

// Násobiteľ podľa naplnenosti. Zachováva individualitu botov — násobí sa ich
// vlastná joinAffinity (5–30 %), takže aktívny bot ostane aktívnejší.
function fillFactor(ratio, season, isBotOwned) {
  if (season.type === 'official') {
    if (ratio >= FILL_HIGH) return 0.002;  // nad 80 % už prakticky nikto nepribudne
    if (ratio >= FILL_MID) return 0.03;    // medzi 50–80 % výrazne spomalí
    return 0.05;                           // nábeh trvá dni, nie hodiny
  }
  // komunitné — rovnaké pásma ako oficiálne, len nižšie hodnoty (bot má menšiu
  // motiváciu vstúpiť do cudzej komunitnej súťaže než do oficiálnej)
  if (ratio >= FILL_HIGH) return isBotOwned ? 0.002 : 0.0005;
  if (ratio >= FILL_MID) return isBotOwned ? 0.02 : 0.01;
  return isBotOwned ? 0.03 : 0.02;
}

// Násobiteľ podľa veku: lineárne klesá z 1,0 (nová) na AGE_FLOOR (30+ dní).
function ageFactor(createdAt) {
  if (!createdAt) return 1;
  const days = (Date.now() - new Date(createdAt).getTime()) / 86400000;
  if (days <= 0) return 1;
  if (days >= AGE_FADE_DAYS) return AGE_FLOOR;
  return 1 - (1 - AGE_FLOOR) * (days / AGE_FADE_DAYS);
}

// vstup do oficiálnych sezón + verejných komunitných súťaží
async function ensureMemberships(bots, log) {
  // len OFICIÁLNE sezóny — do komunitných súťaží boti nevstupujú
  const seasons = await Season.findAll({
    where: { ended: false, password: null, hidden: false, type: 'official' },
    attributes: ['id', 'type', 'creatorId', 'createdAt'],
  });
  if (!seasons.length) return;

  const botIds = new Set(bots.map((b) => b.id));
  const totalBots = bots.length || 1;

  // koľko botov je už v ktorej sezóne — jeden dotaz namiesto N na bota
  const botCounts = new Map();
  try {
    const rows = await UserSeason.findAll({
      where: { userId: { [Op.in]: [...botIds] } },
      attributes: ['seasonId', [Sequelize.fn('COUNT', Sequelize.col('userId')), 'n']],
      group: ['seasonId'],
      raw: true,
    });
    for (const r of rows) botCounts.set(Number(r.seasonId), Number(r.n));
  } catch (e) { /* pri chybe sa brzdy neuplatnia, vstup ostane pôvodný */ }

  let joins = 0;
  for (const bot of bots) {
    const p = persona(bot.id);
    for (const season of seasons) {
      const inSeason = botCounts.get(season.id) || 0;
      const isBotOwned = botIds.has(season.creatorId);

      // tvrdý strop pre komunitné sezóny založené ČLOVEKOM
      if (season.type !== 'official' && !isBotOwned && inSeason >= HUMAN_COMMUNITY_BOT_CAP) continue;

      const ratio = inSeason / totalBots;
      const prob = p.joinAffinity * fillFactor(ratio, season, isBotOwned) * ageFactor(season.createdAt);
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
      botCounts.set(season.id, inSeason + 1);   // drž strop aj v rámci jedného ticku
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
      // Predfiltrovanie priamo v SQL: zápas ešte nezačal a kolo je otvorené.
      // Bez toho by limit nižšie zabrali zápasy, ktoré sa aj tak nesmú tipovať.
      where: { status: 'scheduled', matchTime: { [Op.gt]: now } },
      include: [
        {
          model: Round,
          attributes: ['id', 'startDate', 'endDate', 'leagueId'],
          where: {
            leagueId: { [Op.in]: leagueIds },
            startDate: { [Op.lte]: now },   // kolo sa už otvorilo
            endDate: { [Op.gt]: now },      // uzávierka ešte neprešla
          },
          required: true,
          // liga + sezóna kvôli isLeagueLocked (ukončená liga/sezóna = zamknuté)
          include: [{
            model: League,
            attributes: ['id', 'ended'],
            include: [{ model: Season, attributes: ['id', 'endDate', 'ended'] }],
          }],
        },
        { model: Team, as: 'homeTeam', attributes: ['sport'] },
        { model: Team, as: 'awayTeam', attributes: ['sport'] },
      ],
      // najskôr zápasy s najbližšou uzávierkou — aby pri limite nevypadli tie,
      // ktoré sa čoskoro zatvoria a už by sa nedali dotipovať
      order: [['matchTime', 'ASC']],
      limit: 200,
    });
    if (!matches.length) continue;
    // existujúce tipy bota jedným dotazom, nové tipy jedným INSERT-om
    const have = new Set((await Tip.findAll({
      where: { userId: bot.id, matchId: matches.map((m) => m.id) },
      attributes: ['matchId'],
    })).map((t) => t.matchId));
    const rows = [];
    for (const match of matches) {
      if (!isOpen(match, now)) continue;
      if (Math.random() > p.coverage) continue;
      if (have.has(match.id)) continue;
      rows.push({ userId: bot.id, matchId: match.id, ...makeTipValues(match, p), points: 0 });
    }
    if (rows.length) {
      // ignoreDuplicates: súbeh s iným behom nesmie zhodiť celý tick
      await Tip.bulkCreate(rows, { ignoreDuplicates: true });
      placed += rows.length;
    }
  }
  if (placed) log(`tipy: +${placed}`);
}

// ── verejné API ──────────────────────────────────────────────────────────────
async function tick({ verbose = true } = {}) {
  const log = (m) => { if (verbose) console.log(`[bots] ${m}`); };
  const bots = await getBots();
  if (!bots.length) { log('žiadni boti — najprv spusti create'); return; }
  log(`tick — aktívnych botov: ${bots.length}`);
  // Boti už NEZAKLADAJÚ súťaže, ligy, kolá ani zápasy a nič nevyhodnocujú —
  // len vstupujú do oficiálnych sezón a tipujú (požiadavka prevádzky).
  await ensureMemberships(bots, log);
  await tipOpenMatches(bots, log);
  log('tick hotový');
}

module.exports = { tick, persona, makeTipValues, isOpen, sampleGoals };