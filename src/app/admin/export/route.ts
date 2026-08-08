import { getCurrentUser } from "@/lib/auth";
import { buildPriceListCsv } from "@/lib/export";

/**
 * CSV download. A route handler rather than a server action so the browser gets
 * a real file response with a filename, and the URL can be re-fetched.
 *
 * Guarded explicitly: route handlers are not covered by the /admin layout, so
 * the auth check has to happen here or the price list would be world-readable.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.status !== "approved" || user.role !== "admin") {
    return new Response("Not authorised", { status: 403 });
  }

  const { csv, filename } = await buildPriceListCsv();

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
