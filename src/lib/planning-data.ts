import "server-only";
import { convertAmount } from "./currencies";
import { getFxSettings, getLatestRates } from "./fx";
import { prisma } from "./prisma";
import { volatility, type VolatilityScore } from "./planning";

export type PlanningSku = {
  id: string;
  skuCode: string;
  brandName: string;
  variantName: string;
  sizeMl: number;
  concentration: string;
  stockStatus: string;
  localStockQty: number | null;
  minimumOrderQty: number | null;
  cartonQty: number | null;
  /// Quoted price and currency, kept for display.
  price: number | null;
  priceCurrency: string | null;
  /// Unit cost converted into the base currency — what the modelling works in.
  costInBase: number | null;
  volatility: VolatilityScore | null;
  competitorBest: { competitor: string; price: number; currency: string } | null;
};

export type PlanningData = {
  baseCurrency: string;
  rates: Record<string, number>;
  skus: PlanningSku[];
  /// Currencies with a rate, for the stress-test controls.
  currencies: string[];
};

export async function getPlanningData(): Promise<PlanningData> {
  const settings = await getFxSettings();
  const rateRows = await getLatestRates(
    settings.baseCurrency,
    settings.selectedCurrencies,
  );
  const rates: Record<string, number> = {};
  for (const row of rateRows) rates[row.currency] = row.rate;

  const skus = await prisma.sku.findMany({
    where: { isActive: true, variant: { isActive: true, brand: { isActive: true } } },
    orderBy: [
      { variant: { brand: { sortOrder: "asc" } } },
      { variant: { name: "asc" } },
      { sizeMl: "asc" },
    ],
    select: {
      id: true,
      variantId: true,
      skuCode: true,
      sizeMl: true,
      concentration: true,
      stockStatus: true,
      localStockQty: true,
      minimumOrderQty: true,
      cartonQty: true,
      singlePrice: true,
      priceCurrency: true,
      variant: {
        select: { name: true, brand: { select: { name: true } } },
      },
      // Oldest-first so the volatility series reads chronologically.
      history: {
        where: { entryType: "price_change", singlePrice: { not: null } },
        orderBy: { changedAt: "asc" },
        take: 100,
        select: { singlePrice: true, priceCurrency: true },
      },
    },
  });

  // Competitor prices are recorded against a *variant* (spec/EXTRA_FEATURES §1),
  // optionally narrowed to a size. Reading them through the Sku relation alone
  // would silently miss every variant-level entry.
  const competitorRows = await prisma.competitorPrice.findMany({
    orderBy: { observedAt: "desc" },
    take: 500,
    select: {
      variantId: true,
      skuId: true,
      competitor: true,
      price: true,
      currency: true,
    },
  });

  return {
    baseCurrency: settings.baseCurrency,
    rates,
    currencies: rateRows.map((row) => row.currency),
    skus: skus.map((sku) => {
      const price = sku.singlePrice === null ? null : Number(String(sku.singlePrice));
      const costInBase =
        price === null || sku.priceCurrency === null
          ? null
          : convertAmount(price, sku.priceCurrency, settings.baseCurrency, rates);

      // Volatility is measured in one currency, otherwise a shop switching from
      // SAR to AED would read as a 3.7x price swing.
      const series = sku.history
        .map((row) => {
          const value = row.singlePrice === null ? null : Number(String(row.singlePrice));
          if (value === null || row.priceCurrency === null) return null;
          return convertAmount(value, row.priceCurrency, settings.baseCurrency, rates);
        })
        .filter((value): value is number => value !== null);

      // A row pinned to this exact size wins; otherwise fall back to the
      // variant-wide observation.
      const competitors = competitorRows
        .filter(
          (row) =>
            row.skuId === sku.id || (row.skuId === null && row.variantId === sku.variantId),
        )
        .map((row) => ({
          competitor: row.competitor,
          price: Number(String(row.price)),
          currency: row.currency,
        }))
        .filter((row) => Number.isFinite(row.price) && row.price > 0);

      return {
        id: sku.id,
        skuCode: sku.skuCode,
        brandName: sku.variant.brand.name,
        variantName: sku.variant.name,
        sizeMl: sku.sizeMl,
        concentration: sku.concentration,
        stockStatus: sku.stockStatus,
        localStockQty: sku.localStockQty,
        minimumOrderQty: sku.minimumOrderQty,
        cartonQty: sku.cartonQty,
        price,
        priceCurrency: sku.priceCurrency,
        costInBase,
        volatility: volatility(series),
        competitorBest:
          competitors.length === 0
            ? null
            : competitors.reduce((best, row) => (row.price < best.price ? row : best)),
      };
    }),
  };
}

export async function getCostAssumption() {
  return prisma.costAssumption.findFirst({ orderBy: { effectiveFrom: "desc" } });
}
