// frontend/src/template/createSeasonPage.js
//
// Vytvorenie sezóny — telo 1:1 zo šablóny + napojenie na createSeason.
//  - typ sezóny: sekcia sa zobrazí LEN adminovi; player/VIP tvoria vždy 'community'
//  - chybová hláška sa zobrazí NAD blokom "Základné údaje" (nie v gride)
//  - po úspechu presmeruje na detail novej sezóny

import React from 'react';
import TemplatePage from './TemplatePage';
import { createSeason } from '../services/seasonService';
import * as mCreateSeason from './html/create-season.html.js';

const CreateSeasonPage = () => {
  const onMount = (root, navigate) => {
    const form = root.querySelector('form');
    if (!form) return;
    form.onsubmit = null;
    form.setAttribute('onsubmit', 'return false');

    const isAdmin = localStorage.getItem('tl-role') === 'admin';
    const typeOpts = root.querySelectorAll('.type-opt[data-type]');

    // Sekcia "Typ sezóny" je karta obsahujúca tieto možnosti — pre neadminov ju skryjeme.
    const typeCard = typeOpts[0] ? typeOpts[0].closest('.form-card') : null;
    if (!isAdmin && typeCard) typeCard.style.display = 'none';

    // výber typu (len relevantné pre admina)
    typeOpts.forEach((opt) => {
      opt.addEventListener('click', (e) => {
        e.preventDefault();
        typeOpts.forEach((o) => o.classList.remove('sel'));
        opt.classList.add('sel');
        const radio = opt.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
      });
    });

    const selectedType = () => {
      if (!isAdmin) return 'community';            // player/VIP vždy community
      const opts = Array.from(typeOpts);
      const idx = opts.findIndex((o) => o.classList.contains('sel'));
      return idx === 1 ? 'community' : 'official';  // prvá = official, druhá = community
    };

    // Chybová hláška NAD prvou kartou (Základné údaje), mimo gridu form-layout
    function showError(msg) {
      const firstCard = form.querySelector('.form-card') || form.firstElementChild;
      let box = root.querySelector('[data-form-error]');
      if (!box) {
        box = document.createElement('div');
        box.setAttribute('data-form-error', '');
        box.className = 'tag tag-danger';
        box.style.cssText = 'display:block;padding:12px 14px;margin:0 0 16px;grid-column:1 / -1';
        // vložíme ako prvý prvok formulára, ale roztiahnutý cez celý grid (grid-column 1/-1)
        form.insertBefore(box, form.firstChild);
      }
      box.textContent = msg;
      box.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    function clearError() {
      const box = root.querySelector('[data-form-error]');
      if (box) box.remove();
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const handler = async (e) => {
      e.preventDefault();
      clearError();
      const name = (root.querySelector('#nm')?.value || '').trim();
      const description = (form.querySelector('textarea')?.value || '').trim();
      const type = selectedType();
      if (!name) { showError('Názov sezóny je povinný.'); return; }

      const orig = submitBtn ? submitBtn.textContent : '';
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Vytváram…'; }
      try {
        const created = await createSeason({ name, description, type });
        const id = created?.id;
        navigate(id ? '/seasons/' + id : '/seasons');
      } catch (err) {
        showError(err.response?.data?.message || 'Nepodarilo sa vytvoriť sezónu.');
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = orig; }
      }
    };
    if (submitBtn) submitBtn.addEventListener('click', handler);
    form.addEventListener('submit', handler);
  };

  return (
    <TemplatePage html={mCreateSeason.html} dataPage={mCreateSeason.dataPage} inlineScript={mCreateSeason.inlineScript} onMount={onMount} />
  );
};

export default CreateSeasonPage;