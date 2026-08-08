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
          tone: "border-warning-fg/30 bg-warning-bg text-warning-fg",
          text:
            pending === 0
              ? "Offline — changes will be saved on this phone until you reconnect"
              : `Offline — ${pending} ${pending === 1 ? "change" : "changes"} waiting to sync`,
        }
      : syncing
        ? {
            tone: "border-info-fg/30 bg-info-bg text-info-fg",
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
          className="sticky top-[57px] z-[6] flex items-center gap-2 border-b border-success-fg/30 bg-success-bg px-4 py-2.5 text-sm font-semibold text-success-fg"
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
