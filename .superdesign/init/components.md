# Shared UI Components

**Stack:** Next.js 16.3 (App Router, Turbopack) · React 19.2 · TypeScript · Tailwind CSS v4 · Prisma 7 (Postgres/Supabase)
**Component library:** none — hand-rolled primitives in `src/components/ui.tsx`
**CSS approach:** Tailwind v4 with CSS custom properties via `@theme inline` (tokens defined in `src/app/globals.css`)
**Icons:** emoji (no icon library installed)

All primitives read from CSS variables (`--color-surface`, `--color-line`, `--color-accent`, …) so
theme changes propagate globally.

---

## `src/components/ui.tsx`

Core primitives: Field, Select, Alert, Card, PageHeader, SectionTitle, Badge, StatusBadge, EmptyState, Stat. Also exports `inputClass` used by ad-hoc inputs across pages.

```tsx
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

```

---

## `src/components/SubmitButton.tsx`

Form submit button bound to `useFormStatus`; exports `buttonVariants` + `buttonBase` reused by raw <button> elements.

```tsx
"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export const buttonVariants = {
  primary: "bg-accent text-white hover:bg-accent-hover",
  danger: "bg-red-600 text-white hover:bg-red-700",
  neutral: "border border-line-strong bg-surface text-foreground hover:bg-surface-sunken",
  ghost: "text-muted hover:bg-surface-sunken hover:text-foreground",
} as const;

export const buttonBase =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50";

export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  size = "md",
  className = "",
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: keyof typeof buttonVariants;
  size?: "sm" | "md";
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={`${buttonBase} ${size === "sm" ? "h-9" : "h-10"} ${buttonVariants[variant]} ${className}`}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

```

---

## `src/components/PhotoUpload.tsx`

Admin-only per-SKU photo upload/replace/remove control.

```tsx
"use client";

import { useRef, useState, useTransition } from "react";
import { removeSkuPhoto, uploadSkuPhoto } from "@/app/actions/photos";

/**
 * Photo control shown to admins on the catalogue row. Deliberately small: it
 * sits beside the price fields and must never get in the way of price entry,
 * which is what the screen is really for.
 */
export function PhotoUpload({
  skuId,
  skuCode,
  photoUrl,
}: {
  skuId: string;
  skuCode: string;
  photoUrl: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function upload(file: File | undefined) {
    if (!file) return;
    setError(null);

    const formData = new FormData();
    formData.set("skuId", skuId);
    formData.set("photo", file);

    startTransition(async () => {
      const result = await uploadSkuPhoto(formData);
      if (!result.ok) setError(result.error ?? "Upload failed.");
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await removeSkuPhoto(skuId);
      if (!result.ok) setError(result.error ?? "Could not remove the photo.");
    });
  }

  return (
    <div className="mt-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => upload(event.target.files?.[0])}
        className="hidden"
        aria-label={`Upload a photo for ${skuCode}`}
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          className="text-xs font-semibold text-muted underline underline-offset-2 disabled:opacity-50"
        >
          {pending ? "Uploading…" : photoUrl ? "Replace photo" : "Add photo"}
        </button>
        {photoUrl ? (
          <button
            type="button"
            onClick={remove}
            disabled={pending}
            className="text-xs text-muted underline underline-offset-2 disabled:opacity-50"
          >
            Remove
          </button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="mt-1 text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}

```

---
