// frontend/src/components/ui/Form.js
//
// Formulárové komponenty nad components.css. Konzistentné s dizajnom šablóny.

import React from 'react';

const cx = (...parts) => parts.filter(Boolean).join(' ');

/* Pole s labelom a hintom — obal okolo inputu/selectu/textarey.
   Použitie:
     <Field label="E-mail" hint="Nezdieľame ho">
       <Input type="email" .../>
     </Field> */
export const Field = ({ label, hint, htmlFor, children, className }) => (
  <div className={cx('field', className)}>
    {label && <label className="label" htmlFor={htmlFor}>{label}</label>}
    {children}
    {hint && <span className="hint">{hint}</span>}
  </div>
);

export const Input = ({ className, ...rest }) => (
  <input className={cx('input', className)} {...rest} />
);

export const Textarea = ({ className, ...rest }) => (
  <textarea className={cx('textarea', className)} {...rest} />
);

export const Select = ({ className, children, ...rest }) => (
  <select className={cx('select', className)} {...rest}>
    {children}
  </select>
);

// Input s ikonou vľavo (napr. lupa pri vyhľadávaní)
export const InputIcon = ({ icon, className, ...rest }) => (
  <div className={cx('input-icon', className)}>
    {icon}
    <input className="input" {...rest} />
  </div>
);

/* Prepínač (toggle switch).
   checked + onChange ako pri bežnom checkboxe. */
export const Switch = ({ checked, onChange, className, ...rest }) => (
  <label className={cx('switch', className)}>
    <input type="checkbox" checked={checked} onChange={onChange} {...rest} />
    <span className="track" />
  </label>
);

/* Checkbox s textom.
   <Check checked={x} onChange={...}>Súhlasím</Check> */
export const Check = ({ checked, onChange, className, children, ...rest }) => (
  <label className={cx('check', className)}>
    <input type="checkbox" checked={checked} onChange={onChange} {...rest} />
    {children}
  </label>
);

/* Segmentový prepínač (napr. Oficiálne / Komunitné).
   options: [{ value, label }], value, onChange(value) */
export const Segment = ({ options = [], value, onChange, className }) => (
  <div className={cx('segment', className)}>
    {options.map((o) => (
      <button
        key={o.value}
        type="button"
        className={o.value === value ? 'active' : ''}
        onClick={() => onChange?.(o.value)}
      >
        {o.label}
      </button>
    ))}
  </div>
);
