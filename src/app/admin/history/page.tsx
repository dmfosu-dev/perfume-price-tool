import Link from "next/link";
import { Alert, Card, StatusBadge } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/currencies";
import { EXPORT_CURRENCY, getExportSummary } from "@/lib/export";
import {
  getHistory,
  getHistoryFilterOptions,
  parseHistoryFilters,
  type HistoryEntry,
} from "@/lib/history";
import { HistoryFilterBar } from "./HistoryFilters";

export const metadata = { title: "History · Perfume Price Tool" };

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function priceLabel(entry: HistoryEntry): string {
  if (entry.singlePrice === null) return "no price";
  const currency = entry.priceCurrency;
  return currency === null
    ? entry.singlePrice
    : formatMoney(currency, Number(entry.singlePrice));
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const filters = parseHistoryFilters(params);

  const [{ entries, total, page, pageCount }, options, exportSummary] =
    await Promise.all([
      getHistory(filters),
      getHistoryFilterOptions(),
      getExportSummary(),
    ]);

  function pageHref(next: number): string {
    const query = new URLSearchParams();
    if (filters.skuQuery) query.set("q", filters.skuQuery);
    if (filters.brandId) query.set("brandId", filters.brandId);
    if (filters.userId) query.set("userId", filters.userId);
    if (filters.vendorId) query.set("vendorId", filters.vendorId);
    if (filters.dateFrom) query.set("from", filters.dateFrom);
    if (filters.dateTo) query.set("to", filters.dateTo);
    if (filters.entryType !== "price_change") query.set("entryType", filters.entryType);
    query.set("page", String(next));
    return `/admin/history?${query.toString()}`;
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      <h1 className="text-xl font-bold tracking-tight text-foreground">
        Price history
      </h1>
      <p className="mt-0.5 text-sm text-muted">
        Append-only. Nothing here is ever edited or deleted.
      </p>

      <div className="mt-5 space-y-4">
        <Card>
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-muted">
            Export price list
          </h2>
          <p className="text-sm text-muted">
            Current prices for all {exportSummary.total} active SKUs, as quoted plus a{" "}
            {EXPORT_CURRENCY} conversion. {exportSummary.priced} priced so far.
          </p>

          {exportSummary.missingRate > 0 ? (
            <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">
              {exportSummary.missingRate}{" "}
              {exportSummary.missingRate === 1 ? "row has" : "rows have"} no{" "}
              {EXPORT_CURRENCY} rate for their currency — those export blank rather
              than a guessed figure.
            </p>
          ) : null}

          <a
            href="/admin/export"
            download
            className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            Download CSV
          </a>
        </Card>

        <Card>
          <HistoryFilterBar
            filters={filters}
            brands={options.brands}
            vendors={options.vendors}
            users={options.users}
            total={total}
          />
        </Card>

        {entries.length === 0 ? (
          <Alert tone="info" title="Nothing logged yet">
            Price changes appear here as soon as an intermediary saves one.
            {filters.entryType === "price_change"
              ? " Verifications are hidden by default — switch Entry type to see them."
              : null}
          </Alert>
        ) : (
          <ul className="space-y-2">
            {entries.map((entry) => (
              <li key={entry.id}>
                <Card>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="font-semibold text-foreground">
                      {priceLabel(entry)}
                    </span>
                    {entry.cartonPrice && entry.cartonQty ? (
                      <span className="text-xs text-muted">
                        carton{" "}
                        {entry.priceCurrency
                          ? formatMoney(entry.priceCurrency, Number(entry.cartonPrice))
                          : entry.cartonPrice}{" "}
                        / {entry.cartonQty}
                      </span>
                    ) : null}
                    <StatusBadge status={entry.stockStatus} />
                    {entry.entryType === "verification" ? (
                      <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-medium text-muted">
                        verified unchanged
                      </span>
                    ) : null}
                    {entry.source === "offline_sync" ? (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                        offline sync
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-1 text-sm text-muted">
                    {entry.brandName} · {entry.variantName}
                  </p>
                  <p className="font-mono text-[11px] text-muted-soft">
                    {entry.skuCode}
                  </p>

                  <p className="mt-1 text-xs text-muted">
                    {formatWhen(entry.changedAt)} · {entry.changedBy}
                    {entry.vendor ? ` · ${entry.vendor}` : ""}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        )}

        {pageCount > 1 ? (
          <div className="flex items-center justify-between gap-2">
            {page > 1 ? (
              <Link
                href={pageHref(page - 1)}
                className="flex min-h-11 items-center rounded-lg border border-line-strong px-4 text-sm font-medium text-muted"
              >
                Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="text-xs text-muted">
              Page {page} of {pageCount}
            </span>
            {page < pageCount ? (
              <Link
                href={pageHref(page + 1)}
                className="flex min-h-11 items-center rounded-lg border border-line-strong px-4 text-sm font-medium text-muted"
              >
                Next
              </Link>
            ) : (
              <span />
            )}
          </div>
        ) : null}
      </div>
    </main>
  );
}
