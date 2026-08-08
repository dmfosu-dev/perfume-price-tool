"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

export const buttonVariants = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover",
  danger: "bg-red-600 text-white hover:bg-red-700",
  neutral: "border border-line-strong bg-surface text-foreground hover:bg-surface-sunken",
  ghost: "text-muted hover:bg-surface-sunken hover:text-foreground",
  // A variant rather than `ghost` plus a text colour: two colour utilities on
  // one element resolve by stylesheet order, and text-muted was winning.
  dangerGhost: "text-danger-fg hover:bg-danger-bg",
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
