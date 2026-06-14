// frontend/src/template/authPages.js
//
// Login a Register: prenesené telo zo šablóny (1:1) + napojenie formulárov na
// AuthContext. Markup sa NEMENÍ — len prepíšeme správanie odoslania formulára.
//
// Princíp: TemplatePage vykreslí HTML, onMount nájde formulár a polia podľa ich
// poradia/typu (šablóna nemá id/name) a pri submit zavolá login()/register().

import React from 'react';
import { useNavigate } from 'react-router-dom';
import TemplatePage from './TemplatePage';
import { useAuth } from '../contexts/AuthContext';
import * as mLogin from './html/login.html.js';
import * as mRegister from './html/register.html.js';

// Pomocník: zobrazí inline chybovú hlášku nad submit tlačidlom
function showError(form, msg) {
  let box = form.querySelector('[data-auth-error]');
  if (!box) {
    box = document.createElement('div');
    box.setAttribute('data-auth-error', '');
    box.className = 'tag tag-danger';
    box.style.cssText = 'display:block;padding:10px 12px;margin-bottom:14px';
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) form.insertBefore(box, submitBtn);
    else form.appendChild(box);
  }
  box.textContent = msg;
}

export const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  const onMount = (root) => {
    const form = root.querySelector('form');
    if (!form) return;
    // odstránime pôvodný inline onsubmit (ktorý presmeroval na index.html)
    form.onsubmit = null;
    form.setAttribute('onsubmit', 'return false');

    const handler = async (e) => {
      e.preventDefault();
      const email = form.querySelector('input[type="text"], input[type="email"]')?.value?.trim();
      const password = form.querySelector('input[type="password"]')?.value;
      if (!email || !password) { showError(form, 'Vyplň e-mail aj heslo.'); return; }

      const btn = form.querySelector('button[type="submit"]');
      const orig = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Prihlasujem…'; }

      const res = await login(email, password);
      if (res.success) {
        navigate('/');
      } else {
        showError(form, res.message || 'Prihlásenie zlyhalo.');
        if (btn) { btn.disabled = false; btn.textContent = orig; }
      }
    };
    form.addEventListener('submit', handler);
    return () => form.removeEventListener('submit', handler);
  };

  return <TemplatePage html={mLogin.html} dataPage={mLogin.dataPage} inlineScript={mLogin.inlineScript} onMount={onMount} />;
};

export const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();

  const onMount = (root) => {
    const form = root.querySelector('form');
    if (!form) return;
    form.onsubmit = null;
    form.setAttribute('onsubmit', 'return false');

    const handler = async (e) => {
      e.preventDefault();
      // polia v poradí podľa šablóny: Meno, Priezvisko, Prezývka, E-mail, Heslo
      const inputs = form.querySelectorAll('input.input');
      const firstName = inputs[0]?.value?.trim();
      const lastName = inputs[1]?.value?.trim();
      const username = inputs[2]?.value?.trim();
      const email = form.querySelector('input[type="email"]')?.value?.trim();
      const password = form.querySelector('input[type="password"]')?.value;
      const agree = form.querySelector('input[type="checkbox"]')?.checked;

      if (!username || !email || !password) { showError(form, 'Vyplň prezývku, e-mail aj heslo.'); return; }
      if (!agree) { showError(form, 'Musíš súhlasiť s podmienkami.'); return; }

      const btn = form.querySelector('button[type="submit"]');
      const orig = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Vytváram…'; }

      const res = await register({ firstName, lastName, username, email, password });
      if (res.success) {
        navigate('/');
      } else {
        showError(form, res.message || 'Registrácia zlyhala.');
        if (btn) { btn.disabled = false; btn.textContent = orig; }
      }
    };
    form.addEventListener('submit', handler);
    return () => form.removeEventListener('submit', handler);
  };

  return <TemplatePage html={mRegister.html} dataPage={mRegister.dataPage} inlineScript={mRegister.inlineScript} onMount={onMount} />;
};