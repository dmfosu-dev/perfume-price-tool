"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { CONCENTRATIONS, GENDERS } from "@/lib/enums";
import { parseQty } from "@/lib/price-input";
import { prisma } from "@/lib/prisma";
import { buildSkuCode } from "@/lib/sku-code";

export type CatalogueState = { error?: string; notice?: string };

function slugCode(value: string, max = 28): string {
  return (
    value
      .toUpperCase()
      .replace(/&/g, "AND")
      .replace(/[^A-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, max) || "ITEM"
  );
}

function done(notice: string): CatalogueState {
  revalidatePath("/admin/catalogue");
  revalidatePath("/dashboard");
  return { notice };
}

export async function addBrand(
  _prev: CatalogueState,
  formData: FormData,
): Promise<CatalogueState> {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Give the brand a name." };
  if (name.length > 80) return { error: "That name is too long." };

  const code = (String(formData.get("code") ?? "").trim() || slugCode(name, 4)).toUpperCase();

  const clash = await prisma.brand.findFirst({
    where: { OR: [{ name }, { code }] },
    select: { name: true, code: true },
  });
  if (clash) {
    return {
      error:
        clash.name === name
          ? `"${name}" already exists.`
          : `Code ${code} is already used by ${clash.name}.`,
    };
  }

  await prisma.brand.create({
    data: { name, code, sortOrder: await prisma.brand.count() },
  });
  return done(`Added ${name}.`);
}

export async function renameBrand(
  _prev: CatalogueState,
  formData: FormData,
): Promise<CatalogueState> {
  await requireAdmin();

  const id = String(formData.get("brandId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!id || name.length < 2) return { error: "Give the brand a name." };

  const clash = await prisma.brand.findFirst({
    where: { name, NOT: { id } },
    select: { id: true },
  });
  if (clash) return { error: `"${name}" already exists.` };

  await prisma.brand.update({ where: { id }, data: { name } });
  return done("Brand renamed.");
}

/**
 * Reordering swaps sortOrder with the neighbour rather than rewriting the whole
 * list, so two admins reordering at once cannot renumber each other's work.
 */
export async function moveBrand(
  _prev: CatalogueState,
  formData: FormData,
): Promise<CatalogueState> {
  await requireAdmin();

  const id = String(formData.get("brandId") ?? "");
  const direction = String(formData.get("direction") ?? "");
  if (!id || (direction !== "up" && direction !== "down")) {
    return { error: "Unknown move." };
  }

  const brand = await prisma.brand.findUnique({
    where: { id },
    select: { id: true, sortOrder: true },
  });
  if (!brand) return { error: "That brand no longer exists." };

  const neighbour = await prisma.brand.findFirst({
    where:
      direction === "up"
        ? { sortOrder: { lt: brand.sortOrder } }
        : { sortOrder: { gt: brand.sortOrder } },
    orderBy: { sortOrder: direction === "up" ? "desc" : "asc" },
    select: { id: true, sortOrder: true },
  });
  if (!neighbour) return { notice: "Already at the end." };

  await prisma.$transaction([
    prisma.brand.update({ where: { id: brand.id }, data: { sortOrder: neighbour.sortOrder } }),
    prisma.brand.update({ where: { id: neighbour.id }, data: { sortOrder: brand.sortOrder } }),
  ]);
  return done("Order updated.");
}

export async function setBrandActive(
  _prev: CatalogueState,
  formData: FormData,
): Promise<CatalogueState> {
  await requireAdmin();
  const id = String(formData.get("brandId") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) return { error: "No brand specified." };

  await prisma.brand.update({ where: { id }, data: { isActive: active } });
  return done(active ? "Brand restored." : "Brand archived.");
}

export async function addVariant(
  _prev: CatalogueState,
  formData: FormData,
): Promise<CatalogueState> {
  await requireAdmin();

  const brandId = String(formData.get("brandId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const gender = String(formData.get("gender") ?? "unisex");

  if (!brandId) return { error: "No brand specified." };
  if (name.length < 2) return { error: "Give the fragrance a name." };
  if (!(GENDERS as readonly string[]).includes(gender)) return { error: "Unknown gender." };

  const exists = await prisma.variant.findUnique({
    where: { brandId_name: { brandId, name } },
    select: { id: true },
  });
  if (exists) return { error: `"${name}" already exists for this brand.` };

  await prisma.variant.create({
    data: { brandId, name, gender, code: slugCode(name) },
  });
  return done(`Added ${name}.`);
}

export async function setVariantActive(
  _prev: CatalogueState,
  formData: FormData,
): Promise<CatalogueState> {
  await requireAdmin();
  const id = String(formData.get("variantId") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) return { error: "No fragrance specified." };

  await prisma.variant.update({ where: { id }, data: { isActive: active } });
  return done(active ? "Fragrance restored." : "Fragrance archived.");
}

export async function addSku(
  _prev: CatalogueState,
  formData: FormData,
): Promise<CatalogueState> {
  await requireAdmin();

  const variantId = String(formData.get("variantId") ?? "");
  const concentration = String(formData.get("concentration") ?? "");
  const size = parseQty(String(formData.get("sizeMl") ?? ""), "Size");

  if (!variantId) return { error: "No fragrance specified." };
  if (!size.ok) return { error: size.error };
  if (size.value === null) return { error: "Enter a size in millilitres." };
  if (!(CONCENTRATIONS as readonly string[]).includes(concentration)) {
    return { error: "Pick a concentration." };
  }

  const variant = await prisma.variant.findUnique({
    where: { id: variantId },
    select: { id: true, code: true, brand: { select: { code: true } } },
  });
  if (!variant) return { error: "That fragrance no longer exists." };

  const exists = await prisma.sku.findUnique({
    where: {
      variantId_sizeMl_concentration: {
        variantId,
        sizeMl: size.value,
        concentration,
      },
    },
    select: { id: true },
  });
  if (exists) return { error: `${size.value}ml ${concentration} already exists.` };

  await prisma.sku.create({
    data: {
      variantId,
      skuCode: buildSkuCode(variant.brand.code, variant.code, size.value, concentration),
      sizeMl: size.value,
      concentration,
    },
  });
  return done(`Added ${size.value}ml ${concentration}.`);
}

export async function setSkuActive(
  _prev: CatalogueState,
  formData: FormData,
): Promise<CatalogueState> {
  await requireAdmin();
  const id = String(formData.get("skuId") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!id) return { error: "No size specified." };

  await prisma.sku.update({ where: { id }, data: { isActive: active } });
  return done(active ? "Size restored." : "Size archived.");
}

/// EXTRA_FEATURES §2: pin a SKU to the top of the intermediary's dashboard.
export async function togglePriority(
  _prev: CatalogueState,
  formData: FormData,
): Promise<CatalogueState> {
  const admin = await requireAdmin();

  const id = String(formData.get("skuId") ?? "");
  const on = String(formData.get("on") ?? "") === "true";
  const note = String(formData.get("priorityNote") ?? "").trim();
  if (!id) return { error: "No size specified." };
  if (note.length > 200) return { error: "That note is too long." };

  await prisma.sku.update({
    where: { id },
    data: on
      ? {
          isPriority: true,
          priorityNote: note === "" ? null : note,
          prioritySetAt: new Date(),
          prioritySetById: admin.id,
        }
      : { isPriority: false, priorityNote: null, prioritySetAt: null, prioritySetById: null },
  });
  return done(on ? "Pinned for priority checking." : "Priority removed.");
}

/// EXTRA_FEATURES §3: our own stock level, kept separate from source-side stock
/// and from any customer/order data (spec §7).
export async function setLocalStock(
  _prev: CatalogueState,
  formData: FormData,
): Promise<CatalogueState> {
  const admin = await requireAdmin();

  const id = String(formData.get("skuId") ?? "");
  if (!id) return { error: "No size specified." };

  const raw = String(formData.get("localStockQty") ?? "").trim();
  if (raw === "") {
    await prisma.sku.update({
      where: { id },
      data: { localStockQty: null, localStockUpdatedAt: null, localStockUpdatedById: null },
    });
    return done("Local stock cleared.");
  }

  // Zero is meaningful here ("sold out locally"), so parseQty's minimum of 1
  // is not appropriate.
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value > 1_000_000) {
    return { error: "Local stock must be a whole number, 0 or more." };
  }

  await prisma.sku.update({
    where: { id },
    data: {
      localStockQty: value,
      localStockUpdatedAt: new Date(),
      localStockUpdatedById: admin.id,
    },
  });
  return done("Local stock updated.");
}

export async function updateVariant(
  _prev: CatalogueState,
  formData: FormData,
): Promise<CatalogueState> {
  await requireAdmin();

  const id = String(formData.get("variantId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const gender = String(formData.get("gender") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  if (!id) return { error: "No fragrance specified." };
  if (name.length < 2) return { error: "Give the fragrance a name." };
  if (name.length > 120) return { error: "That name is too long." };
  if (!(GENDERS as readonly string[]).includes(gender)) return { error: "Unknown gender." };
  if (notes.length > 500) return { error: "That note is too long." };

  const current = await prisma.variant.findUnique({
    where: { id },
    select: { brandId: true },
  });
  if (!current) return { error: "That fragrance no longer exists." };

  const clash = await prisma.variant.findFirst({
    where: { brandId: current.brandId, name, NOT: { id } },
    select: { id: true },
  });
  if (clash) return { error: `"${name}" already exists for this brand.` };

  await prisma.variant.update({
    where: { id },
    data: { name, gender, notes: notes === "" ? null : notes },
  });
  return done("Fragrance updated.");
}

/**
 * Changing size or concentration re-mints the SKU code, since the code encodes
 * both. The unique constraint on (variant, size, concentration) is checked first
 * so the failure is a readable message rather than a database error.
 */
export async function updateSku(
  _prev: CatalogueState,
  formData: FormData,
): Promise<CatalogueState> {
  await requireAdmin();

  const id = String(formData.get("skuId") ?? "");
  const concentration = String(formData.get("concentration") ?? "");
  const size = parseQty(String(formData.get("sizeMl") ?? ""), "Size");

  if (!id) return { error: "No size specified." };
  if (!size.ok) return { error: size.error };
  if (size.value === null) return { error: "Enter a size in millilitres." };
  if (!(CONCENTRATIONS as readonly string[]).includes(concentration)) {
    return { error: "Pick a concentration." };
  }

  const sku = await prisma.sku.findUnique({
    where: { id },
    select: {
      variantId: true,
      variant: { select: { code: true, brand: { select: { code: true } } } },
    },
  });
  if (!sku) return { error: "That size no longer exists." };

  const clash = await prisma.sku.findFirst({
    where: {
      variantId: sku.variantId,
      sizeMl: size.value,
      concentration,
      NOT: { id },
    },
    select: { id: true },
  });
  if (clash) return { error: `${size.value}ml ${concentration} already exists.` };

  await prisma.sku.update({
    where: { id },
    data: {
      sizeMl: size.value,
      concentration,
      skuCode: buildSkuCode(
        sku.variant.brand.code,
        sku.variant.code,
        size.value,
        concentration,
      ),
    },
  });
  return done("Size updated.");
}

/**
 * Deletion is only offered where nothing would be lost. Price history cascades
 * from Sku, so removing a priced product would silently destroy its audit trail
 * — archiving is the right tool there, and the caller is told so.
 */
export async function deleteSku(
  _prev: CatalogueState,
  formData: FormData,
): Promise<CatalogueState> {
  await requireAdmin();

  const id = String(formData.get("skuId") ?? "");
  if (!id) return { error: "No size specified." };

  const counts = await prisma.sku.findUnique({
    where: { id },
    select: {
      skuCode: true,
      _count: { select: { history: true, conflicts: true, discrepancies: true } },
    },
  });
  if (!counts) return { error: "That size no longer exists." };

  if (counts._count.history > 0) {
    return {
      error: `${counts.skuCode} has ${counts._count.history} price records. Archive it instead — deleting would destroy that history.`,
    };
  }

  await prisma.sku.delete({ where: { id } });
  return done(`Deleted ${counts.skuCode}.`);
}

export async function deleteVariant(
  _prev: CatalogueState,
  formData: FormData,
): Promise<CatalogueState> {
  await requireAdmin();

  const id = String(formData.get("variantId") ?? "");
  if (!id) return { error: "No fragrance specified." };

  const variant = await prisma.variant.findUnique({
    where: { id },
    select: { name: true, skus: { select: { _count: { select: { history: true } } } } },
  });
  if (!variant) return { error: "That fragrance no longer exists." };

  const records = variant.skus.reduce((total, sku) => total + sku._count.history, 0);
  if (records > 0) {
    return {
      error: `"${variant.name}" has ${records} price records across its sizes. Archive it instead.`,
    };
  }

  await prisma.variant.delete({ where: { id } });
  return done(`Deleted ${variant.name}.`);
}

export async function deleteBrand(
  _prev: CatalogueState,
  formData: FormData,
): Promise<CatalogueState> {
  await requireAdmin();

  const id = String(formData.get("brandId") ?? "");
  if (!id) return { error: "No brand specified." };

  const brand = await prisma.brand.findUnique({
    where: { id },
    select: {
      name: true,
      variants: {
        select: { skus: { select: { _count: { select: { history: true } } } } },
      },
    },
  });
  if (!brand) return { error: "That brand no longer exists." };

  const records = brand.variants.reduce(
    (total, variant) =>
      total + variant.skus.reduce((sum, sku) => sum + sku._count.history, 0),
    0,
  );
  if (records > 0) {
    return {
      error: `"${brand.name}" has ${records} price records. Archive it instead — deleting would destroy that history.`,
    };
  }

  await prisma.brand.delete({ where: { id } });
  return done(`Deleted ${brand.name}.`);
}
