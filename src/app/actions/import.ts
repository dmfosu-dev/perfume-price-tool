"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { buildSkuCode } from "@/lib/sku-code";
import { cell, mapHeaders, parseCsv } from "@/lib/csv-parse";
import { CONCENTRATIONS, GENDERS } from "@/lib/enums";
import { prisma } from "@/lib/prisma";

/**
 * Bulk catalogue import (EXTRA_FEATURES §4). Deliberately two-phase: the admin
 * uploads, sees exactly what will change, and only then commits. A silent
 * one-shot import into the pricing source of truth is how catalogues get
 * quietly mangled.
 *
 * Prices are NOT importable — those come from intermediaries in the field, with
 * history and attribution. This adds and edits products only.
 */

export type ImportRowPlan = {
  line: number;
  brand: string;
  variant: string;
  sizeMl: number;
  concentration: string;
  gender: string;
  skuCode: string;
  action: "create" | "update" | "skip" | "error";
  detail: string;
};

export type ImportPlan = {
  ok: boolean;
  error?: string;
  rows: ImportRowPlan[];
  counts: { create: number; update: number; skip: number; error: number };
};

const REQUIRED = ["brand", "variant", "size_ml", "concentration"];

type Parsed = {
  line: number;
  brand: string;
  brandCode: string;
  variant: string;
  variantCode: string;
  gender: string;
  sizeMl: number;
  concentration: string;
  notes: string;
};

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

function readRows(csv: string): { rows: Parsed[]; errors: ImportRowPlan[] } | string {
  const table = parseCsv(csv);
  if (table.length < 2) return "The file needs a header row and at least one product.";

  const map = mapHeaders(table[0]);
  const missing = REQUIRED.filter((key) => !(key in map));
  if (missing.length > 0) return `Missing required column(s): ${missing.join(", ")}.`;

  const rows: Parsed[] = [];
  const errors: ImportRowPlan[] = [];

  table.slice(1).forEach((raw, index) => {
    const line = index + 2; // 1-based, plus the header
    const brand = cell(raw, map, "brand");
    const variant = cell(raw, map, "variant");
    const sizeRaw = cell(raw, map, "size_ml");
    const concentration = cell(raw, map, "concentration");
    const genderRaw = cell(raw, map, "gender").toLowerCase() || "unisex";

    const fail = (detail: string) =>
      errors.push({
        line,
        brand,
        variant,
        sizeMl: 0,
        concentration,
        gender: genderRaw,
        skuCode: "",
        action: "error",
        detail,
      });

    if (!brand) return fail("Brand is blank.");
    if (!variant) return fail("Variant is blank.");

    const sizeMl = Number(sizeRaw);
    if (!Number.isInteger(sizeMl) || sizeMl <= 0 || sizeMl > 10_000) {
      return fail(`size_ml "${sizeRaw}" is not a whole number of millilitres.`);
    }

    const matchedConc = CONCENTRATIONS.find(
      (option) => option.toLowerCase() === concentration.toLowerCase(),
    );
    if (!matchedConc) {
      return fail(
        `concentration "${concentration}" must be one of ${CONCENTRATIONS.join(", ")}.`,
      );
    }

    if (!(GENDERS as readonly string[]).includes(genderRaw)) {
      return fail(`gender "${genderRaw}" must be one of ${GENDERS.join(", ")}.`);
    }

    rows.push({
      line,
      brand,
      brandCode: cell(raw, map, "brand_code") || slugCode(brand, 4),
      variant,
      variantCode: cell(raw, map, "variant_code") || slugCode(variant),
      gender: genderRaw,
      sizeMl,
      concentration: matchedConc,
      notes: cell(raw, map, "notes"),
    });
  });

  return { rows, errors };
}

/// Dry run. Reads the file and reports what committing would do, changing nothing.
export async function planImport(csv: string): Promise<ImportPlan> {
  await requireAdmin();

  const parsed = readRows(csv);
  if (typeof parsed === "string") {
    return { ok: false, error: parsed, rows: [], counts: { create: 0, update: 0, skip: 0, error: 0 } };
  }

  const brands = await prisma.brand.findMany({ select: { id: true, name: true, code: true } });
  const byBrandName = new Map(brands.map((brand) => [brand.name.toLowerCase(), brand]));

  const existingSkus = await prisma.sku.findMany({
    select: { skuCode: true, variant: { select: { name: true, brandId: true } }, sizeMl: true, concentration: true },
  });
  const existingKeys = new Set(
    existingSkus.map(
      (sku) => `${sku.variant.brandId}|${sku.variant.name.toLowerCase()}|${sku.sizeMl}|${sku.concentration}`,
    ),
  );

  const rows: ImportRowPlan[] = [...parsed.errors];

  for (const row of parsed.rows) {
    const brand = byBrandName.get(row.brand.toLowerCase());
    const brandCode = brand?.code ?? row.brandCode;
    const skuCode = buildSkuCode(brandCode, row.variantCode, row.sizeMl, row.concentration);

    const key = brand
      ? `${brand.id}|${row.variant.toLowerCase()}|${row.sizeMl}|${row.concentration}`
      : null;

    const exists = key !== null && existingKeys.has(key);

    rows.push({
      line: row.line,
      brand: row.brand,
      variant: row.variant,
      sizeMl: row.sizeMl,
      concentration: row.concentration,
      gender: row.gender,
      skuCode,
      action: exists ? "skip" : "create",
      detail: exists
        ? "Already in the catalogue — left untouched."
        : brand
          ? "New size for an existing brand."
          : `New brand "${row.brand}" will be created.`,
    });
  }

  rows.sort((a, b) => a.line - b.line);

  return {
    ok: true,
    rows,
    counts: {
      create: rows.filter((row) => row.action === "create").length,
      update: rows.filter((row) => row.action === "update").length,
      skip: rows.filter((row) => row.action === "skip").length,
      error: rows.filter((row) => row.action === "error").length,
    },
  };
}

export type ImportResult = { ok: boolean; error?: string; created?: number; skipped?: number };

/// Commit. Rows with errors are never written; the rest are created or skipped.
export async function commitImport(csv: string): Promise<ImportResult> {
  await requireAdmin();

  const parsed = readRows(csv);
  if (typeof parsed === "string") return { ok: false, error: parsed };
  if (parsed.errors.length > 0) {
    return { ok: false, error: "Fix the rows with errors before importing." };
  }
  if (parsed.rows.length === 0) return { ok: false, error: "Nothing to import." };
  if (parsed.rows.length > 2000) {
    return { ok: false, error: "That file is too large — split it into smaller batches." };
  }

  let created = 0;
  let skipped = 0;

  for (const row of parsed.rows) {
    const brand = await prisma.brand.upsert({
      where: { name: row.brand },
      update: {},
      create: {
        name: row.brand,
        code: row.brandCode,
        // New brands land at the end of the dashboard ordering.
        sortOrder: await prisma.brand.count(),
      },
      select: { id: true, code: true },
    });

    const variant = await prisma.variant.upsert({
      where: { brandId_name: { brandId: brand.id, name: row.variant } },
      update: { ...(row.notes ? { notes: row.notes } : {}) },
      create: {
        brandId: brand.id,
        code: row.variantCode,
        name: row.variant,
        gender: row.gender,
        ...(row.notes ? { notes: row.notes } : {}),
      },
      select: { id: true, code: true },
    });

    const existing = await prisma.sku.findUnique({
      where: {
        variantId_sizeMl_concentration: {
          variantId: variant.id,
          sizeMl: row.sizeMl,
          concentration: row.concentration,
        },
      },
      select: { id: true },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.sku.create({
      data: {
        variantId: variant.id,
        skuCode: buildSkuCode(brand.code, variant.code, row.sizeMl, row.concentration),
        sizeMl: row.sizeMl,
        concentration: row.concentration,
      },
    });
    created++;
  }

  revalidatePath("/dashboard");
  revalidatePath("/admin/import");
  return { ok: true, created, skipped };
}
