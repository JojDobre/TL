// backend/src/utils/scheduler.js
//
// Plánovač časovo viazaných notifikácií.
//
// PREČO EXISTUJE:
// Stav kola a sezóny sa v aplikácii počíta „za behu" (pri načítaní stránky sa
// porovná `now` so `startDate`/`endDate`). Prechod „naplánované → otvorené"
// teda nikdy nespustil žiadnu udalosť a notifikácia sa nemala ako odoslať.
// Tento modul tie prechody pravidelne kontroluje.
//
// ČO RIEŠI:
//   HRÁČSKE (každých SCHEDULER_INTERVAL_MIN, predvolene 5 min)
//     1) kolo sa otvorilo na tipovanie      → notify.roundStarted
//     2) blíži sa uzávierka a hráč nemá     → notify.roundDeadlineSoon
//        vyplnené všetky tipy
//     2b) zápas sa začína do 2 h a hráč ho  → notify.untippedSoon
//        netipol (jedna správa za všetky také zápasy)
//     3) spustila sa oficiálna sezóna       → notify.seasonStarted (všetkým)
//     4) pribudla oficiálna liga            → notify.officialLeagueAdded (všetkým)
//
//   ADMINSKÉ (každých ADMIN_CHECK_MIN, predvolene 30 min)
//     5) odohrané zápasy bez výsledku       → notify.adminMatchesAwaitingResult
//     6) šablóny čakajúce na výsledky       → notify.adminTemplatesAwaitingResult
//     7) skončené nevyhodnotené kolá        → notify.adminRoundsUnevaluated
//        (len oficiálne sezóny)
//
// NÁVRH:
//   • Beží v procese appky cez setInterval — žiadny cron ani ďalší proces.
//   • Idempotentné: na kole/sezóne/lige sa značí príznak (napr. startNotifiedAt),
//     takže reštart appky ani opakovaný beh notifikácie nezduplikuje.
//   • Defenzívne: každá chyba sa zaloguje a beh pokračuje.
//   • Nedobieha staré udalosti: čo sa stalo pred viac ako GRACE_MINUTES, sa len
//     označí ako vybavené (po výpadku nechceme zaspamovať hráčov).
//   • Pri PRVOM spustení sa staré záznamy hromadne označia bez rozosielania
//     (viď backfillExisting) — inak by po nasadení prišla dávka notifikácií
//     za kolá bežiace už týždne.
//
// KONFIGURÁCIA (.env):
//   SCHEDULER_ENABLED=false     – úplne vypne plánovač (predvolene zapnutý)
//   SCHEDULER_INTERVAL_MIN=5    – interval hráčskych kontrol (minúty)
//   ADMIN_CHECK_MIN=30          – interval adminských kontrol (minúty)
//   DEADLINE_REMINDER_MIN=60    – koľko minút pred uzávierkou pripomenúť
//   UNTIPPED_REMINDER_MIN=120   – „ešte si netipol“: minúty pred začiatkom zápasu (0 = vypnuté)

const { Round, League, Season, Match, Tip, UserLeague, Sequelize } = require('../models');
const { Op } = Sequelize;
const notify = require('./notification.service');

const INTERVAL_MIN = Number(process.env.SCHEDULER_INTERVAL_MIN || 5);
const ADMIN_MIN = Number(process.env.ADMIN_CHECK_MIN || 30);
const DEADLINE_MIN = Number(process.env.DEADLINE_REMINDER_MIN || 60);
// „ešte si netipol“: koľko minút pred začiatkom zápasu pripomenúť (0 = vypnuté)
const UNTIPPED_MIN = Number(process.env.UNTIPPED_REMINDER_MIN != null && process.env.UNTIPPED_REMINDER_MIN !== '' ? process.env.UNTIPPED_REMINDER_MIN : 120);
// Ako ďaleko do minulosti ešte notifikáciu odošleme (po výpadku/reštarte).
const GRACE_MINUTES = 120;

let timer = null;
let adminTimer = null;
let running = false;        // poistka proti prekrytiu hráčskych behov
let adminRunning = false;   // to isté pre adminské
let firstRun = true;        // prvý beh → backfill, nie rozosielanie

// ---------------------------------------------------------------------------
// BACKFILL pri prvom spustení
// ---------------------------------------------------------------------------
// Pri nasadení majú všetky existujúce záznamy príznaky NULL, takže by ich
// plánovač považoval za „práve sa stalo". Staré záznamy preto ticho označíme.
async function backfillExisting(now) {
  const cutoff = new Date(now.getTime() - GRACE_MINUTES * 60000);
  try {
    const [rStart] = await Round.update(
      { startNotifiedAt: now },
      { where: { startNotifiedAt: null, startDate: { [Op.lt]: cutoff } } }
    );
    // uzávierky, ktoré už prebehli, nemá zmysel pripomínať spätne
    const [rDead] = await Round.update(
      { deadlineNotifiedAt: now },
      { where: { deadlineNotifiedAt: null, endDate: { [Op.lte]: now } } }
    );
    // Sezóny a ligy označujeme VŠETKY existujúce, nielen staršie než cutoff.
    // Ide o MASOVÉ notifikácie (všetkým používateľom) — pri nasadení by inak
    // odišla dávka oznámení za sezóny a ligy, ktoré už dávno bežia. Notifikácie
    // sa začnú posielať až za tie, ktoré vzniknú PO nasadení.
    const [sStart] = await Season.update(
      { startNotifiedAt: now },
      { where: { startNotifiedAt: null } }
    );
    const [lAnn] = await League.update(
      { announcedAt: now },
      { where: { announcedAt: null } }
    );
    // pripomienky netipnutých zápasov — začaté zápasy už nepripomíname
    await Match.update({ remindNotifiedAt: now }, { where: { remindNotifiedAt: null, matchTime: { [Op.lte]: now } } });
    if (rStart || rDead || sStart || lAnn) {
      console.log(`[scheduler] backfill (bez rozosielania): kolá ${rStart} otvorenie / `
        + `${rDead} uzávierka, sezóny ${sStart}, ligy ${lAnn}`);
    }
  } catch (e) {
    console.error('[scheduler] backfill zlyhal:', e.message);
  }
  // POZN.: kolá, ktorým uzávierka ešte len nastane a spadajú do pripomienkového
  // okna, pripomienku dostanú aj pri prvom behu — to je zámer, uzávierka sa
  // reálne blíži.
}

// ---------------------------------------------------------------------------
// 1) kolá, ktoré sa práve otvorili
// ---------------------------------------------------------------------------
async function processStartedRounds(now) {
  const graceFrom = new Date(now.getTime() - GRACE_MINUTES * 60000);
  const rounds = await Round.findAll({
    where: { startNotifiedAt: null, startDate: { [Op.lte]: now } },
    include: [{ model: League, attributes: ['id', 'name'] }],
    limit: 50,
  });

  let sent = 0;
  for (const round of rounds) {
    try {
      const league = round.League;
      if (!league) { await round.update({ startNotifiedAt: now }); continue; }
      // pristaré kolo len označíme (nedobiehame notifikácie po výpadku)
      if (new Date(round.startDate) >= graceFrom) {
        await notify.roundStarted(round, league);
        sent++;
      }
      await round.update({ startNotifiedAt: now });
    } catch (e) {
      console.error('[scheduler] roundStarted (kolo ' + round.id + '):', e.message);
    }
  }
  return sent;
}

// ---------------------------------------------------------------------------
// 2) blížiaca sa uzávierka — len hráčom, čo nemajú vyplnené všetky tipy
// ---------------------------------------------------------------------------
async function processDeadlineReminders(now) {
  const until = new Date(now.getTime() + DEADLINE_MIN * 60000);
  const rounds = await Round.findAll({
    where: {
      deadlineNotifiedAt: null,
      endDate: { [Op.gt]: now, [Op.lte]: until },  // uzávierka je v okne
      startDate: { [Op.lte]: now },                // a kolo už beží
    },
    include: [{ model: League, attributes: ['id', 'name'] }],
    limit: 50,
  });

  let sent = 0;
  for (const round of rounds) {
    try {
      const league = round.League;
      if (!league) { await round.update({ deadlineNotifiedAt: now }); continue; }

      // koľko zápasov kolo má
      const matchIds = (await Match.findAll({
        where: { roundId: round.id, status: { [Op.ne]: 'canceled' } },
        attributes: ['id'],
      })).map((m) => m.id);

      if (!matchIds.length) { await round.update({ deadlineNotifiedAt: now }); continue; }

      // členovia ligy
      const members = await UserLeague.findAll({
        where: { leagueId: league.id }, attributes: ['userId'],
      });
      const memberIds = members.map((m) => Number(m.userId));
      if (!memberIds.length) { await round.update({ deadlineNotifiedAt: now }); continue; }

      // koľko tipov má každý hráč v tomto kole
      const tips = await Tip.findAll({
        where: { userId: { [Op.in]: memberIds }, matchId: { [Op.in]: matchIds } },
        attributes: ['userId', 'matchId'],
      });
      const perUser = new Map();
      for (const t of tips) {
        const uid = Number(t.userId);
        perUser.set(uid, (perUser.get(uid) || 0) + 1);
      }

      // pripomienku dostane len ten, komu chýba aspoň jeden tip
      const incomplete = memberIds.filter((uid) => (perUser.get(uid) || 0) < matchIds.length);

      if (incomplete.length) {
        await notify.roundDeadlineSoon(round, league, incomplete);
        sent += incomplete.length;
      }
      await round.update({ deadlineNotifiedAt: now });
    } catch (e) {
      console.error('[scheduler] deadlineSoon (kolo ' + round.id + '):', e.message);
    }
  }
  return sent;
}

// ---------------------------------------------------------------------------
// 3) spustené oficiálne sezóny (masová notifikácia)
// ---------------------------------------------------------------------------
async function processStartedSeasons(now) {
  const graceFrom = new Date(now.getTime() - GRACE_MINUTES * 60000);
  const seasons = await Season.findAll({
    where: {
      startNotifiedAt: null,
      type: 'official',
      startDate: { [Op.lte]: now },
      ended: false,
    },
    limit: 10,
  });

  let sent = 0;
  for (const season of seasons) {
    try {
      if (new Date(season.startDate) >= graceFrom) {
        notify.seasonStarted(season);   // beží na pozadí (dávkovane)
        sent++;
      }
      await season.update({ startNotifiedAt: now });
    } catch (e) {
      console.error('[scheduler] seasonStarted (sezóna ' + season.id + '):', e.message);
    }
  }
  return sent;
}

// ---------------------------------------------------------------------------
// 4) nové oficiálne ligy (masová notifikácia)
// ---------------------------------------------------------------------------
async function processNewOfficialLeagues(now) {
  const graceFrom = new Date(now.getTime() - GRACE_MINUTES * 60000);
  const leagues = await League.findAll({
    where: { announcedAt: null, isTemplate: false },
    include: [{
      model: Season,
      attributes: ['id', 'name', 'type', 'ended'],
      where: { type: 'official', ended: false },
    }],
    limit: 10,
  });

  let sent = 0;
  for (const league of leagues) {
    try {
      if (new Date(league.createdAt) >= graceFrom) {
        notify.officialLeagueAdded(league, league.Season);   // na pozadí
        sent++;
      }
      await league.update({ announcedAt: now });
    } catch (e) {
      console.error('[scheduler] officialLeague (liga ' + league.id + '):', e.message);
    }
  }
  return sent;
}

// ---------------------------------------------------------------------------
// 5–7) prevádzkové kontroly pre webových adminov
// ---------------------------------------------------------------------------
async function processAdminChecks(now) {
  // --- 5) odohrané zápasy bez výsledku ---
  try {
    const pending = await Match.count({
      where: {
        matchTime: { [Op.lte]: now },
        status: { [Op.notIn]: ['finished', 'canceled'] },
      },
    });
    await notify.adminMatchesAwaitingResult(pending);
  } catch (e) { console.error('[scheduler] admin: zápasy:', e.message); }

  // --- 6) šablóny čakajúce na výsledky ---
  // Zápas v šablóne, ktorý sa už odohral a nemá výsledok.
  try {
    const tplIds = (await League.findAll({
      where: { isTemplate: true }, attributes: ['id'],
    })).map((t) => t.id);

    if (tplIds.length) {
      const tplRoundIds = (await Round.findAll({
        where: { leagueId: { [Op.in]: tplIds } }, attributes: ['id'],
      })).map((r) => r.id);

      if (tplRoundIds.length) {
        const waiting = await Match.count({
          where: {
            roundId: { [Op.in]: tplRoundIds },
            matchTime: { [Op.lte]: now },
            status: { [Op.notIn]: ['finished', 'canceled'] },
          },
        });
        await notify.adminTemplatesAwaitingResult(waiting);
      }
    }
  } catch (e) { console.error('[scheduler] admin: šablóny:', e.message); }

  // --- 7) skončené a nevyhodnotené kolá v oficiálnych sezónach ---
  try {
    const officialLeagueIds = (await League.findAll({
      attributes: ['id'],
      include: [{ model: Season, attributes: [], where: { type: 'official' } }],
    })).map((l) => l.id);

    if (officialLeagueIds.length) {
      const endedRounds = await Round.findAll({
        where: { leagueId: { [Op.in]: officialLeagueIds }, endDate: { [Op.lte]: now } },
        attributes: ['id'],
      });

      let unevaluated = 0;
      for (const r of endedRounds) {
        const pending = await Match.count({
          where: { roundId: r.id, status: { [Op.notIn]: ['finished', 'canceled'] } },
        });
        if (pending > 0) unevaluated++;
      }
      await notify.adminRoundsUnevaluated(unevaluated);
    }
  } catch (e) { console.error('[scheduler] admin: kolá:', e.message); }
}

// ---------------------------------------------------------------------------
// 2b) „ešte si netipol“ — zápasy, ktoré sa začínajú do UNTIPPED_MIN minút
// ---------------------------------------------------------------------------
async function processUntippedReminders(now) {
  if (!UNTIPPED_MIN) return 0;
  const { Team, User } = require('../models');
  const until = new Date(now.getTime() + UNTIPPED_MIN * 60000);
  const matches = await Match.findAll({
    where: { remindNotifiedAt: null, status: 'scheduled', matchTime: { [Op.gt]: now, [Op.lte]: until } },
    attributes: ['id', 'roundId', 'matchTime'],
    include: [
      { model: Round, required: true, attributes: ['id', 'leagueId', 'startDate', 'endDate'],
        include: [{ model: League, required: true, attributes: ['id', 'isTemplate', 'active', 'ended'] }] },
      { model: Team, as: 'homeTeam', attributes: ['name'] },
      { model: Team, as: 'awayTeam', attributes: ['name'] },
    ],
    limit: 500,
  });
  if (!matches.length) return 0;
  // tipovateľné: kolo už beží, uzávierka kola ešte nenastala, liga nie je šablóna/ukončená
  const live = matches.filter((m) => !m.Round.League.isTemplate && m.Round.League.active !== false
    && !m.Round.League.ended && new Date(m.Round.startDate) <= now && new Date(m.Round.endDate) > now);
  let sent = 0;
  if (live.length) {
    const byLeague = new Map();
    live.forEach((m) => {
      if (!byLeague.has(m.Round.leagueId)) byLeague.set(m.Round.leagueId, []);
      byLeague.get(m.Round.leagueId).push(m);
    });
    const members = await UserLeague.findAll({ where: { leagueId: { [Op.in]: [...byLeague.keys()] } }, attributes: ['userId', 'leagueId'] });
    const tips = await Tip.findAll({ where: { matchId: { [Op.in]: live.map((m) => m.id) } }, attributes: ['userId', 'matchId'] });
    const tipped = new Set(tips.map((t) => `${t.userId}:${t.matchId}`));
    const perUser = new Map();
    members.forEach((mem) => {
      (byLeague.get(mem.leagueId) || []).forEach((m) => {
        if (tipped.has(`${mem.userId}:${m.id}`)) return;
        const uid = Number(mem.userId);
        if (!perUser.has(uid)) perUser.set(uid, []);
        perUser.get(uid).push({ id: m.id, roundId: m.roundId, time: m.matchTime,
          home: m.homeTeam ? m.homeTeam.name : '?', away: m.awayTeam ? m.awayTeam.name : '?' });
      });
    });
    if (perUser.size && User.rawAttributes.isBot) {   // boti notifikácie nedostávajú
      const bots = await User.findAll({ where: { id: { [Op.in]: [...perUser.keys()] }, isBot: true }, attributes: ['id'] });
      bots.forEach((b) => perUser.delete(b.id));
    }
    if (perUser.size) { await notify.untippedSoon(perUser); sent = perUser.size; }
  }
  // kolo, ktoré sa ešte neotvorilo, necháme na ďalší beh (môže sa otvoriť pred zápasom)
  const done = matches.filter((m) => new Date(m.Round.startDate) <= now).map((m) => m.id);
  if (done.length) await Match.update({ remindNotifiedAt: now }, { where: { id: { [Op.in]: done } } });
  return sent;
}

// ---------------------------------------------------------------------------
// 2c) výsledky súbojov 1 na 1 — po uzavretí kola obom hráčom
// ---------------------------------------------------------------------------
async function processDuelResults(now) {
  const { Duel, User } = require('../models');
  const { duelScore } = require('./duel.util');
  const duels = await Duel.findAll({
    where: { status: 'accepted', resultNotifiedAt: null },
    include: [{ model: Round, required: true, where: { endDate: { [Op.lte]: now } } }],
    limit: 100,
  });
  let sent = 0;
  for (const d of duels) {
    try {
      const sc = await duelScore(d, now);
      if (sc.state !== 'finished') continue;
      const users = await User.findAll({ where: { id: [d.challengerId, d.opponentId] }, attributes: ['id', 'username', 'firstName', 'lastName'] });
      const nm = (id) => { const u = users.find((x) => x.id === id); return u ? ([u.firstName, u.lastName].filter(Boolean).join(' ') || u.username) : 'Súper'; };
      const view = (me, opp, mine, theirs) => {
        const t = mine > theirs ? 'Vyhral si súboj! 🏆' : (mine < theirs ? 'Súboj si prehral' : 'Súboj skončil remízou');
        return { userId: me, title: t, message: `Ty ${mine} : ${theirs} ${nm(opp)} · kolo „${sc.round.name}“` };
      };
      await notify.duelResult(d, [
        view(d.challengerId, d.opponentId, sc.challengerPts, sc.opponentPts),
        view(d.opponentId, d.challengerId, sc.opponentPts, sc.challengerPts),
      ]);
      await d.update({ resultNotifiedAt: now });
      sent += 2;
    } catch (e) { console.error('[scheduler] duel ' + d.id + ':', e.message); }
  }
  return sent;
}

// ---------------------------------------------------------------------------
// behy
// ---------------------------------------------------------------------------

// Jeden hráčsky prechod. Exportované aj samostatne kvôli testovaniu.
async function tick() {
  if (running) return { skipped: true };
  running = true;
  const now = new Date();
  const res = { rounds: 0, deadlines: 0, untipped: 0, seasons: 0, leagues: 0 };
  try {
    if (firstRun) {
      firstRun = false;
      await backfillExisting(now);
    }
    res.rounds = await processStartedRounds(now);
    res.deadlines = await processDeadlineReminders(now);
    res.untipped = await processUntippedReminders(now);
    res.duels = await processDuelResults(now);
    res.seasons = await processStartedSeasons(now);
    res.leagues = await processNewOfficialLeagues(now);
  } catch (e) {
    console.error('[scheduler] beh zlyhal:', e.message);
  } finally {
    running = false;
  }
  return res;
}

// Jeden adminský prechod.
async function adminTick() {
  if (adminRunning) return { skipped: true };
  adminRunning = true;
  try {
    await processAdminChecks(new Date());
  } catch (e) {
    console.error('[scheduler] admin beh zlyhal:', e.message);
  } finally {
    adminRunning = false;
  }
  return { ok: true };
}

// Spustí periodické behy. Volá sa raz pri štarte aplikácie.
function start() {
  if (String(process.env.SCHEDULER_ENABLED).toLowerCase() === 'false') {
    console.log('[scheduler] vypnutý (SCHEDULER_ENABLED=false)');
    return null;
  }
  if (timer) return timer;

  // Prvé behy s odkladom, nech neblokujú štart a DB je pripravená.
  setTimeout(() => { tick().catch(() => {}); }, 20 * 1000);
  setTimeout(() => { adminTick().catch(() => {}); }, 60 * 1000);

  timer = setInterval(() => { tick().catch(() => {}); }, Math.max(1, INTERVAL_MIN) * 60000);
  adminTimer = setInterval(() => { adminTick().catch(() => {}); }, Math.max(1, ADMIN_MIN) * 60000);

  // Nebránia ukončeniu procesu (napr. pri deployi).
  if (timer.unref) timer.unref();
  if (adminTimer.unref) adminTimer.unref();

  console.log(`[scheduler] spustený — hráčske kontroly každých ${INTERVAL_MIN} min, `
    + `adminské každých ${ADMIN_MIN} min, pripomienka ${DEADLINE_MIN} min pred uzávierkou`);
  return timer;
}

function stop() {
  if (timer) { clearInterval(timer); timer = null; }
  if (adminTimer) { clearInterval(adminTimer); adminTimer = null; }
}

module.exports = { start, stop, tick, adminTick, processUntippedReminders, processDuelResults };
