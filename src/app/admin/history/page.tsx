import Link from "next/link";
import { Alert, Card, PageHeader, SectionTitle, StatusBadge, Th } from "@/components/ui";
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

export const metadata = { title: "History · Aromatic Ghana" };

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
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6">
      <PageHeader
        title="Price history"
        description="Append-only. Nothing here is ever edited or deleted."
        actions={
          <a
            href="/admin/export"
            download
            className="inline-flex min-h-10 items-center rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent transition hover:bg-accent-hover"
          >
            Download CSV
          </a>
        }
      />

      <div className="space-y-4">
        <Card>
          <SectionTitle>Export price list</SectionTitle>
          <p className="mt-1.5 text-sm text-muted">
            Current prices for all{" "}
            <span className="nums font-medium text-foreground">{exportSummary.total}</span>{" "}
            active SKUs, as quoted plus a {EXPORT_CURRENCY} conversion.{" "}
            <span className="nums font-medium text-foreground">
              {exportSummary.priced}
            </span>{" "}
            priced so far.
          </p>

          {exportSummary.missingRate > 0 ? (
            <p className="mt-2 text-xs font-medium text-warning-fg">
              {exportSummary.missingRate}{" "}
              {exportSummary.missingRate === 1 ? "row has" : "rows have"} no{" "}
              {EXPORT_CURRENCY} rate for their currency — those export blank rather than a
              guessed figure.
            </p>
          ) : null}
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
          <Card padded={false} className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] border-collapse text-left">
                <thead className="bg-surface-sunken">
                  <tr>
                    <Th>When</Th>
                    <Th>Product</Th>
                    <Th align="right">Price</Th>
                    <Th align="center">Stock</Th>
                    <Th>By</Th>
                    <Th>Vendor</Th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-t border-line align-top">
                      <td className="nums whitespace-nowrap px-4 py-3 text-xs text-muted">
                        {formatWhen(entry.changedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="block text-sm font-medium text-foreground">
                          {entry.brandName} · {entry.variantName}
                        </span>
                        <span className="block font-mono text-[11px] text-muted-soft">
                          {entry.skuCode}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-1.5">
                          {entry.entryType === "verification" ? (
                            <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-muted">
                              verified unchanged
                            </span>
                          ) : null}
                          {entry.source === "offline_sync" ? (
                            <span className="rounded-full bg-info-bg px-2 py-0.5 text-[11px] font-medium text-info-fg">
                              offline sync
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td className="nums px-4 py-3 text-right">
                        <span className="block text-sm font-semibold text-foreground">
                          {priceLabel(entry)}
                        </span>
                        {entry.cartonPrice && entry.cartonQty ? (
                          <span className="block text-[11px] text-muted">
                            carton{" "}
                            {entry.priceCurrency
                              ? formatMoney(
                                  entry.priceCurrency,
                                  Number(entry.cartonPrice),
                                )
                              : entry.cartonPrice}{" "}
                            / {entry.cartonQty}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={entry.stockStatus} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted">{entry.changedBy}</td>
                      <td className="px-4 py-3 text-xs text-muted">
                        {entry.vendor ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {pageCount > 1 ? (
          <div className="flex items-center justify-between gap-2">
            {page > 1 ? (
              <Link
                href={pageHref(page - 1)}
                className="flex min-h-10 items-center rounded-lg border border-line-strong px-4 text-sm font-medium text-muted transition hover:bg-surface-sunken"
              >
                Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="nums text-xs text-muted">
              Page {page} of {pageCount}
            </span>
            {page < pageCount ? (
              <Link
                href={pageHref(page + 1)}
                className="flex min-h-10 items-center rounded-lg border border-line-strong px-4 text-sm font-medium text-muted transition hover:bg-surface-sunken"
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
