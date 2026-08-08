import "server-only";
import { prisma } from "./prisma";

// Spec §3.7: full price-change log, filterable by SKU, brand, user and date
// range. Vendor and entry type are added from EXTRA_FEATURES §3 and §2.

export const HISTORY_PAGE_SIZE = 50;

export type HistoryFilters = {
  brandId: string | null;
  skuQuery: string | null;
  userId: string | null;
  vendorId: string | null;
  /// "price_change" | "verification" | "all"
  entryType: string;
  dateFrom: string | null;
  dateTo: string | null;
  page: number;
};

export type HistoryEntry = {
  id: string;
  changedAt: string;
  skuCode: string;
  variantName: string;
  brandName: string;
  singlePrice: string | null;
  cartonPrice: string | null;
  cartonQty: number | null;
  priceCurrency: string | null;
  stockStatus: string;
  entryType: string;
  source: string;
  changedBy: string;
  vendor: string | null;
};

function first(value: string | string[] | undefined): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}

export function parseHistoryFilters(
  params: Record<string, string | string[] | undefined>,
): HistoryFilters {
  const rawType = first(params.entryType) ?? "price_change";
  const page = Number(first(params.page) ?? "1");

  return {
    brandId: first(params.brandId),
    skuQuery: first(params.q),
    userId: first(params.userId),
    vendorId: first(params.vendorId),
    entryType: ["price_change", "verification", "all"].includes(rawType)
      ? rawType
      : "price_change",
    dateFrom: first(params.from),
    dateTo: first(params.to),
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/// `input type="date"` gives YYYY-MM-DD. The end of a range must cover the whole
/// day, otherwise "to: today" silently excludes everything logged today.
function dayBounds(from: string | null, to: string | null) {
  const range: { gte?: Date; lt?: Date } = {};

  if (from) {
    const start = new Date(`${from}T00:00:00`);
    if (!Number.isNaN(start.getTime())) range.gte = start;
  }
  if (to) {
    const end = new Date(`${to}T00:00:00`);
    if (!Number.isNaN(end.getTime())) {
      end.setDate(end.getDate() + 1);
      range.lt = end;
    }
  }
  return range;
}

function money(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(String(value));
  return Number.isFinite(parsed) ? parsed.toFixed(2) : null;
}

export async function getHistory(filters: HistoryFilters): Promise<{
  entries: HistoryEntry[];
  total: number;
  page: number;
  pageCount: number;
}> {
  const dates = dayBounds(filters.dateFrom, filters.dateTo);

  const where = {
    ...(filters.entryType === "all" ? {} : { entryType: filters.entryType }),
    ...(filters.userId ? { changedById: filters.userId } : {}),
    ...(filters.vendorId ? { vendorId: filters.vendorId } : {}),
    ...(Object.keys(dates).length > 0 ? { changedAt: dates } : {}),
    ...(filters.brandId || filters.skuQuery
      ? {
          sku: {
            ...(filters.skuQuery
              ? { skuCode: { contains: filters.skuQuery } }
              : {}),
            ...(filters.brandId
              ? { variant: { brandId: filters.brandId } }
              : {}),
          },
        }
      : {}),
  };

  const total = await prisma.priceHistory.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE));
  const page = Math.min(filters.page, pageCount);

  const rows = await prisma.priceHistory.findMany({
    where,
    orderBy: { changedAt: "desc" },
    skip: (page - 1) * HISTORY_PAGE_SIZE,
    take: HISTORY_PAGE_SIZE,
    select: {
      id: true,
      changedAt: true,
      singlePrice: true,
      cartonPrice: true,
      cartonQty: true,
      priceCurrency: true,
      stockStatus: true,
      entryType: true,
      source: true,
      changedBy: { select: { email: true } },
      vendor: { select: { name: true } },
      sku: {
        select: {
          skuCode: true,
          variant: { select: { name: true, brand: { select: { name: true } } } },
        },
      },
    },
  });

  return {
    entries: rows.map((row) => ({
      id: row.id,
      changedAt: row.changedAt.toISOString(),
      skuCode: row.sku.skuCode,
      variantName: row.sku.variant.name,
      brandName: row.sku.variant.brand.name,
      singlePrice: money(row.singlePrice),
      cartonPrice: money(row.cartonPrice),
      cartonQty: row.cartonQty,
      priceCurrency: row.priceCurrency,
      stockStatus: row.stockStatus,
      entryType: row.entryType,
      source: row.source,
      changedBy: row.changedBy.email,
      vendor: row.vendor?.name ?? null,
    })),
    total,
    page,
    pageCount,
  };
}

/// Options for the filter selects. Only users who have actually logged a change
/// appear, so the list does not fill with accounts that never touched a price.
export async function getHistoryFilterOptions() {
  const [brands, vendors, userIds] = await Promise.all([
    prisma.brand.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    prisma.vendor.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.priceHistory.findMany({
      distinct: ["changedById"],
      select: { changedById: true },
    }),
  ]);

  const users =
    userIds.length === 0
      ? []
      : await prisma.user.findMany({
          where: { id: { in: userIds.map((row) => row.changedById) } },
          orderBy: { email: "asc" },
          select: { id: true, email: true },
        });

  return { brands, vendors, users };
}
