/* =====================================================================
   TIFO.SK — PWA + Web Push (client)
   - Registruje service worker (/sw.js) → inštalovateľnosť + push
   - Prihláseným ponúkne zapnutie push notifikácií (nenásilný prompt)
   - Subscribe/unsubscribe cez /api/push/*
   - Vystavuje window.tifoPush { subscribe, unsubscribe, status } pre /settings
   ===================================================================== */
(function () {
  'use strict';

  // Push a Service Worker fungujú len cez HTTPS (alebo localhost).
  var SUPPORTED = ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window);

  // Je používateľ prihlásený? Zistíme z prítomnosti zvončeka (navbar ho renderuje
  // len prihláseným). Tým sa vyhneme registrácii push pre neprihlásených.
  function isLoggedIn() { return !!document.querySelector('[data-bell]'); }

  // ---- pomocník: base64url VAPID kľúč → Uint8Array ----
  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var raw = atob(base64);
    var out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  var swRegistration = null;

  // Zaregistruj service worker (aj pre neprihlásených — kvôli inštalovateľnosti/offline).
  function registerSW() {
    if (!('serviceWorker' in navigator)) return Promise.resolve(null);
    return navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(function (reg) { swRegistration = reg; return reg; })
      .catch(function (e) { /* SW nie je kritický */ return null; });
  }

  // Získa verejný VAPID kľúč zo servera. null ak push nie je na serveri zapnutý.
  function getVapidKey() {
    return fetch('/api/push/vapid-public-key', { headers: { 'Accept': 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { return (d && d.enabled && d.key) ? d.key : null; })
      .catch(function () { return null; });
  }

  // CSRF token pre POST na /api/push/* (server overuje mutujúce requesty).
  function csrfToken() {
    var m = document.querySelector('meta[name="csrf-token"]');
    return m ? m.getAttribute('content') : '';
  }

  function postJSON(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-CSRF-Token': csrfToken() },
      body: JSON.stringify(body || {}),
    });
  }

  // Vytvorí push subscription a pošle ju na server.
  function subscribe() {
    if (!SUPPORTED) return Promise.reject(new Error('Prehliadač nepodporuje notifikácie.'));
    return (swRegistration ? Promise.resolve(swRegistration) : registerSW())
      .then(function (reg) {
        if (!reg) throw new Error('Service worker sa nepodarilo zaregistrovať.');
        return getVapidKey().then(function (key) {
          if (!key) throw new Error('Push nie je na serveri nakonfigurovaný.');
          return reg.pushManager.getSubscription().then(function (existing) {
            if (existing) return existing;
            return reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(key),
            });
          });
        });
      })
      .then(function (sub) {
        return postJSON('/api/push/subscribe', sub.toJSON ? sub.toJSON() : sub).then(function () { return sub; });
      });
  }

  // Odhlási push (v prehliadači aj na serveri).
  function unsubscribe() {
    if (!swRegistration) {
      return navigator.serviceWorker.ready.then(function (reg) { swRegistration = reg; return doUnsub(); });
    }
    return doUnsub();
    function doUnsub() {
      return swRegistration.pushManager.getSubscription().then(function (sub) {
        if (!sub) return true;
        var endpoint = sub.endpoint;
        return sub.unsubscribe().then(function () {
          return postJSON('/api/push/unsubscribe', { endpoint: endpoint });
        }).then(function () { return true; });
      });
    }
  }

  // Aktuálny stav: podpora, povolenie, či je aktívna subscription.
  function status() {
    var base = { supported: SUPPORTED, permission: SUPPORTED ? Notification.permission : 'denied', subscribed: false };
    if (!SUPPORTED) return Promise.resolve(base);
    return navigator.serviceWorker.ready.then(function (reg) {
      swRegistration = reg;
      return reg.pushManager.getSubscription().then(function (sub) {
        base.subscribed = !!sub;
        return base;
      });
    }).catch(function () { return base; });
  }

  // ---- Nenásilný prompt pre prihlásených ----
  // Notification.requestPermission() MUSÍ byť volaný v reakcii na gesto používateľa
  // (klik) — inak ho prehliadače blokujú. Preto neukazujeme systémový dialóg hneď;
  // zobrazíme malý vlastný banner s tlačidlom „Zapnúť". Zamietnutie si pamätáme.
  var DISMISS_KEY = 'tifo-push-dismissed';

  function shouldOfferPrompt() {
    if (!SUPPORTED || !isLoggedIn()) return false;
    if (Notification.permission !== 'default') return false; // už rozhodol
    if (localStorage.getItem(DISMISS_KEY)) return false;      // banner zamietnutý
    return true;
  }

  function showPromptBanner() {
    if (document.querySelector('[data-push-banner]')) return;
    var bar = document.createElement('div');
    bar.setAttribute('data-push-banner', '');
    bar.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(env(safe-area-inset-bottom,0px) + 16px);z-index:1200;max-width:calc(100% - 24px);width:420px;display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:14px;background:var(--surface-2,#141a2b);border:1px solid var(--line,#26304a);box-shadow:0 12px 40px rgba(0,0,0,.35);color:var(--text-1,#eef2ff);font-size:14px';
    bar.innerHTML =
      '<span style="font-size:20px;line-height:1">🔔</span>' +
      '<span style="flex:1;line-height:1.35">Zapni si upozornenia na nové kolá, uzávierky a výsledky.</span>' +
      '<button data-push-enable style="border:none;border-radius:9px;padding:8px 12px;font-weight:700;cursor:pointer;background:var(--brand,#5b3fd6);color:#fff">Zapnúť</button>' +
      '<button data-push-dismiss aria-label="Zavrieť" style="border:none;background:none;color:var(--text-3,#93a1c4);font-size:20px;cursor:pointer;padding:2px 4px;line-height:1">×</button>';
    document.body.appendChild(bar);

    bar.querySelector('[data-push-enable]').addEventListener('click', function () {
      // požiadaj o systémové povolenie (v rámci gesta) a hneď subscribe
      Notification.requestPermission().then(function (perm) {
        if (perm === 'granted') {
          subscribe().catch(function () {});
        }
        // po rozhodnutí banner zavri (aj pri odmietnutí — nechceme otravovať)
        localStorage.setItem(DISMISS_KEY, '1');
        removeBanner();
      });
    });
    bar.querySelector('[data-push-dismiss]').addEventListener('click', function () {
      localStorage.setItem(DISMISS_KEY, '1');
      removeBanner();
    });

    function removeBanner() { if (bar && bar.parentNode) bar.parentNode.removeChild(bar); }
  }

  // Ak už používateľ povolenie udelil (napr. na inom zariadení kliknutím),
  // ale subscription na tomto zariadení chýba, ticho ju obnov.
  function ensureSubscribedIfGranted() {
    if (!SUPPORTED || !isLoggedIn()) return;
    if (Notification.permission !== 'granted') return;
    status().then(function (s) {
      if (!s.subscribed) subscribe().catch(function () {});
    });
  }

  // ---- init ----
  function init() {
    registerSW().then(function () {
      ensureSubscribedIfGranted();
      // banner ponúkni s malým oneskorením, nech neruší prvé vykreslenie
      if (shouldOfferPrompt()) {
        setTimeout(function () { if (shouldOfferPrompt()) showPromptBanner(); }, 4000);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // API pre /settings toggle
  window.tifoPush = { subscribe: subscribe, unsubscribe: unsubscribe, status: status };
})();
