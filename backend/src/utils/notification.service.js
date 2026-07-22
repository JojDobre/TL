// backend/src/utils/notification.service.js
//
// Centrálna služba pre tvorbu notifikácií. Každá verejná funkcia je navrhnutá ako
// "fire-and-forget": obalená try/catch tak, aby prípadné zlyhanie tvorby
// notifikácie NIKDY nezhodilo hlavnú akciu (vytvorenie kola, vyhodnotenie atď.).
//
// Použitie z controllera (bez await blokujúceho hlavný tok, ale s await kvôli
// poradiu je tiež OK — chyby sú odchytené vnútri):
//   const notify = require('../utils/notification.service');
//   await notify.roundCreated(round, league);

const { Notification, UserLeague, Round, League, Match, Tip, User, Sequelize } = require('../models');
const { Op } = Sequelize;
const push = require('./push.service');
// Formátovanie časov v slovenskej zóne — notifikácie vznikajú na serveri,
// ktorý môže bežať v UTC (viď utils/datetime.util.js).
const { fmtDateTimeShort } = require('./datetime.util');

// Odošle Web Push pre skupinu už vytvorených in-app notifikácií.
// Zoskupí podľa (title, message, link) tak, aby sa každému príjemcovi poslal
// zodpovedajúci obsah. Fire-and-forget: chyby push nikdy neprepadnú do hlavného
// toku (push.service má vlastný try/catch, ale pridávame ešte jednu poistku).
async function pushForRows(rows) {
  try {
    if (!push.isEnabled() || !rows || !rows.length) return;
    // zoskup notifikácie s rovnakým obsahom → jeden push payload pre skupinu ID
    const groups = new Map();
    for (const r of rows) {
      const key = (r.title || '') + '\u0000' + (r.message || '') + '\u0000' + (r.link || '');
      if (!groups.has(key)) {
        groups.set(key, { title: r.title, body: r.message, url: r.link || '/notifications', tag: r.type, ids: [] });
      }
      groups.get(key).ids.push(Number(r.userId));
    }
    for (const g of groups.values()) {
      await push.pushToUsers(g.ids, { title: g.title, body: g.body, url: g.url, tag: g.tag });
    }
  } catch (e) {
    console.error('[notify] push zlyhalo:', e.message);
  }
}

// Odfiltruje príjemcov, ktorí majú vypnuté notifikácie v aplikácii (notifyInApp=false).
async function filterOptedIn(rows) {
  if (!rows || !rows.length) return [];
  const ids = [...new Set(rows.map((r) => Number(r.userId)).filter(Boolean))];
  if (!ids.length) return rows;
  const optedOut = await User.findAll({ where: { id: { [Op.in]: ids }, notifyInApp: false }, attributes: ['id'] });
  if (!optedOut.length) return rows;
  const block = new Set(optedOut.map((u) => u.id));
  return rows.filter((r) => !block.has(Number(r.userId)));
}

// Bezpečné vytvorenie viacerých notifikácií naraz.
async function createMany(rows) {
  if (!rows || !rows.length) return;
  try {
    const allowed = await filterOptedIn(rows);
    if (!allowed.length) return;
    await Notification.bulkCreate(allowed);
    // po uložení in-app notifikácií pošli aj Web Push (ak je zapnutý)
    await pushForRows(allowed);
  } catch (e) {
    // zámerne nehádžeme ďalej — notifikácie sú vedľajší efekt
    console.error('[notify] bulkCreate zlyhalo:', e.message);
  }
}

// Bezpečné vytvorenie jednej notifikácie.
async function createOne(row) {
  try {
    const allowed = await filterOptedIn([row]);
    if (!allowed.length) return;
    await Notification.create(allowed[0]);
    await pushForRows(allowed);
  } catch (e) {
    console.error('[notify] create zlyhalo:', e.message);
  }
}

// Vráti ID členov ligy (voliteľne okrem vylúčeného používateľa).
async function leagueMemberIds(leagueId, excludeUserId) {
  try {
    const mems = await UserLeague.findAll({ where: { leagueId }, attributes: ['userId'] });
    return mems
      .map((m) => m.userId)
      .filter((uid) => !excludeUserId || uid !== Number(excludeUserId));
  } catch (e) {
    console.error('[notify] leagueMemberIds zlyhalo:', e.message);
    return [];
  }
}

// ── UDALOSTI ───────────────────────────────────────────────────────────────

// Nové kolo otvorené → upozorni členov ligy.
// ODPOJENÉ (2026-07): notifikácia sa posielala pri VYTVORENÍ kola, teda aj vtedy,
// keď kolo ešte nebolo otvorené na tipovanie. Hráč tak dostal upozornenie na niečo,
// s čím nemohol nič robiť. Nahradené funkciou roundStarted() nižšie, ktorú spúšťa
// plánovač v okamihu, keď kolo naozaj začne. Funkciu nemažeme kvôli spätnej
// kompatibilite — jednoducho sa už nikde nevolá.
async function roundCreated(round, league) {
  return; // zámerne nič nerobí — viď komentár vyššie
}

// Kolo sa PRÁVE OTVORILO na tipovanie (nastal startDate).
// Volá plánovač (utils/scheduler.js), nie HTTP request.
async function roundStarted(round, league) {
  try {
    const ids = await leagueMemberIds(league.id);
    if (!ids.length) return;
    const when = round.endDate ? fmtDateTimeShort(round.endDate, null) : null;
    const msg = `Kolo „${round.name}" v lige ${league.name} je otvorené — môžeš tipovať.`
      + (when ? ` Uzávierka ${when}.` : '');
    await createMany(ids.map((uid) => ({
      userId: uid, type: 'new_round',
      title: 'Kolo sa otvorilo na tipovanie',
      message: msg, link: `/rounds/${round.id}`,
    })));
  } catch (e) { console.error('[notify] roundStarted:', e.message); }
}

// Blíži sa UZÁVIERKA kola → pripomienka LEN tým hráčom, ktorí nemajú vyplnené
// všetky tipy. Kto má natipované celé kolo, notifikáciu nedostane.
// userIds určuje volajúci (plánovač si ich vyfiltruje podľa počtu tipov).
async function roundDeadlineSoon(round, league, userIds) {
  try {
    const ids = (userIds || []).filter(Boolean);
    if (!ids.length) return;
    const when = round.endDate ? fmtDateTimeShort(round.endDate, null) : null;
    const msg = `Kolo „${round.name}" sa čoskoro uzatvára${when ? ` (${when})` : ''}. Nemáš vyplnené všetky tipy.`;
    await createMany(ids.map((uid) => ({
      userId: uid, type: 'deadline',
      title: 'Blíži sa uzávierka tipovania',
      message: msg, link: `/rounds/${round.id}`,
    })));
  } catch (e) { console.error('[notify] roundDeadlineSoon:', e.message); }
}

// ODPOJENÉ (2026-07): duplicitné s matchEvaluated(), ktorá už zoskupuje
// notifikácie na úroveň kola a sama rozlišuje „celé kolo vyhodnotené" vs
// „kolo má vyhodnotené zápasy". Ponechané kvôli spätnej kompatibilite.
async function roundEvaluated(round, league, perUser) {
  return; // zámerne nič nerobí — viď komentár vyššie
}

// Jeden zápas vyhodnotený → ZOSKUPENÁ notifikácia na úrovni kola.
// Namiesto samostatnej notifikácie za každý zápas (10 zápasov = 10 notifikácií)
// vytvoríme/aktualizujeme JEDNU neprečítanú notifikáciu typu 'result' pre dané
// kolo. Rozlišujeme dve znenia:
//   • časť kola   → „Kolo XY má vyhodnotené zápasy" (+ počet a získané body)
//   • celé kolo   → „Kolo XY vyhodnotené"
// Zoskupenie funguje aj pri postupnom vyhodnocovaní (evaluate po jednom zápase),
// pretože existujúcu neprečítanú notifikáciu pre kolo nájdeme podľa link.
// tips = pole tipov so .userId a .points (po prepočítaní tohto zápasu).
async function matchEvaluated(match, round, tips) {
  try {
    if (!tips || !tips.length) return;
    if (!round) {
      // bez kontextu kola padáme na jednoduchú per-zápas notifikáciu
      await createMany(tips.map((t) => ({
        userId: t.userId, type: 'result',
        title: 'Výsledok zápasu vyhodnotený',
        message: `Zápas bol vyhodnotený. Za tip si získal +${t.points || 0} bodov.`,
        link: '/my',
      })));
      return;
    }

    const link = `/rounds/${round.id}`;
    const rname = round.name || 'kolo';

    // koľko zápasov v kole je spolu a koľko je už vyhodnotených → celé vs. časť
    const totalMatches = await Match.count({ where: { roundId: round.id } });
    const finishedMatches = await Match.count({ where: { roundId: round.id, status: 'finished' } });
    const wholeDone = totalMatches > 0 && finishedMatches >= totalMatches;

    // príjemcovia, ktorí neodhlásili in-app notifikácie
    const allowed = await filterOptedIn(tips.map((t) => ({ userId: t.userId, points: t.points })));
    if (!allowed.length) return;

    for (const t of allowed) {
      const uid = Number(t.userId);
      try {
        // existuje už neprečítaná 'result' notifikácia pre toto kolo?
        const existing = await Notification.findOne({
          where: { userId: uid, type: 'result', link, read: false },
          order: [['createdAt', 'DESC']],
        });

        // súčet získaných bodov hráča za celé kolo (pre presné znenie správy)
        const roundPoints = await sumUserRoundPoints(uid, round.id);

        const title = wholeDone ? `Kolo „${rname}" vyhodnotené` : `Kolo „${rname}" má vyhodnotené zápasy`;
        const message = wholeDone
          ? `Celé kolo je vyhodnotené. Získal si +${roundPoints} bodov.`
          : `Vyhodnotených ${finishedMatches} z ${totalMatches} zápasov. Zatiaľ máš +${roundPoints} bodov.`;

        if (existing) {
          existing.title = title;
          existing.message = message;
          existing.set('createdAt', new Date(), { raw: true });
          existing.changed('createdAt', true);
          await existing.save({ silent: true, fields: ['title', 'message', 'createdAt'] });
        } else {
          await Notification.create({ userId: uid, type: 'result', title, message, link });
        }
        // Web Push pre tohto hráča (aktualizácia aj nová notifikácia)
        await pushForRows([{ userId: uid, type: 'result', title, message, link }]);
      } catch (inner) {
        console.error('[notify] matchEvaluated (user ' + uid + '):', inner.message);
      }
    }
  } catch (e) { console.error('[notify] matchEvaluated:', e.message); }
}

// Súčet bodov jedného hráča vo všetkých zápasoch daného kola.
async function sumUserRoundPoints(userId, roundId) {
  try {
    const tips = await Tip.findAll({
      attributes: ['points'],
      include: [{ model: Match, attributes: [], where: { roundId }, required: true }],
      where: { userId },
    });
    return tips.reduce((s, t) => s + (t.points || 0), 0);
  } catch (e) {
    return 0;
  }
}

// Zápas zrušený → upozorni tipujúcich.
async function matchCanceled(match, round, tips) {
  try {
    if (!tips || !tips.length) return;

    // Notifikáciu posielame LEN ak sa na kolo už dalo tipovať — teda kolo je
    // otvorené alebo už uzavreté. Pri NAPLÁNOVANOM kole (tipovanie sa ešte
    // neotvorilo) by hráča zrušený zápas nezaujímal: nemohol naň tipovať.
    if (round && round.startDate && new Date(round.startDate) > new Date()) {
      return;
    }

    await createMany(tips.map((t) => ({
      userId: t.userId, type: 'canceled',
      title: 'Zápas zrušený',
      message: 'Zápas bol zrušený. Body sa zaň neprideľujú nikomu.',
      link: round ? `/rounds/${round.id}` : '/my',
    })));
  } catch (e) { console.error('[notify] matchCanceled:', e.message); }
}

// Nový hráč v lige → upozorni ostatných členov (okrem nového hráča).
// Standalone liga: detail žije na /seasons/:seasonId, nie /leagues/:id.
// Hranica, od ktorej sa notifikácie o nových hráčoch zoskupujú a posielajú
// už len správcom (nie všetkým členom). Nad týmto počtom by pri každom
// pripojení dostal notifikáciu každý člen — v 50-člennej lige neúnosné.
const MEMBER_NOTIFY_LIMIT = 10;

// Nový hráč sa pripojil do ligy.
//
// Pravidlá (podľa zadania):
//   • LEN komunitné sezóny — v oficiálnych sezónach sa pripojenia neriešia.
//   • Menej ako 10 členov → notifikáciu dostanú všetci členovia (menná).
//   • 10 a viac členov    → dostane ju už len SPRÁVCA ligy/sezóny, a to
//     zoskupene: ak má neprečítanú notifikáciu o nových hráčoch, len sa
//     aktualizuje počet („Pribudli 3 noví hráči" → „Pribudlo 7 nových hráčov").
//     Nová notifikácia vznikne až keď si predchádzajúcu prečíta — ochrana
//     proti spamu pri veľkých ligách.
async function memberJoined(league, newUserId, newUserName) {
  try {
    const { Season, League } = require('../models');

    // --- sezóna: notifikujeme len v komunitných ---
    const season = await Season.findByPk(league.seasonId, {
      attributes: ['id', 'mode', 'type', 'creatorId'],
    });
    if (season && season.type === 'official') return;

    const link = (season && season.mode === 'standalone')
      ? `/seasons/${league.seasonId}`
      : `/leagues/${league.id}`;

    // všetci členovia okrem toho, kto sa práve pripojil
    const memberIds = await leagueMemberIds(league.id, newUserId);
    const totalMembers = memberIds.length + 1; // + práve pripojený

    // --- malá liga: klasická menná notifikácia všetkým ---
    if (totalMembers < MEMBER_NOTIFY_LIMIT) {
      if (!memberIds.length) return;
      await createMany(memberIds.map((uid) => ({
        userId: uid, type: 'member',
        title: 'Nový hráč v tvojej lige',
        message: `${newUserName || 'Nový hráč'} sa pripojil do ligy ${league.name}.`,
        link,
      })));
      return;
    }

    // --- veľká liga: len správcovia, zoskupene ---
    const managerIds = new Set();
    if (league.creatorId) managerIds.add(Number(league.creatorId));
    if (season && season.creatorId) managerIds.add(Number(season.creatorId));
    managerIds.delete(Number(newUserId));
    if (!managerIds.size) return;

    const allowed = await filterOptedIn([...managerIds].map((uid) => ({ userId: uid })));
    if (!allowed.length) return;

    for (const row of allowed) {
      const uid = Number(row.userId);
      try {
        // existuje neprečítaná notifikácia o nových hráčoch pre túto ligu?
        const existing = await Notification.findOne({
          where: { userId: uid, type: 'member', link, read: false },
          order: [['createdAt', 'DESC']],
        });

        if (existing) {
          // zvýš počet v existujúcej správe namiesto vytvorenia novej
          const m = /^(\d+)/.exec(String(existing.message || ''));
          const count = (m ? Number(m[1]) : 1) + 1;
          existing.title = 'Noví hráči v lige';
          existing.message = `${count} nových hráčov sa pripojilo do ligy ${league.name}.`;
          existing.set('createdAt', new Date(), { raw: true });
          existing.changed('createdAt', true);
          await existing.save({ silent: true, fields: ['title', 'message', 'createdAt'] });
          // push zámerne NEposielame — hráč už notifikáciu má a neprečítal si ju
        } else {
          const title = 'Nový hráč v lige';
          const message = `1 nový hráč sa pripojil do ligy ${league.name}.`;
          await Notification.create({ userId: uid, type: 'member', title, message, link });
          await pushForRows([{ userId: uid, type: 'member', title, message, link }]);
        }
      } catch (inner) {
        console.error('[notify] memberJoined (user ' + uid + '):', inner.message);
      }
    }
  } catch (e) { console.error('[notify] memberJoined:', e.message); }
}

// Nový odznak → upozorni používateľa. achievements = pole { name, rarity }.
async function achievementsAwarded(userId, achievements) {
  try {
    if (!achievements || !achievements.length) return;
    const RAR = { common: 'Common', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' };
    await createMany(achievements.map((a) => ({
      userId: Number(userId), type: 'achievement',
      title: `Nový odznak: ${a.name}`,
      message: `Odomkol si ${RAR[a.rarity] || ''} odznak „${a.name}".`,
      link: '/achievements',
    })));
  } catch (e) { console.error('[notify] achievementsAwarded:', e.message); }
}

// Admin/systémová správa pre jedného používateľa.
async function adminMessage(userId, title, message, link) {
  await createOne({ userId: Number(userId), type: 'admin', title: title || 'Oznámenie', message, link: link || null });
}


// ---------------------------------------------------------------------------
// MASOVÉ NOTIFIKÁCIE (oficiálne sezóny a ligy)
// ---------------------------------------------------------------------------

// Veľkosť dávky a pauza medzi dávkami. Pri tisíckach používateľov nechceme
// zahltiť DB ani push službu — rozložíme to v čase.
const BROADCAST_BATCH = Number(process.env.BROADCAST_BATCH || 100);
const BROADCAST_PAUSE_MS = Number(process.env.BROADCAST_PAUSE_MS || 10000);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Rozpošle rovnakú notifikáciu VŠETKÝM používateľom po dávkach.
//
// Ochrany:
//   • dedupe podľa (type + link) — kto už takú notifikáciu má, druhýkrát ju
//     nedostane, a to ani keď si ju medzitým prečítal
//   • dávkovanie: BROADCAST_BATCH príjemcov, potom pauza BROADCAST_PAUSE_MS
//   • beží na pozadí (volajúci nečaká) — pri veľa používateľoch by inak
//     HTTP request alebo beh plánovača trval minúty
async function broadcastToAll({ type, title, message, link }) {
  try {
    const { User } = require('../models');

    // koho už notifikácia zastihla (bez ohľadu na prečítanie)
    const already = await Notification.findAll({
      where: { type, link }, attributes: ['userId'],
    });
    const skip = new Set(already.map((n) => Number(n.userId)));

    const users = await User.findAll({ attributes: ['id'] });
    const targets = users.map((u) => Number(u.id)).filter((id) => !skip.has(id));
    if (!targets.length) return;

    console.log(`[notify] broadcast "${title}" → ${targets.length} používateľov `
      + `(po ${BROADCAST_BATCH}, pauza ${BROADCAST_PAUSE_MS} ms)`);

    for (let i = 0; i < targets.length; i += BROADCAST_BATCH) {
      const batch = targets.slice(i, i + BROADCAST_BATCH);
      // createMany sám rieši opt-out (notifyInApp) aj Web Push
      await createMany(batch.map((uid) => ({ userId: uid, type, title, message, link })));
      if (i + BROADCAST_BATCH < targets.length) await sleep(BROADCAST_PAUSE_MS);
    }
    console.log(`[notify] broadcast "${title}" dokončený`);
  } catch (e) { console.error('[notify] broadcastToAll:', e.message); }
}

// Spustila sa OFICIÁLNA sezóna → notifikácia všetkým používateľom.
// Beží na pozadí, volajúci na dokončenie nečaká.
function seasonStarted(season) {
  const payload = {
    type: 'season',
    title: 'Spustila sa nová sezóna',
    message: `Oficiálna sezóna ${season.name} sa práve začala. Pripoj sa a tipuj.`,
    link: `/seasons/${season.id}`,
  };
  broadcastToAll(payload).catch((e) => console.error('[notify] seasonStarted:', e.message));
}

// Pribudla nová OFICIÁLNA liga v oficiálnej sezóne → notifikácia všetkým.
function officialLeagueAdded(league, season) {
  const payload = {
    type: 'season',
    title: 'Nová oficiálna liga',
    message: `V sezóne ${season ? season.name : 'oficiálnej sezóne'} pribudla liga ${league.name}.`,
    link: `/leagues/${league.id}`,
  };
  broadcastToAll(payload).catch((e) => console.error('[notify] officialLeagueAdded:', e.message));
}

// ---------------------------------------------------------------------------
// PREVÁDZKOVÉ NOTIFIKÁCIE PRE WEBOVÝCH ADMINOV (role === 'admin')
// ---------------------------------------------------------------------------

// ID všetkých webových adminov.
async function webAdminIds() {
  try {
    const { User } = require('../models');
    const admins = await User.findAll({ where: { role: 'admin' }, attributes: ['id'] });
    return admins.map((a) => Number(a.id));
  } catch (e) {
    console.error('[notify] webAdminIds:', e.message);
    return [];
  }
}

// Súhrnná notifikácia pre adminov.
//
// Tieto stavy trvajú, kým ich admin nevyrieši, preto notifikáciu neposielame
// znova pri každom behu plánovača. Namiesto toho aktualizujeme existujúcu
// neprečítanú notifikáciu s rovnakým `link` — a to len ak sa zmenil počet.
// Nová (a s ňou push) vznikne až po prečítaní tej predchádzajúcej.
async function sysadminNotice({ key, title, message, link }) {
  try {
    const ids = await webAdminIds();
    if (!ids.length) return;

    const allowed = await filterOptedIn(ids.map((uid) => ({ userId: uid })));
    if (!allowed.length) return;

    for (const row of allowed) {
      const uid = Number(row.userId);
      try {
        const existing = await Notification.findOne({
          where: { userId: uid, type: 'sysadmin', link, read: false },
          order: [['createdAt', 'DESC']],
        });

        if (existing) {
          // rovnaký obsah → neotravuj (žiadny zápis, žiadny push)
          if (existing.message === message) continue;
          existing.title = title;
          existing.message = message;
          existing.set('createdAt', new Date(), { raw: true });
          existing.changed('createdAt', true);
          await existing.save({ silent: true, fields: ['title', 'message', 'createdAt'] });
        } else {
          await Notification.create({ userId: uid, type: 'sysadmin', title, message, link });
          await pushForRows([{ userId: uid, type: 'sysadmin', title, message, link }]);
        }
      } catch (inner) {
        console.error('[notify] sysadminNotice (user ' + uid + '):', inner.message);
      }
    }
  } catch (e) { console.error('[notify] sysadminNotice:', e.message); }
}

// Zápasy, ktoré sa už odohrali, ale nemajú zadaný výsledok.
async function adminMatchesAwaitingResult(count) {
  if (!count) return;
  await sysadminNotice({
    title: 'Zápasy čakajú na vyhodnotenie',
    message: count === 1
      ? '1 zápas sa už odohral a nemá zadaný výsledok.'
      : `${count} zápasov sa už odohralo a nemá zadaný výsledok.`,
    link: '/admin/pending',
  });
}

// Šablóny, v ktorých čakajú zápasy na doplnenie výsledku.
async function adminTemplatesAwaitingResult(count) {
  if (!count) return;
  await sysadminNotice({
    title: 'Šablóny čakajú na výsledky',
    message: count === 1
      ? '1 zápas v šablóne čaká na doplnenie výsledku.'
      : `${count} zápasov v šablónach čaká na doplnenie výsledku.`,
    link: '/admin/templates',
  });
}

// Kolá v oficiálnych sezónach, ktoré skončili a nie sú vyhodnotené.
async function adminRoundsUnevaluated(count) {
  if (!count) return;
  await sysadminNotice({
    title: 'Kolá čakajú na vyhodnotenie',
    message: count === 1
      ? '1 kolo v oficiálnej sezóne skončilo a nie je vyhodnotené.'
      : `${count} kôl v oficiálnych sezónach skončilo a nie je vyhodnotených.`,
    link: '/admin/competitions',
  });
}

module.exports = {
  createOne, createMany, leagueMemberIds,
  // kolá
  roundStarted, roundDeadlineSoon, matchEvaluated, matchCanceled,
  // ligy a sezóny
  memberJoined, seasonStarted, officialLeagueAdded,
  // odznaky
  achievementsAwarded,
  // prevádzkové (weboví admini)
  adminMatchesAwaitingResult, adminTemplatesAwaitingResult, adminRoundsUnevaluated,
  // ODPOJENÉ — ponechané kvôli spätnej kompatibilite, nikde sa nevolajú:
  roundCreated, roundEvaluated, adminMessage,
};