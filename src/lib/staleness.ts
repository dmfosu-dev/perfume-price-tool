// Shared by server and client — no Node built-ins here.

const DAY_MS = 86_400_000;

/// Spec §3.2: "Not updated in 7+ days" filter chip.
export const FILTER_STALE_DAYS = 7;
/// Spec §3.2: prices older than 14 days get a subtle visual flag.
export const FLAG_STALE_DAYS = 14;

export function daysSince(iso: string | null, nowMs: number): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  return Math.floor((nowMs - then) / DAY_MS);
}

/// True once a price is old enough to warrant the stale flag. A SKU that has
/// never been updated is "not yet priced" rather than stale, and is surfaced
/// with its own label instead.
export function isStale(iso: string | null, nowMs: number): boolean {
  const days = daysSince(iso, nowMs);
  return days !== null && days >= FLAG_STALE_DAYS;
}

export function matchesStaleFilter(iso: string | null, nowMs: number): boolean {
  if (!iso) return true; // never updated counts as needing attention
  const days = daysSince(iso, nowMs);
  return days !== null && days >= FILTER_STALE_DAYS;
}

/// `nowMs` is passed in rather than read from Date.now() so server render and
/// client hydration agree — otherwise React reports a mismatch.
export function relativeTime(iso: string | null, nowMs: number): string {
  if (!iso) return "never updated";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "never updated";

  const diff = Math.max(0, nowMs - then);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(diff / DAY_MS);
  if (days < 31) return `${days}d ago`;

  const months = Math.floor(days / 30);
  return months < 12 ? `${months}mo ago` : `${Math.floor(days / 365)}y ago`;
}
