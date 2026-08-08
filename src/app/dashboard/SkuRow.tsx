"use client";

import { useState, useTransition } from "react";
import { reportDiscrepancy, verifyPrice } from "@/app/actions/prices";
import type { SkuView } from "@/lib/catalogue";
import { PhotoUpload } from "@/components/PhotoUpload";
import { convertAmount, currencyInfo, formatMoney } from "@/lib/currencies";
import type { ConversionView } from "@/lib/fx";
import { isStale, relativeTime } from "@/lib/staleness";

export type Draft = {
  singlePrice: string;
  cartonPrice: string;
  cartonQty: string;
  minimumOrderQty: string;
  stockStatus: string;
};

export function draftFromSku(sku: SkuView): Draft {
  return {
    singlePrice: sku.singlePrice ?? "",
    cartonPrice: sku.cartonPrice ?? "",
    cartonQty: sku.cartonQty === null ? "" : String(sku.cartonQty),
    minimumOrderQty: sku.minimumOrderQty === null ? "" : String(sku.minimumOrderQty),
    stockStatus: sku.stockStatus,
  };
}

/// Pure value comparison. Deliberately currency-blind — see draftIsDirty.
export function draftDiffers(draft: Draft, sku: SkuView): boolean {
  const base = draftFromSku(sku);
  return (
    draft.singlePrice.trim() !== base.singlePrice ||
    draft.cartonPrice.trim() !== base.cartonPrice ||
    draft.cartonQty.trim() !== base.cartonQty ||
    draft.minimumOrderQty.trim() !== base.minimumOrderQty ||
    draft.stockStatus !== base.stockStatus
  );
}

/**
 * Whether a row the user has actually touched should be saved.
 *
 * Re-quoting the same number in a different currency IS a change (300 AED is
 * not 300 SAR), so the entry currency counts here. Crucially this is only ever
 * asked about rows with a real draft: applying it to untouched rows would mark
 * every differently-priced SKU as edited the moment the session currency
 * changed, and silently re-denominate them on save.
 */
export function draftIsDirty(
  draft: Draft,
  sku: SkuView,
  entryCurrency: string,
): boolean {
  if (draftDiffers(draft, sku)) return true;
  const priced = draft.singlePrice.trim() !== "";
  return priced && sku.priceCurrency !== null && sku.priceCurrency !== entryCurrency;
}

/// Converts from whatever currency this row is quoted in, skipping that
/// currency itself — showing "300 AED ≈ AED 300" would be noise.
function convert(amount: string, from: string, fx: ConversionView): string[] {
  const value = Number(amount);
  if (!Number.isFinite(value)) return [];
  return fx.displayOrder.flatMap((code) => {
    if (code === from) return [];
    const result = convertAmount(value, from, code, fx.rates);
    return result === null ? [] : [formatMoney(code, result)];
  });
}

export function SkuRow({
  sku,
  fx,
  nowMs,
  draft,
  entryCurrency,
  dirty,
  touched,
  canManagePhotos,
  error,
  onChange,
  label,
  gender,
  indented = false,
}: {
  sku: SkuView;
  fx: ConversionView;
  nowMs: number;
  draft: Draft;
  /// Currency the intermediary is currently entering prices in.
  entryCurrency: string;
  /// Has a pending change worth saving.
  dirty: boolean;
  /// The user has edited this row in this session. Distinct from `dirty`: an
  /// untouched row keeps the currency it was quoted in, whatever the session
  /// is set to.
  touched: boolean;
  /// Admins may attach product photos from the catalogue (spec §3.4).
  canManagePhotos: boolean;
  error?: string;
  onChange: (next: Draft) => void;
  label?: string;
  gender?: string;
  indented?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [note, setNote] = useState("");

  const stale = isStale(sku.lastUpdatedAt, nowMs);
  // An untouched row keeps showing the currency it was quoted in; only once the
  // user edits it does it belong to the session's entry currency.
  const rowCurrency = touched ? entryCurrency : (sku.priceCurrency ?? entryCurrency);
  const converted = draft.singlePrice.trim()
    ? convert(draft.singlePrice.trim(), rowCurrency, fx)
    : [];

  function update(patch: Partial<Draft>) {
    onChange({ ...draft, ...patch });
  }

  function runVerify() {
    setNotice(null);
    startTransition(async () => {
      const result = await verifyPrice(sku.id);
      setNotice(result.ok ? "Confirmed unchanged" : (result.error ?? "Could not verify"));
    });
  }

  function submitReport() {
    setNotice(null);
    startTransition(async () => {
      const result = await reportDiscrepancy(sku.id, note);
      if (result.ok) {
        setReporting(false);
        setNote("");
        setNotice("Reported to admin");
      } else {
        setNotice(result.error ?? "Could not send report");
      }
    });
  }

  return (
    <div className={`px-4 py-3 ${indented ? "pl-11" : ""} ${dirty ? "bg-sky-50/70 dark:bg-sky-950/20" : ""}`}>
      <div className="flex items-start gap-3">
        {sku.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={sku.photoUrl} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
        ) : (
          <div
            aria-hidden
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-sunken text-[10px] font-medium text-muted-soft"
          >
            {sku.sizeMl}ml
          </div>
        )}

        <div className="min-w-0 flex-1">
          {label ? (
            <p className="font-medium text-foreground">{label}</p>
          ) : null}
          <p className="text-sm text-muted">
            {sku.sizeMl}ml · {sku.concentration}
            {gender ? <span className="text-muted-soft"> · {gender}</span> : null}
          </p>
          <p className="mt-0.5 font-mono text-[11px] text-muted-soft">
            {sku.skuCode}
          </p>
          <p
            className={`mt-0.5 text-xs ${
              stale
                ? "font-medium text-amber-700 dark:text-amber-400"
                : "text-muted"
            }`}
          >
            {relativeTime(sku.lastUpdatedAt, nowMs)}
            {stale ? " · stale" : ""}
            {sku.lastUpdatedBy ? ` · ${sku.lastUpdatedBy}` : ""}
          </p>
        </div>
      </div>

      {/* Price entry. inputMode="decimal" gives a numeric keypad (spec §3.2). */}
      <div className="mt-2.5 flex flex-wrap items-end gap-2">
        <label className="flex-1 basis-32">
          <span className="mb-1 block text-xs font-medium text-muted">
            Price ({rowCurrency})
          </span>
          <input
            type="text"
            inputMode="decimal"
            enterKeyHint="done"
            value={draft.singlePrice}
            onChange={(event) => update({ singlePrice: event.target.value })}
            placeholder="—"
            aria-label={`Single bottle price for ${sku.skuCode}`}
            className="h-11 w-full rounded-lg border border-line bg-surface px-2.5 text-base nums text-foreground outline-none focus:border-accent"
          />
        </label>

        <label className="flex-1 basis-28">
          <span className="mb-1 block text-xs font-medium text-muted">
            Carton ({rowCurrency})
          </span>
          <input
            type="text"
            inputMode="decimal"
            enterKeyHint="done"
            value={draft.cartonPrice}
            onChange={(event) => update({ cartonPrice: event.target.value })}
            placeholder="—"
            aria-label={`Carton price for ${sku.skuCode}`}
            className="h-11 w-full rounded-lg border border-line bg-surface px-2.5 text-base nums text-foreground outline-none focus:border-accent"
          />
        </label>

        <label className="w-[4.5rem]">
          <span className="mb-1 block text-xs font-medium text-muted">
            Bottles
          </span>
          <input
            type="text"
            inputMode="numeric"
            enterKeyHint="done"
            value={draft.cartonQty}
            onChange={(event) => update({ cartonQty: event.target.value })}
            placeholder="12"
            aria-label={`Bottles per carton for ${sku.skuCode}`}
            className="h-11 w-full rounded-lg border border-line bg-surface px-2.5 text-base nums text-foreground outline-none focus:border-accent"
          />
        </label>

        <label className="w-[4.5rem]">
          <span
            className="mb-1 block text-xs font-medium text-muted"
            title="Fewest units this vendor will sell"
          >
            Min qty
          </span>
          <input
            type="text"
            inputMode="numeric"
            enterKeyHint="done"
            value={draft.minimumOrderQty}
            onChange={(event) => update({ minimumOrderQty: event.target.value })}
            placeholder="—"
            aria-label={`Minimum order quantity for ${sku.skuCode}`}
            className="h-11 w-full rounded-lg border border-line bg-surface px-2.5 text-base nums text-foreground outline-none focus:border-accent"
          />
        </label>
      </div>

      {converted.length > 0 ? (
        <p className="mt-1.5 text-xs nums text-muted">
          ≈ {converted.join(" · ")}
        </p>
      ) : null}

      {touched &&
      sku.priceCurrency !== null &&
      sku.priceCurrency !== entryCurrency &&
      draft.singlePrice.trim() !== "" ? (
        <p className="mt-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
          Was quoted in {sku.priceCurrency} — saving records this as{" "}
          {currencyInfo(entryCurrency).code}.
        </p>
      ) : null}

      {/* Large tap targets — this is the most-used control (spec §3.2). */}
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        {[
          { value: "in_stock", label: "In stock", on: "bg-emerald-600 text-white" },
          { value: "out_of_stock", label: "Out of stock", on: "bg-red-600 text-white" },
        ].map((option) => {
          const selected = draft.stockStatus === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                update({ stockStatus: selected ? "unknown" : option.value })
              }
              className={`min-h-12 rounded-lg text-sm font-semibold transition ${
                selected
                  ? option.on
                  : "border border-line-strong text-muted hover:bg-surface-sunken "
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {canManagePhotos ? (
        <PhotoUpload skuId={sku.id} skuCode={sku.skuCode} photoUrl={sku.photoUrl} />
      ) : null}

      {sku.hasConflict ? (
        <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          An offline edit for this product clashed with a newer change. The price above
          stands until an admin resolves it.
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        {sku.singlePrice && !dirty ? (
          <button
            type="button"
            onClick={runVerify}
            disabled={pending}
            className="text-xs font-semibold text-muted underline underline-offset-2 disabled:opacity-50"
          >
            Still the same price
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setReporting((open) => !open)}
          className="text-xs text-muted underline underline-offset-2"
        >
          Report a problem
        </button>
        {notice ? (
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
            {notice}
          </span>
        ) : null}
      </div>

      {reporting ? (
        <div className="mt-2 rounded-lg border border-line p-2.5-strong">
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            placeholder="e.g. the box says 105ml, not 100ml"
            aria-label={`Describe the problem with ${sku.skuCode}`}
            className="w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-sm text-foreground outline-none focus:border-accent"
          />
          <div className="mt-1.5 flex gap-2">
            <button
              type="button"
              onClick={submitReport}
              disabled={pending || note.trim().length < 3}
              className="min-h-10 rounded-lg bg-accent px-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              Send to admin
            </button>
            <button
              type="button"
              onClick={() => setReporting(false)}
              className="min-h-10 rounded-lg px-3 text-sm text-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
