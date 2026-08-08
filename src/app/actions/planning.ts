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

export async function addCompetitorPrice(
  _prev: PlanningActionState,
  formData: FormData,
): Promise<PlanningActionState> {
  const admin = await requireAdmin();

  const variantId = String(formData.get("variantId") ?? "");
  const competitor = String(formData.get("competitor") ?? "").trim();
  const currency = String(formData.get("currency") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  if (!variantId) return { error: "Pick a fragrance." };
  if (competitor.length < 2) return { error: "Name the competitor." };
  if (competitor.length > 120) return { error: "That name is too long." };
  if (!isSupportedCurrency(currency)) return { error: "Pick a tracked currency." };

  const price = parseNumber(String(formData.get("price") ?? ""), "Price");
  if (!price.ok) return { error: price.error };
  if (price.value <= 0) return { error: "Enter the competitor's price." };

  const variant = await prisma.variant.findUnique({
    where: { id: variantId },
    select: { id: true },
  });
  if (!variant) return { error: "That fragrance no longer exists." };

  await prisma.competitorPrice.create({
    data: {
      variantId,
      competitor,
      price: price.value.toString(),
      currency,
      notes: notes === "" ? null : notes,
      recordedById: admin.id,
    },
  });

  revalidatePath("/admin/planning");
  return { notice: `Recorded ${competitor}.` };
}
