// frontend/src/components/ui/Feedback.js
//
// Komponenty pre spätnú väzbu a stavy: dialóg, toast, skeleton, prázdny stav,
// progres, countdown. Postavené nad components.css.

import React, { createContext, useContext, useState, useCallback } from 'react';

const cx = (...parts) => parts.filter(Boolean).join(' ');

/* ============ DIALOG / MODAL ============
   open, onClose, title + children (telo).
   Klik na pozadie (scrim) zatvára. */
export const Dialog = ({ open, onClose, title, children, maxWidth }) => {
  if (!open) return null;
  return (
    <div className="scrim" onClick={onClose}>
      <div
        className="dialog"
        style={maxWidth ? { maxWidth } : undefined}
        onClick={(e) => e.stopPropagation()}  // klik vnútri nezatvára
        role="dialog"
        aria-modal="true"
      >
        {title && <h3 className="dialog-title">{title}</h3>}
        {children}
      </div>
    </div>
  );
};

/* ============ SKELETON ============
   Placeholder počas načítavania. Rozmery cez style/props. */
export const Skeleton = ({ width, height = 16, radius, className, style }) => (
  <div
    className={cx('skel', className)}
    style={{ width, height, borderRadius: radius, ...style }}
  />
);

/* ============ EMPTY STATE ============
   icon, title, message + voliteľná akcia (children). */
export const EmptyState = ({ icon, title, message, children }) => (
  <div className="empty">
    {icon && <div className="empty-icon">{icon}</div>}
    {title && <h4>{title}</h4>}
    {message && <p>{message}</p>}
    {children}
  </div>
);

/* ============ PROGRESS ============
   value 0–100. tone: undefined (brand) | 'gold' | 'success'. */
export const Progress = ({ value = 0, tone, className }) => (
  <div className={cx('progress', tone, className)}>
    <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
  </div>
);

/* ============ TOAST SYSTEM ============
   Použitie:
     1) Obal appku do <ToastProvider> (v App.js, vnútri ThemeProvider).
     2) V komponente: const toast = useToast(); toast.success('Uložené');
*/
const ToastCtx = createContext(null);

export const useToast = () => {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast musí byť vnútri <ToastProvider>');
  return ctx;
};

let toastId = 0;

export const ToastProvider = ({ children }) => {
  const [items, setItems] = useState([]);

  const remove = useCallback((id) => {
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((tone, title, msg, ttl = 4000) => {
    const id = ++toastId;
    setItems((list) => [...list, { id, tone, title, msg }]);
    if (ttl) setTimeout(() => remove(id), ttl);
  }, [remove]);

  // Skratky pre jednotlivé typy
  const api = {
    show: (title, msg) => push(null, title, msg),
    success: (title, msg) => push('success', title, msg),
    warning: (title, msg) => push('warning', title, msg),
    danger: (title, msg) => push('danger', title, msg),
  };

  return (
    <ToastCtx.Provider value={api}>
      {children}
      {/* Kontajner toastov vpravo dole */}
      <div
        style={{
          position: 'fixed',
          right: 20,
          bottom: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          zIndex: 200,
        }}
      >
        {items.map((t) => (
          <div key={t.id} className={cx('toast', t.tone)} onClick={() => remove(t.id)}>
            <div className="toast-body" style={{ flex: 1 }}>
              {t.title && <div className="toast-title">{t.title}</div>}
              {t.msg && <div className="toast-msg">{t.msg}</div>}
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
};
