import Link from "next/link";
import { Alert, Card } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/currencies";
import { prisma } from "@/lib/prisma";
import { ConflictActions } from "./ConflictActions";

export const metadata = { title: "Conflicts · Perfume Price Tool" };

function formatWhen(value: Date | null): string {
  if (!value) return "—";
  return value.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function priceText(
  price: unknown,
  currency: string | null,
  cartonPrice: unknown,
  cartonQty: number | null,
  moq: number | null,
): string {
  if (price === null || price === undefined) return "no price";
  const amount = Number(String(price));
  const main =
    currency && Number.isFinite(amount) ? formatMoney(currency, amount) : String(price);

  const extras: string[] = [];
  if (cartonPrice !== null && cartonPrice !== undefined && cartonQty !== null) {
    const carton = Number(String(cartonPrice));
    extras.push(
      `carton ${currency && Number.isFinite(carton) ? formatMoney(currency, carton) : String(cartonPrice)} / ${cartonQty}`,
    );
  }
  if (moq !== null) extras.push(`min ${moq}`);

  return extras.length > 0 ? `${main} · ${extras.join(" · ")}` : main;
}

export default async function ConflictsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const showAll = params.show === "all";

  const conflicts = await prisma.priceConflict.findMany({
    where: showAll ? {} : { status: "open" },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    include: {
      incomingBy: { select: { email: true } },
      existingBy: { select: { email: true } },
      resolvedBy: { select: { email: true } },
      sku: {
        select: {
          skuCode: true,
          sizeMl: true,
          concentration: true,
          variant: { select: { name: true, brand: { select: { name: true } } } },
        },
      },
    },
  });

  const openCount = await prisma.priceConflict.count({ where: { status: "open" } });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      <h1 className="text-xl font-bold tracking-tight text-foreground">
        Conflicts
      </h1>
      <p className="mt-0.5 text-sm text-muted">
        An offline edit arrived for a product someone else had already changed. Nothing
        was overwritten — pick which price is right.
      </p>

      <div className="mt-4 flex gap-2">
        <Link
          href="/admin/conflicts"
          className={`min-h-9 rounded-full px-3 text-sm font-medium leading-9 ${
            showAll
              ? "border border-line-strong text-muted"
              : "bg-accent text-white"
          }`}
        >
          Open ({openCount})
        </Link>
        <Link
          href="/admin/conflicts?show=all"
          className={`min-h-9 rounded-full px-3 text-sm font-medium leading-9 ${
            showAll
              ? "bg-accent text-white"
              : "border border-line-strong text-muted"
          }`}
        >
          All
        </Link>
      </div>

      <div className="mt-4 space-y-3">
        {conflicts.length === 0 ? (
          <Alert tone="info" title={showAll ? "No conflicts recorded" : "Nothing to resolve"}>
            These appear only when an offline edit clashes with a change made while that
            phone was away.
          </Alert>
        ) : (
          conflicts.map((conflict) => (
            <Card key={conflict.id}>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium text-foreground">
                  {conflict.sku.variant.brand.name} · {conflict.sku.variant.name}
                </span>
                <span className="text-xs text-muted">
                  {conflict.sku.sizeMl}ml · {conflict.sku.concentration}
                </span>
                {conflict.status !== "open" ? (
                  <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-medium text-muted">
                    {conflict.status === "took_incoming" ? "used queued" : "kept current"}
                  </span>
                ) : null}
              </div>
              <p className="font-mono text-[11px] text-muted-soft">
                {conflict.sku.skuCode}
              </p>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-2.5 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                  <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">
                    In force now
                  </p>
                  <p className="mt-0.5 font-semibold text-foreground">
                    {priceText(
                      conflict.existingSinglePrice,
                      conflict.existingPriceCurrency,
                      conflict.existingCartonPrice,
                      conflict.existingCartonQty,
                      conflict.existingMinimumOrderQty,
                    )}
                  </p>
                  <p className="text-xs text-muted">
                    {conflict.existingStockStatus} · {conflict.existingBy?.email ?? "—"} ·{" "}
                    {formatWhen(conflict.existingAt)}
                  </p>
                </div>

                <div className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 dark:border-amber-900/60 dark:bg-amber-950/30">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-300">
                    Queued offline
                  </p>
                  <p className="mt-0.5 font-semibold text-foreground">
                    {priceText(
                      conflict.incomingSinglePrice,
                      conflict.incomingPriceCurrency,
                      conflict.incomingCartonPrice,
                      conflict.incomingCartonQty,
                      conflict.incomingMinimumOrderQty,
                    )}
                  </p>
                  <p className="text-xs text-muted">
                    {conflict.incomingStockStatus} · {conflict.incomingBy.email} ·{" "}
                    {formatWhen(conflict.incomingAt)}
                  </p>
                </div>
              </div>

              {conflict.status === "open" ? (
                <ConflictActions conflictId={conflict.id} />
              ) : (
                <p className="mt-2 text-xs text-muted">
                  Resolved by {conflict.resolvedBy?.email ?? "—"} ·{" "}
                  {formatWhen(conflict.resolvedAt)}
                </p>
              )}
            </Card>
          ))
        )}
      </div>
    </main>
  );
}
