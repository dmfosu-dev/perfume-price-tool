"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import type { ReactNode } from "react";
import { savePriceEdits, type SkuEdit } from "@/app/actions/prices";
import type { BrandView, SkuView, VariantView } from "@/lib/catalogue";
import { useOffline } from "@/components/OfflineSync";
import { chipClass, Stat, StatRow, Th } from "@/components/ui";
import { currencyInfo } from "@/lib/currencies";
import type { ConversionView } from "@/lib/fx";
import { FILTER_STALE_DAYS, isStale, matchesStaleFilter } from "@/lib/staleness";
import { BrandSaveBar } from "./BrandSaveBar";
import { draftFromSku, draftIsDirty, SkuRow, type Draft } from "./SkuRow";

type FilterKey = "all" | "out_of_stock" | "stale";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "out_of_stock", label: "Out of stock" },
  { key: "stale", label: `Not updated in ${FILTER_STALE_DAYS}+ days` },
];

function skuMatchesFilter(sku: SkuView, filter: FilterKey, nowMs: number): boolean {
  if (filter === "out_of_stock") return sku.stockStatus === "out_of_stock";
  if (filter === "stale") return matchesStaleFilter(sku.lastUpdatedAt, nowMs);
  return true;
}

/// Search spans brand, variant and SKU code (spec §3.2). Matching a brand keeps
/// all of its variants, so a brand-name search behaves like "show me this brand".
function filterCatalogue(
  brands: BrandView[],
  query: string,
  filter: FilterKey,
  nowMs: number,
  dirtyIds: ReadonlySet<string>,
): BrandView[] {
  const q = query.trim().toLowerCase();

  const result: BrandView[] = [];
  for (const brand of brands) {
    const brandMatches = q.length > 0 && brand.name.toLowerCase().includes(q);

    const variants: VariantView[] = [];
    for (const variant of brand.variants) {
      const variantMatches =
        q.length === 0 || brandMatches || variant.name.toLowerCase().includes(q);

      const skus = variant.skus.filter((sku) => {
        // An unsaved edit is never hidden. Filtering it away would strand the
        // change: the row disappears while the counter still claims it exists,
        // and Discard would throw away work the user cannot see.
        if (dirtyIds.has(sku.id)) return true;
        const textOk = variantMatches || sku.skuCode.toLowerCase().includes(q);
        return textOk && skuMatchesFilter(sku, filter, nowMs);
      });

      if (skus.length > 0) variants.push({ ...variant, skus });
    }

    if (variants.length > 0) result.push({ ...brand, variants });
  }
  return result;
}

function allSkus(brand: BrandView): SkuView[] {
  return brand.variants.flatMap((variant) => variant.skus);
}

/** Shared table chrome, so the priority list and every brand read identically. */
function CatalogueTable({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-left">
        <thead className="bg-surface-sunken">
          <tr>
            <Th className="w-8" />
            <Th>Product</Th>
            <Th className="hidden md:table-cell">SKU</Th>
            <Th align="right">Price</Th>
            <Th align="center">Stock</Th>
            <Th align="right" className="hidden md:table-cell">
              Updated
            </Th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function PriceDashboard({
  brands,
  fx,
  vendors,
  nowMs,
  canManagePhotos,
}: {
  brands: BrandView[];
  fx: ConversionView;
  vendors: string[];
  nowMs: number;
  canManagePhotos: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [openBrands, setOpenBrands] = useState<Set<string>>(new Set());

  // Edits queue here until the brand's Save is tapped (spec §3.2 batch save).
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  /// Keyed by brand, so a failure in one brand does not show an error on every
  /// other open brand's save bar.
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});
  const [savingBrand, setSavingBrand] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState("");
  // Which currency this session is entering prices in. Defaults to the admin
  // setting; the intermediary switches it when a shop quotes something else.
  const [entryCurrency, setEntryCurrency] = useState(fx.priceEntryCurrency);
  const [toast, setToast] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const { online, queue } = useOffline();

  const searching = query.trim().length > 0 || filter !== "all";

  const skuById = useMemo(() => {
    const map = new Map<string, SkuView>();
    for (const brand of brands) for (const sku of allSkus(brand)) map.set(sku.id, sku);
    return map;
  }, [brands]);

  /// Every SKU with a real pending edit, across the whole catalogue.
  const dirtyIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [skuId, draft] of Object.entries(drafts)) {
      const sku = skuById.get(skuId);
      if (sku !== undefined && draftIsDirty(draft, sku, entryCurrency)) ids.add(skuId);
    }
    return ids;
  }, [drafts, skuById, entryCurrency]);

  /// Rows the user has actually edited this session.
  const touchedIds = useMemo(() => new Set(Object.keys(drafts)), [drafts]);

  /// Headline counts describe the whole catalogue, not the current filter — a
  /// KPI that moved every time a chip was tapped would tell you nothing.
  const totals = useMemo(() => {
    let skus = 0;
    let priced = 0;
    let outOfStock = 0;
    let stale = 0;
    for (const brand of brands) {
      for (const sku of allSkus(brand)) {
        skus += 1;
        if (sku.singlePrice !== null) priced += 1;
        if (sku.stockStatus === "out_of_stock") outOfStock += 1;
        if (isStale(sku.lastUpdatedAt, nowMs)) stale += 1;
      }
    }
    return { skus, priced, outOfStock, stale };
  }, [brands, nowMs]);

  const visible = useMemo(
    () => filterCatalogue(brands, query, filter, nowMs, dirtyIds),
    [brands, query, filter, nowMs, dirtyIds],
  );

  const getDraft = useCallback(
    (sku: SkuView): Draft => drafts[sku.id] ?? draftFromSku(sku),
    [drafts],
  );

  const setDraft = useCallback((skuId: string, next: Draft) => {
    setDrafts((prev) => ({ ...prev, [skuId]: next }));
    setFieldErrors((prev) => {
      if (!(skuId in prev)) return prev;
      const copy = { ...prev };
      delete copy[skuId];
      return copy;
    });
  }, []);

  const brandById = useMemo(() => {
    const map = new Map<string, BrandView>();
    for (const brand of brands) map.set(brand.id, brand);
    return map;
  }, [brands]);

  /// Reads the *unfiltered* brand, so a search or chip can never shrink the set
  /// of edits that Save and Discard act on.
  const dirtyIdsFor = useCallback(
    (brandId: string): string[] => {
      const brand = brandById.get(brandId);
      if (!brand) return [];
      return allSkus(brand)
        .filter((sku) => dirtyIds.has(sku.id))
        .map((sku) => sku.id);
    },
    [brandById, dirtyIds],
  );

  const priority = useMemo(
    () =>
      visible.flatMap((brand) =>
        brand.variants.flatMap((variant) =>
          variant.skus
            .filter((sku) => sku.isPriority)
            .map((sku) => ({ sku, variant, brand })),
        ),
      ),
    [visible],
  );

  const totalShown = visible.reduce((total, brand) => total + allSkus(brand).length, 0);
  const totalDirty = dirtyIds.size;

  function toggle(set: Set<string>, id: string): Set<string> {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  }

  function discardBrand(brandId: string) {
    const ids = new Set(dirtyIdsFor(brandId));
    setDrafts((prev) => {
      const copy = { ...prev };
      for (const id of ids) delete copy[id];
      return copy;
    });
    setFieldErrors((prev) => {
      const copy = { ...prev };
      for (const id of ids) delete copy[id];
      return copy;
    });
    setSaveErrors((prev) => {
      const copy = { ...prev };
      delete copy[brandId];
      return copy;
    });
  }

  function saveBrand(brandId: string) {
    const ids = dirtyIdsFor(brandId);
    if (ids.length === 0) return;

    const edits: Required<SkuEdit>[] = ids.map((id) => {
      const draft = drafts[id];
      return {
        skuId: id,
        singlePrice: draft.singlePrice,
        cartonPrice: draft.cartonPrice,
        cartonQty: draft.cartonQty,
        minimumOrderQty: draft.minimumOrderQty,
        stockStatus: draft.stockStatus,
        // Recorded at queue time so a later clash can be spotted on replay.
        baseUpdatedAt: skuById.get(id)?.lastUpdatedAt ?? null,
      };
    });

    setSavingBrand(brandId);
    setSaveErrors((prev) => {
      const copy = { ...prev };
      delete copy[brandId];
      return copy;
    });
    setFieldErrors({});

    const brandName = brandById.get(brandId)?.name ?? "";

    // Offline: park the batch in IndexedDB instead of losing it. It syncs by
    // itself once the connection returns (spec §3.3).
    if (!online) {
      void (async () => {
        try {
          await queue({
            brandId,
            brandName,
            edits,
            vendorName: vendorName || null,
            priceCurrency: entryCurrency,
            queuedAt: Date.now(),
          });
          setDrafts((prev) => {
            const copy = { ...prev };
            for (const id of ids) delete copy[id];
            return copy;
          });
          setVendorName("");
          setToast(
            `${ids.length} ${ids.length === 1 ? "change" : "changes"} saved on this phone — will sync when you are back online`,
          );
        } catch {
          setSaveErrors((prev) => ({
            ...prev,
            [brandId]: "Could not store the changes on this device. Do not close the app.",
          }));
        } finally {
          setSavingBrand(null);
        }
      })();
      return;
    }

    startTransition(async () => {
      const result = await savePriceEdits(edits, vendorName || null, entryCurrency);
      setSavingBrand(null);

      if (!result.ok) {
        setSaveErrors((prev) => ({ ...prev, [brandId]: result.error ?? "Could not save." }));
        if (result.fieldErrors) setFieldErrors(result.fieldErrors);
        return;
      }

      // Clear only what was sent; edits made elsewhere while saving survive.
      setDrafts((prev) => {
        const copy = { ...prev };
        for (const id of ids) delete copy[id];
        return copy;
      });
      setVendorName("");
      const conflicts = result.conflictCount ?? 0;
      const saved = result.savedCount ?? 0;
      setToast(
        saved === 0 && conflicts === 0
          ? "No changes to save"
          : [
              saved > 0 ? `${saved} ${saved === 1 ? "change" : "changes"} saved` : null,
              conflicts > 0 ? `${conflicts} sent to the admin conflicts queue` : null,
            ]
              .filter(Boolean)
              .join(" · "),
      );
    });
  }

  return (
    <div>
      <div className="sticky top-[57px] z-[5] -mx-4 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search brand, variant or SKU code"
            aria-label="Search brand, variant or SKU code"
            className="min-w-0 flex-1 basis-64 rounded-lg border border-line bg-surface px-3 py-2.5 text-base text-foreground outline-none placeholder:text-muted-soft focus:border-accent"
          />
          {fx.entryOptions.length > 0 ? (
            <label className="flex shrink-0 items-center gap-2">
              <span className="text-xs font-medium text-muted">Entering prices in</span>
              <select
                value={entryCurrency}
                onChange={(event) => setEntryCurrency(event.target.value)}
                aria-label="Currency to enter prices in"
                className="h-10 rounded-lg border border-line-strong bg-surface px-2 text-sm font-medium text-foreground"
              >
                {fx.entryOptions.map((code) => (
                  <option key={code} value={code}>
                    {currencyInfo(code).flag} {code}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <div className="mt-2 flex gap-2 overflow-x-auto pb-0.5">
          {FILTERS.map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setFilter(chip.key)}
              aria-pressed={filter === chip.key}
              className={`${chipClass(filter === chip.key)} shrink-0`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {totalDirty > 0 ? (
          <p className="mt-2 text-xs font-medium text-info-fg">
            {totalDirty} unsaved {totalDirty === 1 ? "change" : "changes"} — open the brand
            and tap Save.
          </p>
        ) : null}
      </div>

      {toast ? (
        <div
          role="status"
          className="mt-3 rounded-lg border border-success-fg/25 bg-success-bg px-3 py-2 text-sm font-medium text-success-fg"
        >
          {toast}{" "}
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-1 underline underline-offset-2"
          >
            dismiss
          </button>
        </div>
      ) : null}

      <div className="mt-4">
        <StatRow>
          <Stat label="SKUs" value={totals.skus} hint={`${brands.length} brands`} />
          <Stat
            label="Priced"
            value={totals.priced}
            hint={`${totals.skus - totals.priced} still blank`}
          />
          <Stat
            label="Out of stock"
            value={totals.outOfStock}
            tone={totals.outOfStock > 0 ? "danger" : "default"}
          />
          <Stat
            label="Needs update"
            value={totals.stale}
            hint={`${FILTER_STALE_DAYS}+ days old`}
            tone={totals.stale > 0 ? "warning" : "default"}
          />
        </StatRow>
      </div>

      {priority.length > 0 ? (
        <section className="mb-4 overflow-hidden rounded-xl border border-warning-fg/30 bg-surface">
          <h2 className="bg-warning-bg px-4 py-2 text-xs font-semibold uppercase tracking-wider text-warning-fg">
            Priority checks
          </h2>
          <CatalogueTable>
            {priority.map(({ sku, variant, brand }) => (
              <SkuRow
                key={sku.id}
                sku={sku}
                fx={fx}
                nowMs={nowMs}
                draft={getDraft(sku)}
                entryCurrency={entryCurrency}
                dirty={dirtyIds.has(sku.id)}
                touched={touchedIds.has(sku.id)}
                canManagePhotos={canManagePhotos}
                error={fieldErrors[sku.id]}
                onChange={(next) => setDraft(sku.id, next)}
                label={`${brand.name} · ${variant.name}`}
              />
            ))}
          </CatalogueTable>
        </section>
      ) : null}

      {searching ? (
        <p className="mb-2 text-sm text-muted">
          {totalShown === 1 ? "1 SKU matches" : `${totalShown} SKUs match`}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
          Nothing matches that search.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {visible.map((brand) => {
            const dirtyCount = dirtyIdsFor(brand.id).length;
            // Never collapse a brand that has unsaved edits — they would become
            // invisible and be lost on Discard without the user realising.
            const open = searching || openBrands.has(brand.id) || dirtyCount > 0;
            const skus = allSkus(brand);
            const staleCount = skus.filter((sku) =>
              isStale(sku.lastUpdatedAt, nowMs),
            ).length;

            return (
              <li
                key={brand.id}
                className="overflow-hidden rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
              >
                <button
                  type="button"
                  onClick={() => setOpenBrands((prev) => toggle(prev, brand.id))}
                  aria-expanded={open}
                  className="flex min-h-14 w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-sunken"
                >
                  <span
                    aria-hidden
                    className={`text-xs text-muted-soft transition-transform ${open ? "rotate-90" : ""}`}
                  >
                    ▶
                  </span>
                  <span className="flex-1 text-sm font-semibold text-foreground">
                    {brand.name}
                  </span>
                  {dirtyCount > 0 ? (
                    <span className="nums rounded-full bg-info-bg px-2 py-0.5 text-[11px] font-semibold text-info-fg">
                      {dirtyCount} unsaved
                    </span>
                  ) : null}
                  {staleCount > 0 ? (
                    <span className="nums rounded-full bg-warning-bg px-2 py-0.5 text-[11px] font-medium text-warning-fg">
                      {staleCount} stale
                    </span>
                  ) : null}
                  <span className="nums rounded-full bg-surface-sunken px-2 py-0.5 text-[11px] font-medium text-muted">
                    {skus.length}
                  </span>
                </button>

                {open ? (
                  <>
                    <CatalogueTable>
                      {brand.variants.flatMap((variant) =>
                        variant.skus.map((sku) => (
                          <SkuRow
                            key={sku.id}
                            sku={sku}
                            fx={fx}
                            nowMs={nowMs}
                            draft={getDraft(sku)}
                            entryCurrency={entryCurrency}
                            dirty={dirtyIds.has(sku.id)}
                            touched={touchedIds.has(sku.id)}
                            canManagePhotos={canManagePhotos}
                            error={fieldErrors[sku.id]}
                            onChange={(next) => setDraft(sku.id, next)}
                            label={variant.name}
                            gender={variant.gender}
                          />
                        )),
                      )}
                    </CatalogueTable>
                    <BrandSaveBar
                      count={dirtyCount}
                      saving={savingBrand === brand.id}
                      vendors={vendors}
                      vendorName={vendorName}
                      onVendorChange={setVendorName}
                      onSave={() => saveBrand(brand.id)}
                      onDiscard={() => discardBrand(brand.id)}
                      error={saveErrors[brand.id] ?? null}
                    />
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
