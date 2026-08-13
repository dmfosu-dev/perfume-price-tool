"use client";

import { useState, useTransition } from "react";
import { reportDiscrepancy, saveBaseline, verifyPrice } from "@/app/actions/prices";
import type { SkuView } from "@/lib/catalogue";
import { PhotoUpload } from "@/components/PhotoUpload";
import { StatusBadge } from "@/components/ui";
import { convertAmount, currencyInfo, formatMoney } from "@/lib/currencies";
import type { ConversionView } from "@/lib/fx";
import { isStale, relativeTime } from "@/lib/staleness";

/** Cells per row — the drawer spans all of them. */
export const SKU_COLUMNS = 6;

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

const cellInput =
  "h-11 w-full rounded-lg border border-line bg-surface px-2.5 text-base nums text-foreground outline-none focus:border-accent";

/**
 * One catalogue row. Collapsed it stays dense enough to scan a whole brand —
 * product, code, a single price field and a stock pill. The chevron opens a
 * full-width drawer holding everything else (carton pricing, minimum order,
 * conversions, the big stock buttons and the report actions), which is how the
 * table keeps its density without shrinking the controls a phone needs.
 */
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
}) {
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [note, setNote] = useState("");
  const [manualOpen, setManualOpen] = useState(false);

  // The admin's research band is separate state from `draft`: it saves on its
  // own action rather than riding the brand's batch save, because it must not
  // reach PriceHistory. See saveBaseline.
  const baseline = sku.baseline;
  const [baseMin, setBaseMin] = useState(baseline?.minPrice ?? "");
  const [baseMax, setBaseMax] = useState(baseline?.maxPrice ?? "");
  const [baseNote, setBaseNote] = useState(baseline?.note ?? "");
  const [baseSaving, setBaseSaving] = useState(false);
  const [baseNotice, setBaseNotice] = useState<string | null>(null);
  const [baseError, setBaseError] = useState<string | null>(null);

  const baselineDirty =
    baseline !== null &&
    (baseMin.trim() !== (baseline.minPrice ?? "") ||
      baseMax.trim() !== (baseline.maxPrice ?? "") ||
      baseNote.trim() !== (baseline.note ?? ""));

  function submitBaseline() {
    setBaseNotice(null);
    setBaseError(null);
    setBaseSaving(true);
    startTransition(async () => {
      const result = await saveBaseline(sku.id, baseMin, baseMax, baseNote);
      setBaseSaving(false);
      if (result.ok) setBaseNotice("Research saved");
      else setBaseError(result.error ?? "Could not save.");
    });
  }

  // A rejected field lives in the drawer, so force it open rather than reporting
  // an error about a control the user cannot see.
  const open = manualOpen || error !== undefined;

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

  const rowTint = dirty ? "bg-info-bg/50" : "";

  return (
    <>
      <tr className={`border-t border-line align-middle ${rowTint}`}>
        <td className="py-2 pl-3 pr-1 align-middle">
          <button
            type="button"
            onClick={() => setManualOpen((value) => !value)}
            aria-expanded={open}
            aria-label={`${open ? "Hide" : "Show"} all fields for ${sku.skuCode}`}
            className="flex h-9 w-7 items-center justify-center rounded-lg text-muted-soft transition hover:bg-surface-sunken hover:text-foreground"
          >
            <span
              aria-hidden
              className={`text-[10px] transition-transform ${open ? "rotate-90" : ""}`}
            >
              ▶
            </span>
          </button>
        </td>

        <td className="py-2 pr-3">
          <div className="flex items-center gap-2.5">
            {sku.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={sku.photoUrl}
                alt=""
                className="h-10 w-10 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed border-line-strong text-[10px] font-medium text-muted-soft"
              >
                {sku.sizeMl}ml
              </span>
            )}
            <span className="min-w-0">
              {label ? (
                <span className="block truncate text-sm font-medium text-foreground">
                  {label}
                </span>
              ) : null}
              <span className="block text-xs text-muted">
                {sku.sizeMl}ml · {sku.concentration}
                {gender ? <span className="text-muted-soft"> · {gender}</span> : null}
              </span>
              {dirty ? (
                <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-info-fg">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-info-fg" />
                  unsaved
                </span>
              ) : null}
            </span>
          </div>
        </td>

        <td className="hidden py-2 pr-3 font-mono text-[11px] text-muted-soft md:table-cell">
          {sku.skuCode}
        </td>

        <td className="py-2 pr-3">
          <div className="flex items-center justify-end gap-1.5">
            <span className="hidden text-[11px] font-medium text-muted-soft sm:inline">
              {rowCurrency}
            </span>
            <input
              type="text"
              inputMode="decimal"
              enterKeyHint="done"
              value={draft.singlePrice}
              onChange={(event) => update({ singlePrice: event.target.value })}
              placeholder="—"
              aria-label={`Single bottle price for ${sku.skuCode} in ${rowCurrency}`}
              className="h-10 w-20 rounded-lg border border-line bg-surface px-2 text-right text-sm nums text-foreground outline-none focus:border-accent sm:w-24"
            />
          </div>
        </td>

        <td className="py-2 pr-3 text-center">
          <StatusBadge status={draft.stockStatus} />
        </td>

        <td className="hidden py-2 pr-3 text-right text-xs md:table-cell">
          <span className={stale ? "font-medium text-warning-fg" : "text-muted"}>
            {relativeTime(sku.lastUpdatedAt, nowMs)}
            {stale ? " · stale" : ""}
          </span>
          {sku.lastUpdatedBy ? (
            <span className="block truncate text-[11px] text-muted-soft">
              {sku.lastUpdatedBy}
            </span>
          ) : null}
        </td>
      </tr>

      {open ? (
        <tr className={rowTint}>
          <td colSpan={SKU_COLUMNS} className="p-0">
            <div className="border-l-2 border-accent bg-surface-sunken px-4 py-3.5">
              {/* inputMode="decimal" gives a numeric keypad (spec §3.2). The
                  max width stops four fields stretching across a wide table;
                  an admin has two more fields, so the row uses the full width
                  rather than squeezing them. */}
              <div
                className={`flex flex-wrap items-end gap-2 ${
                  baseline === null ? "max-w-2xl" : ""
                }`}
              >
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
                    className={cellInput}
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
                    className={cellInput}
                  />
                </label>

                <label className="w-[4.5rem]">
                  <span className="mb-1 block text-xs font-medium text-muted">Bottles</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    enterKeyHint="done"
                    value={draft.cartonQty}
                    onChange={(event) => update({ cartonQty: event.target.value })}
                    placeholder="12"
                    aria-label={`Bottles per carton for ${sku.skuCode}`}
                    className={cellInput}
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
                    className={cellInput}
                  />
                </label>

                {baseline !== null ? (
                  <>
                    <span aria-hidden className="mx-1 h-11 w-px self-end bg-line-strong" />
                    <label className="w-28">
                      <span className="mb-1 block text-xs font-medium text-muted">
                        UAE min ({baseline.currency})
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        enterKeyHint="done"
                        value={baseMin}
                        onChange={(event) => setBaseMin(event.target.value)}
                        placeholder="—"
                        aria-label={`My researched UAE minimum price for ${sku.skuCode}`}
                        className={cellInput}
                      />
                    </label>
                    <label className="w-28">
                      <span className="mb-1 block text-xs font-medium text-muted">
                        UAE max ({baseline.currency})
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        enterKeyHint="done"
                        value={baseMax}
                        onChange={(event) => setBaseMax(event.target.value)}
                        placeholder="—"
                        aria-label={`My researched UAE maximum price for ${sku.skuCode}`}
                        className={cellInput}
                      />
                    </label>
                  </>
                ) : null}
              </div>

              <p className="mt-2 font-mono text-[11px] text-muted-soft md:hidden">
                {sku.skuCode}
              </p>

              {converted.length > 0 ? (
                <p className="mt-1.5 text-xs nums text-muted">≈ {converted.join(" · ")}</p>
              ) : null}

              {touched &&
              sku.priceCurrency !== null &&
              sku.priceCurrency !== entryCurrency &&
              draft.singlePrice.trim() !== "" ? (
                <p className="mt-1.5 text-xs font-medium text-warning-fg">
                  Was quoted in {sku.priceCurrency} — saving records this as{" "}
                  {currencyInfo(entryCurrency).code}.
                </p>
              ) : null}

              {baseline !== null ? (
                <div className="mt-2.5">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted">
                      Where I saw the UAE prices (shop or link)
                    </span>
                    <input
                      type="text"
                      value={baseNote}
                      onChange={(event) => setBaseNote(event.target.value)}
                      placeholder="e.g. Grand Stores, Dubai Mall — or a website address"
                      aria-label={`Source of my researched UAE prices for ${sku.skuCode}`}
                      maxLength={500}
                      className={`${cellInput} max-w-2xl`}
                    />
                  </label>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <button
                      type="button"
                      onClick={submitBaseline}
                      disabled={baseSaving || !baselineDirty}
                      className="min-h-9 rounded-lg border border-line-strong bg-surface px-3 text-xs font-semibold text-foreground transition hover:bg-surface-sunken disabled:opacity-50"
                    >
                      {baseSaving ? "Saving…" : "Save my research"}
                    </button>
                    {/* Says so out loud because these fields sit in the same
                        drawer as the intermediary's, and the brand's Save does
                        not cover them. */}
                    <span className="text-[11px] text-muted-soft">
                      Admin only — intermediaries never see this, and it is saved
                      separately from the brand&apos;s Save.
                    </span>
                    {baseNotice ? (
                      <span className="text-xs font-medium text-success-fg">
                        {baseNotice}
                      </span>
                    ) : null}
                    {baseError ? (
                      <span role="alert" className="text-xs font-medium text-danger-fg">
                        {baseError}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* Large tap targets — this is the most-used control (spec §3.2). */}
              <div className="mt-2.5 grid max-w-2xl grid-cols-2 gap-2">
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
                          : "border border-line-strong bg-surface text-muted hover:bg-surface-sunken"
                      }`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>

              {error ? (
                <p role="alert" className="mt-2 text-xs font-medium text-danger-fg">
                  {error}
                </p>
              ) : null}

              {canManagePhotos ? (
                <PhotoUpload skuId={sku.id} skuCode={sku.skuCode} photoUrl={sku.photoUrl} />
              ) : null}

              {sku.hasConflict ? (
                <p className="mt-2 rounded-lg bg-warning-bg px-2.5 py-1.5 text-xs font-medium text-warning-fg">
                  An offline edit for this product clashed with a newer change. The price
                  above stands until an admin resolves it.
                </p>
              ) : null}

              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
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
                  onClick={() => setReporting((value) => !value)}
                  className="text-xs text-muted underline underline-offset-2"
                >
                  Report a problem
                </button>
                {notice ? (
                  <span className="text-xs font-medium text-success-fg">{notice}</span>
                ) : null}
              </div>

              {reporting ? (
                <div className="mt-2 rounded-lg border border-line-strong bg-surface p-2.5">
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
                      className="min-h-10 rounded-lg bg-accent px-3 text-sm font-semibold text-on-accent disabled:opacity-50"
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
          </td>
        </tr>
      ) : null}
    </>
  );
}
