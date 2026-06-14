// frontend/src/template/seasonDetailPage.js
//
// Detail sezóny — telo 1:1 zo šablóny + reálne dáta.
// Napojené: hlavička (názov, popis, počty), súhrnný rebríček, pripojenie cez ID.
// Ligy a aktuality sa napoja v ďalšom kroku (league backend) — zatiaľ ostáva
// markup zo šablóny.

import React from 'react';
import { useParams } from 'react-router-dom';
import TemplatePage from './TemplatePage';
import { getSeasonById, getSeasonLeaderboard, joinSeason } from '../services/seasonService';
import * as mSeason from './html/season.html.js';

const GRADS = [
  '135deg,#7c5cff,#5b3fd6', '135deg,#3a7bd5,#1b3f72', '135deg,#e0935a,#a45c28',
  '135deg,#16a085,#0c5f4d', '135deg,#d35400,#8a3700', '135deg,#8e44ad,#522963',
];
const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const initials = (row) => {
  const n = [row.firstName, row.lastName].filter(Boolean).join(' ') || row.username || '?';
  return n.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
};
const displayName = (row) => row.firstName ? (row.firstName + ' ' + (row.lastName ? row.lastName[0] + '.' : '')).trim() : (row.username || 'Hráč');

function lbRow(entry, i) {
  const u = entry.user || entry;
  const rankCls = i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : '';
  const grad = i === 0 ? '135deg,var(--gold-bright),var(--gold-dim)' : GRADS[i % GRADS.length];
  const color = i === 0 ? 'var(--gold-ink)' : '#fff';
  const ptsCls = i === 0 ? 'lb-pts gold' : 'lb-pts';
  return '<div class="lb-row"><span class="lb-rank ' + rankCls + '">' + (i + 1) + '</span>' +
    '<div class="lb-user"><span class="avatar avatar-sm" style="background:linear-gradient(' + grad + ');color:' + color + '">' + esc(initials(u)) + '</span>' +
    '<span class="lb-name">' + esc(displayName(u)) + '</span></div>' +
    '<span class="' + ptsCls + '">' + (entry.totalPoints ?? 0) + '</span></div>';
}

const SeasonDetailPage = () => {
  const { id } = useParams();

  const onMount = (root, navigate) => {
    // klik na ligu → detail ligy (zatiaľ markup zo šablóny vedie na league.html)
    root.addEventListener('click', (e) => {
      const open = e.target.closest('[data-open-join]');
      const close = e.target.closest('[data-close-join]');
      const dialog = root.querySelector('[data-join]');
      if (open && dialog) { e.preventDefault(); dialog.removeAttribute('hidden'); return; }
      if (close && dialog) { e.preventDefault(); dialog.setAttribute('hidden', ''); return; }
    });

    // pripojenie cez ID v dialógu
    const dialog = root.querySelector('[data-join]');
    if (dialog) {
      const joinBtn = Array.from(dialog.querySelectorAll('button')).find((b) => /Pripojiť/i.test(b.textContent));
      const codeInput = dialog.querySelector('input');
      if (joinBtn && codeInput) {
        joinBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          const code = (codeInput.value || '').trim();
          if (!code) return;
          try {
            await joinSeason(code);
            dialog.setAttribute('hidden', '');
            navigate('/my');
          } catch (err) {
            alert(err.response?.data?.message || 'Pripojenie zlyhalo.');
          }
        });
      }
    }

    (async () => {
      try {
        const season = await getSeasonById(id);
        if (season) {
          const h1 = root.querySelector('header h1');
          if (h1) h1.textContent = season.name || '';
          const desc = root.querySelector('header h1 + p.muted, header p.muted');
          if (desc && season.description) desc.textContent = season.description;
          // počty v sh-meta: [hráči, kolá, zápasy, ligy]
          const metaNums = root.querySelectorAll('.sh-meta .n');
          if (metaNums[0]) metaNums[0].textContent = season.participantsCount ?? '—';
          if (metaNums[3]) metaNums[3].textContent = season.leaguesCount ?? (season.leagues?.length ?? '—');
          // subnav názov sezóny
          const subnav = document.querySelector('[data-season-name]');
          if (subnav) subnav.setAttribute('data-season-name', season.name || '');
        }
      } catch (e) { /* hlavička ostane zo šablóny */ }

      try {
        const lb = await getSeasonLeaderboard(id);
        const rows = Array.isArray(lb) ? lb : [];
        // nájdeme rebríčkový kontajner v sidebare (prvý blok s .lb-row)
        const firstRow = root.querySelector('.lb-row');
        const container = firstRow ? firstRow.parentElement : null;
        if (container) {
          container.innerHTML = rows.length
            ? rows.slice(0, 8).map((entry, i) => lbRow(entry, i)).join('')
            : '<p class="muted" style="font-size:var(--fs-sm)">Rebríček je zatiaľ prázdny.</p>';
        }
      } catch (e) { /* rebríček ostane zo šablóny */ }
    })();
  };

  return (
    <TemplatePage html={mSeason.html} dataPage={mSeason.dataPage} inlineScript={mSeason.inlineScript} onMount={onMount} />
  );
};

export default SeasonDetailPage;
