import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { useCallback, useId, useRef } from 'react';
import { Icon, type IconName } from './icons.js';

// ---------------------------------------------------------------------------
// Button
// ---------------------------------------------------------------------------

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'solid' | 'soft' | 'ghost' | 'outline';
  size?: 'sm' | 'md';
  icon?: IconName;
  active?: boolean;
  block?: boolean;
}

export function Button({
  variant = 'ghost',
  size = 'md',
  icon,
  active = false,
  block = false,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  const classes = [
    'ris-btn',
    `ris-btn--${variant}`,
    `ris-btn--${size}`,
    active ? 'is-active' : '',
    block ? 'is-block' : '',
    !children ? 'is-icon-only' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type={type} className={classes} aria-pressed={active || undefined} {...rest}>
      {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 18} /> : null}
      {children ? <span className="ris-btn__label">{children}</span> : null}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Slider
// ---------------------------------------------------------------------------

export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  neutral?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  onCommit?: () => void;
  onBegin?: () => void;
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  neutral,
  disabled = false,
  onChange,
  onCommit,
  onBegin,
}: SliderProps) {
  const id = useId();
  const activeRef = useRef(false);

  const begin = useCallback(() => {
    if (activeRef.current) return;
    activeRef.current = true;
    onBegin?.();
  }, [onBegin]);

  const finish = useCallback(() => {
    if (!activeRef.current) return;
    activeRef.current = false;
    onCommit?.();
  }, [onCommit]);

  const display = step < 1 ? value.toFixed(2) : Math.round(value).toString();
  const isNeutral = neutral === undefined ? false : Math.abs(value - neutral) < 1e-6;

  return (
    <div className={`ris-slider${disabled ? ' is-disabled' : ''}`}>
      <div className="ris-slider__head">
        <label className="ris-slider__label" htmlFor={id}>
          {label}
        </label>
        <button
          type="button"
          className={`ris-slider__value${isNeutral ? ' is-neutral' : ''}`}
          onDoubleClick={() => {
            if (neutral === undefined || disabled) return;
            begin();
            onChange(neutral);
            finish();
          }}
          title={neutral === undefined ? undefined : 'Double click to reset'}
          tabIndex={-1}
        >
          {display}
          {unit}
        </button>
      </div>
      <input
        id={id}
        className="ris-slider__input"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          begin();
          onChange(Number(event.currentTarget.value));
        }}
        onPointerDown={begin}
        onPointerUp={finish}
        onPointerCancel={finish}
        onKeyDown={begin}
        onKeyUp={finish}
        onBlur={finish}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Segmented control
// ---------------------------------------------------------------------------

export interface SegmentedOption<T extends string> {
  value: T;
  label?: string;
  icon?: IconName;
  title?: string;
}

export interface SegmentedProps<T extends string> {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  size?: 'sm' | 'md';
  block?: boolean;
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  size = 'md',
  block = false,
}: SegmentedProps<T>) {
  return (
    <div className={`ris-segmented ris-segmented--${size}${block ? ' is-block' : ''}`} role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={`ris-segmented__item${option.value === value ? ' is-active' : ''}`}
          aria-pressed={option.value === value}
          title={option.title ?? option.label}
          onClick={() => onChange(option.value)}
        >
          {option.icon ? <Icon name={option.icon} size={16} /> : null}
          {option.label ? <span>{option.label}</span> : null}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Colour swatch input
// ---------------------------------------------------------------------------

export interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  swatches?: string[];
}

export const DEFAULT_SWATCHES = [
  '#ffffff',
  '#000000',
  '#ff3b30',
  '#ff9500',
  '#ffcc00',
  '#34c759',
  '#00c7be',
  '#0a84ff',
  '#5856d6',
  '#af52de',
];

export function ColorField({ label, value, onChange, swatches = DEFAULT_SWATCHES }: ColorFieldProps) {
  const id = useId();
  return (
    <div className="ris-field">
      <div className="ris-field__head">
        <label className="ris-slider__label" htmlFor={id}>
          {label}
        </label>
      </div>
      <div className="ris-colors">
        {swatches.map((color) => (
          <button
            key={color}
            type="button"
            className={`ris-color${color.toLowerCase() === value.toLowerCase() ? ' is-active' : ''}`}
            style={{ background: color }}
            aria-label={color}
            aria-pressed={color.toLowerCase() === value.toLowerCase()}
            onClick={() => onChange(color)}
          />
        ))}
        <label className="ris-color ris-color--picker" title={label}>
          <input
            id={id}
            type="color"
            value={value}
            onChange={(event) => onChange(event.currentTarget.value)}
          />
          <span aria-hidden="true">+</span>
        </label>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Panel scaffolding
// ---------------------------------------------------------------------------

export interface PanelProps {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  hint?: string;
}

export function Panel({ title, children, actions, hint }: PanelProps) {
  return (
    <section className="ris-panel" aria-label={title}>
      <header className="ris-panel__head">
        <h2 className="ris-panel__title">{title}</h2>
        {actions ? <div className="ris-panel__actions">{actions}</div> : null}
      </header>
      {hint ? <p className="ris-panel__hint">{hint}</p> : null}
      <div className="ris-panel__body">{children}</div>
    </section>
  );
}
