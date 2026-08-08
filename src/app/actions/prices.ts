"use server";

import { revalidatePath } from "next/cache";
import { requireApprovedUser } from "@/lib/auth";
import { isSupportedCurrency } from "@/lib/currencies";
import { PRICE_SOURCES, STOCK_STATUSES, type PriceSource, type StockStatus } from "@/lib/enums";
import { getFxSettings, getLatestRates } from "@/lib/fx";
import { parsePrice, parseQty, validateCartonPair } from "@/lib/price-input";
import { prisma } from "@/lib/prisma";

export type SkuEdit = {
  skuId: string;
  /// Raw strings straight from the inputs; parsed and validated server-side.
  singlePrice: string;
  cartonPrice: string;
  cartonQty: string;
  minimumOrderQty: string;
  stockStatus: string;
  /// The SKU's lastUpdatedAt as the client saw it. Offline edits carry this so
  /// a clash can be detected on replay (spec §3.3); null means "was unpriced".
  baseUpdatedAt?: string | null;
};

export type SaveResult = {
  ok: boolean;
  savedCount?: number;
  /// Edits parked for admin review because the SKU moved underneath them.
  conflictCount?: number;
  error?: string;
  /// Per-SKU validation messages, keyed by skuId.
  fieldErrors?: Record<string, string>;
};

function isStockStatus(value: string): value is StockStatus {
  return (STOCK_STATUSES as readonly string[]).includes(value);
}

/**
 * Batch save (spec §3.2): every queued edit in a brand commits in one call.
 * Runs in a single transaction so a partial failure cannot leave some SKUs
 * updated with no matching history row.
 *
 * `priceCurrency` is whatever the intermediary was working in — a shop in Dubai
 * quotes AED, one in Riyadh quotes SAR — so it is recorded per entry rather
 * than assumed.
 */
export async function savePriceEdits(
  edits: SkuEdit[],
  vendorName: string | null,
  priceCurrency: string,
  source: PriceSource = "online",
): Promise<SaveResult> {
  const user = await requireApprovedUser();

  if (!(PRICE_SOURCES as readonly string[]).includes(source)) {
    return { ok: false, error: "Unrecognised entry source." };
  }

  if (!Array.isArray(edits) || edits.length === 0) {
    return { ok: false, error: "Nothing to save." };
  }
  if (edits.length > 500) {
    return { ok: false, error: "Too many changes in one save." };
  }
  if (!isSupportedCurrency(priceCurrency)) {
    return { ok: false, error: "Unrecognised price currency." };
  }

  const settings = await getFxSettings();
  if (!settings.selectedCurrencies.includes(priceCurrency)) {
    return {
      ok: false,
      error: `${priceCurrency} is not being tracked. An admin must add it on the FX page first.`,
    };
  }

  // Validate everything before writing anything.
  const fieldErrors: Record<string, string> = {};
  const parsed = new Map<
    string,
    {
      singlePrice: string | null;
      cartonPrice: string | null;
      cartonQty: number | null;
      minimumOrderQty: number | null;
      stockStatus: StockStatus;
      baseUpdatedAt: string | null;
    }
  >();

  for (const edit of edits) {
    const single = parsePrice(edit.singlePrice ?? "", "Price");
    if (!single.ok) {
      fieldErrors[edit.skuId] = single.error;
      continue;
    }
    const cartonPrice = parsePrice(edit.cartonPrice ?? "", "Carton price");
    if (!cartonPrice.ok) {
      fieldErrors[edit.skuId] = cartonPrice.error;
      continue;
    }
    const cartonQty = parseQty(edit.cartonQty ?? "", "Carton quantity");
    if (!cartonQty.ok) {
      fieldErrors[edit.skuId] = cartonQty.error;
      continue;
    }

    const moq = parseQty(edit.minimumOrderQty ?? "", "Minimum order quantity");
    if (!moq.ok) {
      fieldErrors[edit.skuId] = moq.error;
      continue;
    }

    const pairError = validateCartonPair(cartonPrice.value, cartonQty.value);
    if (pairError) {
      fieldErrors[edit.skuId] = pairError;
      continue;
    }

    if (!isStockStatus(edit.stockStatus)) {
      fieldErrors[edit.skuId] = "Unrecognised stock status.";
      continue;
    }

    if (cartonPrice.value !== null && single.value === null) {
      fieldErrors[edit.skuId] = "Enter the single-bottle price too.";
      continue;
    }

    parsed.set(edit.skuId, {
      singlePrice: single.value,
      cartonPrice: cartonPrice.value,
      cartonQty: cartonQty.value,
      minimumOrderQty: moq.value,
      stockStatus: edit.stockStatus,
      baseUpdatedAt: edit.baseUpdatedAt ?? null,
    });
  }

  if (Object.keys(fieldErrors).length > 0) {
    return { ok: false, error: "Some entries need fixing.", fieldErrors };
  }

  const skuIds = [...parsed.keys()];
  const existing = await prisma.sku.findMany({
    where: { id: { in: skuIds } },
    select: {
      id: true,
      singlePrice: true,
      cartonPrice: true,
      cartonQty: true,
      minimumOrderQty: true,
      priceCurrency: true,
      stockStatus: true,
      lastUpdatedAt: true,
      lastUpdatedById: true,
    },
  });

  if (existing.length !== skuIds.length) {
    return { ok: false, error: "Some products no longer exist. Reload and try again." };
  }

  let vendorId: string | null = null;
  const trimmedVendor = vendorName?.trim() ?? "";
  if (trimmedVendor.length > 0) {
    if (trimmedVendor.length > 120) {
      return { ok: false, error: "Vendor name is too long." };
    }
    const vendor = await prisma.vendor.upsert({
      where: { name: trimmedVendor },
      update: {},
      create: { name: trimmedVendor, createdById: user.id },
      select: { id: true },
    });
    vendorId = vendor.id;
  }

  // Snapshot of what this currency was worth at entry time. History is
  // append-only, so it cannot be reconstructed later if rates move.
  const rates = await getLatestRates(settings.baseCurrency, settings.selectedCurrencies);
  const rateToBase = rates.find((row) => row.currency === priceCurrency)?.rate ?? null;

  const now = new Date();
  const toWrite: typeof existing = [];
  const conflicts: typeof existing = [];

  for (const sku of existing) {
    const next = parsed.get(sku.id);
    if (!next) continue;

    // Spec §3.3 — only for offline replays. An online save is last-write-wins
    // per §7 (no approval workflow); an offline edit may be hours stale, which
    // is a different risk entirely.
    if (source === "offline_sync") {
      const serverAt = sku.lastUpdatedAt?.getTime() ?? null;
      const base = next.baseUpdatedAt === null ? null : Date.parse(next.baseUpdatedAt);
      const movedUnderneath =
        serverAt !== null &&
        // Someone priced it while this device was away, or it changed after the
        // point the device last saw.
        (base === null || (Number.isFinite(base) && serverAt > (base as number)));

      if (movedUnderneath && sku.lastUpdatedById !== user.id) {
        conflicts.push(sku);
        continue;
      }
    }

    const changed =
      normaliseMoney(sku.singlePrice) !== next.singlePrice ||
      normaliseMoney(sku.cartonPrice) !== next.cartonPrice ||
      (sku.cartonQty ?? null) !== next.cartonQty ||
      (sku.minimumOrderQty ?? null) !== next.minimumOrderQty ||
      sku.stockStatus !== next.stockStatus ||
      // Re-quoting the same number in a different currency is a real change.
      (next.singlePrice !== null && sku.priceCurrency !== priceCurrency);

    if (changed) toWrite.push(sku);
  }

  if (toWrite.length === 0 && conflicts.length === 0) {
    return { ok: true, savedCount: 0 };
  }

  await prisma.$transaction([
    ...toWrite.flatMap((sku) => {
      const next = parsed.get(sku.id)!;
      // Clearing the price clears its currency too, rather than leaving a
      // currency label attached to nothing.
      const currency = next.singlePrice === null ? null : priceCurrency;

      return [
        prisma.sku.update({
          where: { id: sku.id },
          data: {
            singlePrice: next.singlePrice,
            cartonPrice: next.cartonPrice,
            cartonQty: next.cartonQty,
            minimumOrderQty: next.minimumOrderQty,
            priceCurrency: currency,
            stockStatus: next.stockStatus,
            lastUpdatedAt: now,
            lastUpdatedById: user.id,
          },
        }),
        prisma.priceHistory.create({
          data: {
            skuId: sku.id,
            singlePrice: next.singlePrice,
            cartonPrice: next.cartonPrice,
            cartonQty: next.cartonQty,
            minimumOrderQty: next.minimumOrderQty,
            priceCurrency: currency,
            fxBaseCurrency: rateToBase === null ? null : settings.baseCurrency,
            fxRateToBase: rateToBase === null ? null : rateToBase.toString(),
            stockStatus: next.stockStatus,
            entryType: "price_change",
            source,
            vendorId,
            changedById: user.id,
            changedAt: now,
          },
        }),
      ];
    }),
    // The SKU is deliberately left untouched: "price remains at the last
    // confirmed value until resolved".
    ...conflicts.map((sku) => {
      const next = parsed.get(sku.id)!;
      return prisma.priceConflict.create({
        data: {
          skuId: sku.id,
          incomingSinglePrice: next.singlePrice,
          incomingCartonPrice: next.cartonPrice,
          incomingCartonQty: next.cartonQty,
          incomingMinimumOrderQty: next.minimumOrderQty,
          incomingPriceCurrency: next.singlePrice === null ? null : priceCurrency,
          incomingStockStatus: next.stockStatus,
          incomingById: user.id,
          incomingAt: now,
          baseUpdatedAt:
            next.baseUpdatedAt === null ? null : new Date(next.baseUpdatedAt),
          existingSinglePrice: sku.singlePrice,
          existingCartonPrice: sku.cartonPrice,
          existingCartonQty: sku.cartonQty,
          existingMinimumOrderQty: sku.minimumOrderQty,
          existingPriceCurrency: sku.priceCurrency,
          existingStockStatus: sku.stockStatus,
          existingById: sku.lastUpdatedById,
          existingAt: sku.lastUpdatedAt,
          status: "open",
        },
      });
    }),
  ]);

  revalidatePath("/dashboard");
  return {
    ok: true,
    savedCount: toWrite.length,
    conflictCount: conflicts.length,
  };
}

function normaliseMoney(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(String(value));
  return Number.isFinite(parsed) ? parsed.toFixed(2) : null;
}

/**
 * One-tap confirmation that the market price has not moved (EXTRA_FEATURES §2).
 * Writes a real history row so "who checked this, and when" survives, but tags
 * it as a verification so the default history view can hide it.
 */
export async function verifyPrice(skuId: string): Promise<SaveResult> {
  const user = await requireApprovedUser();

  const sku = await prisma.sku.findUnique({
    where: { id: skuId },
    select: {
      id: true,
      singlePrice: true,
      cartonPrice: true,
      cartonQty: true,
      priceCurrency: true,
      stockStatus: true,
    },
  });
  if (!sku) return { ok: false, error: "That product no longer exists." };
  if (sku.singlePrice === null) {
    return { ok: false, error: "There is no price to verify yet." };
  }

  const now = new Date();
  await prisma.$transaction([
    prisma.sku.update({
      where: { id: sku.id },
      data: {
        lastUpdatedAt: now,
        lastUpdatedById: user.id,
        lastVerifiedAt: now,
        lastVerifiedById: user.id,
      },
    }),
    prisma.priceHistory.create({
      data: {
        skuId: sku.id,
        singlePrice: String(sku.singlePrice),
        cartonPrice: sku.cartonPrice === null ? null : String(sku.cartonPrice),
        cartonQty: sku.cartonQty,
        priceCurrency: sku.priceCurrency,
        stockStatus: sku.stockStatus,
        entryType: "verification",
        source: "online",
        changedById: user.id,
        changedAt: now,
      },
    }),
  ]);

  revalidatePath("/dashboard");
  return { ok: true, savedCount: 1 };
}

/**
 * Intermediary reports a naming/size mismatch against physical stock
 * (spec §4 note). Lands in the admin queue built in step 6.
 */
export async function reportDiscrepancy(
  skuId: string,
  note: string,
): Promise<SaveResult> {
  const user = await requireApprovedUser();

  const trimmed = note.trim();
  if (trimmed.length < 3) return { ok: false, error: "Describe the problem first." };
  if (trimmed.length > 1000) return { ok: false, error: "That note is too long." };

  const sku = await prisma.sku.findUnique({ where: { id: skuId }, select: { id: true } });
  if (!sku) return { ok: false, error: "That product no longer exists." };

  const alreadyOpen = await prisma.discrepancyReport.findFirst({
    where: { skuId, status: "open" },
    select: { id: true },
  });
  if (alreadyOpen) {
    return { ok: false, error: "There is already an open report for this product." };
  }

  await prisma.discrepancyReport.create({
    data: { skuId, note: trimmed, reportedById: user.id, status: "open" },
  });

  revalidatePath("/dashboard");
  return { ok: true, savedCount: 1 };
}
