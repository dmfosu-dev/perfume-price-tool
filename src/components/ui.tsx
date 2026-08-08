import type { ComponentProps, ReactNode } from "react";

// Shared primitives. Everything reads from the tokens in globals.css so the
// whole app shifts together rather than drifting page by page.

export const inputClass =
  "h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-foreground placeholder:text-muted-soft transition focus:border-accent focus:outline-none disabled:opacity-60";

export function Field({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & ComponentProps<"input">) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      <input {...props} className={inputClass} />
      {hint ? <span className="mt-1 block text-xs text-muted-soft">{hint}</span> : null}
    </label>
  );
}

export function Select({
  label,
  hint,
  children,
  ...props
}: { label?: string; hint?: string; children: ReactNode } & ComponentProps<"select">) {
  const select = (
    <select {...props} className={inputClass}>
      {children}
    </select>
  );
  if (!label) return select;
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      {select}
      {hint ? <span className="mt-1 block text-xs text-muted-soft">{hint}</span> : null}
    </label>
  );
}

const TONES = {
  error: "border-red-200 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100",
  info: "border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-100",
  success:
    "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-100",
  warning:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100",
} as const;

export function Alert({
  tone = "error",
  title,
  children,
}: {
  tone?: keyof typeof TONES;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" className={`rounded-lg border px-3.5 py-2.5 text-sm ${TONES[tone]}`}>
      {title ? <p className="mb-0.5 font-semibold">{title}</p> : null}
      <div>{children}</div>
    </div>
  );
}

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04)] ${
        padded ? "p-4 sm:p-5" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-soft">
      {children}
    </h2>
  );
}

const BADGE_TONES: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  in_stock: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  unknown: "bg-surface-sunken text-muted",
  suspended: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
  out_of_stock: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  revoked: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  rejected: "bg-surface-sunken text-muted",
  accent: "bg-accent-soft text-accent",
  neutral: "bg-surface-sunken text-muted",
};

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
        BADGE_TONES[tone] ?? BADGE_TONES.neutral
      }`}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={status}>{status.replace(/_/g, " ")}</Badge>;
}

export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-line px-6 py-10 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {children ? <p className="mt-1 text-sm text-muted">{children}</p> : null}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-soft">{label}</p>
      <p className="nums mt-0.5 text-xl font-semibold text-foreground">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}
