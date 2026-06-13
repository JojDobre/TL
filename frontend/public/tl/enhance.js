/* =====================================================================
   TIPERLIGA — Modernizačné správanie (layout-safe)
   Scroll reveal · count-up · živý odpočet · scroll-progress ·
   spotlight glow. Defenzívne: ak čokoľvek zlyhá, obsah ostáva viditeľný.

   Režimy:
   • body[data-enhance="manual"]  → reveal/count-up len tam, kde sú
     explicitné triedy/atribúty (používa index.html, ktorý je doladený ručne).
   • inak (AUTO)                   → reveal a count-up sa nasadia automaticky
     na bežné obsahové bloky a štatistiky, bez úprav HTML každej stránky.
   ===================================================================== */
(function () {
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine   = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var MANUAL = document.body && document.body.getAttribute('data-enhance') === 'manual';

  // Skrytie reveal prvkov zapneme len keď beží JS (bez JS sa nič neschová)
  document.documentElement.classList.add('has-reveal');

  /* ---- AUTO: označ obsahové bloky triedou .reveal (so staggerom v skupine) */
  function autoTagReveal() {
    if (MANUAL) return;

    function bad(el) {
      return !el || el.nodeType !== 1 ||
        el.closest('.nav, .footer, .subnav, .dropdown, .tabbar, .device-overlay, .manage-block');
    }
    // tag one element; returns true if it became a reveal
    function tag(el) {
      if (bad(el)) return false;
      if (el.classList.contains('reveal')) return false;
      var pos = getComputedStyle(el).position;
      if (pos === 'sticky' || pos === 'fixed') return false;   // transform breaks sticky
      if (el.closest('.reveal')) return false;                  // no nested reveals
      // don't wrap a block that holds a sticky child — the transform would break it
      if (el.querySelector && el.querySelector('.sticky-side, [style*="position:sticky"], [style*="position: sticky"]')) return false;
      el.classList.add('reveal');
      return true;
    }
    function stagger(container) {
      if (bad(container)) return;
      [].slice.call(container.children).forEach(function (c, i) {
        if (tag(c) && !c.hasAttribute('data-delay')) c.setAttribute('data-delay', Math.min(i * 60, 240));
      });
    }

    // 1) staggered groups (grids, lists, badge/metric rows)
    document.querySelectorAll(
      '.grid-cards, .stack, .bento, .post-grid, .badge-grid, .metrics, .team-grid, .summary, .ac-summary, .values'
    ).forEach(stagger);

    // 2) standalone content blocks
    document.querySelectorAll(
      '.section-head, .match, .ev-match, .res-match, .se-block, .round-item, .ach, .empty, .auth-card'
    ).forEach(tag);

    // 3) catch-all: every top-level block inside a content host animates exactly
    //    once — guarantees consistent motion on pages the selectors above miss
    document.querySelectorAll('main, .wrap').forEach(function (host) {
      if (bad(host)) return;
      [].slice.call(host.children).forEach(function (c) {
        if (c.nodeType !== 1) return;
        if (c.classList.contains('reveal')) return;
        if (c.querySelector && c.querySelector('.reveal')) return; // already animates inside
        tag(c);
      });
    });
  }

  /* ---- 1 · scroll reveal ------------------------------------------- */
  function initReveal() {
    var els = [].slice.call(document.querySelectorAll('.reveal'));
    if (reduce || !('IntersectionObserver' in window)) {
      els.forEach(function (e) { e.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        var d = parseFloat(el.getAttribute('data-delay') || 0);
        setTimeout(function () { el.classList.add('in'); }, d);
        io.unobserve(el);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    var vh = window.innerHeight || document.documentElement.clientHeight;
    els.forEach(function (el) {
      var r = el.getBoundingClientRect();
      var inView = r.top < vh * 0.92 && r.bottom > 0;
      if (inView) {
        // nad záhybom: odhalíme spoľahlivo bez čakania na observer
        var d = parseFloat(el.getAttribute('data-delay') || 0);
        requestAnimationFrame(function () {
          setTimeout(function () { el.classList.add('in'); }, d);
        });
      } else {
        io.observe(el);
      }
    });

    // bezpečnostná poistka: nech obsah nikdy neostane skrytý
    setTimeout(function () {
      document.querySelectorAll('.reveal:not(.in)').forEach(function (el) {
        var r = el.getBoundingClientRect();
        var vh2 = window.innerHeight || document.documentElement.clientHeight;
        if (r.top < vh2 && r.bottom > 0) el.classList.add('in');
      });
    }, 1200);
  }

  /* ---- 2 · count-up ------------------------------------------------- */
  function fmt(n, dec, grp) {
    var s = n.toFixed(dec);
    if (grp) {
      var p = s.split('.');
      p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
      s = p.join('.');
    }
    return s;
  }
  function runCount(el, pre, target, suf, dec, grp) {
    if (reduce) { el.textContent = pre + fmt(target, dec, grp) + suf; return; }
    var dur = 1400, t0 = performance.now();
    function step(now) {
      var p = Math.min(1, (now - t0) / dur);
      var e = 1 - Math.pow(1 - p, 3); // easeOutCubic
      el.textContent = pre + fmt(target * e, dec, grp) + suf;
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = pre + fmt(target, dec, grp) + suf;
    }
    requestAnimationFrame(step);
  }
  function countFromAttr(el) {
    var raw = el.getAttribute('data-count');
    runCount(el,
      el.getAttribute('data-prefix') || '',
      parseFloat(raw),
      el.getAttribute('data-suffix') || '',
      (raw.split('.')[1] || '').length,
      el.getAttribute('data-group') === '1');
  }
  // parsuje napr. "14 280", "320+", "2.1M", "+10", "98%" → bezpečne, inak null
  function parseStat(txt) {
    var s = (txt || '').trim();
    var m = s.match(/^([#+]?)\s*(\d{1,3}(?:[\s\u00A0]\d{3})+|\d+(?:\.\d+)?)\s*([%+]|[MmKk]|×|x)?$/);
    if (!m) return null;
    var numRaw = m[2];
    var grouped = /[\s\u00A0]/.test(numRaw);
    var num = parseFloat(numRaw.replace(/[\s\u00A0]/g, ''));
    if (isNaN(num)) return null;
    var suf = m[3] || '';
    if (num < 10 && !suf) return null; // preskoč triviálne (#2, malé čísla)
    return { pre: m[1] || '', target: num, suf: suf,
             dec: (numRaw.split('.')[1] || '').length, grp: grouped ? 1 : 0 };
  }
  function autoCountCandidates() {
    if (MANUAL) return [];
    return [].slice.call(document.querySelectorAll('.stat-value, .hero-stat .n'))
      .filter(function (el) {
        if (el.childElementCount > 0) return false;
        if (el.closest('.nav, .footer, .subnav, .dropdown')) return false;
        var p = parseStat(el.textContent);
        if (!p) return false;
        el.__stat = p; return true;
      });
  }
  function initCount() {
    var attrEls = [].slice.call(document.querySelectorAll('[data-count]'));
    var autoEls = autoCountCandidates();
    var all = attrEls.concat(autoEls);
    if (!all.length) return;
    function fire(el) {
      if (el.hasAttribute('data-count')) countFromAttr(el);
      else { var p = el.__stat; runCount(el, p.pre, p.target, p.suf, p.dec, p.grp); }
    }
    if (!('IntersectionObserver' in window)) { all.forEach(fire); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { fire(en.target); io.unobserve(en.target); } });
    }, { threshold: 0.5 });
    all.forEach(function (e) { io.observe(e); });
  }

  /* ---- 4 · živý odpočet (HH:MM:SS) --------------------------------- */
  function initCountdown() {
    [].slice.call(document.querySelectorAll('[data-countdown]')).forEach(function (node) {
      var mins = parseFloat(node.getAttribute('data-countdown')) || 0;
      var end = Date.now() + mins * 60000;
      var boxes = node.querySelectorAll('.cd-num');
      function tick() {
        var s = Math.max(0, Math.floor((end - Date.now()) / 1000));
        var h = Math.floor(s / 3600); s -= h * 3600;
        var m = Math.floor(s / 60); var sec = s - m * 60;
        var v = [h, m, sec];
        for (var i = 0; i < boxes.length; i++) {
          if (v[i] != null) boxes[i].textContent = String(v[i]).padStart(2, '0');
        }
      }
      tick(); setInterval(tick, 1000);
    });
  }

  /* ---- 5 · scroll-progress prúžok ---------------------------------- */
  function initScrollProgress() {
    if (window.name === 'tl-device') return; // nie v rámčeku náhľadu
    var bar = document.createElement('div');
    bar.className = 'scroll-prog';
    document.body.appendChild(bar);
    var ticking = false;
    function update() {
      var h = document.documentElement;
      var max = (h.scrollHeight - h.clientHeight) || 1;
      bar.style.width = (Math.min(1, Math.max(0, h.scrollTop / max)) * 100) + '%';
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* ---- 6 · spotlight glow sledujúci kurzor (len desktop) ----------- */
  function initGlowFollow() {
    if (!fine) return;
    [].slice.call(document.querySelectorAll('.card-hover, .match, .how-step')).forEach(function (el) {
      if (el.closest('.nav, .footer, .subnav, .dropdown')) return;
      el.classList.add('glow-follow');
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
        el.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
      });
    });
  }

  function init() {
    autoTagReveal();
    initReveal(); initCount(); initCountdown(); initScrollProgress(); initGlowFollow();
  }
  window.TLenhance = init;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
