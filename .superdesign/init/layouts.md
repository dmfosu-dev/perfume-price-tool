# Shared Layouts

The app has one shell used by every authenticated screen.

- `src/app/layout.tsx` — root HTML/body, Geist fonts, global metadata
- `src/components/AppHeader.tsx` — **server** component: counts nav badges, builds the nav item list, wraps children in `AppShell`
- `src/components/AppShell.tsx` — **client** component: persistent sidebar on `lg+`, slide-over drawer below that, plus mobile top bar
- `src/app/dashboard/layout.tsx` — wraps the intermediary catalogue; also mounts the service worker + offline provider
- `src/app/admin/layout.tsx` — wraps every admin screen; requires admin role
- `src/components/OfflineSync.tsx` — offline banner + sync toasts rendered above dashboard content

Login, signup and the blocked-account view render standalone (no shell).

---

## `src/app/layout.tsx`

Root layout — fonts, metadata, html/body.

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Perfume Price Tool",
  description: "Internal source-price and stock tracking for the perfume catalogue.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

```

---

## `src/components/AppHeader.tsx`

Server wrapper: badge counts + nav definition, renders AppShell.

```tsx
import { logoutAction } from "@/app/actions/auth";
import { AppShell, type NavItem } from "@/components/AppShell";
import { SubmitButton } from "@/components/SubmitButton";
import type { SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/// Server wrapper: counts the badges, then hands the shell to the client.
export async function AppHeader({
  user,
  children,
}: {
  user: SessionUser;
  children: React.ReactNode;
}) {
  const isAdmin = user.role === "admin";

  const [pendingUsers, openReports, openConflicts] = isAdmin
    ? await Promise.all([
        prisma.user.count({ where: { status: "pending" } }),
        prisma.discrepancyReport.count({ where: { status: "open" } }),
        prisma.priceConflict.count({ where: { status: "open" } }),
      ])
    : [0, 0, 0];

  const items: NavItem[] = [
    { href: "/dashboard", label: "Catalogue", icon: "🧴" },
    ...(isAdmin
      ? [
          { href: "/admin/catalogue", label: "Products", icon: "📦" },
          { href: "/admin/planning", label: "Planning", icon: "📈" },
          { href: "/admin/history", label: "History", icon: "🕘" },
          {
            href: "/admin/conflicts",
            label: "Conflicts",
            icon: "⚠️",
            badge: openConflicts,
          },
          { href: "/admin/discrepancies", label: "Issues", icon: "🚩", badge: openReports },
          { href: "/admin/fx", label: "Currencies", icon: "💱" },
          { href: "/admin/import", label: "Import", icon: "⬆️" },
          { href: "/admin/users", label: "Users", icon: "👥", badge: pendingUsers },
        ]
      : []),
    { href: "/account", label: "My account", icon: "⚙️" },
  ];

  return (
    <AppShell
      items={items}
      userEmail={user.email}
      role={user.role}
      signOut={
        <form action={logoutAction}>
          <SubmitButton variant="neutral" size="sm" className="w-full">
            Sign out
          </SubmitButton>
        </form>
      }
    >
      {children}
    </AppShell>
  );
}

```

---

## `src/components/AppShell.tsx`

The actual shell: sidebar (desktop), drawer (mobile), identity block, sign-out.

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";

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
        <span className="flex items-center gap-2 font-semibold tracking-tight text-foreground">
          <span
            aria-hidden
            className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-xs font-bold text-white"
          >
            P
          </span>
          Perfume Price
        </span>
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
              <span className="font-semibold text-foreground">Menu</span>
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
        <div className="flex items-center gap-2 px-4 py-4">
          <span
            aria-hidden
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white"
          >
            P
          </span>
          <span className="font-semibold tracking-tight text-foreground">
            Perfume Price
          </span>
        </div>
        <div className="flex-1 overflow-y-auto px-2">{nav}</div>
        {identity}
      </aside>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

```

---

## `src/app/dashboard/layout.tsx`

Dashboard layout.

```tsx
import { AppHeader } from "@/components/AppHeader";
import { OfflineProvider } from "@/components/OfflineSync";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { requireApprovedUser } from "@/lib/auth";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const user = await requireApprovedUser();
  return (
    <>
      <ServiceWorkerRegistrar />
      <AppHeader user={user}>
        <OfflineProvider>{children}</OfflineProvider>
      </AppHeader>
    </>
  );
}

```

---

## `src/app/admin/layout.tsx`

Admin layout.

```tsx
import { AppHeader } from "@/components/AppHeader";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdmin();
  return <AppHeader user={user}>{children}</AppHeader>;
}

```

---

## `src/components/OfflineSync.tsx`

Offline/sync banners rendered inside the dashboard layout.

```tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import { savePriceEdits } from "@/app/actions/prices";
import {
  enqueueBatch,
  isSupported,
  listBatches,
  pendingChangeCount,
  removeBatch,
  type QueuedBatch,
} from "@/lib/offline-queue";

type OfflineContextValue = {
  online: boolean;
  pending: number;
  queue: (batch: Omit<QueuedBatch, "id">) => Promise<void>;
};

const OfflineContext = createContext<OfflineContextValue>({
  online: true,
  pending: 0,
  queue: async () => {},
});

export function useOffline(): OfflineContextValue {
  return useContext(OfflineContext);
}

function subscribeToConnection(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function OfflineProvider({ children }: { children: React.ReactNode }) {
  // useSyncExternalStore rather than an effect + setState: the browser is the
  // source of truth here, and the server snapshot ("online") stops the banner
  // flashing during hydration.
  const online = useSyncExternalStore(
    subscribeToConnection,
    () => navigator.onLine,
    () => true,
  );

  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const syncingRef = useRef(false);
  const router = useRouter();

  const refresh = useCallback(async () => {
    if (!isSupported()) return;
    try {
      setPending(await pendingChangeCount());
    } catch {
      // A blocked or unavailable IndexedDB must not take the dashboard down.
    }
  }, []);

  const queue = useCallback(
    async (batch: Omit<QueuedBatch, "id">) => {
      await enqueueBatch(batch);
      await refresh();
    },
    [refresh],
  );

  const sync = useCallback(async () => {
    if (!isSupported() || syncingRef.current) return;
    syncingRef.current = true;

    let synced = 0;
    let conflicted = 0;
    let rejected = 0;

    try {
      // Awaited before any setState, so this never runs synchronously inside an
      // effect body.
      const batches = await listBatches();
      if (batches.length === 0) return;
      setSyncing(true);

      for (const batch of batches) {
        if (batch.id === undefined) continue;
        try {
          const result = await savePriceEdits(
            batch.edits,
            batch.vendorName,
            batch.priceCurrency,
            "offline_sync",
          );
          if (result.ok) {
            // Count what the server actually did, not what was sent — some of
            // the batch may have been parked as conflicts rather than applied.
            synced += result.savedCount ?? 0;
            conflicted += result.conflictCount ?? 0;
            await removeBatch(batch.id);
          } else {
            // Rejected on its merits (validation, deleted SKU). Retrying would
            // fail identically and block everything behind it, so drop it and
            // tell the user rather than looping forever.
            rejected += batch.edits.length;
            await removeBatch(batch.id);
          }
        } catch {
          // Connection dropped again mid-drain: leave the rest queued.
          break;
        }
      }
    } finally {
      syncingRef.current = false;
      setSyncing(false);
      await refresh();
    }

    if (synced > 0 || conflicted > 0 || rejected > 0) {
      const parts: string[] = [];
      if (synced > 0) {
        parts.push(`${synced} ${synced === 1 ? "change" : "changes"} synced`);
      }
      if (conflicted > 0) {
        parts.push(
          `${conflicted} clashed with a newer price — sent for admin review`,
        );
      }
      if (rejected > 0) {
        parts.push(
          `${rejected} rejected — re-enter ${rejected === 1 ? "it" : "them"}`,
        );
      }
      setToast(parts.join(" · "));
      router.refresh();
    }
  }, [refresh, router]);

  // Drain whenever the connection is up: on mount (catching anything queued in
  // a previous session, even before a restart) and on every reconnect.
  useEffect(() => {
    if (!online) return;
    void sync();
  }, [online, sync]);

  // Show the queued count even when the app opens already offline, where sync()
  // never runs. Inlined rather than calling refresh() so the setState is
  // visibly after an await, not synchronous in the effect body.
  useEffect(() => {
    if (!isSupported()) return;
    let cancelled = false;

    void (async () => {
      try {
        const count = await pendingChangeCount();
        if (!cancelled) setPending(count);
      } catch {
        // IndexedDB unavailable — the dashboard still works, just without a count.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const banner =
    !online
      ? {
          tone: "border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950 dark:text-amber-100",
          text:
            pending === 0
              ? "Offline — changes will be saved on this phone until you reconnect"
              : `Offline — ${pending} ${pending === 1 ? "change" : "changes"} waiting to sync`,
        }
      : syncing
        ? {
            tone: "border-sky-300 bg-sky-100 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950 dark:text-sky-100",
            text: "Syncing queued changes…",
          }
        : null;

  return (
    <OfflineContext.Provider value={{ online, pending, queue }}>
      {banner ? (
        <div
          role="status"
          className={`sticky top-[57px] z-[6] border-b px-4 py-2.5 text-sm font-semibold ${banner.tone}`}
        >
          {banner.text}
        </div>
      ) : null}

      {toast ? (
        <div
          role="status"
          className="sticky top-[57px] z-[6] flex items-center gap-2 border-b border-emerald-300 bg-emerald-100 px-4 py-2.5 text-sm font-semibold text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950 dark:text-emerald-100"
        >
          <span className="flex-1">{toast}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="underline underline-offset-2"
          >
            dismiss
          </button>
        </div>
      ) : null}

      {children}
    </OfflineContext.Provider>
  );
}

```

---
