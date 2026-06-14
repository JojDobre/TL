// frontend/src/template/TemplatePage.js
//
// Prenáša CELÉ telo stránky zo šablóny 1:1 — vrátane navbaru (data-shell-nav),
// subnavu, footera a per-page inline skriptov. Navbar/footer/graf si generuje
// pôvodný shell.js / enhance.js / inline script presne ako v šablóne.
//
// Postup:
//  1. vloží HTML telo (so shell markermi) cez dangerouslySetInnerHTML
//  2. zabezpečí, že shell.js a enhance.js sú načítané (raz)
//  3. zavolá window.TL.setPage(dataPage) → vygeneruje navbar/subnav/footer
//  4. zavolá window.TLenhance() → animácie/countdown
//  5. spustí per-page inline skript (graf, rozbaľovanie...)
//  6. zachytí kliknutia na interné odkazy pre SPA navigáciu

import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

const HREF_MAP = {
  'index.html': '/', 'seasons.html': '/seasons', 'season.html': '/seasons',
  'league.html': '/leagues/1', 'round.html': '/rounds/1', 'round-results.html': '/rounds/1',
  'create-season.html': '/seasons/create', 'create-league.html': '/leagues/create',
  'create-round.html': '/rounds/create', 'create-matches.html': '/matches/create', 'create-team.html': '/teams/create',
  'login.html': '/login', 'register.html': '/register', 'forgot-password.html': '/forgot-password',
  'profile.html': '/profile', 'settings.html': '/settings',
  'my.html': '/my', 'tip-history.html': '/tip-history', 'stats.html': '/stats',
  'achievements.html': '/achievements', 'notifications.html': '/notifications',
  'discover.html': '/discover', 'join.html': '/join', 'leave-competition.html': '/leave',
  'player.html': '/player/1', 'compare.html': '/compare',
  'leaderboards.html': '/leaderboards', 'blog.html': '/blog', 'blog-post.html': '/blog/1',
  'about.html': '/about', 'kontakt.html': '/kontakt',
  'admin.html': '/admin', 'admin-users.html': '/admin/users', 'admin-leagues.html': '/admin/leagues',
  'admin-competition.html': '/admin/competition', 'admin-evaluate.html': '/admin/evaluate',
  '404.html': '/404', 'error.html': '/error',
};

// Načíta skript raz (vráti Promise). Pri opakovanom volaní nič nerobí.
const loaded = {};
function loadScript(src) {
  if (loaded[src]) return loaded[src];
  loaded[src] = new Promise((resolve) => {
    const existing = document.querySelector(`script[data-tl="${src}"]`);
    if (existing) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.setAttribute('data-tl', src);
    s.onload = () => resolve();
    document.body.appendChild(s);
  });
  return loaded[src];
}

const TemplatePage = ({ html, dataPage, inlineScript, onMount }) => {
  const ref = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let disposed = false;

    (async () => {
      // 1+2. načítaj shell.js a enhance.js (raz)
      await loadScript('/tl/shell.js');
      await loadScript('/tl/enhance.js');
      if (disposed) return;

      // 3. vygeneruj navbar/subnav/footer pre túto stránku
      if (window.TL && typeof window.TL.setPage === 'function') {
        window.TL.setPage(dataPage || '');
      }
      // 4. animácie/countdown
      if (typeof window.TLenhance === 'function') window.TLenhance();

      // 5. per-page inline skript (graf, rozbaľovanie atď.)
      if (inlineScript) {
        try {
          // eslint-disable-next-line no-new-func
          const run = new Function(inlineScript);
          run();
        } catch (e) { console.warn('Inline skript stránky zlyhal:', e); }
      }

      // 6. voliteľný hook na napojenie dát z backendu
      if (typeof onMount === 'function') onMount(root, navigate);
    })();

    // SPA navigácia pre interné odkazy v tele (vrátane navbaru, ktorý je v tele)
    const onClick = (e) => {
      const a = e.target.closest('a');
      if (!a) return;
      const raw = a.getAttribute('href');
      if (!raw || raw.startsWith('#') || raw.startsWith('mailto') || raw.startsWith('tel')) return;
      // odlúpni doménu aj prípadné /cesty, nechaj len názov súboru (napr. admin-users.html)
      let clean = raw.replace(/^https?:\/\/[^/]+/, '').replace(/^\.?\//, '');
      // ak je to plná cesta typu /admin-users.html, vezmi posledný segment
      const file = clean.split('/').pop();
      const target = HREF_MAP[clean] || HREF_MAP[file];
      if (!target) return; // necháme prehliadač / iné odkazy tak
      e.preventDefault();
      e.stopPropagation();
      if (target === window.location.pathname) {
        // klik na stránku, na ktorej už sme → znovu spusti shell + obsah
        if (window.TL && window.TL.setPage) window.TL.setPage(dataPage || '');
        if (window.TLenhance) window.TLenhance();
      } else {
        navigate(target);
      }
    };
    document.addEventListener('click', onClick);

    return () => {
      disposed = true;
      document.removeEventListener('click', onClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html, dataPage, inlineScript]);

  return <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />;
};

export default TemplatePage;