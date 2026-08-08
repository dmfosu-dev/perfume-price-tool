import "server-only";
import { cache } from "react";
import {
  DEFAULT_BASE_CURRENCY,
  DEFAULT_PRICE_CURRENCY,
  DEFAULT_SELECTED_CURRENCIES,
  isSupportedCurrency,
} from "./currencies";
import type { FxSource } from "./enums";
import { prisma } from "./prisma";

export const FX_SETTING_ID = "singleton";

export type FxSettings = {
  source: FxSource;
  baseCurrency: string;
  /// Default currency offered for price entry on the dashboard.
  priceEntryCurrency: string;
  selectedCurrencies: string[];
  refreshIntervalHours: number;
  lastFetchAt: Date | null;
  lastFetchError: string | null;
};

export type FxRateRow = {
  currency: string;
  rate: number;
  source: string;
  fetchedAt: Date;
  setBy: string | null;
};

/// Stored as a JSON string because SQLite has no array type. Bad data must not
/// break the page, so anything unparseable falls back to the defaults.
export function parseSelectedCurrencies(
  raw: string,
  base: string,
  priceEntry: string,
): string[] {
  let codes: string[] = [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) codes = parsed.filter(isSupportedCurrency);
  } catch {
    codes = [];
  }
  if (codes.length === 0) codes = [...DEFAULT_SELECTED_CURRENCIES];
  return normaliseSelection(codes, base, priceEntry);
}

/**
 * Rates are quoted from the base, and every price is quoted in some currency —
 * converting either without a rate is impossible. So the base and the default
 * price-entry currency are always tracked. Nothing else is forced: SAR is a
 * sensible default, not a requirement, since shops abroad quote in their own.
 */
export function normaliseSelection(
  codes: readonly string[],
  base: string,
  priceEntry: string,
): string[] {
  const set = new Set(codes.filter(isSupportedCurrency));
  if (isSupportedCurrency(base)) set.add(base);
  if (isSupportedCurrency(priceEntry)) set.add(priceEntry);
  return [...set].sort();
}

export const getFxSettings = cache(async (): Promise<FxSettings> => {
  const row = await prisma.fxSetting.findUnique({ where: { id: FX_SETTING_ID } });

  if (!row) {
    return {
      source: "exchangerate_api",
      baseCurrency: DEFAULT_BASE_CURRENCY,
      priceEntryCurrency: DEFAULT_PRICE_CURRENCY,
      selectedCurrencies: normaliseSelection(
        DEFAULT_SELECTED_CURRENCIES,
        DEFAULT_BASE_CURRENCY,
        DEFAULT_PRICE_CURRENCY,
      ),
      refreshIntervalHours: 24,
      lastFetchAt: null,
      lastFetchError: null,
    };
  }

  const baseCurrency = isSupportedCurrency(row.baseCurrency)
    ? row.baseCurrency
    : DEFAULT_BASE_CURRENCY;
  const priceEntryCurrency = isSupportedCurrency(row.priceEntryCurrency)
    ? row.priceEntryCurrency
    : DEFAULT_PRICE_CURRENCY;

  return {
    source: row.source as FxSource,
    baseCurrency,
    priceEntryCurrency,
    selectedCurrencies: parseSelectedCurrencies(
      row.selectedCurrencies,
      baseCurrency,
      priceEntryCurrency,
    ),
    refreshIntervalHours: row.refreshIntervalHours,
    lastFetchAt: row.lastFetchAt,
    lastFetchError: row.lastFetchError,
  };
});

/// Newest row per currency for the current base. Rates stored against a former
/// base are ignored rather than deleted, so switching back restores them.
export async function getLatestRates(
  baseCurrency: string,
  selected: readonly string[],
): Promise<FxRateRow[]> {
  const rows = await prisma.fxRate.findMany({
    where: { baseCurrency, currency: { in: [...selected] } },
    orderBy: { fetchedAt: "desc" },
    select: {
      currency: true,
      rate: true,
      source: true,
      fetchedAt: true,
      setBy: { select: { email: true } },
    },
  });

  const seen = new Map<string, FxRateRow>();
  for (const row of rows) {
    if (seen.has(row.currency)) continue;
    const rate = Number(String(row.rate));
    if (!Number.isFinite(rate) || rate <= 0) continue;
    seen.set(row.currency, {
      currency: row.currency,
      rate,
      source: row.source,
      fetchedAt: row.fetchedAt,
      setBy: row.setBy?.email ?? null,
    });
  }

  return selected
    .map((code) => seen.get(code))
    .filter((row): row is FxRateRow => row !== undefined);
}

export type FxHealth = {
  stale: boolean;
  reason: string | null;
  missing: string[];
};

/**
 * Spec §3.6 fallback rule: a failed fetch must never block price entry. The last
 * known good rate keeps being used and is flagged as stale instead.
 */
export function assessFxHealth(
  settings: FxSettings,
  rates: FxRateRow[],
  nowMs: number,
): FxHealth {
  const present = new Set(rates.map((rate) => rate.currency));
  const missing = settings.selectedCurrencies.filter((code) => !present.has(code));

  if (settings.lastFetchError) {
    return {
      stale: true,
      reason: `Last automatic update failed: ${settings.lastFetchError}`,
      missing,
    };
  }
  if (rates.length === 0) return { stale: false, reason: null, missing };

  const oldest = Math.min(...rates.map((rate) => rate.fetchedAt.getTime()));
  const ageHours = (nowMs - oldest) / 3_600_000;
  const limitHours =
    settings.source === "manual" ? 30 * 24 : settings.refreshIntervalHours * 2;

  if (ageHours > limitHours) {
    const days = Math.floor(ageHours / 24);
    return {
      stale: true,
      reason:
        settings.source === "manual"
          ? `Rates were set ${days} days ago.`
          : `Rates have not refreshed in ${days} days.`,
      missing,
    };
  }

  return { stale: false, reason: null, missing };
}

/**
 * Everything the browser needs to convert money, without doing rate lookups of
 * its own. Prices are no longer anchored to one currency: each SKU records what
 * it was quoted in, so the client gets the whole rate table and converts from
 * whichever currency that row uses.
 */
export type ConversionView = {
  baseCurrency: string;
  priceEntryCurrency: string;
  /// 1 baseCurrency = rates[code] of code.
  rates: Record<string, number>;
  /// Currencies to show beside a price, base first then alphabetical.
  displayOrder: string[];
  /// Currencies that can be used for price entry — only those with a rate, or
  /// their prices could never be converted.
  entryOptions: string[];
};

export function buildConversionView(
  settings: FxSettings,
  rates: FxRateRow[],
): ConversionView {
  const table: Record<string, number> = {};
  for (const row of rates) table[row.currency] = row.rate;

  const withRates = settings.selectedCurrencies.filter(
    (code) => table[code] !== undefined,
  );

  const displayOrder = [...withRates].sort((a, b) => {
    if (a === settings.baseCurrency) return -1;
    if (b === settings.baseCurrency) return 1;
    return a.localeCompare(b);
  });

  const entryOptions = [...withRates].sort((a, b) => {
    if (a === settings.priceEntryCurrency) return -1;
    if (b === settings.priceEntryCurrency) return 1;
    return a.localeCompare(b);
  });

  return {
    baseCurrency: settings.baseCurrency,
    priceEntryCurrency: settings.priceEntryCurrency,
    rates: table,
    displayOrder,
    entryOptions,
  };
}

/// Bundles the reads with the timestamp they are judged against, so callers do
/// not read the clock impurely during render.
export async function getFxStatus(): Promise<{
  settings: FxSettings;
  rates: FxRateRow[];
  health: FxHealth;
  conversion: ConversionView;
}> {
  const settings = await getFxSettings();
  const rates = await getLatestRates(settings.baseCurrency, settings.selectedCurrencies);
  return {
    settings,
    rates,
    health: assessFxHealth(settings, rates, Date.now()),
    conversion: buildConversionView(settings, rates),
  };
}
