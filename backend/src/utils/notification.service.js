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

const { Notification, UserLeague, Round, League, Sequelize } = require('../models');
const { Op } = Sequelize;

// Bezpečné vytvorenie viacerých notifikácií naraz.
async function createMany(rows) {
  if (!rows || !rows.length) return;
  try {
    await Notification.bulkCreate(rows);
  } catch (e) {
    // zámerne nehádžeme ďalej — notifikácie sú vedľajší efekt
    console.error('[notify] bulkCreate zlyhalo:', e.message);
  }
}

// Bezpečné vytvorenie jednej notifikácie.
async function createOne(row) {
  try {
    await Notification.create(row);
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

// Jednoduchšia verzia: jeden zápas vyhodnotený → upozorni tipujúcich na zápas.
// tips = pole tipov so .userId a .points (po prepočítaní).
async function matchEvaluated(match, round, tips) {
  try {
    if (!tips || !tips.length) return;
    const rname = round && round.name ? round.name : 'kolo';
    await createMany(tips.map((t) => ({
      userId: t.userId, type: 'result',
      title: 'Výsledok zápasu vyhodnotený',
      message: `Zápas bol vyhodnotený. Za tip si získal +${t.points || 0} bodov (${rname}).`,
      link: round ? `/rounds/${round.id}` : '/my',
    })));
  } catch (e) { console.error('[notify] matchEvaluated:', e.message); }
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
async function memberJoined(league, newUserId, newUserName) {
  try {
    const ids = await leagueMemberIds(league.id, newUserId);
    if (!ids.length) return;
    await createMany(ids.map((uid) => ({
      userId: uid, type: 'member',
      title: 'Nový hráč v tvojej lige',
      message: `${newUserName || 'Nový hráč'} sa pripojil do ligy ${league.name}.`,
      link: `/leagues/${league.id}`,
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
