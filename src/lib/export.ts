import "server-only";
import { convertAmount, decimalsFor } from "./currencies";
import { getFxSettings, getLatestRates } from "./fx";
import { prisma } from "./prisma";
import { toCsv } from "./csv";

/**
 * Spec §3.7 + §8.4: the manual bridge to the storefront.
 *
 * Each row carries the price exactly as quoted (`single_price` +
 * `price_currency`) *and* a USD conversion. The storefront consumes the USD
 * column so it never has to know that sources quote in different currencies;
 * the original is kept so nothing is lost to rounding or a stale rate.
 */
export const EXPORT_CURRENCY = "USD";

const HEADER = [
  "sku_code",
  "brand",
  "variant",
  "gender",
  "size_ml",
  "concentration",
  "stock_status",
  "price_currency",
  "single_price",
  "carton_price",
  "carton_qty",
  `single_price_${EXPORT_CURRENCY.toLowerCase()}`,
  `carton_price_${EXPORT_CURRENCY.toLowerCase()}`,
  "last_updated_at",
  "last_updated_by",
] as const;

function money(value: unknown): string {
  if (value === null || value === undefined) return "";
  const parsed = Number(String(value));
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "";
}

export type ExportResult = {
  csv: string;
  filename: string;
  rowCount: number;
  /// Rows whose currency had no rate, so no USD figure could be produced.
  unconvertible: number;
};

export async function buildPriceListCsv(): Promise<ExportResult> {
  const settings = await getFxSettings();
  const rateRows = await getLatestRates(
    settings.baseCurrency,
    settings.selectedCurrencies,
  );

  const rates: Record<string, number> = {};
  for (const row of rateRows) rates[row.currency] = row.rate;

  const skus = await prisma.sku.findMany({
    where: { isActive: true, variant: { brand: { isActive: true } } },
    orderBy: [
      { variant: { brand: { sortOrder: "asc" } } },
      { variant: { name: "asc" } },
      { sizeMl: "asc" },
    ],
    select: {
      skuCode: true,
      sizeMl: true,
      concentration: true,
      stockStatus: true,
      singlePrice: true,
      cartonPrice: true,
      cartonQty: true,
      priceCurrency: true,
      lastUpdatedAt: true,
      lastUpdatedBy: { select: { email: true } },
      variant: {
        select: {
          name: true,
          gender: true,
          isActive: true,
          brand: { select: { name: true } },
        },
      },
    },
  });

  let unconvertible = 0;

  const rows = skus
    .filter((sku) => sku.variant.isActive)
    .map((sku) => {
      const currency = sku.priceCurrency;

      // Only attempt a conversion when there is both a price and a rate for its
      // currency. A missing rate exports blank rather than a guessed number.
      const toExport = (value: unknown): string => {
        if (value === null || value === undefined || currency === null) return "";
        const amount = Number(String(value));
        if (!Number.isFinite(amount)) return "";
        const converted = convertAmount(amount, currency, EXPORT_CURRENCY, rates);
        return converted === null ? "" : converted.toFixed(decimalsFor(EXPORT_CURRENCY));
      };

      const singleUsd = toExport(sku.singlePrice);
      if (sku.singlePrice !== null && singleUsd === "") unconvertible++;

      return [
        sku.skuCode,
        sku.variant.brand.name,
        sku.variant.name,
        sku.variant.gender,
        sku.sizeMl,
        sku.concentration,
        sku.stockStatus,
        currency ?? "",
        money(sku.singlePrice),
        money(sku.cartonPrice),
        sku.cartonQty ?? "",
        singleUsd,
        toExport(sku.cartonPrice),
        sku.lastUpdatedAt?.toISOString() ?? "",
        sku.lastUpdatedBy?.email ?? "",
      ];
    });

  const stamp = new Date().toISOString().slice(0, 10);

  return {
    csv: toCsv(HEADER, rows),
    filename: `price-list-${stamp}.csv`,
    rowCount: rows.length,
    unconvertible,
  };
}

/// Counts shown next to the download button so the admin knows what they'll get.
export async function getExportSummary(): Promise<{
  total: number;
  priced: number;
  missingRate: number;
}> {
  const settings = await getFxSettings();
  const rateRows = await getLatestRates(
    settings.baseCurrency,
    settings.selectedCurrencies,
  );
  const withRates = new Set(rateRows.map((row) => row.currency));

  const skus = await prisma.sku.findMany({
    where: {
      isActive: true,
      variant: { isActive: true, brand: { isActive: true } },
    },
    select: { singlePrice: true, priceCurrency: true },
  });

  let priced = 0;
  let missingRate = 0;
  for (const sku of skus) {
    if (sku.singlePrice === null) continue;
    priced++;
    const canConvert =
      sku.priceCurrency !== null &&
      (sku.priceCurrency === EXPORT_CURRENCY || withRates.has(sku.priceCurrency)) &&
      (withRates.has(EXPORT_CURRENCY) || sku.priceCurrency === EXPORT_CURRENCY);
    if (!canConvert) missingRate++;
  }

  return { total: skus.length, priced, missingRate };
}
