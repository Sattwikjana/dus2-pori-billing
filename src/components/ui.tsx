"use client";

import { clsx } from "@/lib/clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "accent";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-gradient-to-b from-brand-500 to-brand-600 text-white shadow-sm shadow-brand-600/30 hover:from-brand-600 hover:to-brand-700 active:from-brand-700 active:to-brand-800 disabled:from-brand-300 disabled:to-brand-300 disabled:shadow-none",
  accent:
    "bg-plum-900 text-white shadow-sm shadow-plum-900/25 hover:bg-plum-800 disabled:bg-ink-300",
  secondary:
    "bg-white text-ink-700 border border-ink-200 hover:bg-ink-50 hover:border-ink-300 disabled:text-ink-400",
  ghost: "text-ink-600 hover:bg-ink-100 hover:text-ink-900 disabled:text-ink-300",
  danger:
    "bg-rose-600 text-white hover:bg-rose-700 shadow-sm shadow-rose-600/25 disabled:bg-rose-300",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-xl",
  lg: "h-12 px-6 text-sm gap-2 rounded-2xl",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center font-bold transition-all select-none",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500",
        "disabled:cursor-not-allowed",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={clsx("card", className)}>{children}</div>;
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-ink-100 px-5 py-4">
      <div className="min-w-0">
        <h2 className="display text-[15px] text-ink-900">{title}</h2>
        {subtitle ? (
          <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "green" | "amber" | "red" | "brand" | "pink";
  children: ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: "bg-ink-100 text-ink-600",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-gold-100 text-gold-600",
    red: "bg-rose-50 text-rose-700",
    brand: "bg-brand-50 text-brand-700",
    pink: "bg-brand-50 text-brand-600",
  } as const;
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-500 ring-1 ring-brand-200/60">
        {icon ?? <span className="text-xl">✨</span>}
      </div>
      <p className="text-sm font-semibold text-ink-800">{title}</p>
      {hint ? <p className="mt-1 max-w-xs text-xs text-ink-500">{hint}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-plum-950/50 backdrop-blur-[3px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        className={clsx(
          "animate-slide-up relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white shadow-pop sm:rounded-3xl thin-scroll",
          wide ? "sm:max-w-3xl" : "sm:max-w-lg",
        )}
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-ink-100 bg-white/95 px-5 py-4 backdrop-blur">
          <div>
            <h3 className="display text-[17px] text-ink-900">{title}</h3>
            {subtitle ? (
              <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>
            ) : null}
          </div>
          <button
            onClick={onClose}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-700"
          >
            ✕
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  icon,
  tone = "brand",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon: ReactNode;
  tone?: "brand" | "green" | "pink" | "amber";
}) {
  const tones = {
    brand: "bg-brand-50 text-brand-600 ring-brand-200/60",
    green: "bg-emerald-50 text-emerald-600 ring-emerald-200/60",
    pink: "bg-plum-900 text-brand-300 ring-plum-800",
    amber: "bg-gold-100 text-gold-600 ring-gold-200/70",
  } as const;
  return (
    <div className="card p-4 transition-shadow hover:shadow-lift">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold tracking-[0.06em] text-ink-500 uppercase">
          {label}
        </p>
        <span
          className={clsx(
            "grid size-8 place-items-center rounded-xl ring-1",
            tones[tone],
          )}
        >
          {icon}
        </span>
      </div>
      <p className="tnum display mt-3 text-[26px] leading-none text-ink-900">
        {value}
      </p>
      {sub ? <p className="mt-2 text-xs text-ink-500">{sub}</p> : null}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2">
      <span>
        <span className="block text-sm font-semibold text-ink-800">{label}</span>
        {hint ? <span className="block text-xs text-ink-500">{hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={clsx(
          "relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-brand-600" : "bg-ink-300",
        )}
      >
        <span
          className={clsx(
            "absolute top-0.5 size-5 rounded-full bg-white shadow transition-all",
            checked ? "left-[22px]" : "left-0.5",
          )}
        />
      </button>
    </label>
  );
}
