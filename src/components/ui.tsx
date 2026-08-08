import type { ComponentProps, ReactNode } from "react";

// Shared primitives. Everything reads from the tokens in globals.css so the
// whole app shifts together rather than drifting page by page.
//
// Status colours come from tokens too (success-bg/fg, warning-*, danger-*,
// info-*) rather than Tailwind's palette with `dark:` variants: `dark:` keys off
// the OS setting, which would be wrong the moment someone picks the Neon theme
// on a light machine, or the Mono theme on a dark one.

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

const BUTTON_BASE =
  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold transition disabled:opacity-50 disabled:pointer-events-none";

export const buttonVariants = {
  primary: `${BUTTON_BASE} bg-accent text-on-accent hover:bg-accent-hover`,
  secondary: `${BUTTON_BASE} border border-line-strong bg-surface text-foreground hover:bg-surface-sunken`,
  ghost: `${BUTTON_BASE} text-muted hover:bg-surface-sunken hover:text-foreground`,
  danger: `${BUTTON_BASE} bg-danger-bg text-danger-fg hover:opacity-85`,
  dangerGhost: `${BUTTON_BASE} text-danger-fg hover:bg-danger-bg`,
} as const;

export type ButtonVariant = keyof typeof buttonVariants;

/** Small ghost button used in the dense toolbars on the Products screen. */
export const smallGhostClass =
  "inline-flex min-h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-muted transition hover:bg-surface-sunken hover:text-foreground disabled:opacity-50";

export const smallDangerClass =
  "inline-flex min-h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-danger-fg transition hover:bg-danger-bg disabled:opacity-50";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: { variant?: ButtonVariant } & ComponentProps<"button">) {
  return <button {...props} className={`${buttonVariants[variant]} ${className}`} />;
}

const TONES = {
  error: "border-danger-fg/25 bg-danger-bg text-danger-fg",
  info: "border-info-fg/25 bg-info-bg text-info-fg",
  success: "border-success-fg/25 bg-success-bg text-success-fg",
  warning: "border-warning-fg/25 bg-warning-bg text-warning-fg",
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
  approved: "bg-success-bg text-success-fg",
  in_stock: "bg-success-bg text-success-fg",
  pending: "bg-warning-bg text-warning-fg",
  unknown: "bg-surface-sunken text-muted",
  suspended: "bg-warning-bg text-warning-fg",
  out_of_stock: "bg-danger-bg text-danger-fg",
  revoked: "bg-danger-bg text-danger-fg",
  rejected: "bg-surface-sunken text-muted",
  info: "bg-info-bg text-info-fg",
  accent: "bg-accent-soft text-accent",
  solid: "bg-accent text-on-accent",
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
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  /** Tints the figure when a non-zero count needs attention. */
  tone?: "default" | "warning" | "danger" | "success";
}) {
  const valueTone =
    tone === "warning"
      ? "text-warning-fg"
      : tone === "danger"
        ? "text-danger-fg"
        : tone === "success"
          ? "text-success-fg"
          : "text-foreground";
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-soft">{label}</p>
      <p className={`nums mt-0.5 text-xl font-semibold ${valueTone}`}>{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

/** Row of KPI tiles; wraps to two columns on a phone. */
export function StatRow({ children }: { children: ReactNode }) {
  return <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}

/** Uppercase heading cell shared by every data table. */
export function Th({
  children,
  align = "left",
  className = "",
}: {
  children?: ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}) {
  // Alignment is a prop rather than a caller-supplied class because Tailwind
  // resolves conflicting utilities by stylesheet order, not class order.
  const alignment =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <th
      scope="col"
      className={`px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-soft ${alignment} ${className}`}
    >
      {children}
    </th>
  );
}

/** Rounded-full filter chip. */
export function chipClass(active: boolean) {
  return `inline-flex min-h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition ${
    active
      ? "bg-accent text-on-accent"
      : "border border-line bg-surface text-muted hover:bg-surface-sunken hover:text-foreground"
  }`;
}
