'use client';

import React, { useEffect, useId, useRef } from 'react';
import { AlertTriangle, CheckCircle2, Info, Minus, Plus, X } from 'lucide-react';
import { useStage } from '@/lib/stageContext';

export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

const variantClass: Record<ButtonVariant, string> = {
  primary: 'bg-brass text-brass-ink hover:bg-brass-strong font-semibold',
  secondary: 'bg-raised text-ink border border-line hover:border-line-strong hover:bg-[#20232e]',
  ghost: 'text-muted hover:text-ink hover:bg-raised',
  danger: 'bg-red-500/10 text-danger border border-red-500/30 hover:bg-red-500/20',
};
const sizeClass: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-base gap-2 rounded-xl',
  xl: 'h-16 px-6 text-lg gap-2.5 rounded-2xl',
};

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: ButtonSize }
>(({ variant = 'secondary', size = 'md', className, type = 'button', ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    className={cx(
      'inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors [touch-action:manipulation]',
      'disabled:opacity-40 disabled:pointer-events-none',
      variantClass[variant],
      sizeClass[size],
      className
    )}
    {...props}
  />
));
Button.displayName = 'Button';

export const IconButton = ({
  label,
  className,
  variant = 'ghost',
  size = 'md',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string; variant?: ButtonVariant; size?: 'sm' | 'md' }) => (
  <button
    type="button"
    aria-label={label}
    title={label}
    className={cx(
      'inline-flex items-center justify-center shrink-0 transition-colors [touch-action:manipulation]',
      'disabled:opacity-30 disabled:pointer-events-none',
      size === 'sm' ? 'w-8 h-8 rounded-lg' : 'w-10 h-10 rounded-xl',
      variantClass[variant],
      className
    )}
    {...props}
  />
);

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

export const Badge = ({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: 'neutral' | 'brass' | 'live' | 'ok' | 'override';
  className?: string;
  children: React.ReactNode;
}) => (
  <span
    className={cx(
      'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide whitespace-nowrap',
      tone === 'neutral' && 'bg-raised text-muted',
      tone === 'brass' && 'bg-brass-soft text-brass',
      tone === 'live' && 'bg-red-500/15 text-red-400',
      tone === 'ok' && 'bg-green-500/15 text-green-400',
      tone === 'override' && 'bg-violet-500/15 text-violet-300',
      className
    )}
  >
    {children}
  </span>
);

export const LiveDot = ({ className }: { className?: string }) => (
  <span className={cx('relative inline-flex w-2 h-2', className)}>
    <span className="absolute inset-0 rounded-full bg-live animate-ping opacity-60" />
    <span className="relative w-2 h-2 rounded-full bg-live" />
  </span>
);

export const Card = ({ className, children }: { className?: string; children: React.ReactNode }) => (
  <div className={cx('rounded-2xl border border-line bg-surface', className)}>{children}</div>
);

export const EmptyState = ({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) => (
  <div className={cx('flex flex-col items-center text-center gap-2 px-6 py-12', className)}>
    {icon && <div className="text-faint mb-1">{icon}</div>}
    <p className="font-semibold text-ink">{title}</p>
    {children && <div className="text-sm text-muted max-w-sm">{children}</div>}
    {action && <div className="mt-3">{action}</div>}
  </div>
);

export const Chip = ({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) => (
  <button
    type="button"
    aria-pressed={selected}
    onClick={onClick}
    className={cx(
      'h-9 px-3.5 rounded-full text-sm font-medium border transition-colors [touch-action:manipulation]',
      selected ? 'bg-brass text-brass-ink border-brass' : 'bg-raised text-ink border-line hover:border-line-strong',
      className
    )}
  >
    {children}
  </button>
);

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------

export const Field = ({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  htmlFor?: string;
}) => (
  <div className="space-y-1.5">
    <label htmlFor={htmlFor} className="block text-sm font-medium text-ink">
      {label}
    </label>
    {children}
    {hint && <p className="text-xs text-muted">{hint}</p>}
  </div>
);

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cx(
        'w-full h-11 px-3.5 rounded-xl bg-bg border border-line text-ink placeholder:text-faint',
        'focus:outline-none focus:border-brass/70 focus:ring-2 focus:ring-brass/20 transition-colors',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export const Stepper = ({
  value,
  onChange,
  min = 0,
  max = 99,
  suffix,
  id,
}: {
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
  id?: string;
}) => {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div className="flex items-center gap-2">
      <IconButton label="Decrease" variant="secondary" onClick={() => onChange(clamp(value - 1))} disabled={value <= min}>
        <Minus className="w-4 h-4" />
      </IconButton>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => onChange(clamp(parseInt(e.target.value, 10) || min))}
        className="w-16 h-10 rounded-xl bg-bg border border-line text-center text-lg font-semibold tabular focus:outline-none focus:border-brass/70"
      />
      <IconButton label="Increase" variant="secondary" onClick={() => onChange(clamp(value + 1))} disabled={value >= max}>
        <Plus className="w-4 h-4" />
      </IconButton>
      {suffix && <span className="text-sm text-muted">{suffix}</span>}
    </div>
  );
};

export const Toggle = ({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={cx(
      'relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors',
      checked ? 'bg-ok' : 'bg-line-strong'
    )}
  >
    <span
      className={cx(
        'absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow transition-transform',
        checked && 'translate-x-5'
      )}
    />
  </button>
);

// ---------------------------------------------------------------------------
// Modal (bottom sheet on phones, centred dialog on larger screens)
// ---------------------------------------------------------------------------

export const Modal = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) => {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // Focus the first field, or the panel itself
    requestAnimationFrame(() => {
      const first = panelRef.current?.querySelector<HTMLElement>('input, textarea, select');
      (first ?? panelRef.current)?.focus();
    });
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          'relative w-full bg-surface border border-line shadow-2xl flex flex-col max-h-[92dvh] outline-none',
          'rounded-t-3xl sm:rounded-2xl animate-sheet-up',
          size === 'sm' && 'sm:max-w-md',
          size === 'md' && 'sm:max-w-lg',
          size === 'lg' && 'sm:max-w-2xl'
        )}
      >
        <div className="flex items-start justify-between gap-4 px-5 pt-5 pb-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-ink">
              {title}
            </h2>
            {description && <div className="text-sm text-muted mt-0.5">{description}</div>}
          </div>
          <IconButton label="Close" onClick={onClose} className="-mr-2 -mt-1">
            <X className="w-5 h-5" />
          </IconButton>
        </div>
        <div className="px-5 pb-5 overflow-y-auto scrollbar-thin">{children}</div>
        {footer && (
          <div className="px-5 py-4 border-t border-line flex items-center justify-end gap-2 safe-bottom">{footer}</div>
        )}
      </div>
    </div>
  );
};

export const ConfirmDialog = ({
  open,
  title,
  children,
  confirmLabel,
  onConfirm,
  onCancel,
  danger = true,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}) => (
  <Modal
    open={open}
    onClose={onCancel}
    title={title}
    size="sm"
    footer={
      <>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </>
    }
  >
    <div className="text-sm text-muted space-y-2">{children}</div>
  </Modal>
);

// ---------------------------------------------------------------------------
// Toasts
// ---------------------------------------------------------------------------

export const Toaster = () => {
  const { toasts, dismissToast } = useStage();
  return (
    <div
      aria-live="polite"
      className="fixed z-[70] left-1/2 -translate-x-1/2 bottom-24 sm:bottom-6 flex flex-col items-center gap-2 w-[min(92vw,420px)] pointer-events-none"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cx(
            'pointer-events-auto w-full flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm shadow-xl animate-fade-in',
            t.kind === 'error' && 'bg-[#2a1214] border-red-500/40 text-red-200',
            t.kind === 'success' && 'bg-raised border-line text-ink',
            t.kind === 'info' && 'bg-raised border-line text-ink'
          )}
        >
          {t.kind === 'error' ? (
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-danger" />
          ) : t.kind === 'success' ? (
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-ok" />
          ) : (
            <Info className="w-4 h-4 mt-0.5 shrink-0 text-muted" />
          )}
          <span className="flex-1">{t.message}</span>
          <button onClick={() => dismissToast(t.id)} className="text-faint hover:text-ink" aria-label="Dismiss">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
};
