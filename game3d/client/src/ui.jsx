/** Shared UI widgets. */

import { useEffect } from 'react';
import { uiTick } from './audio.js';
import { appStore, useStore } from './store.js';
import { useT } from './i18n.js';

export function Button({ children, variant = 'primary', icon, className = '', onClick, disabled, ...rest }) {
  return (
    <button
      type="button"
      className={`btn btn--${variant} ${className}`}
      disabled={disabled}
      onMouseEnter={() => !disabled && uiTick('hover')}
      onClick={(e) => {
        if (disabled) return;
        uiTick('click');
        onClick?.(e);
      }}
      {...rest}
    >
      {icon && <span className="btn__icon" aria-hidden>{icon}</span>}
      <span className="btn__label">{children}</span>
    </button>
  );
}

export function Panel({ title, onBack, children, wide, className = '' }) {
  const t = useT();
  useEffect(() => {
    if (!onBack) return undefined;
    const onKey = (e) => e.key === 'Escape' && onBack();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);
  return (
    <div className={`panel ${wide ? 'panel--wide' : ''} ${className}`}>
      <header className="panel__header">
        {onBack && (
          <button type="button" className="panel__back" onClick={() => { uiTick(); onBack(); }} aria-label={t('common.back')}>
            <span className="flip-rtl">←</span>
          </button>
        )}
        <h2 className="panel__title">{title}</h2>
      </header>
      <div className="panel__body">{children}</div>
    </div>
  );
}

export function Segmented({ value, options, onChange }) {
  return (
    <div className="segmented" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={`segmented__opt ${value === o.value ? 'is-active' : ''}`}
          onClick={() => { uiTick(); onChange(o.value); }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Slider({ value, onChange, min = 0, max = 1, step = 0.05 }) {
  return (
    <input
      className="slider"
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      style={{ '--fill': `${((value - min) / (max - min)) * 100}%` }}
    />
  );
}

export function Toasts() {
  const toasts = useStore(appStore, (s) => s.toasts);
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((x) => (
        <div key={x.id} className={`toast toast--${x.tone}`}>{x.text}</div>
      ))}
    </div>
  );
}

export function Confirm({ text, confirmLabel, cancelLabel, onConfirm, onCancel }) {
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal modal--small" onClick={(e) => e.stopPropagation()}>
        <p className="modal__text">{text}</p>
        <div className="modal__actions">
          <Button variant="ghost" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant="danger" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  );
}
