/* =====================================================================
   TIFO.SK — Service Worker
   - Web Push: prijíma push správy a zobrazuje notifikácie
   - notificationclick: otvorí/zaostrí správnu URL
   - Inštalovateľnosť (PWA): minimálny offline fallback pre navigácie
   Scope: '/' (súbor je servovaný z /sw.js cez express.static)
   ===================================================================== */

const CACHE = 'tifo-shell-v3';

// Minimálny „app shell": statické assety, ktoré chceme mať k dispozícii aj
// offline. Zámerne malý zoznam — appka je server-rendered (EJS), takže offline
// nemá zmysel cachovať HTML stránky, len základnú kostru a ikony.
const SHELL = [
  '/offline.html',
  '/css/tokens.css',
  '/css/components.css',
  '/css/enhance.css',
  '/js/push.js',
  '/js/install.js',
  '/js/enhance.js',
  '/branding/identity/favicon-192.png',
  '/site.webmanifest',
];

// ---- INSTALL: predcachuj shell (chyby jednotlivých assetov neblokujú install) ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.allSettled(SHELL.map((u) => cache.add(u))))
      .then(() => self.skipWaiting())
  );
});

// ---- ACTIVATE: vyčisti staré verzie cache ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ---- FETCH ----
// Stratégia:
//   • statické assety (/css, /js, /branding) → cache-first (rýchlosť, offline)
//   • navigácie (HTML) → network-first, offline fallback na cachovaný / (ak je)
//   • API a všetko ostatné → nechaj prejsť na sieť (žiadne cachovanie)
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // cudzie domény nechaj tak

  // API nikdy necachuj
  if (url.pathname.startsWith('/api/')) return;

  const isAsset = /^\/(css|js|branding)\//.test(url.pathname)
    || url.pathname === '/site.webmanifest'
    || url.pathname === '/favicon.ico';

  if (isAsset) {
    event.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        // opportunisticky dopĺňaj cache
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => cached))
    );
    return;
  }

  // navigácie: network-first, offline fallback na peknú offline stránku
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(function () {
        return caches.match('/offline.html').then(function (off) {
          return off || caches.match('/') || Response.error();
        });
      })
    );
    return;
  }
});

// ---- PUSH: zobraz notifikáciu ----
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'tifo.sk', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'tifo.sk';
  const options = {
    body: data.body || '',
    icon: '/branding/identity/favicon-192.png',
    badge: '/branding/identity/favicon-192.png',
    tag: data.tag || undefined,        // rovnaký tag → notifikácia sa nahradí, nie zdvojí
    renotify: !!data.tag,
    data: { url: data.url || '/notifications' },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ---- NOTIFICATIONCLICK: otvor/zaostri správnu stránku ----
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/notifications';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // ak je už otvorené okno appky, presmeruj ho a zaostri
      for (const client of clientList) {
        try {
          const u = new URL(client.url);
          if (u.origin === self.location.origin && 'focus' in client) {
            client.navigate(target);
            return client.focus();
          }
        } catch (e) { /* ignoruj */ }
      }
      // inak otvor nové okno
      if (self.clients.openWindow) return self.clients.openWindow(target);
      return null;
    })
  );
});
