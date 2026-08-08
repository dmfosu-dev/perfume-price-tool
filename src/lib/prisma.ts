import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * On Vercel every request may land in a fresh serverless instance, so the app
 * connects through Supabase's transaction pooler (port 6543) rather than opening
 * a direct Postgres connection per invocation. Migrations use DIRECT_URL
 * instead — see prisma.config.ts.
 */
function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and add your Supabase connection strings.",
    );
  }

  return new PrismaClient({
    adapter: new PrismaPg({
      connectionString: url,
      // Serverless instances are short-lived and numerous; a small ceiling per
      // instance keeps the pooler from being exhausted under concurrency.
      max: 3,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    }),
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function client(): PrismaClient {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}

/**
 * Constructed on first use rather than at import time. `next build` evaluates
 * every module while collecting page data, and connecting — or throwing on a
 * missing URL — during a build that never touches the database is both wasteful
 * and a needless deploy-time failure.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property, receiver) {
    return Reflect.get(client(), property, receiver);
  },
  has(_target, property) {
    return property in client();
  },
});
