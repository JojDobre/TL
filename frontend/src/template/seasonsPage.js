// frontend/src/template/seasonsPage.js
//
// Zoznam sezón — telo 1:1 zo šablóny + reálne dáta z getAllSeasons.
// Oficiálne sezóny (type='official') do mriežky g3, komunitné (type='community')
// do g4. Markup kariet je identický so šablónou.

import React from 'react';
import TemplatePage from './TemplatePage';
import { getAllSeasons } from '../services/seasonService';
import * as mSeasons from './html/seasons.html.js';

const GRADS = [
  '135deg,#0b4ea2,#1a1340', '135deg,#2b0a4a,#5b3fd6', '135deg,#0a3d2e,#15543a',
  '135deg,#7a1f06,#c2410c', '135deg,#1b3f72,#3a7bd5', '135deg,#522963,#8e44ad',
];
const gradFor = (id) => GRADS[(Number(id) || 0) % GRADS.length];
const esc = (s = '') => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// stav sezóny → tag vpravo hore
function statusTag(season) {
  if (season.active === false) return '<span class="tag tag-muted" style="position:absolute;top:12px;right:12px">Ukončená</span>';
  return '<span class="tag tag-live" style="position:absolute;top:12px;right:12px"><span class="dot"></span>Live</span>';
}

// oficiálna karta (mriežka g3)
function officialCard(s) {
  return '<a href="season.html" data-season-id="' + s.id + '" class="card card-hover" style="overflow:hidden">' +
    '<div class="season-cover" style="background:linear-gradient(' + gradFor(s.id) + ')">' +
      '<span class="tag tag-brand">Oficiálna</span>' + statusTag(s) +
    '</div>' +
    '<div class="card-pad">' +
      '<h4 style="margin-bottom:6px">' + esc(s.name) + '</h4>' +
      '<p class="muted" style="font-size:var(--fs-sm);margin-bottom:14px">' + esc(s.description || '') + '</p>' +
      '<div class="season-meta">' +
        '<span><b>' + (s.participantsCount ?? '—') + '</b> hráčov</span>' +
        '<span><b>' + (s.leaguesCount ?? '—') + '</b> líg</span>' +
        '<span><b>—</b> zápasov</span>' +
      '</div>' +
    '</div></a>';
}

// komunitná karta (mriežka g4)
function communityCard(s) {
  return '<a href="season.html" data-season-id="' + s.id + '" class="card card-hover" style="overflow:hidden">' +
    '<div class="season-cover" style="background:linear-gradient(' + gradFor(s.id) + ');height:88px">' +
      '<span class="tag tag-gold">Community</span>' +
    '</div>' +
    '<div class="card-pad">' +
      '<h4 style="font-size:var(--fs-h4);margin-bottom:4px">' + esc(s.name) + '</h4>' +
      '<p class="muted" style="font-size:var(--fs-xs);margin-bottom:12px">' + esc(s.description || '') + '</p>' +
      '<div class="row between">' +
        '<span class="season-meta"><b>' + (s.participantsCount ?? '—') + '</b> hráčov</span>' +
        '<span class="tag tag-muted">Verejná</span>' +
      '</div>' +
    '</div></a>';
}

const SeasonsPage = () => {
  const onMount = (root, navigate) => {
    const grids = root.querySelectorAll('.grid-cards');
    const officialGrid = root.querySelector('.grid-cards.g3') || grids[0];
    const communityGrid = root.querySelector('.grid-cards.g4') || grids[1];

    // OKAMŽITE vyprázdnime šablónové ukážkové karty (inak preblikne mock pred DB dátami)
    if (officialGrid) officialGrid.innerHTML = '<p class="muted" style="grid-column:1/-1">Načítavam sezóny…</p>';
    if (communityGrid) communityGrid.innerHTML = '';

    // klik na kartu → detail sezóny cez React router (data-season-id)
    root.addEventListener('click', (e) => {
      const card = e.target.closest('[data-season-id]');
      if (card) { e.preventDefault(); e.stopPropagation(); navigate('/seasons/' + card.getAttribute('data-season-id')); }
    });

    (async () => {
      try {
        const seasons = await getAllSeasons();
        const list = Array.isArray(seasons) ? seasons : [];
        const official = list.filter((s) => s.type === 'official');
        const community = list.filter((s) => s.type === 'community');

        if (officialGrid) {
          officialGrid.innerHTML = official.length
            ? official.map(officialCard).join('')
            : '<p class="muted">Zatiaľ tu nie sú žiadne oficiálne sezóny.</p>';
        }
        if (communityGrid) {
          communityGrid.innerHTML = community.length
            ? community.map(communityCard).join('')
            : '<p class="muted">Zatiaľ tu nie sú žiadne komunitné sezóny.</p>';
        }
      } catch (e) {
        if (officialGrid) officialGrid.innerHTML = '<p class="muted">Nepodarilo sa načítať sezóny.</p>';
      }
    })();
  };

  return (
    <TemplatePage html={mSeasons.html} dataPage={mSeasons.dataPage} inlineScript={mSeasons.inlineScript} onMount={onMount} />
  );
};

export default SeasonsPage;