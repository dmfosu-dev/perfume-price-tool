"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";

/**
 * Brand lockup. The gold in the mark is the only place gold appears — buttons,
 * links, focus rings and status stay on the theme's accent.
 */
function BrandMark({ size = "md" }: { size?: "sm" | "md" }) {
  const box = size === "sm" ? "h-7 w-7" : "h-8 w-8";
  return (
    <span className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand asset, no optimisation needed */}
      <img
        src="/brand/aromatik-logo.png"
        alt=""
        aria-hidden
        style={{ background: "var(--logo-plate)" }}
        className={`${box} shrink-0 rounded-lg object-contain p-0.5`}
      />
      <span className="text-sm font-semibold tracking-tight text-foreground">
        Aromatic Ghana
      </span>
    </span>
  );
}

export type NavItem = {
  href: string;
  label: string;
  icon: string;
  badge?: number;
};

/**
 * Back-office shell: a persistent sidebar on desktop, a slide-over on mobile.
 * The intermediary sees a single item, so the sidebar collapses to almost
 * nothing for them rather than framing a one-link app in heavy chrome.
 */
export function AppShell({
  items,
  userEmail,
  role,
  signOut,
  children,
}: {
  items: NavItem[];
  userEmail: string;
  role: string;
  signOut: ReactNode;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isCurrent = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  const nav = (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const current = isCurrent(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={current ? "page" : undefined}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
              current
                ? "bg-accent-soft text-accent"
                : "text-muted hover:bg-surface-sunken hover:text-foreground"
            }`}
          >
            <span aria-hidden className="w-5 text-center text-base leading-none">
              {item.icon}
            </span>
            <span className="flex-1">{item.label}</span>
            {item.badge !== undefined && item.badge > 0 ? (
              <span className="nums inline-flex min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white">
                {item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  const identity = (
    <div className="border-t border-line px-3 py-3">
      <div className="mb-3">
        <ThemeSwitcher />
      </div>
      <p className="truncate text-sm font-medium text-foreground">{userEmail}</p>
      <p className="mb-2 text-xs capitalize text-muted-soft">{role}</p>
      {signOut}
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-line bg-surface/95 px-3 py-2.5 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-surface-sunken"
        >
          ☰
        </button>
        <BrandMark size="sm" />
      </header>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-line bg-surface lg:hidden">
            <div className="flex items-center justify-between px-3 py-3">
              <BrandMark size="sm" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-surface-sunken"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2">{nav}</div>
            {identity}
          </aside>
        </>
      ) : null}

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-surface lg:flex">
        <div className="px-4 py-4">
          <BrandMark />
        </div>
        <div className="flex-1 overflow-y-auto px-2">{nav}</div>
        {identity}
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
