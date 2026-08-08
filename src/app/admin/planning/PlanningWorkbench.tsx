"use client";

import { useMemo, useState } from "react";
import { convertAmount, currencyInfo, formatMoney } from "@/lib/currencies";
import type { PlanningData, PlanningSku } from "@/lib/planning-data";
import {
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

  /// Costs recomputed under the stressed rates.
  const priced = useMemo(
    () =>
      data.skus
        .map((sku) => {
          const cost =
            sku.price === null || sku.priceCurrency === null
              ? null
              : convertAmount(sku.price, sku.priceCurrency, data.baseCurrency, stressedRates);
          return { sku, cost };
        })
        .filter((row): row is { sku: PlanningSku; cost: number } => row.cost !== null),
    [data.skus, data.baseCurrency, stressedRates],
  );

  const field =
    "h-11 w-full rounded-lg border border-line-strong bg-white px-2.5 text-base nums text-foreground-strong dark:bg-accent";

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => setTab(entry.key)}
            aria-pressed={tab === entry.key}
            className={`min-h-10 shrink-0 rounded-full px-3 text-sm font-medium ${
              tab === entry.key
                ? "bg-accent text-white"
                : "border border-line-strong text-muted"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      {/* Stress test applies to every tab — it is just a different set of rates. */}
      <div className="mt-3 rounded-xl border border-line bg-white p-3 dark:bg-accent">
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
          <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">
            Simulation only — nothing here is saved, and live rates are untouched.
          </p>
        ) : null}
      </div>

      {tab === "margin" ? (
        <div className="mt-3 space-y-3">
          <div className="rounded-xl border border-line bg-white p-3 dark:bg-accent">
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

          {priced.length === 0 ? (
            <Empty />
          ) : (
            <ul className="space-y-2">
              {priced.map(({ sku, cost }) => {
                const result = landedCost(cost, inputs);
                const retail =
                  result.suggestedRetail === null
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
                  competitorInBase === null
                    ? null
                    : marginAt(competitorInBase, result.total);

                return (
                  <li
                    key={sku.id}
                    className="rounded-xl border border-line bg-white p-3 dark:bg-accent"
                  >
                    <SkuHeading sku={sku} />
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
                    {competitor !== null && competitorMargin !== null ? (
                      <p className="mt-1.5 text-xs text-muted">
                        Cheapest competitor {competitor.competitor} at{" "}
                        {formatMoney(competitor.currency, competitor.price)} → margin{" "}
                        <span
                          className={
                            competitorMargin < 0
                              ? "font-semibold text-red-600 dark:text-red-400"
                              : "font-semibold text-emerald-700 dark:text-emerald-400"
                          }
                        >
                          {competitorMargin.toFixed(1)}%
                        </span>
                      </p>
                    ) : null}
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
                    ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
                    : band === "moderate"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200";
                return (
                  <div
                    key={sku.id}
                    className="rounded-xl border border-line bg-white p-3 dark:bg-accent"
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
                className="rounded-xl border border-line bg-white p-3 dark:bg-accent"
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
                      className="h-11 w-full rounded-lg border border-line-strong bg-white px-2.5 text-base nums text-foreground-strong dark:bg-accent"
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
                  <p className="mt-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
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
      No priced products yet. Enter prices on the catalogue first.
    </p>
  );
}
