"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { isSupportedCurrency } from "@/lib/currencies";
import { prisma } from "@/lib/prisma";

export type PlanningActionState = { error?: string; notice?: string };

function parseNumber(
  raw: string,
  label: string,
  { min = 0, max = 1_000_000 }: { min?: number; max?: number } = {},
): { ok: true; value: number } | { ok: false; error: string } {
  const cleaned = raw.replace(/[\s,]/g, "").trim();
  if (cleaned === "") return { ok: true, value: 0 };
  if (!/^\d*\.?\d+$/.test(cleaned)) return { ok: false, error: `${label} must be a number.` };

  const value = Number(cleaned);
  if (!Number.isFinite(value)) return { ok: false, error: `${label} must be a number.` };
  if (value < min) return { ok: false, error: `${label} cannot be below ${min}.` };
  if (value > max) return { ok: false, error: `${label} looks too large.` };
  return { ok: true, value };
}

/**
 * Persists the shipping/customs/margin assumptions so they survive a reload.
 * Appended rather than overwritten — a past quote can then be re-derived from
 * the assumptions that were actually in force at the time.
 */
export async function saveCostAssumptions(
  _prev: PlanningActionState,
  formData: FormData,
): Promise<PlanningActionState> {
  const admin = await requireAdmin();

  const shipping = parseNumber(String(formData.get("shippingPerUnit") ?? ""), "Shipping");
  if (!shipping.ok) return { error: shipping.error };

  const customs = parseNumber(String(formData.get("customsRatePct") ?? ""), "Customs %", {
    max: 500,
  });
  if (!customs.ok) return { error: customs.error };

  const other = parseNumber(String(formData.get("otherFeesPerUnit") ?? ""), "Other fees");
  if (!other.ok) return { error: other.error };

  const margin = parseNumber(String(formData.get("targetMarginPct") ?? ""), "Target margin", {
    max: 99.9,
  });
  if (!margin.ok) return { error: margin.error };

  await prisma.costAssumption.create({
    data: {
      label: String(formData.get("label") ?? "").trim() || null,
      shippingPerUnitSar: shipping.value.toString(),
      customsRatePct: customs.value.toString(),
      otherFeesSar: other.value.toString(),
      targetMarginPct: margin.value.toString(),
      setById: admin.id,
    },
  });

  revalidatePath("/admin/planning");
  return { notice: "Assumptions saved — they will load next time." };
}

/**
 * Shared validation for the add and edit forms.
 *
 * `skuId` is optional and is what makes a price size-specific: a 100ml and a
 * 150ml of the same fragrance are different products at different prices, so
 * pinning the observation to a size stops one of them being modelled against
 * the other's competitor price. Left blank, the row applies to every size —
 * still useful when a listing does not say which one it is.
 */
async function readCompetitorForm(formData: FormData): Promise<
  | { ok: false; error: string }
  | {
      ok: true;
      value: {
        variantId: string;
        skuId: string | null;
        competitor: string;
        price: string;
        currency: string;
        notes: string | null;
      };
    }
> {
  const variantId = String(formData.get("variantId") ?? "");
  const rawSkuId = String(formData.get("skuId") ?? "").trim();
  const competitor = String(formData.get("competitor") ?? "").trim();
  const currency = String(formData.get("currency") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  if (!variantId) return { ok: false, error: "Pick a fragrance." };
  if (competitor.length < 2) return { ok: false, error: "Name the competitor." };
  if (competitor.length > 120) return { ok: false, error: "That name is too long." };
  if (!isSupportedCurrency(currency)) return { ok: false, error: "Pick a tracked currency." };
  if (notes.length > 500) return { ok: false, error: "That note is too long." };

  const price = parseNumber(String(formData.get("price") ?? ""), "Price");
  if (!price.ok) return { ok: false, error: price.error };
  if (price.value <= 0) return { ok: false, error: "Enter the competitor's price." };

  const variant = await prisma.variant.findUnique({
    where: { id: variantId },
    select: { id: true },
  });
  if (!variant) return { ok: false, error: "That fragrance no longer exists." };

  // A size must belong to the fragrance it is filed under, or the comparison
  // would silently attach one product's competitor price to another's.
  if (rawSkuId !== "") {
    const sku = await prisma.sku.findUnique({
      where: { id: rawSkuId },
      select: { variantId: true },
    });
    if (!sku) return { ok: false, error: "That size no longer exists." };
    if (sku.variantId !== variantId) {
      return { ok: false, error: "That size belongs to a different fragrance." };
    }
  }

  return {
    ok: true,
    value: {
      variantId,
      skuId: rawSkuId === "" ? null : rawSkuId,
      competitor,
      price: price.value.toString(),
      currency,
      notes: notes === "" ? null : notes,
    },
  };
}

export async function addCompetitorPrice(
  _prev: PlanningActionState,
  formData: FormData,
): Promise<PlanningActionState> {
  const admin = await requireAdmin();

  const parsed = await readCompetitorForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  await prisma.competitorPrice.create({
    data: { ...parsed.value, recordedById: admin.id },
  });

  revalidatePath("/admin/planning");
  return { notice: `Recorded ${parsed.value.competitor}.` };
}

export async function updateCompetitorPrice(
  _prev: PlanningActionState,
  formData: FormData,
): Promise<PlanningActionState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing the price to update." };

  const parsed = await readCompetitorForm(formData);
  if (!parsed.ok) return { error: parsed.error };

  const existing = await prisma.competitorPrice.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return { error: "That competitor price has already been removed." };

  await prisma.competitorPrice.update({ where: { id }, data: parsed.value });

  revalidatePath("/admin/planning");
  return { notice: "Updated." };
}

export async function deleteCompetitorPrice(
  _prev: PlanningActionState,
  formData: FormData,
): Promise<PlanningActionState> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing the price to delete." };

  const existing = await prisma.competitorPrice.findUnique({
    where: { id },
    select: { competitor: true },
  });
  // Already gone is the outcome the user wanted, so this is not an error.
  if (!existing) {
    revalidatePath("/admin/planning");
    return { notice: "That competitor price was already removed." };
  }

  await prisma.competitorPrice.delete({ where: { id } });

  revalidatePath("/admin/planning");
  return { notice: `Removed ${existing.competitor}.` };
}
