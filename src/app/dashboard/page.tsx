import { Alert } from "@/components/ui";
import { requireApprovedUser } from "@/lib/auth";
import { getCatalogueSnapshot } from "@/lib/catalogue";
import { getFxStatus } from "@/lib/fx";
import { PriceDashboard } from "./PriceDashboard";

export const metadata = { title: "Catalogue · Aromatic Ghana" };

export default async function DashboardPage() {
  const user = await requireApprovedUser();

  const { brands, vendors, nowMs } = await getCatalogueSnapshot();
  const { health: fxHealth, conversion } = await getFxStatus();

  const hasFx = conversion.displayOrder.length > 0;
  const pricedCount = brands.reduce(
    (total, brand) =>
      total +
      brand.variants.reduce(
        (subtotal, variant) =>
          subtotal + variant.skus.filter((sku) => sku.singlePrice !== null).length,
        0,
      ),
    0,
  );

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-16 sm:px-6">
      <div className="py-4">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Catalogue</h1>
        <p className="mt-1 text-sm text-muted">
          Open a brand, price its sizes, then Save that brand. Tap the arrow on a row for
          carton pricing and stock.
        </p>
      </div>

      <PriceDashboard
        brands={brands}
        fx={conversion}
        vendors={vendors}
        nowMs={nowMs}
        canManagePhotos={user.role === "admin"}
      />

      <div className="mt-6 space-y-3">
        {/* §3.6: a stale rate is flagged, never allowed to block price entry. */}
        {hasFx && fxHealth.stale ? (
          <Alert tone="warning" title="Converted values may be out of date">
            {fxHealth.reason} Entered prices are unaffected — keep going as normal.
          </Alert>
        ) : null}
        {pricedCount === 0 ? (
          <Alert tone="info" title="No prices entered yet">
            Open a brand, type prices in the currency the shop quotes, set stock, then tap Save.
          </Alert>
        ) : null}
        {!hasFx ? (
          <Alert tone="info" title="Currency conversions are off">
            USD, GHS and AED figures appear next to each price once FX rates are set in
            step 5.
          </Alert>
        ) : null}
      </div>
    </main>
  );
}
