// Prisma 7 keeps connection URLs here rather than in the schema.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations must bypass the connection pooler: pgbouncer in transaction
    // mode cannot run the DDL and advisory locks Migrate needs. DIRECT_URL is
    // Supabase's port-5432 string; the app itself uses the pooler.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
