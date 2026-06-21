// backend/src/controllers/notificationsPage.controller.js
//
// Centrum notifikácií (/notifications) + API akcie (označiť prečítané / všetky).
// Pri otvorení stránky sa LAZY dogenerujú "deadline" notifikácie pre blížiace sa
// kolá s nevyplnenými tipmi (idempotentne — bez duplicít).

const { Notification, UserLeague, Round, Match, Tip, League, Sequelize } = require('../models');
const { Op } = Sequelize;
const { asyncHandler } = require('../middleware/error.middleware');

// ── lazy generovanie "blížiaca sa uzávierka" ────────────────────────────────
// Pre prihláseného: kolá v jeho ligách, ktoré sa ešte neuzavreli, končia do 24h
// a má v nich nevyplnené zápasy. Pre každé takéto kolo vznikne max. 1 notifikácia
// (kontrola cez link, aby sa neduplikovala).
async function generateDeadlineNotifications(userId) {
  try {
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const lMems = await UserLeague.findAll({ where: { userId }, attributes: ['leagueId'] });
    const leagueIds = lMems.map((m) => m.leagueId);
    if (!leagueIds.length) return;

    const rounds = await Round.findAll({
      where: { leagueId: { [Op.in]: leagueIds }, endDate: { [Op.gt]: now, [Op.lte]: in24h } },
      include: [{ model: League, attributes: ['name'] }],
    });
    if (!rounds.length) return;

    for (const round of rounds) {
      // koľko zápasov v kole je ešte scheduled (tipovateľných)?
      const matches = await Match.findAll({ where: { roundId: round.id, status: 'scheduled' }, attributes: ['id'] });
      if (!matches.length) continue;
      const matchIds = matches.map((m) => m.id);
      const myTips = await Tip.findAll({ where: { userId, matchId: { [Op.in]: matchIds } }, attributes: ['matchId'] });
      const tipped = new Set(myTips.map((t) => t.matchId));
      const unfilled = matchIds.filter((id) => !tipped.has(id)).length;
      if (unfilled <= 0) continue;

      // idempotencia: existuje už deadline notifikácia pre toto kolo?
      const link = `/rounds/${round.id}`;
      const exists = await Notification.findOne({ where: { userId, type: 'deadline', link } });
      if (exists) continue;

      const when = new Date(round.endDate).toLocaleString('sk-SK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      await Notification.create({
        userId, type: 'deadline',
        title: 'Blížiaca sa uzávierka',
        message: `Máš ${unfilled} nevyplnených tipov v kole „${round.name}" (${round.League ? round.League.name : ''}). Uzávierka ${when}.`,
        link,
      });
    }
  } catch (e) {
    console.error('[notify] generateDeadlineNotifications:', e.message);
  }
}

// pomocná: zaradenie do skupiny podľa dátumu
function dayBucket(date) {
  const now = new Date();
  const d = new Date(date);
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (d >= startToday) return 'Dnes';
  const weekAgo = new Date(startToday.getTime() - 6 * 24 * 60 * 60 * 1000);
  if (d >= weekAgo) return 'Tento týždeň';
  return 'Staršie';
}

// GET /notifications
const notificationsPage = asyncHandler(async (req, res) => {
  const userId = Number(req.session.userId);

  // lazy dogenerovanie deadline notifikácií
  await generateDeadlineNotifications(userId);

  const all = await Notification.findAll({
    where: { userId },
    order: [['createdAt', 'DESC']],
    limit: 100,
  });

  const items = all.map((n) => n.toJSON());
  const unreadCount = items.filter((n) => !n.read).length;

  // zoskupenie podľa dní pri zachovaní poradia
  const groups = [];
  const idx = {};
  items.forEach((n) => {
    const b = dayBucket(n.createdAt);
    if (idx[b] === undefined) { idx[b] = groups.length; groups.push({ label: b, items: [] }); }
    groups[idx[b]].items.push(n);
  });

  res.render('notifications', { groups, unreadCount, total: items.length });
});

// POST /notifications/:id/read — označ jednu ako prečítanú
const markRead = asyncHandler(async (req, res) => {
  const userId = Number(req.session.userId);
  await Notification.update({ read: true }, { where: { id: req.params.id, userId } });
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.json({ success: true });
  }
  res.redirect('/notifications');
});

// POST /notifications/read-all — označ všetky ako prečítané
const markAllRead = asyncHandler(async (req, res) => {
  const userId = Number(req.session.userId);
  await Notification.update({ read: true }, { where: { userId, read: false } });
  if (req.headers.accept && req.headers.accept.includes('application/json')) {
    return res.json({ success: true });
  }
  res.redirect('/notifications');
});

// GET /api/notifications/unread-count — pre zvonček v navbare (počet neprečítaných)
const unreadCountApi = asyncHandler(async (req, res) => {
  const userId = Number(req.session.userId);
  const count = await Notification.count({ where: { userId, read: false } });
  res.json({ count });
});

// GET /api/notifications/recent — pre dropdown zvončeka (posledných 5)
const recentApi = asyncHandler(async (req, res) => {
  const userId = Number(req.session.userId);
  const rows = await Notification.findAll({ where: { userId }, order: [['createdAt', 'DESC']], limit: 5 });
  res.json({ items: rows.map((n) => ({ id: n.id, type: n.type, title: n.title, message: n.message, link: n.link, read: n.read, createdAt: n.createdAt })) });
});

module.exports = {
  notificationsPage, markRead, markAllRead, unreadCountApi, recentApi,
  generateDeadlineNotifications,
};
