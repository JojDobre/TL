// backend/src/controllers/notificationsPage.controller.js
//
// Centrum notifikácií (/notifications) + API akcie (označiť prečítané / všetky).
// Pri otvorení stránky sa LAZY dogenerujú "deadline" notifikácie pre blížiace sa
// kolá s nevyplnenými tipmi (idempotentne — bez duplicít).

const { Notification, UserLeague, Round, Match, Tip, League, Sequelize } = require('../models');
const { Op } = Sequelize;
const { asyncHandler } = require('../middleware/error.middleware');

// ── čistenie starých notifikácií ────────────────────────────────────────────
// Aby tabuľka nerástla donekonečna, mažeme:
//   1) PREČÍTANÉ notifikácie staršie než RETENTION_DAYS (default 14 dní),
//   2) poistka: ak má používateľ viac než MAX_PER_USER záznamov, najstaršie
//      prebytočné zmažeme (bez ohľadu na read) — chráni pred extrémami.
// Neprečítané mladšie než limit necháme vždy. Beh je throttlovaný (max raz za
// CLEAN_EVERY_MS na používateľa), takže nezaťažuje DB pri každom otvorení.
const RETENTION_DAYS = 14;
const MAX_PER_USER = 200;
const CLEAN_EVERY_MS = 6 * 60 * 60 * 1000; // najviac raz za 6 hodín na používateľa
const _lastClean = new Map(); // userId -> timestamp (in-memory throttle)

async function cleanupOldNotifications(userId) {
  try {
    const now = Date.now();
    const last = _lastClean.get(userId) || 0;
    if (now - last < CLEAN_EVERY_MS) return; // throttle
    _lastClean.set(userId, now);

    // 1) prečítané staršie než RETENTION_DAYS
    const cutoff = new Date(now - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    await Notification.destroy({
      where: { userId, read: true, createdAt: { [Op.lt]: cutoff } },
    });

    // 2) tvrdý strop na počet záznamov používateľa
    const count = await Notification.count({ where: { userId } });
    if (count > MAX_PER_USER) {
      // nájdi hranicu: ponecháme najnovších MAX_PER_USER, zvyšok zmažeme
      const keep = await Notification.findAll({
        where: { userId },
        order: [['createdAt', 'DESC']],
        offset: MAX_PER_USER - 1,
        limit: 1,
        attributes: ['createdAt'],
      });
      if (keep.length) {
        const boundary = keep[0].createdAt;
        await Notification.destroy({
          where: { userId, createdAt: { [Op.lt]: boundary } },
        });
      }
    }
  } catch (e) {
    // čistenie je vedľajší efekt — nikdy nezhodí stránku
    console.error('[notify] cleanupOldNotifications:', e.message);
  }
}

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

  // priebežné čistenie starých prečítaných notifikácií (throttlované)
  await cleanupOldNotifications(userId);

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
  generateDeadlineNotifications, cleanupOldNotifications,
};