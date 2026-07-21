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
async function roundCreated(round, league) {
  try {
    const ids = await leagueMemberIds(league.id);
    if (!ids.length) return;
    const when = round.endDate ? new Date(round.endDate).toLocaleString('sk-SK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;
    const msg = `Kolo „${round.name}" v lige ${league.name} je otvorené na tipovanie.` + (when ? ` Uzávierka ${when}.` : '');
    await createMany(ids.map((uid) => ({
      userId: uid, type: 'new_round',
      title: 'Nové kolo otvorené na tipovanie',
      message: msg, link: `/rounds/${round.id}`,
    })));
  } catch (e) { console.error('[notify] roundCreated:', e.message); }
}

// Vyhodnotenie zápasov v kole → upozorni hráčov, ktorí v danom kole tipovali.
// Voláme po vyhodnotení; perUser je mapa userId -> { points } (zisk v tomto kroku).
async function roundEvaluated(round, league, perUser) {
  try {
    const entries = Object.entries(perUser || {});
    if (!entries.length) return;
    await createMany(entries.map(([uid, info]) => ({
      userId: Number(uid), type: 'result',
      title: `Výsledky kola „${round.name}" vyhodnotené`,
      message: `Získal si +${info.points || 0} bodov v kole ${round.name}.`,
      link: `/rounds/${round.id}`,
    })));
  } catch (e) { console.error('[notify] roundEvaluated:', e.message); }
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
async function memberJoined(league, newUserId, newUserName) {
  try {
    const ids = await leagueMemberIds(league.id, newUserId);
    if (!ids.length) return;
    let link = `/leagues/${league.id}`;
    try {
      const { Season } = require('../models');
      const s = await Season.findByPk(league.seasonId, { attributes: ['id', 'mode'] });
      if (s && s.mode === 'standalone') link = `/seasons/${league.seasonId}`;
    } catch (e) { /* fallback na /leagues */ }
    await createMany(ids.map((uid) => ({
      userId: uid, type: 'member',
      title: 'Nový hráč v tvojej lige',
      message: `${newUserName || 'Nový hráč'} sa pripojil do ligy ${league.name}.`,
      link,
    })));
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

module.exports = {
  createOne, createMany, leagueMemberIds,
  roundCreated, roundEvaluated, matchEvaluated, matchCanceled,
  memberJoined, achievementsAwarded, adminMessage,
};