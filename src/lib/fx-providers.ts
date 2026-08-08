import { isSupportedCurrency } from "./currencies";

// Kept free of database access and `server-only` so the response parsing can be
// unit-tested without a server runtime.
//
// ExchangeRate-API is the primary source (free tier, 1500 requests/month — so
// rates are only fetched on an explicit admin action, never on page load).
// Wise is the automatic fallback when the primary fails.

export type FetchedRates = Record<string, number>;

export type FetchOutcome = {
  rates: FetchedRates;
  /// Which provider actually produced these rates — may differ from the one
  /// asked for, if the primary failed and the fallback took over.
  provider: string;
  /// Set when the primary failed but the fallback succeeded.
  fellBackFrom?: string;
};

function toRate(value: unknown): number | null {
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

/// Keeps only the currencies asked for, so an provider returning 160 codes does
/// not end up stored or shipped to the browser.
function pick(all: Record<string, unknown>, wanted: readonly string[]): FetchedRates {
  const rates: FetchedRates = {};
  for (const code of wanted) {
    if (!isSupportedCurrency(code)) continue;
    const rate = toRate(all[code]);
    if (rate !== null) rates[code] = rate;
  }
  return rates;
}

export function parseExchangeRateApiResponse(
  payload: unknown,
  wanted: readonly string[],
): FetchedRates {
  const body = payload as { result?: unknown; conversion_rates?: unknown };
  if (body?.result !== "success") return {};
  const table = body.conversion_rates;
  if (typeof table !== "object" || table === null) return {};
  return pick(table as Record<string, unknown>, wanted);
}

export function parseWiseResponse(
  payload: unknown,
  wanted: readonly string[],
): FetchedRates {
  if (!Array.isArray(payload)) return {};
  const table: Record<string, unknown> = {};
  for (const entry of payload) {
    const target = (entry as { target?: unknown })?.target;
    if (typeof target === "string") table[target] = (entry as { rate?: unknown }).rate;
  }
  return pick(table, wanted);
}

export function buildRequest(
  provider: "exchangerate_api" | "wise",
  base: string,
  env: NodeJS.ProcessEnv,
): { url: string; headers: Record<string, string> } {
  if (provider === "exchangerate_api") {
    const key = env.EXCHANGERATE_API_KEY;
    if (!key) throw new Error("EXCHANGERATE_API_KEY is not configured.");
    return {
      url: `https://v6.exchangerate-api.com/v6/${key}/latest/${base}`,
      headers: {},
    };
  }

  const token = env.WISE_API_TOKEN;
  if (!token) throw new Error("WISE_API_TOKEN is not configured.");
  return {
    url: `https://api.wise.com/v1/rates?source=${base}`,
    headers: { Authorization: `Bearer ${token}` },
  };
}

const LABELS: Record<string, string> = {
  exchangerate_api: "ExchangeRate-API",
  wise: "Wise",
};

export function providerLabel(provider: string): string {
  return LABELS[provider] ?? provider;
}

async function fetchFromProvider(
  provider: "exchangerate_api" | "wise",
  base: string,
  wanted: readonly string[],
): Promise<FetchedRates> {
  const { url, headers } = buildRequest(provider, base, process.env);

  const response = await fetch(url, {
    headers,
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`${providerLabel(provider)} responded ${response.status}.`);
  }

  const payload: unknown = await response.json();
  const rates =
    provider === "exchangerate_api"
      ? parseExchangeRateApiResponse(payload, wanted)
      : parseWiseResponse(payload, wanted);

  if (Object.keys(rates).length === 0) {
    throw new Error(`${providerLabel(provider)} returned no usable rates.`);
  }

  // Wise omits the base from its response (asking for USD returns only the
  // targets), while ExchangeRate-API includes it as 1. Normalise, or the base
  // currency silently disappears from the conversion table.
  if (rates[base] === undefined) rates[base] = 1;

  return rates;
}

/**
 * Fetches rates for `base`, limited to `wanted`. When the configured provider is
 * the primary and it fails, Wise is tried automatically — the caller only sees
 * an error if both are unavailable.
 */
export async function fetchRates(
  source: string,
  base: string,
  wanted: readonly string[],
): Promise<FetchOutcome> {
  if (source === "manual") {
    throw new Error("Manual rates are entered by hand, not fetched.");
  }
  if (source !== "exchangerate_api" && source !== "wise") {
    throw new Error(`Unknown rate source "${source}".`);
  }

  try {
    const rates = await fetchFromProvider(source, base, wanted);
    return { rates, provider: source };
  } catch (primaryError) {
    if (source !== "exchangerate_api") throw primaryError;

    // Primary failed — fall back to Wise rather than leaving rates unrefreshed.
    try {
      const rates = await fetchFromProvider("wise", base, wanted);
      return { rates, provider: "wise", fellBackFrom: "exchangerate_api" };
    } catch (fallbackError) {
      const primary =
        primaryError instanceof Error ? primaryError.message : String(primaryError);
      const fallback =
        fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      throw new Error(`${primary} Wise fallback also failed: ${fallback}`);
    }
  }
}
