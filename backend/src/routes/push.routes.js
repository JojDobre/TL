// backend/src/routes/push.routes.js
//
// Web Push subscription endpointy pre prihláseného používateľa (session auth).
// Mountované v index.js na /api/push.

const express = require('express');
const { getVapidPublicKey, subscribe, unsubscribe } = require('../controllers/push.controller');
const { apiRequireLogin } = require('../middleware/page-auth.middleware');

const router = express.Router();

// Verejný VAPID kľúč potrebuje aj klient tesne pred prihlásením subscribe flow;
// necháme ho ale za apiRequireLogin, keďže push registrujeme len prihláseným.
router.get('/vapid-public-key', apiRequireLogin, getVapidPublicKey);
router.post('/subscribe', apiRequireLogin, subscribe);
router.post('/unsubscribe', apiRequireLogin, unsubscribe);

module.exports = router;
