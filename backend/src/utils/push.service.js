// backend/src/utils/push.service.js
//
// Odosielanie Web Push notifikácií do prehliadačov/mobilov, ktoré si to zapli.
// Nadväzuje na in-app notifikácie: notification.service.js po vytvorení záznamov
// zavolá pushToUsers(...) s tým istým obsahom, takže push a zvonček sú v sync.
//
// Návrh je "fire-and-forget": žiadne zlyhanie push nesmie zhodiť hlavnú akciu
// (vytvorenie kola, vyhodnotenie). Neplatné subscription (410 Gone / 404) sa
// automaticky mažú z DB.
//
// Aktivácia: v .env musia byť VAPID kľúče. Bez nich sa push ticho preskočí
// (isEnabled() === false) — appka funguje ďalej, len bez push.

let webpush = null;
let configured = false;
let configTried = false;

// Lazy init web-push. web-push je závislosť, ktorá nemusí byť nainštalovaná
// v čase importu (napr. pri seedovaní) — preto ju načítavame opatrne.
function ensureConfigured() {
  if (configTried) return configured;
  configTried = true;
  try {
    const pub = process.env.VAPID_PUBLIC_KEY;
    const priv = process.env.VAPID_PRIVATE_KEY;
    if (!pub || !priv) {
      // VAPID nie je nastavený → push je vypnutý (nie je to chyba).
      return false;
    }
    // eslint-disable-next-line global-require
    webpush = require('web-push');
    const subject = process.env.VAPID_SUBJECT
      || (process.env.EMAIL_FROM && process.env.EMAIL_FROM.match(/<(.+)>/) ? 'mailto:' + process.env.EMAIL_FROM.match(/<(.+)>/)[1] : null)
      || 'mailto:podpora@tiperliga.sk';
    webpush.setVapidDetails(subject, pub, priv);
    configured = true;
  } catch (e) {
    console.error('[push] konfigurácia zlyhala:', e.message);
    configured = false;
  }
  return configured;
}

function isEnabled() {
  return ensureConfigured();
}

// Verejný VAPID kľúč pre klienta (subscribe flow). null ak push nie je zapnutý.
function getPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

// Odošle jednu push notifikáciu na jednu subscription. Pri 404/410 (subscription
// vypršala / bola odhlásená) záznam zmaže z DB. Ostatné chyby len zaloguje.
async function sendToSubscription(sub, payload) {
  if (!ensureConfigured()) return;
  const { PushSubscription } = require('../models');
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24 } // doručovať do 24 h
    );
  } catch (e) {
    const code = e && e.statusCode;
    if (code === 404 || code === 410) {
      // subscription je mŕtva → odstráň
      try { await PushSubscription.destroy({ where: { id: sub.id } }); } catch (_) { /* ignoruj */ }
    } else {
      console.error('[push] send zlyhalo (sub ' + sub.id + '):', e.message);
    }
  }
}

// Odošle push všetkým subscription daných používateľov. userIds je pole ID.
// Rešpektuje preferenciu notifyPush (a notifyInApp ako hlavný vypínač):
// ak má používateľ push vypnutý, jeho subscription preskočíme.
// title/body/url zodpovedajú in-app notifikácii.
async function pushToUsers(userIds, { title, body, url, tag } = {}) {
  try {
    if (!ensureConfigured()) return;
    const ids = [...new Set((userIds || []).map(Number).filter(Boolean))];
    if (!ids.length) return;

    const { PushSubscription, User, Sequelize } = require('../models');
    const { Op } = Sequelize;

    // vyfiltruj používateľov s vypnutým push (alebo vypnutými notifikáciami)
    const users = await User.findAll({
      where: { id: { [Op.in]: ids } },
      attributes: ['id', 'notifyInApp', 'notifyPush'],
    });
    const allowed = new Set(
      users
        .filter((u) => u.notifyInApp !== false && u.notifyPush !== false)
        .map((u) => u.id)
    );
    if (!allowed.size) return;

    const subs = await PushSubscription.findAll({
      where: { userId: { [Op.in]: [...allowed] } },
    });
    if (!subs.length) return;

    const payload = {
      title: title || 'tifo.sk',
      body: body || '',
      url: url || '/notifications',
      tag: tag || undefined,
    };

    // odošli paralelne, ale chyby jednotlivých pushov neprepadnú ďalej
    await Promise.all(subs.map((s) => sendToSubscription(s, payload)));
  } catch (e) {
    console.error('[push] pushToUsers zlyhalo:', e.message);
  }
}

module.exports = { isEnabled, getPublicKey, pushToUsers };
