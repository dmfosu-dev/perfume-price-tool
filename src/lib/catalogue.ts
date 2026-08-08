import "server-only";
import { prisma } from "./prisma";

// Prices cross the server/client boundary as pre-formatted strings. Prisma's
// Decimal is not serialisable to a client component, and turning money into a
// float earlier than necessary is how rounding bugs start.
function money(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const asString =
    typeof value === "object" && value !== null && "toFixed" in value
      ? (value as { toFixed: (d: number) => string }).toFixed(2)
      : String(value);
  const parsed = Number(asString);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : null;
}

export type SkuView = {
  id: string;
  skuCode: string;
  sizeMl: number;
  concentration: string;
  singlePrice: string | null;
  cartonPrice: string | null;
  cartonQty: number | null;
  minimumOrderQty: number | null;
  /// True while an unresolved offline clash is parked against this SKU.
  hasConflict: boolean;
  /// Currency this SKU's price was quoted in; null when unpriced.
  priceCurrency: string | null;
  stockStatus: string;
  photoUrl: string | null;
  isPriority: boolean;
  priorityNote: string | null;
  lastUpdatedAt: string | null;
  lastUpdatedBy: string | null;
};

export type VariantView = {
  id: string;
  name: string;
  gender: string;
  skus: SkuView[];
};

export type BrandView = {
  id: string;
  name: string;
  variants: VariantView[];
};

export async function getCatalogue(): Promise<BrandView[]> {
  // One query rather than a flag on Sku: derived state cannot drift out of sync
  // with the conflicts themselves.
  const openConflicts = await prisma.priceConflict.findMany({
    where: { status: "open" },
    select: { skuId: true },
  });
  const conflicted = new Set(openConflicts.map((row) => row.skuId));

  const brands = await prisma.brand.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      variants: {
        where: { isActive: true },
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          gender: true,
          skus: {
            where: { isActive: true },
            orderBy: [{ sizeMl: "asc" }, { concentration: "asc" }],
            select: {
              id: true,
              skuCode: true,
              sizeMl: true,
              concentration: true,
              singlePrice: true,
              cartonPrice: true,
              cartonQty: true,
              minimumOrderQty: true,
              priceCurrency: true,
              stockStatus: true,
              photoUrl: true,
              isPriority: true,
              priorityNote: true,
              lastUpdatedAt: true,
              lastUpdatedBy: { select: { email: true } },
            },
          },
        },
      },
    },
  });

  return brands.map((brand) => ({
    id: brand.id,
    name: brand.name,
    variants: brand.variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      gender: variant.gender,
      skus: variant.skus.map((sku) => ({
        id: sku.id,
        skuCode: sku.skuCode,
        sizeMl: sku.sizeMl,
        concentration: sku.concentration,
        singlePrice: money(sku.singlePrice),
        cartonPrice: money(sku.cartonPrice),
        cartonQty: sku.cartonQty,
        minimumOrderQty: sku.minimumOrderQty,
        hasConflict: conflicted.has(sku.id),
        priceCurrency: sku.priceCurrency,
        stockStatus: sku.stockStatus,
        photoUrl: sku.photoUrl,
        isPriority: sku.isPriority,
        priorityNote: sku.priorityNote,
        lastUpdatedAt: sku.lastUpdatedAt?.toISOString() ?? null,
        lastUpdatedBy: sku.lastUpdatedBy?.email ?? null,
      })),
    })),
  }));
}

export async function getVendorNames(): Promise<string[]> {
  const vendors = await prisma.vendor.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { name: true },
  });
  return vendors.map((vendor) => vendor.name);
}

export type CatalogueSnapshot = {
  brands: BrandView[];
  vendors: string[];
  /// The instant this snapshot was taken. Relative times ("3d ago") are derived
  /// from it so server render and client hydration agree, and so the value is
  /// not read impurely during render.
  nowMs: number;
};

export async function getCatalogueSnapshot(): Promise<CatalogueSnapshot> {
  const [brands, vendors] = await Promise.all([getCatalogue(), getVendorNames()]);
  return { brands, vendors, nowMs: Date.now() };
}
