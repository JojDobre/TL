/* =====================================================================
   TIFO.SK — Inštalácia appky (PWA)
   - Android/Chrome: odchytí beforeinstallprompt → vlastné tlačidlo „Nainštalovať"
   - iOS/Safari: natívny prompt neexistuje → zobrazí návod „Pridať na plochu"
   - Standalone: keď appka už beží nainštalovaná, nič neponúka + pridá triedu
   Vystavuje window.tifoInstall = { available, promptInstall, isStandalone }
   ===================================================================== */
(function () {
  'use strict';

  var DISMISS_KEY = 'tifo-install-dismissed';
  var deferredPrompt = null;

  // ---- detekcie ----
  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
      || window.navigator.standalone === true; // iOS
  }
  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent)
      // iPadOS 13+ sa hlási ako Mac s dotykom
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function isSafari() {
    var ua = navigator.userAgent;
    return /safari/i.test(ua) && !/crios|fxios|edgios|chrome|android/i.test(ua);
  }
  function dismissed() { return !!localStorage.getItem(DISMISS_KEY); }
  function markDismissed() { try { localStorage.setItem(DISMISS_KEY, '1'); } catch (e) {} }

  // ---- keď appka beží ako nainštalovaná: pridaj triedu na <html> ----
  // (CSS môže napr. pridať safe-area padding, skryť „nainštaluj" prvky)
  if (isStandalone()) {
    document.documentElement.classList.add('is-standalone');
  }

  // ---- spoločný banner ----
  function buildBanner(innerHTML) {
    if (document.querySelector('[data-install-banner]')) return null;
    var bar = document.createElement('div');
    bar.setAttribute('data-install-banner', '');
    bar.style.cssText = [
      'position:fixed', 'left:50%', 'transform:translateX(-50%)',
      // nad mobilným tabbarom (ten býva ~64px) + safe area
      'bottom:calc(env(safe-area-inset-bottom,0px) + 76px)',
      'z-index:1250', 'max-width:calc(100% - 24px)', 'width:440px',
      'display:flex', 'align-items:center', 'gap:12px',
      'padding:12px 14px', 'border-radius:16px',
      'background:var(--surface-2,#192135)', 'border:1px solid var(--line-strong,rgba(150,165,215,.22))',
      'box-shadow:0 16px 48px rgba(0,0,0,.45)', 'color:var(--text-1,#eef1f9)',
      'font-size:14px', 'line-height:1.4',
      'animation:tifoInstallIn .32s cubic-bezier(.2,.8,.2,1)',
    ].join(';');
    bar.innerHTML = innerHTML;
    document.body.appendChild(bar);
    return bar;
  }

  function removeBanner() {
    var b = document.querySelector('[data-install-banner]');
    if (b && b.parentNode) b.parentNode.removeChild(b);
  }

  // malý mascot/ikonka do bannera
  var ICON = '<img src="/branding/identity/favicon-192.png" alt="" style="width:40px;height:40px;border-radius:10px;flex:none">';

  // ---- Android/Chrome: vlastné tlačidlo ----
  function showAndroidBanner() {
    var bar = buildBanner(
      ICON +
      '<div style="flex:1"><b style="display:block">Nainštaluj si tifo.sk</b>' +
      '<span style="color:var(--text-3,#828caa);font-size:13px">Appka na ploche, rýchlejšie a s notifikáciami.</span></div>' +
      '<button data-install-go style="border:none;border-radius:10px;padding:9px 14px;font-weight:800;cursor:pointer;background:var(--gold,#facc15);color:var(--gold-ink,#1c1605)">Nainštalovať</button>' +
      '<button data-install-x aria-label="Zavrieť" style="border:none;background:none;color:var(--text-3,#828caa);font-size:22px;cursor:pointer;padding:0 4px;line-height:1">×</button>'
    );
    if (!bar) return;
    bar.querySelector('[data-install-go]').addEventListener('click', function () {
      promptInstall();
    });
    bar.querySelector('[data-install-x]').addEventListener('click', function () {
      markDismissed(); removeBanner();
    });
  }

  // Vyvolá natívny inštalačný dialóg (Android). Vracia Promise.
  function promptInstall() {
    if (!deferredPrompt) return Promise.resolve(false);
    var dp = deferredPrompt;
    deferredPrompt = null;
    dp.prompt();
    return dp.userChoice.then(function (choice) {
      removeBanner();
      if (choice && choice.outcome === 'accepted') {
        markDismissed(); // nainštalované → už neponúkaj
        return true;
      }
      // odmietnuté — necháme možnosť znova (nemarkujeme natrvalo),
      // ale banner sme zavreli
      return false;
    }).catch(function () { removeBanner(); return false; });
  }

  // ---- iOS/Safari: návod (natívny prompt neexistuje) ----
  function showIOSGuide() {
    // ikonka „share" (obdĺžnik so šípkou hore) — iOS Zdieľať
    var share = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px"><path d="M12 16V4M8 8l4-4 4 4"/><path d="M20 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-5"/></svg>';
    var bar = buildBanner(
      ICON +
      '<div style="flex:1"><b style="display:block">Pridaj si tifo.sk na plochu</b>' +
      '<span style="color:var(--text-3,#828caa);font-size:13px">Ťukni na ' + share + ' <b>Zdieľať</b> a zvoľ <b>„Pridať na plochu"</b>.</span></div>' +
      '<button data-install-x aria-label="Zavrieť" style="border:none;background:none;color:var(--text-3,#828caa);font-size:22px;cursor:pointer;padding:0 4px;line-height:1">×</button>'
    );
    if (!bar) return;
    bar.querySelector('[data-install-x]').addEventListener('click', function () {
      markDismissed(); removeBanner();
    });
  }

  // ---- Android event: prehliadač signalizuje inštalovateľnosť ----
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();       // potlač default mini-infobar
    deferredPrompt = e;       // ulož na neskôr (musí sa spustiť z gesta)
    if (isStandalone() || dismissed()) return;
    // ponúkni s malým oneskorením, nech to neruší prvé vykreslenie
    setTimeout(function () {
      if (!isStandalone() && !dismissed() && deferredPrompt) showAndroidBanner();
    }, 3500);
  });

  // ---- po úspešnej inštalácii ----
  window.addEventListener('appinstalled', function () {
    markDismissed();
    removeBanner();
    deferredPrompt = null;
  });

  // ---- iOS init (žiadny beforeinstallprompt sa nespustí) ----
  function init() {
    // keyframe pre vstup bannera (raz)
    if (!document.getElementById('tifo-install-kf')) {
      var st = document.createElement('style');
      st.id = 'tifo-install-kf';
      st.textContent = '@keyframes tifoInstallIn{from{opacity:0;transform:translate(-50%,12px)}to{opacity:1;transform:translate(-50%,0)}}';
      document.head.appendChild(st);
    }
    if (isStandalone() || dismissed()) return;
    if (isIOS() && isSafari()) {
      setTimeout(function () {
        if (!isStandalone() && !dismissed()) showIOSGuide();
      }, 4000);
    }
    // Android sa rieši cez beforeinstallprompt vyššie.
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.tifoInstall = {
    isStandalone: isStandalone,
    available: function () { return !!deferredPrompt || (isIOS() && isSafari() && !isStandalone()); },
    promptInstall: promptInstall,
  };
})();
