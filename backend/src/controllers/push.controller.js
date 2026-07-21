// backend/src/controllers/push.controller.js
//
// Web Push subscription API pre prihláseného používateľa.
//   GET  /api/push/vapid-public-key  → verejný VAPID kľúč (na subscribe v prehliadači)
//   POST /api/push/subscribe         → uloží/aktualizuje PushSubscription
//   POST /api/push/unsubscribe       → zmaže PushSubscription podľa endpointu
//
// Ochrana: apiRequireLogin (JSON 401 pre neprihlásených).

const { PushSubscription } = require('../models');
const push = require('../utils/push.service');

// Malý asyncHandler, aby chyby padli do error middleware namiesto uviaznutia.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// GET /api/push/vapid-public-key
// Vráti verejný kľúč + príznak, či je push na serveri vôbec zapnutý.
const getVapidPublicKey = asyncHandler(async (req, res) => {
  const key = push.getPublicKey();
  res.json({ enabled: !!(key && push.isEnabled()), key: key || null });
});

// POST /api/push/subscribe  { endpoint, keys: { p256dh, auth } }
// Uloží subscription pre prihláseného. Idempotentné podľa endpointu — ak už
// existuje, prepíše kľúče a priradí aktuálnemu používateľovi (napr. keď sa na
// zariadení prihlási iný účet).
const subscribe = asyncHandler(async (req, res) => {
  const sub = req.body || {};
  const endpoint = sub.endpoint;
  const p256dh = sub.keys && sub.keys.p256dh;
  const auth = sub.keys && sub.keys.auth;

  if (!endpoint || !p256dh || !auth) {
    return res.status(400).json({ success: false, message: 'Neúplná subscription.' });
  }

  const userAgent = (req.headers['user-agent'] || '').slice(0, 255);

  const existing = await PushSubscription.findOne({ where: { endpoint } });
  if (existing) {
    existing.userId = req.session.userId;
    existing.p256dh = p256dh;
    existing.auth = auth;
    existing.userAgent = userAgent;
    await existing.save();
  } else {
    await PushSubscription.create({
      userId: req.session.userId,
      endpoint, p256dh, auth, userAgent,
    });
  }
  res.json({ success: true });
});

// POST /api/push/unsubscribe  { endpoint }
// Zmaže subscription podľa endpointu (len ak patrí prihlásenému používateľovi).
const unsubscribe = asyncHandler(async (req, res) => {
  const endpoint = req.body && req.body.endpoint;
  if (!endpoint) {
    return res.status(400).json({ success: false, message: 'Chýba endpoint.' });
  }
  await PushSubscription.destroy({ where: { endpoint, userId: req.session.userId } });
  res.json({ success: true });
});

module.exports = { getVapidPublicKey, subscribe, unsubscribe };
