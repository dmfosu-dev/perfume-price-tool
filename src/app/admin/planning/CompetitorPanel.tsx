"use client";

import { useActionState, useState } from "react";
import {
  addCompetitorPrice,
  deleteCompetitorPrice,
  saveCostAssumptions,
  updateCompetitorPrice,
  type PlanningActionState,
} from "@/app/actions/planning";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert, Badge } from "@/components/ui";
import { currencyInfo, formatMoney } from "@/lib/currencies";

const field =
  "h-11 w-full rounded-lg border border-line bg-surface px-2.5 text-sm text-foreground";

export type VariantOption = {
  id: string;
  label: string;
  sizes: { id: string; label: string }[];
};

export type CompetitorRow = {
  id: string;
  variantId: string;
  skuId: string | null;
  competitor: string;
  price: number;
  currency: string;
  notes: string | null;
  variantLabel: string;
  /// Null when the observation applies to every size of the fragrance.
  sizeLabel: string | null;
  observedAt: string;
};

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

/**
 * Fragrance + size pair. The size list depends on the chosen fragrance, so the
 * selection is held in state rather than left to the uncontrolled form.
 *
 * "All sizes" stays available deliberately: a listing that does not say which
 * bottle it is still worth recording, and planning-data falls back to it only
 * when no size-specific row exists.
 */
function ProductPicker({
  variants,
  variantId,
  skuId,
  onVariantChange,
  onSkuChange,
}: {
  variants: VariantOption[];
  variantId: string;
  skuId: string;
  onVariantChange: (next: string) => void;
  onSkuChange: (next: string) => void;
}) {
  const sizes = variants.find((variant) => variant.id === variantId)?.sizes ?? [];

  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_12rem]">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Fragrance</span>
        <select
          name="variantId"
          className={field}
          value={variantId}
          onChange={(event) => {
            onVariantChange(event.target.value);
            // The old size belongs to the old fragrance; keeping it would be
            // rejected server-side anyway.
            onSkuChange("");
          }}
        >
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

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">Size</span>
        <select
          name="skuId"
          className={field}
          value={skuId}
          onChange={(event) => onSkuChange(event.target.value)}
          disabled={variantId === ""}
        >
          <option value="">All sizes</option>
          {sizes.map((size) => (
            <option key={size.id} value={size.id}>
              {size.label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function PriceFields({
  currencies,
  defaults,
}: {
  currencies: string[];
  defaults?: { competitor: string; price: string; currency: string; notes: string };
}) {
  return (
    <>
      <div className="flex gap-2">
        <input
          name="competitor"
          placeholder="Competitor name"
          aria-label="Competitor name"
          defaultValue={defaults?.competitor ?? ""}
          className={field}
        />
        <input
          name="price"
          inputMode="decimal"
          placeholder="Price"
          aria-label="Competitor price"
          defaultValue={defaults?.price ?? ""}
          className={`${field} w-28`}
        />
        <select
          name="currency"
          aria-label="Currency"
          defaultValue={defaults?.currency ?? currencies[0] ?? "USD"}
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
        defaultValue={defaults?.notes ?? ""}
        className={field}
      />
    </>
  );
}

function AddCompetitorForm({
  variants,
  currencies,
}: {
  variants: VariantOption[];
  currencies: string[];
}) {
  const [state, action] = useActionState<PlanningActionState, FormData>(
    addCompetitorPrice,
    {},
  );
  const [variantId, setVariantId] = useState("");
  const [skuId, setSkuId] = useState("");

  return (
    <form action={action} className="space-y-2">
      <Feedback state={state} />
      <ProductPicker
        variants={variants}
        variantId={variantId}
        skuId={skuId}
        onVariantChange={setVariantId}
        onSkuChange={setSkuId}
      />
      <PriceFields currencies={currencies} />
      <SubmitButton pendingLabel="Saving…">Record price</SubmitButton>
    </form>
  );
}

function EditCompetitorRow({
  row,
  variants,
  currencies,
  onDone,
}: {
  row: CompetitorRow;
  variants: VariantOption[];
  currencies: string[];
  onDone: () => void;
}) {
  const [state, action] = useActionState<PlanningActionState, FormData>(
    updateCompetitorPrice,
    {},
  );
  const [variantId, setVariantId] = useState(row.variantId);
  const [skuId, setSkuId] = useState(row.skuId ?? "");

  return (
    <form action={action} className="space-y-2">
      <Feedback state={state} />
      <input type="hidden" name="id" value={row.id} />
      <ProductPicker
        variants={variants}
        variantId={variantId}
        skuId={skuId}
        onVariantChange={setVariantId}
        onSkuChange={setSkuId}
      />
      <PriceFields
        currencies={currencies}
        defaults={{
          competitor: row.competitor,
          price: String(row.price),
          currency: row.currency,
          notes: row.notes ?? "",
        }}
      />
      <div className="flex flex-wrap gap-2">
        <SubmitButton size="sm" pendingLabel="Saving…">
          Save changes
        </SubmitButton>
        <button
          type="button"
          onClick={onDone}
          className="min-h-9 rounded-lg px-3 text-sm font-medium text-muted transition hover:bg-surface-sunken"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function CompetitorListRow({
  row,
  variants,
  currencies,
}: {
  row: CompetitorRow;
  variants: VariantOption[];
  currencies: string[];
}) {
  const [deleteState, remove] = useActionState<PlanningActionState, FormData>(
    deleteCompetitorPrice,
    {},
  );
  const [editing, setEditing] = useState(false);

  return (
    <li className="rounded-xl border border-line bg-surface p-3">
      <Feedback state={deleteState} />

      {editing ? (
        <EditCompetitorRow
          row={row}
          variants={variants}
          currencies={currencies}
          onDone={() => setEditing(false)}
        />
      ) : (
        <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
          <div className="min-w-0 flex-1">
            <p className="nums font-medium text-foreground">
              {formatMoney(row.currency, row.price)} · {row.competitor}
            </p>
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
              <span>{row.variantLabel}</span>
              {/* Says which bottle it refers to, so a 100ml observation is never
                  mistaken for the 150ml sitting next to it. */}
              {row.sizeLabel === null ? (
                <Badge>all sizes</Badge>
              ) : (
                <Badge tone="accent">{row.sizeLabel}</Badge>
              )}
              <span>· {row.observedAt}</span>
            </p>
            {row.notes ? (
              <p className="mt-0.5 truncate text-[11px] text-muted-soft" title={row.notes}>
                {row.notes}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="min-h-9 rounded-lg px-2.5 text-xs font-medium text-muted transition hover:bg-surface-sunken hover:text-foreground"
            >
              Edit
            </button>
            <form
              action={remove}
              onSubmit={(event) => {
                if (
                  !window.confirm(
                    `Delete the ${formatMoney(row.currency, row.price)} price from ${row.competitor}?`,
                  )
                ) {
                  event.preventDefault();
                }
              }}
            >
              <input type="hidden" name="id" value={row.id} />
              <SubmitButton variant="dangerGhost" size="sm">
                Delete
              </SubmitButton>
            </form>
          </div>
        </div>
      )}
    </li>
  );
}

export function CompetitorPanel({
  variants,
  currencies,
  recent,
}: {
  variants: VariantOption[];
  currencies: string[];
  recent: CompetitorRow[];
}) {
  return (
    <div className="mt-3 space-y-3">
      <div className="rounded-xl border border-line bg-surface p-3">
        <h3 className="mb-2 text-sm font-semibold text-foreground">
          Log a competitor price
        </h3>
        <AddCompetitorForm variants={variants} currencies={currencies} />
      </div>

      {recent.length === 0 ? (
        <p className="rounded-xl border border-line px-4 py-8 text-center text-sm text-muted">
          No competitor prices logged yet. They feed the margin comparison on the first
          tab.
        </p>
      ) : (
        <ul className="space-y-2">
          {recent.map((row) => (
            <CompetitorListRow
              key={row.id}
              row={row}
              variants={variants}
              currencies={currencies}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
