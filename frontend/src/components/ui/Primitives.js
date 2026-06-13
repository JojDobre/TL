// frontend/src/components/ui/Primitives.js
//
// Základné UI komponenty postavené nad components.css zo šablóny.
// Filozofia: tenké React wrappery, ktoré vykresľujú správne CSS triedy.
// Vďaka tomu je dizajn 1:1 so šablónou a komponenty sa ľahko používajú.
//
// Vyžaduje, aby bol v projekte importnutý components.css (viď _NAVOD).

import React from 'react';

// Pomocník na spájanie tried (preskočí prázdne/false hodnoty)
const cx = (...parts) => parts.filter(Boolean).join(' ');

/* ============ BUTTON ============
   variant: 'primary' (gold) | 'brand' (violet) | 'secondary' | 'ghost' | 'danger'
   size:    'sm' | 'lg' | undefined (default)
   block:   true → plná šírka
   icon:    true → štvorcové ikonové tlačidlo */
export const Btn = ({
  variant = 'secondary',
  size,
  block,
  icon,
  className,
  children,
  ...rest
}) => (
  <button
    className={cx(
      'btn',
      `btn-${variant}`,
      size && `btn-${size}`,
      block && 'btn-block',
      icon && 'btn-icon',
      className
    )}
    {...rest}
  >
    {children}
  </button>
);

/* ============ CARD ============
   pad:    true → vnútorné odsadenie
   hover:  true → hover zdvih
   glow:   true → brand glow
   accent: true → horný gradient prúžok */
export const Card = ({ pad, hover, glow, accent, className, children, ...rest }) => (
  <div
    className={cx(
      'card',
      pad && 'card-pad',
      hover && 'card-hover',
      glow && 'card-glow',
      accent && 'card-accent',
      className
    )}
    {...rest}
  >
    {children}
  </div>
);

/* ============ TAG / STATUS ============
   tone: 'brand'|'gold'|'success'|'warning'|'danger'|'info'|'muted'|'live'
   dot:  true → bodka pred textom (živý stav animuje) */
export const Tag = ({ tone = 'muted', dot, className, children, ...rest }) => (
  <span className={cx('tag', `tag-${tone}`, className)} {...rest}>
    {dot && <span className="dot" />}
    {children}
  </span>
);

// Mapovanie stavu zápasu na vzhľad štítku — jednotné v celej appke
const MATCH_STATUS = {
  scheduled: { tone: 'info', label: 'Naplánovaný' },
  in_progress: { tone: 'live', label: 'Prebieha', dot: true },
  finished: { tone: 'success', label: 'Ukončený' },
  canceled: { tone: 'danger', label: 'Zrušený' },
};
export const MatchStatusTag = ({ status }) => {
  const s = MATCH_STATUS[status] || MATCH_STATUS.scheduled;
  return <Tag tone={s.tone} dot={s.dot}>{s.label}</Tag>;
};

/* ============ ROLE CHIP ============
   role: 'admin' | 'vip' | 'player' */
const ROLE_LABEL = { admin: 'Admin', vip: 'VIP', player: 'Hráč' };
export const RoleChip = ({ role = 'player', className }) => (
  <span className={cx('chip-role', `role-${role}`, className)}>
    {ROLE_LABEL[role] || role}
  </span>
);

/* ============ AVATAR ============
   size: 'sm'|'md'|'lg'|'xl'  | src: obrázok | name: iniciály ak nie je obrázok */
export const Avatar = ({ size = 'md', src, name = '', ring, className }) => {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <span className={cx('avatar', `avatar-${size}`, ring && 'avatar-ring', className)}>
      {src ? <img src={src} alt={name} /> : initials}
    </span>
  );
};

/* ============ POINTS PILL ============
   tone: undefined (brand) | 'zero' | 'max' (presný výsledok) */
export const PtsPill = ({ value, tone, className }) => (
  <span className={cx('pts-pill', tone, className)}>
    {value} b
  </span>
);
