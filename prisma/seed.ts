import "dotenv/config";
import { randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { hashPassword } from "../src/lib/password";
import { buildSkuCode, CATALOG } from "./catalog";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

/// Bootstraps the first admin. Without one, nobody can approve the first signup,
/// so the app would be unusable on a fresh database.
async function seedAdmin() {
  const existing = await prisma.user.findFirst({
    where: { role: "admin" },
    select: { email: true },
  });
  if (existing) {
    console.log(`Admin already exists: ${existing.email}`);
    return;
  }

  const email = (process.env.ADMIN_EMAIL ?? "admin@example.com").trim().toLowerCase();
  const supplied = process.env.ADMIN_PASSWORD;
  // Generating a random password beats shipping a known default that everyone
  // forgets to change.
  const password = supplied ?? randomBytes(12).toString("base64url");

  await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      role: "admin",
      status: "approved",
      approvedAt: new Date(),
    },
  });

  console.log(`Created admin account: ${email}`);
  if (!supplied) {
    console.log(`  Generated password: ${password}`);
    console.log("  Shown once only — save it now, then change it.");
  }
}

async function main() {
  await seedAdmin();

  let brands = 0;
  let variants = 0;
  let skus = 0;

  for (const [index, seedBrand] of CATALOG.entries()) {
    const brand = await prisma.brand.upsert({
      where: { code: seedBrand.code },
      update: { name: seedBrand.name, sortOrder: index },
      create: { code: seedBrand.code, name: seedBrand.name, sortOrder: index },
    });
    brands++;

    for (const seedVariant of seedBrand.variants) {
      const variant = await prisma.variant.upsert({
        where: { brandId_name: { brandId: brand.id, name: seedVariant.name } },
        update: { code: seedVariant.code, gender: seedVariant.gender },
        create: {
          brandId: brand.id,
          code: seedVariant.code,
          name: seedVariant.name,
          gender: seedVariant.gender,
        },
      });
      variants++;

      for (const seedSku of seedVariant.skus) {
        await prisma.sku.upsert({
          where: {
            variantId_sizeMl_concentration: {
              variantId: variant.id,
              sizeMl: seedSku.sizeMl,
              concentration: seedSku.concentration,
            },
          },
          update: {},
          create: {
            variantId: variant.id,
            skuCode: buildSkuCode(
              brand.code,
              seedVariant.code,
              seedSku.sizeMl,
              seedSku.concentration,
            ),
            sizeMl: seedSku.sizeMl,
            concentration: seedSku.concentration,
          },
        });
        skus++;
      }
    }
  }

  console.log(`Seeded ${brands} brands, ${variants} variants, ${skus} SKUs.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
