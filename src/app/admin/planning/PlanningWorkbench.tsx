"use client";

import { useMemo, useState } from "react";
import { chipClass } from "@/components/ui";
import { convertAmount, currencyInfo, formatMoney } from "@/lib/currencies";
import type { PlanningData, PlanningSku } from "@/lib/planning-data";
import {
  compareToBaseline,
  landedCost,
  marginAt,
  volatilityBand,
  type CostInputs,
} from "@/lib/planning";
import { CompetitorPanel, SaveAssumptionsForm } from "./CompetitorPanel";

type Tab = "margin" | "restock" | "volatility" | "competitors";

const TABS: { key: Tab; label: string }[] = [
  { key: "margin", label: "Landed cost & margin" },
  { key: "restock", label: "Restock capital" },
  { key: "volatility", label: "Volatility" },
  { key: "competitors", label: "Competitors" },
];

function numberField(value: string): number {
  const parsed = Number(value.replace(/[\s,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function PlanningWorkbench({
  data,
  initialCosts,
  variantOptions,
  recentCompetitors,
}: {
  data: PlanningData;
  initialCosts: CostInputs;
  variantOptions: { id: string; label: string }[];
  recentCompetitors: {
    id: string;
    competitor: string;
    price: number;
    currency: string;
    variantLabel: string;
    observedAt: string;
  }[];
}) {
  const [tab, setTab] = useState<Tab>("margin");
  const [costs, setCosts] = useState({
    shippingPerUnit: String(initialCosts.shippingPerUnit),
    customsRatePct: String(initialCosts.customsRatePct),
    otherFeesPerUnit: String(initialCosts.otherFeesPerUnit),
    targetMarginPct: String(initialCosts.targetMarginPct),
  });

  // Stress test: a multiplier applied to every rate, never persisted. FxRate is
  // append-only and "newest wins", so writing a scenario there would silently
  // become the live rate.
  const [stressPct, setStressPct] = useState(0);
  const [sellCurrency, setSellCurrency] = useState(
    data.currencies.find((code) => code !== data.baseCurrency) ?? data.baseCurrency,
  );
  const [quantities, setQuantities] = useState<Record<string, string>>({});

  const inputs: CostInputs = {
    shippingPerUnit: numberField(costs.shippingPerUnit),
    customsRatePct: numberField(costs.customsRatePct),
    otherFeesPerUnit: numberField(costs.otherFeesPerUnit),
    targetMarginPct: numberField(costs.targetMarginPct),
  };

  /// Weakening the base by X% means each foreign unit buys less of it.
  const stressedRates = useMemo(() => {
    const factor = 1 + stressPct / 100;
    const next: Record<string, number> = {};
    for (const [code, rate] of Object.entries(data.rates)) {
      next[code] = code === data.baseCurrency ? rate : rate * factor;
    }
    return next;
  }, [data.rates, data.baseCurrency, stressPct]);

  /// Costs recomputed under the stressed rates. A SKU with no quote but with a
  /// research band is kept: modelling that band is the point of recording it,
  /// and dropping it would make the research look like it did nothing until an
  /// intermediary happened to quote.
  const modelled = useMemo(
    () =>
      data.skus
        .map((sku) => {
          const cost =
            sku.price === null || sku.priceCurrency === null
              ? null
              : convertAmount(sku.price, sku.priceCurrency, data.baseCurrency, stressedRates);
          return { sku, cost };
        })
        .filter(
          (row) =>
            row.cost !== null ||
            row.sku.baselineMin !== null ||
            row.sku.baselineMax !== null,
        ),
    [data.skus, data.baseCurrency, stressedRates],
  );

  const field =
    "h-11 w-full rounded-lg border border-line-strong bg-surface px-2.5 text-base nums text-foreground";

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setTab(entry.key)}
            aria-pressed={tab === entry.key}
            className={`${chipClass(tab === entry.key)} min-h-10 shrink-0 text-sm`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {/* Stress test applies to every tab — it is just a different set of rates. */}
      <div className="mt-3 rounded-xl border border-line bg-surface p-3">
        <label className="block">
          <span className="text-xs font-medium text-muted">
            What-if: move every rate against {data.baseCurrency} by{" "}
            <span className="font-bold nums text-foreground">
              {stressPct > 0 ? "+" : ""}
              {stressPct}%
            </span>
          </span>
          <input
            type="range"
            min={-50}
            max={50}
            step={1}
            value={stressPct}
            onChange={(event) => setStressPct(Number(event.target.value))}
            className="mt-1.5 w-full"
            aria-label="Exchange rate stress test"
          />
        </label>
        {stressPct !== 0 ? (
          <p className="mt-1 text-xs font-medium text-warning-fg">
            Simulation only — nothing here is saved, and live rates are untouched.
          </p>
        ) : null}
      </div>

      {tab === "margin" ? (
        <div className="mt-3 space-y-3">
          <div className="rounded-xl border border-line bg-surface p-3">
            <div className="grid grid-cols-2 gap-2">
              {[
                ["shippingPerUnit", `Shipping / unit (${data.baseCurrency})`],
                ["customsRatePct", "Customs %"],
                ["otherFeesPerUnit", `Other fees / unit (${data.baseCurrency})`],
                ["targetMarginPct", "Target margin %"],
              ].map(([key, label]) => (
                <label key={key}>
                  <span className="mb-1 block text-xs font-medium text-muted">
                    {label}
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={costs[key as keyof typeof costs]}
                    onChange={(event) =>
                      setCosts((prev) => ({ ...prev, [key]: event.target.value }))
                    }
                    className={field}
                  />
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">
              Margin is on the selling price, not a markup on cost: price = cost ÷ (1 −
              margin).
            </p>

            <SaveAssumptionsForm values={costs} />

            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-medium text-muted">
                Show suggested retail in
              </span>
              <select
                value={sellCurrency}
                onChange={(event) => setSellCurrency(event.target.value)}
                className={field}
              >
                {data.currencies.map((code) => (
                  <option key={code} value={code}>
                    {currencyInfo(code).flag} {code} — {currencyInfo(code).name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {modelled.length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-2">
              {modelled.map(({ sku, cost }) => {
                const result = cost === null ? null : landedCost(cost, inputs);
                const retail =
                  result === null || result.suggestedRetail === null
                    ? null
                    : convertAmount(
                        result.suggestedRetail,
                        data.baseCurrency,
                        sellCurrency,
                        stressedRates,
                      );
                const competitor = sku.competitorBest;
                const competitorInBase =
                  competitor === null
                    ? null
                    : convertAmount(
                        competitor.price,
                        competitor.currency,
                        data.baseCurrency,
                        stressedRates,
                      );
                const competitorMargin =
                  competitorInBase === null || result === null
                    ? null
                    : marginAt(competitorInBase, result.total);

                return (
                  <li
                    key={sku.id}
                    className="rounded-xl border border-line bg-surface p-3"
                  >
                    <SkuHeading sku={sku} />
                    {result === null ? (
                      <p className="mt-1.5 text-xs text-muted">
                        No intermediary quote yet — modelled from my research alone.
                      </p>
                    ) : (
                      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-sm sm:grid-cols-4">
                        <Stat label="Goods" value={formatMoney(data.baseCurrency, result.goods)} />
                        <Stat label="Duty" value={formatMoney(data.baseCurrency, result.duty)} />
                        <Stat
                          label="Landed"
                          value={formatMoney(data.baseCurrency, result.total)}
                          strong
                        />
                        <Stat
                          label={`Retail (${sellCurrency})`}
                          value={retail === null ? "—" : formatMoney(sellCurrency, retail)}
                          strong
                        />
                      </dl>
                    )}
                    {competitor !== null && competitorMargin !== null ? (
                      <p className="mt-1.5 text-xs text-muted">
                        Cheapest competitor {competitor.competitor} at{" "}
                        {formatMoney(competitor.currency, competitor.price)} → margin{" "}
                        <span
                          className={
                            competitorMargin < 0
                              ? "font-semibold text-danger-fg"
                              : "font-semibold text-success-fg"
                          }
                        >
                          {competitorMargin.toFixed(1)}%
                        </span>
                      </p>
                    ) : null}

                    <BaselinePanel
                      sku={sku}
                      inputs={inputs}
                      baseCurrency={data.baseCurrency}
                      sellCurrency={sellCurrency}
                      rates={stressedRates}
                      competitorInBase={competitorInBase}
                      competitorName={competitor?.competitor ?? null}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}

      {tab === "restock" ? (
        <RestockForecaster
          data={data}
          rates={stressedRates}
          quantities={quantities}
          setQuantities={setQuantities}
        />
      ) : null}

      {tab === "competitors" ? (
        <CompetitorPanel
          variants={variantOptions}
          currencies={data.currencies}
          recent={recentCompetitors}
        />
      ) : null}

      {tab === "volatility" ? (
        <div className="mt-3 space-y-2">
          {data.skus.filter((sku) => sku.volatility !== null).length === 0 ? (
            <p className="rounded-xl border border-line px-4 py-8 text-center text-sm text-muted">
              Volatility needs at least two recorded prices for a product. Keep updating
              and it will fill in.
            </p>
          ) : (
            [...data.skus]
              .filter((sku) => sku.volatility !== null)
              .sort((a, b) => (b.volatility?.score ?? 0) - (a.volatility?.score ?? 0))
              .map((sku) => {
                const v = sku.volatility!;
                const band = volatilityBand(v.score);
                const tone =
                  band === "volatile"
                    ? "bg-danger-bg text-danger-fg"
                    : band === "moderate"
                      ? "bg-warning-bg text-warning-fg"
                      : "bg-success-bg text-success-fg";
                return (
                  <div
                    key={sku.id}
                    className="rounded-xl border border-line bg-surface p-3"
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <SkuHeading sku={sku} />
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>
                        {v.score.toFixed(1)}% {band}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-muted">
                      {v.changes} prices · low {formatMoney(data.baseCurrency, v.min)} · high{" "}
                      {formatMoney(data.baseCurrency, v.max)} · avg{" "}
                      {formatMoney(data.baseCurrency, v.mean)}
                    </p>
                  </div>
                );
              })
          )}
        </div>
      ) : null}
    </div>
  );
}

function RestockForecaster({
  data,
  rates,
  quantities,
  setQuantities,
}: {
  data: PlanningData;
  rates: Record<string, number>;
  quantities: Record<string, string>;
  setQuantities: (next: Record<string, string>) => void;
}) {
  // The shopping-list case from EXTRA_FEATURES §3: sold out locally but the
  // source has it.
  const candidates = data.skus.filter(
    (sku) => sku.price !== null && sku.stockStatus !== "out_of_stock",
  );

  const total = candidates.reduce((sum, sku) => {
    const qty = Number(quantities[sku.id] ?? "");
    if (!Number.isFinite(qty) || qty <= 0) return sum;
    const unit =
      sku.price === null || sku.priceCurrency === null
        ? null
        : convertAmount(sku.price, sku.priceCurrency, data.baseCurrency, rates);
    return unit === null ? sum : sum + unit * qty;
  }, 0);

  const selected = candidates.filter((sku) => Number(quantities[sku.id] ?? "") > 0);

  return (
    <div className="mt-3 space-y-3">
      <div className="sticky top-[57px] z-[4] rounded-xl border border-line bg-surface p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Capital required
        </p>
        <p className="text-2xl font-bold nums text-foreground">
          {formatMoney(data.baseCurrency, total)}
        </p>
        <p className="mt-0.5 text-xs text-muted">
          {selected.length} {selected.length === 1 ? "product" : "products"} ·{" "}
          {data.currencies
            .filter((code) => code !== data.baseCurrency)
            .map((code) => {
              const converted = convertAmount(total, data.baseCurrency, code, rates);
              return converted === null ? null : formatMoney(code, converted);
            })
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      {candidates.length === 0 ? (
        <Empty />
      ) : (
        <ul className="space-y-2">
          {candidates.map((sku) => {
            const unit =
              sku.price === null || sku.priceCurrency === null
                ? null
                : convertAmount(sku.price, sku.priceCurrency, data.baseCurrency, rates);
            const qty = Number(quantities[sku.id] ?? "");
            const line = unit !== null && qty > 0 ? unit * qty : 0;
            const belowMoq =
              sku.minimumOrderQty !== null && qty > 0 && qty < sku.minimumOrderQty;

            return (
              <li
                key={sku.id}
                className="rounded-xl border border-line bg-surface p-3"
              >
                <SkuHeading sku={sku} />
                <div className="mt-2 flex items-end gap-2">
                  <label className="w-24">
                    <span className="mb-1 block text-xs font-medium text-muted">
                      Quantity
                    </span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={quantities[sku.id] ?? ""}
                      onChange={(event) =>
                        setQuantities({ ...quantities, [sku.id]: event.target.value })
                      }
                      placeholder="0"
                      aria-label={`Restock quantity for ${sku.skuCode}`}
                      className="h-11 w-full rounded-lg border border-line-strong bg-surface px-2.5 text-base nums text-foreground"
                    />
                  </label>
                  <div className="flex-1 text-right">
                    <p className="text-xs text-muted">
                      {unit === null ? "—" : `${formatMoney(data.baseCurrency, unit)} each`}
                      {sku.minimumOrderQty !== null ? ` · min ${sku.minimumOrderQty}` : ""}
                    </p>
                    <p className="font-semibold nums text-foreground">
                      {formatMoney(data.baseCurrency, line)}
                    </p>
                  </div>
                </div>
                {belowMoq ? (
                  <p className="mt-1.5 text-xs font-medium text-warning-fg">
                    Below the vendor minimum of {sku.minimumOrderQty}.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * The third leg of the comparison: the admin's own source-market research.
 *
 * The quoted price says what one intermediary is asking today; the competitor
 * price says what Ghana will pay. This says what the goods are actually worth
 * at source, which is the only one of the three that can tell you a quote is
 * simply too high. Modelled as a band rather than a point, so landed cost and
 * retail come out as ranges.
 */
function BaselinePanel({
  sku,
  inputs,
  baseCurrency,
  sellCurrency,
  rates,
  competitorInBase,
  competitorName,
}: {
  sku: PlanningSku;
  inputs: CostInputs;
  baseCurrency: string;
  sellCurrency: string;
  rates: Record<string, number>;
  competitorInBase: number | null;
  competitorName: string | null;
}) {
  const currency = sku.baselineCurrency;
  if (currency === null || (sku.baselineMin === null && sku.baselineMax === null)) {
    return null;
  }

  const toBase = (value: number | null) =>
    value === null ? null : convertAmount(value, currency, baseCurrency, rates);

  const minBase = toBase(sku.baselineMin);
  const maxBase = toBase(sku.baselineMax);
  if (minBase === null && maxBase === null) {
    return (
      <p className="mt-2 text-xs text-warning-fg">
        No {baseCurrency} rate for {currency}, so the research band cannot be modelled.
      </p>
    );
  }

  // A half-open band collapses to a single figure rather than being discarded.
  const lowCost = landedCost(minBase ?? maxBase!, inputs);
  const highCost = landedCost(maxBase ?? minBase!, inputs);

  const retail = (value: number | null) =>
    value === null ? null : convertAmount(value, baseCurrency, sellCurrency, rates);
  const lowRetail = retail(lowCost.suggestedRetail);
  const highRetail = retail(highCost.suggestedRetail);

  const range = (low: number, high: number, code: string) =>
    Math.abs(high - low) < 0.005
      ? formatMoney(code, low)
      : `${formatMoney(code, low)} – ${formatMoney(code, high)}`;

  const comparison =
    sku.price === null || sku.priceCurrency === null
      ? null
      : compareToBaseline(
          convertAmount(sku.price, sku.priceCurrency, currency, rates) ?? NaN,
          sku.baselineMin,
          sku.baselineMax,
        );

  const verdictTone =
    comparison === null
      ? "bg-surface-sunken text-muted"
      : comparison.verdict === "above"
        ? "bg-danger-bg text-danger-fg"
        : comparison.verdict === "below"
          ? "bg-success-bg text-success-fg"
          : "bg-surface-sunken text-muted";

  const verdictLabel =
    comparison === null
      ? null
      : comparison.verdict === "within"
        ? "quote is within my band"
        : `quote is ${comparison.deltaPct.toFixed(1)}% ${comparison.verdict} my band`;

  // Margin the competitor price would yield if we sourced at the band instead
  // of at the quote — cheapest sourcing gives the best margin, hence the swap.
  const marginHigh =
    competitorInBase === null ? null : marginAt(competitorInBase, lowCost.total);
  const marginLow =
    competitorInBase === null ? null : marginAt(competitorInBase, highCost.total);

  return (
    <div className="mt-2 rounded-lg border border-line bg-surface-sunken px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-soft">
          My {currency} research
        </span>
        <span className="nums text-xs font-medium text-foreground">
          {range(sku.baselineMin ?? sku.baselineMax!, sku.baselineMax ?? sku.baselineMin!, currency)}
        </span>
        {verdictLabel ? (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${verdictTone}`}
          >
            {verdictLabel}
          </span>
        ) : null}
      </div>

      <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        <Stat
          label="Landed at band"
          value={range(lowCost.total, highCost.total, baseCurrency)}
          strong
        />
        <Stat
          label={`Retail at band (${sellCurrency})`}
          value={
            lowRetail === null || highRetail === null
              ? "—"
              : range(lowRetail, highRetail, sellCurrency)
          }
          strong
        />
      </dl>

      {marginLow !== null && marginHigh !== null && competitorName !== null ? (
        <p className="mt-1.5 text-xs text-muted">
          Sourced at this band, {competitorName}&apos;s price gives margin{" "}
          <span
            className={
              marginLow < 0 ? "font-semibold text-danger-fg" : "font-semibold text-success-fg"
            }
          >
            {marginLow.toFixed(1)}% – {marginHigh.toFixed(1)}%
          </span>
        </p>
      ) : null}

      {sku.baselineNote ? (
        <p className="mt-1 truncate text-[11px] text-muted-soft" title={sku.baselineNote}>
          Source: {sku.baselineNote}
        </p>
      ) : null}
    </div>
  );
}

function SkuHeading({ sku }: { sku: PlanningSku }) {
  return (
    <>
      <p className="font-medium text-foreground">
        {sku.brandName} · {sku.variantName}
      </p>
      <p className="text-xs text-muted">
        {sku.sizeMl}ml · {sku.concentration}
        {sku.price !== null && sku.priceCurrency
          ? ` · quoted ${formatMoney(sku.priceCurrency, sku.price)}`
          : ""}
      </p>
    </>
  );
}

function Stat({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd
        className={`nums ${
          strong
            ? "font-semibold text-foreground"
            : "text-muted"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

function Empty() {
  return (
    <p className="rounded-xl border border-line px-4 py-8 text-center text-sm text-muted">
      Nothing to model yet. Enter prices on the catalogue, or record your own source-market
      research against a product there.
    </p>
  );
}
