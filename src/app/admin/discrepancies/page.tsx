import Link from "next/link";
import { Alert, Card, chipClass, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ResolveForm } from "./ResolveForm";

export const metadata = { title: "Discrepancies · Aromatic Ghana" };

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

export default async function DiscrepanciesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const showAll = params.show === "all";

  const reports = await prisma.discrepancyReport.findMany({
    where: showAll ? {} : { status: "open" },
    orderBy: [{ status: "asc" }, { reportedAt: "desc" }],
    take: 200,
    select: {
      id: true,
      note: true,
      status: true,
      reportedAt: true,
      resolvedAt: true,
      resolutionNote: true,
      reportedBy: { select: { email: true } },
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

  const openCount = await prisma.discrepancyReport.count({ where: { status: "open" } });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
      <PageHeader
        title="Discrepancies"
        description="Naming and size problems reported against physical stock."
      />

      <div className="mb-4 flex gap-2">
        <Link
          href="/admin/discrepancies"
          aria-current={showAll ? undefined : "page"}
          className={`${chipClass(!showAll)} min-h-9 text-sm`}
        >
          Open ({openCount})
        </Link>
        <Link
          href="/admin/discrepancies?show=all"
          aria-current={showAll ? "page" : undefined}
          className={`${chipClass(showAll)} min-h-9 text-sm`}
        >
          All
        </Link>
      </div>

      <div className="space-y-3">
        {reports.length === 0 ? (
          <Alert tone="info" title={showAll ? "No reports yet" : "Nothing to review"}>
            Intermediaries raise these from the catalogue with “Report a problem”.
          </Alert>
        ) : (
          reports.map((report) => (
            <Card key={report.id}>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-medium text-foreground">
                  {report.sku.variant.brand.name} · {report.sku.variant.name}
                </span>
                <span className="text-xs text-muted">
                  {report.sku.sizeMl}ml · {report.sku.concentration}
                </span>
                {report.status !== "open" ? (
                  <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-medium text-muted">
                    {report.status}
                  </span>
                ) : null}
              </div>
              <p className="font-mono text-[11px] text-muted-soft">
                {report.sku.skuCode}
              </p>

              <p className="mt-2 rounded-lg bg-surface-sunken px-3 py-2 text-sm text-foreground">
                {report.note}
              </p>

              <p className="mt-1.5 text-xs text-muted">
                {report.reportedBy.email} · {formatWhen(report.reportedAt)}
              </p>

              {report.status === "open" ? (
                <ResolveForm reportId={report.id} />
              ) : (
                <p className="mt-2 text-xs text-muted">
                  {report.status} by {report.resolvedBy?.email ?? "—"} ·{" "}
                  {formatWhen(report.resolvedAt)}
                  {report.resolutionNote ? ` · ${report.resolutionNote}` : ""}
                </p>
              )}
            </Card>
          ))
        )}
      </div>
    </main>
  );
}
