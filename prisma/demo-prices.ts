/**
 * DEVELOPMENT ONLY — fabricated prices for exercising the dashboard.
 *
 * These are invented numbers, not sourced from any vendor. This tool is meant to
 * be the single source of truth for pricing decisions, so never leave this data
 * in a database anyone treats as real.
 *
 *   npm run db:demo            load demo prices + FX rates
 *   npm run db:demo -- --clear remove them again
 *
 * Delete this file once real prices start arriving (step 4 onwards).
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

const DAY = 86_400_000;

/** [skuCode, singleSar, cartonSar, cartonQty, stockStatus, ageDays] */
const DEMO: [string, string | null, string | null, number | null, string, number | null][] = [
  ["LAT-KHAMRAH-QAHWA-100-EDP", "78.50", null, null, "in_stock", 2],
  ["LAT-ASAD-100-EDP", "95.00", "912.00", 12, "in_stock", 1],
  ["LAT-YARA-100-EDP", "64.00", null, null, "out_of_stock", 3],
  // 10 days: old enough for the "7+ days" chip, not yet flagged stale (14d).
  ["RAS-HAWAS-100-EDP", "120.00", null, null, "in_stock", 10],
  // 20 days: carries the stale flag.
  ["ARM-CDNIM-150-PARFUM", "310.00", null, null, "in_stock", 20],
];

const DEMO_PRIORITY = "ALH-AMBER-OUD-GOLD-125-EDP";

async function clear() {
  await prisma.sku.updateMany({
    data: {
      singlePrice: null,
      cartonPrice: null,
      priceCurrency: null,
      cartonQty: null,
      stockStatus: "unknown",
      lastUpdatedAt: null,
      lastUpdatedById: null,
      isPriority: false,
      priorityNote: null,
    },
  });
  await prisma.fxRate.deleteMany({ where: { source: "manual" } });
  console.log("Demo prices and manual FX rates cleared.");
}

async function load() {
  const admin = await prisma.user.findFirst({
    where: { role: "admin" },
    select: { id: true },
  });
  if (!admin) throw new Error("No admin user found — run `npm run db:seed` first.");

  const now = Date.now();

  for (const [skuCode, single, carton, qty, stock, ageDays] of DEMO) {
    await prisma.sku.update({
      where: { skuCode },
      data: {
        singlePrice: single,
        cartonPrice: carton,
        priceCurrency: "SAR",
        cartonQty: qty,
        stockStatus: stock,
        lastUpdatedAt: ageDays === null ? null : new Date(now - ageDays * DAY),
        lastUpdatedById: admin.id,
      },
    });
  }

  await prisma.sku.update({
    where: { skuCode: DEMO_PRIORITY },
    data: { isPriority: true, priorityNote: "Client waiting on this one" },
  });

  // Rates are quoted from the default base (USD), matching FxSetting.
  for (const [currency, rate] of [
    ["USD", "1"],
    ["SAR", "3.7500"],
    ["GHS", "11.7000"],
    ["AED", "3.6725"],
  ] as const) {
    await prisma.fxRate.create({
      data: {
        baseCurrency: "USD",
        currency,
        rate,
        source: "manual",
        setById: admin.id,
      },
    });
  }

  console.log(`Loaded ${DEMO.length} demo prices, 1 priority flag and 4 FX rates.`);
  console.log("These are FABRICATED values — clear them with: npm run db:demo -- --clear");
}

const run = process.argv.includes("--clear") ? clear : load;

run()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
