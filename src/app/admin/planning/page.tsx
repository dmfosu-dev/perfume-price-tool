import { Alert, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { DEFAULT_COST_INPUTS, type CostInputs } from "@/lib/planning";
import { getCostAssumption, getPlanningData } from "@/lib/planning-data";
import { prisma } from "@/lib/prisma";
import { PlanningWorkbench } from "./PlanningWorkbench";

export const metadata = { title: "Planning · Aromatic Ghana" };

export default async function PlanningPage() {
  await requireAdmin();

  const [data, saved, variantRows, competitorRows] = await Promise.all([
    getPlanningData(),
    getCostAssumption(),
    prisma.variant.findMany({
      where: { isActive: true, brand: { isActive: true } },
      orderBy: [{ brand: { sortOrder: "asc" } }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        brand: { select: { name: true } },
        // Sizes come along so a competitor price can be pinned to one: the
        // 100ml and 150ml of the same fragrance are different products.
        skus: {
          where: { isActive: true },
          orderBy: [{ sizeMl: "asc" }, { concentration: "asc" }],
          select: { id: true, sizeMl: true, concentration: true },
        },
      },
    }),
    prisma.competitorPrice.findMany({
      orderBy: { observedAt: "desc" },
      take: 25,
      select: {
        id: true,
        variantId: true,
        skuId: true,
        competitor: true,
        price: true,
        currency: true,
        notes: true,
        observedAt: true,
        variant: { select: { name: true, brand: { select: { name: true } } } },
        sku: { select: { sizeMl: true, concentration: true } },
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
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6">
      <PageHeader
        title="Planning"
        description="Admin only. Intermediaries never see landed cost, margin or retail pricing."
      />

      <div>
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
              sizes: row.skus.map((sku) => ({
                id: sku.id,
                label: `${sku.sizeMl}ml · ${sku.concentration}`,
              })),
            }))}
            recentCompetitors={competitorRows.map((row) => ({
              id: row.id,
              variantId: row.variantId,
              skuId: row.skuId,
              competitor: row.competitor,
              price: Number(String(row.price)),
              currency: row.currency,
              notes: row.notes,
              variantLabel: `${row.variant.brand.name} · ${row.variant.name}`,
              sizeLabel:
                row.sku === null
                  ? null
                  : `${row.sku.sizeMl}ml · ${row.sku.concentration}`,
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
