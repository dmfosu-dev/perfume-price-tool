import { prisma } from "@/lib/prisma";

/**
 * Supabase pauses a free-tier project after ~7 days without database activity,
 * and a paused project has to be restored by hand. A scheduled hit on this
 * route runs a trivial query so the project always looks active.
 *
 * It deliberately touches the *database*, not just the web app — a Vercel
 * function returning 200 without querying Postgres would not reset the clock.
 *
 * Wired up in vercel.json. Also safe to point an external uptime monitor at.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Vercel signs its own cron invocations. When CRON_SECRET is set, anything
  // else must present it, so the endpoint cannot be used to keep a project warm
  // (or hammered) by strangers.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    const isVercelCron = request.headers.get("x-vercel-cron") !== null;
    if (!isVercelCron && auth !== `Bearer ${secret}`) {
      return Response.json({ ok: false }, { status: 401 });
    }
  }

  const startedAt = Date.now();

  try {
    // Cheapest possible round trip that still proves the connection works.
    await prisma.$queryRaw`SELECT 1`;
    const brands = await prisma.brand.count();

    return Response.json(
      { ok: true, brands, ms: Date.now() - startedAt, at: new Date().toISOString() },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Database unreachable",
        ms: Date.now() - startedAt,
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
