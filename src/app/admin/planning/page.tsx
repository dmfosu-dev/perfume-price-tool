import { Alert } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { DEFAULT_COST_INPUTS, type CostInputs } from "@/lib/planning";
import { getCostAssumption, getPlanningData } from "@/lib/planning-data";
import { prisma } from "@/lib/prisma";
import { PlanningWorkbench } from "./PlanningWorkbench";

export const metadata = { title: "Planning · Perfume Price Tool" };

export default async function PlanningPage() {
  await requireAdmin();

  const [data, saved, variantRows, competitorRows] = await Promise.all([
    getPlanningData(),
    getCostAssumption(),
    prisma.variant.findMany({
      where: { isActive: true, brand: { isActive: true } },
      orderBy: [{ brand: { sortOrder: "asc" } }, { name: "asc" }],
      select: { id: true, name: true, brand: { select: { name: true } } },
    }),
    prisma.competitorPrice.findMany({
      orderBy: { observedAt: "desc" },
      take: 25,
      select: {
        id: true,
        competitor: true,
        price: true,
        currency: true,
        observedAt: true,
        variant: { select: { name: true, brand: { select: { name: true } } } },
      },
    }),
  ]);

  const initialCosts: CostInputs = {
    shippingPerUnit: saved?.shippingPerUnitSar
      ? Number(String(saved.shippingPerUnitSar))
      : DEFAULT_COST_INPUTS.shippingPerUnit,
    customsRatePct: saved?.customsRatePct
      ? Number(String(saved.customsRatePct))
      : DEFAULT_COST_INPUTS.customsRatePct,
    otherFeesPerUnit: saved?.otherFeesSar
      ? Number(String(saved.otherFeesSar))
      : DEFAULT_COST_INPUTS.otherFeesPerUnit,
    targetMarginPct: saved?.targetMarginPct
      ? Number(String(saved.targetMarginPct))
      : DEFAULT_COST_INPUTS.targetMarginPct,
  };

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      <h1 className="text-xl font-bold tracking-tight text-foreground">
        Planning
      </h1>
      <p className="mt-0.5 text-sm text-muted">
        Admin only. Intermediaries never see landed cost, margin or retail pricing.
      </p>

      <div className="mt-4">
        {data.currencies.length === 0 ? (
          <Alert tone="warning" title="No FX rates yet">
            Costs are converted into {data.baseCurrency} before modelling. Fetch or enter
            rates on the FX page first.
          </Alert>
        ) : (
          <PlanningWorkbench
            data={data}
            initialCosts={initialCosts}
            variantOptions={variantRows.map((row) => ({
              id: row.id,
              label: `${row.brand.name} · ${row.name}`,
            }))}
            recentCompetitors={competitorRows.map((row) => ({
              id: row.id,
              competitor: row.competitor,
              price: Number(String(row.price)),
              currency: row.currency,
              variantLabel: `${row.variant.brand.name} · ${row.variant.name}`,
              observedAt: row.observedAt.toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              }),
            }))}
          />
        )}
      </div>
    </main>
  );
}
