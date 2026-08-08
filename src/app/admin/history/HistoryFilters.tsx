"use client";

import Link from "next/link";
import type { HistoryFilters } from "@/lib/history";

/**
 * Plain GET form: filters live in the URL, so a filtered view can be linked,
 * bookmarked and back-buttoned. No client state to keep in sync.
 */
export function HistoryFilterBar({
  filters,
  brands,
  vendors,
  users,
  total,
}: {
  filters: HistoryFilters;
  brands: { id: string; name: string }[];
  vendors: { id: string; name: string }[];
  users: { id: string; email: string }[];
  total: number;
}) {
  const hasFilters =
    filters.brandId !== null ||
    filters.skuQuery !== null ||
    filters.userId !== null ||
    filters.vendorId !== null ||
    filters.dateFrom !== null ||
    filters.dateTo !== null ||
    filters.entryType !== "price_change";

  const field =
    "h-11 w-full rounded-lg border border-line bg-surface px-2.5 text-sm text-foreground";

  return (
    <form method="get" className="space-y-2.5">
      <input
        type="search"
        name="q"
        defaultValue={filters.skuQuery ?? ""}
        placeholder="SKU code"
        aria-label="Filter by SKU code"
        className={field}
      />

      <div className="grid grid-cols-2 gap-2">
        <label>
          <span className="mb-1 block text-xs font-medium text-muted">
            Brand
          </span>
          <select name="brandId" defaultValue={filters.brandId ?? ""} className={field}>
            <option value="">All brands</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-1 block text-xs font-medium text-muted">
            Updated by
          </span>
          <select name="userId" defaultValue={filters.userId ?? ""} className={field}>
            <option value="">Anyone</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.email}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-1 block text-xs font-medium text-muted">
            Vendor
          </span>
          <select name="vendorId" defaultValue={filters.vendorId ?? ""} className={field}>
            <option value="">Any vendor</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-1 block text-xs font-medium text-muted">
            Entry type
          </span>
          <select name="entryType" defaultValue={filters.entryType} className={field}>
            <option value="price_change">Price changes</option>
            <option value="verification">Verifications</option>
            <option value="all">Both</option>
          </select>
        </label>

        <label>
          <span className="mb-1 block text-xs font-medium text-muted">
            From
          </span>
          <input
            type="date"
            name="from"
            defaultValue={filters.dateFrom ?? ""}
            className={field}
          />
        </label>

        <label>
          <span className="mb-1 block text-xs font-medium text-muted">
            To
          </span>
          <input
            type="date"
            name="to"
            defaultValue={filters.dateTo ?? ""}
            className={field}
          />
        </label>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="min-h-11 flex-1 rounded-lg bg-accent text-sm font-semibold text-white"
        >
          Apply filters
        </button>
        {hasFilters ? (
          <Link
            href="/admin/history"
            className="flex min-h-11 items-center rounded-lg border border-line-strong px-4 text-sm font-medium text-muted"
          >
            Clear
          </Link>
        ) : null}
      </div>

      <p className="text-xs text-muted">
        {total} {total === 1 ? "entry" : "entries"}
      </p>
    </form>
  );
}
