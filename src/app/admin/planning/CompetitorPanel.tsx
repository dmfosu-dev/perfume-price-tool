"use client";

import { useActionState } from "react";
import {
  addCompetitorPrice,
  saveCostAssumptions,
  type PlanningActionState,
} from "@/app/actions/planning";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert } from "@/components/ui";
import { currencyInfo, formatMoney } from "@/lib/currencies";

const field =
  "h-11 w-full rounded-lg border border-line bg-surface px-2.5 text-sm text-foreground";

function Feedback({ state }: { state: PlanningActionState }) {
  if (state.error) return <Alert tone="error">{state.error}</Alert>;
  if (state.notice) return <Alert tone="success">{state.notice}</Alert>;
  return null;
}

/// Persists whatever is currently typed into the margin tab.
export function SaveAssumptionsForm({
  values,
}: {
  values: {
    shippingPerUnit: string;
    customsRatePct: string;
    otherFeesPerUnit: string;
    targetMarginPct: string;
  };
}) {
  const [state, action] = useActionState<PlanningActionState, FormData>(
    saveCostAssumptions,
    {},
  );

  return (
    <form action={action} className="mt-3 border-t border-line pt-3">
      <Feedback state={state} />
      {Object.entries(values).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <SubmitButton variant="neutral" pendingLabel="Saving…">
        Save these assumptions
      </SubmitButton>
    </form>
  );
}

export function CompetitorPanel({
  variants,
  currencies,
  recent,
}: {
  variants: { id: string; label: string }[];
  currencies: string[];
  recent: {
    id: string;
    competitor: string;
    price: number;
    currency: string;
    variantLabel: string;
    observedAt: string;
  }[];
}) {
  const [state, action] = useActionState<PlanningActionState, FormData>(
    addCompetitorPrice,
    {},
  );

  return (
    <div className="mt-3 space-y-3">
      <div className="rounded-xl border border-line bg-white p-3 dark:bg-accent">
        <h3 className="mb-2 text-sm font-semibold text-foreground">
          Log a competitor price
        </h3>
        <form action={action} className="space-y-2">
          <Feedback state={state} />

          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">
              Fragrance
            </span>
            <select name="variantId" className={field} defaultValue="">
              <option value="" disabled>
                Choose…
              </option>
              {variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variant.label}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-2">
            <input
              name="competitor"
              placeholder="Competitor name"
              aria-label="Competitor name"
              className={field}
            />
            <input
              name="price"
              inputMode="decimal"
              placeholder="Price"
              aria-label="Competitor price"
              className={`${field} w-28`}
            />
            <select
              name="currency"
              aria-label="Currency"
              defaultValue={currencies[0] ?? "USD"}
              className={`${field} w-28`}
            >
              {currencies.map((code) => (
                <option key={code} value={code}>
                  {currencyInfo(code).flag} {code}
                </option>
              ))}
            </select>
          </div>

          <input
            name="notes"
            placeholder="Where did you see it? (optional)"
            aria-label="Notes"
            className={field}
          />

          <SubmitButton pendingLabel="Saving…">Record price</SubmitButton>
        </form>
      </div>

      {recent.length === 0 ? (
        <p className="rounded-xl border border-line px-4 py-8 text-center text-sm text-muted">
          No competitor prices logged yet. They feed the margin comparison on the first
          tab.
        </p>
      ) : (
        <ul className="space-y-2">
          {recent.map((row) => (
            <li
              key={row.id}
              className="rounded-xl border border-line bg-white p-3 dark:bg-accent"
            >
              <p className="font-medium text-foreground">
                {formatMoney(row.currency, row.price)} · {row.competitor}
              </p>
              <p className="text-xs text-muted">
                {row.variantLabel} · {row.observedAt}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
