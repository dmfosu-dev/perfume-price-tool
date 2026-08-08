"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type ConflictActionState = { error?: string; notice?: string };

/**
 * Spec §3.3: the admin picks which value is correct. Keeping the existing one
 * simply closes the conflict — the SKU was never changed. Taking the incoming
 * one applies it and writes a history row, so the audit trail shows the
 * resolution rather than an unexplained jump.
 */
async function resolve(
  formData: FormData,
  choice: "kept_existing" | "took_incoming",
): Promise<ConflictActionState> {
  const admin = await requireAdmin();

  const id = String(formData.get("conflictId") ?? "");
  if (!id) return { error: "No conflict specified." };

  const conflict = await prisma.priceConflict.findUnique({ where: { id } });
  if (!conflict) return { error: "That conflict no longer exists." };
  if (conflict.status !== "open") {
    revalidatePath("/admin/conflicts");
    return { error: "This conflict was already resolved." };
  }

  const now = new Date();

  if (choice === "kept_existing") {
    await prisma.priceConflict.update({
      where: { id },
      data: { status: choice, resolvedById: admin.id, resolvedAt: now },
    });
  } else {
    await prisma.$transaction([
      prisma.sku.update({
        where: { id: conflict.skuId },
        data: {
          singlePrice: conflict.incomingSinglePrice,
          cartonPrice: conflict.incomingCartonPrice,
          cartonQty: conflict.incomingCartonQty,
          minimumOrderQty: conflict.incomingMinimumOrderQty,
          priceCurrency: conflict.incomingPriceCurrency,
          stockStatus: conflict.incomingStockStatus,
          lastUpdatedAt: now,
          lastUpdatedById: conflict.incomingById,
        },
      }),
      prisma.priceHistory.create({
        data: {
          skuId: conflict.skuId,
          singlePrice: conflict.incomingSinglePrice,
          cartonPrice: conflict.incomingCartonPrice,
          cartonQty: conflict.incomingCartonQty,
          minimumOrderQty: conflict.incomingMinimumOrderQty,
          priceCurrency: conflict.incomingPriceCurrency,
          stockStatus: conflict.incomingStockStatus,
          entryType: "price_change",
          source: "offline_sync",
          // Credited to whoever recorded the price, not the admin who approved.
          changedById: conflict.incomingById,
          changedAt: now,
        },
      }),
      prisma.priceConflict.update({
        where: { id },
        data: { status: choice, resolvedById: admin.id, resolvedAt: now },
      }),
    ]);
  }

  revalidatePath("/admin/conflicts");
  revalidatePath("/dashboard");
  return {
    notice:
      choice === "kept_existing" ? "Kept the current price." : "Applied the queued price.",
  };
}

export async function keepExisting(
  _prev: ConflictActionState,
  formData: FormData,
): Promise<ConflictActionState> {
  return resolve(formData, "kept_existing");
}

export async function takeIncoming(
  _prev: ConflictActionState,
  formData: FormData,
): Promise<ConflictActionState> {
  return resolve(formData, "took_incoming");
}
