// Admin-only financial modelling (EXTRA_FEATURES §1, permitted by the amended
// spec §7). Pure functions — no database, no `server-only` — so the same maths
// runs on the server for the initial render and in the browser as the admin
// drags the inputs about.

export type CostInputs = {
  /// Freight attributable to one bottle, in the base currency.
  shippingPerUnit: number;
  /// Duty as a percentage of goods value, e.g. 20 for 20%.
  customsRatePct: number;
  /// Any flat per-unit extra: clearing agent, handling, packaging.
  otherFeesPerUnit: number;
  /// Desired profit as a percentage of the selling price (margin, not markup).
  targetMarginPct: number;
};

export const DEFAULT_COST_INPUTS: CostInputs = {
  shippingPerUnit: 0,
  customsRatePct: 0,
  otherFeesPerUnit: 0,
  targetMarginPct: 35,
};

export type LandedCost = {
  goods: number;
  duty: number;
  shipping: number;
  otherFees: number;
  total: number;
  /// Price that achieves the target margin. Null when the margin is >= 100%,
  /// which has no finite solution.
  suggestedRetail: number | null;
  /// Profit per unit at the suggested price.
  profit: number | null;
};

/**
 * Margin is on the selling price: price = cost / (1 - margin). Markup would be
 * cost * (1 + rate), which yields a different — and smaller — number. Using the
 * wrong one is the classic pricing error, so it is spelled out here.
 */
export function landedCost(goodsCost: number, inputs: CostInputs): LandedCost {
  const goods = Number.isFinite(goodsCost) && goodsCost > 0 ? goodsCost : 0;
  const duty = goods * (Math.max(0, inputs.customsRatePct) / 100);
  const shipping = Math.max(0, inputs.shippingPerUnit);
  const otherFees = Math.max(0, inputs.otherFeesPerUnit);
  const total = goods + duty + shipping + otherFees;

  const margin = inputs.targetMarginPct / 100;
  const suggestedRetail = margin >= 1 || margin < 0 ? null : total / (1 - margin);
  const profit = suggestedRetail === null ? null : suggestedRetail - total;

  return { goods, duty, shipping, otherFees, total, suggestedRetail, profit };
}

/// Margin actually achieved if sold at `price`, as a percentage of that price.
export function marginAt(price: number, cost: number): number | null {
  if (!Number.isFinite(price) || price <= 0) return null;
  return ((price - cost) / price) * 100;
}

export type VolatilityScore = {
  /// Coefficient of variation as a percentage — standard deviation relative to
  /// the mean, so a 5 SAR swing on a 50 SAR bottle outranks the same swing on
  /// a 500 SAR one.
  score: number;
  changes: number;
  min: number;
  max: number;
  mean: number;
  latest: number;
};

/**
 * EXTRA_FEATURES §1: flags perfumes whose price moves a lot, to buy in bulk on
 * dips rather than on demand. Needs at least two observations — a single price
 * has no variation to measure, and reporting 0% for it would read as "stable"
 * when the truth is "unknown".
 */
export function volatility(prices: readonly number[]): VolatilityScore | null {
  const values = prices.filter((value) => Number.isFinite(value) && value > 0);
  if (values.length < 2) return null;

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  if (mean <= 0) return null;

  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const score = (Math.sqrt(variance) / mean) * 100;

  return {
    score,
    changes: values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    mean,
    latest: values[values.length - 1],
  };
}

export function volatilityBand(score: number): "stable" | "moderate" | "volatile" {
  if (score < 5) return "stable";
  if (score < 15) return "moderate";
  return "volatile";
}
