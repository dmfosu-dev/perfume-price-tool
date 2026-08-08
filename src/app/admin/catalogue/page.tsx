import Link from "next/link";
import { PhotoUpload } from "@/components/PhotoUpload";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  SectionTitle,
  Stat,
  StatRow,
} from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  AddBrandForm,
  AddSkuForm,
  AddVariantForm,
  BrandToolbar,
  SkuToolbar,
  VariantToolbar,
} from "./CatalogueForms";

export const metadata = { title: "Products · Aromatic Ghana" };

export default async function CatalogueAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const openBrandId = typeof params.brand === "string" ? params.brand : null;
  const showArchived = params.archived === "1";
  const suffix = showArchived ? "&archived=1" : "";

  // Two queries rather than a conditional select: making `variants` optional in
  // one query yields a union type that cannot be narrowed usefully.
  const brands = await prisma.brand.findMany({
    where: showArchived ? {} : { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      code: true,
      isActive: true,
      _count: { select: { variants: true } },
      // Used only to decide whether deletion is safe.
      variants: {
        select: { skus: { select: { _count: { select: { history: true } } } } },
      },
    },
  });

  const variants =
    openBrandId === null
      ? []
      : await prisma.variant.findMany({
          where: { brandId: openBrandId, ...(showArchived ? {} : { isActive: true }) },
          orderBy: { name: "asc" },
          select: {
            id: true,
            name: true,
            gender: true,
            notes: true,
            isActive: true,
            skus: {
              where: showArchived ? {} : { isActive: true },
              orderBy: [{ sizeMl: "asc" }, { concentration: "asc" }],
              select: {
                id: true,
                skuCode: true,
                sizeMl: true,
                concentration: true,
                isActive: true,
                isPriority: true,
                priorityNote: true,
                localStockQty: true,
                photoUrl: true,
                _count: { select: { history: true } },
              },
            },
          },
        });

  // Headline counts always describe the whole catalogue, including archived
  // rows, so the tiles don't move when "Show archived" is toggled.
  const [brandTotal, variantTotal, skuTotal, archivedBrands, archivedVariants, archivedSkus] =
    await Promise.all([
      prisma.brand.count(),
      prisma.variant.count(),
      prisma.sku.count(),
      prisma.brand.count({ where: { isActive: false } }),
      prisma.variant.count({ where: { isActive: false } }),
      prisma.sku.count({ where: { isActive: false } }),
    ]);
  const archivedTotal = archivedBrands + archivedVariants + archivedSkus;

  const historyFor = (brand: (typeof brands)[number]) =>
    brand.variants.reduce(
      (total, variant) =>
        total + variant.skus.reduce((sum, sku) => sum + sku._count.history, 0),
      0,
    );

  const openBrand = brands.find((brand) => brand.id === openBrandId);

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <PageHeader
        title="Products"
        description="Add, edit, archive and delete brands, fragrances and sizes. Attach photos and record local stock."
        actions={
          <Link
            href={showArchived ? "/admin/catalogue" : "/admin/catalogue?archived=1"}
            className="inline-flex h-10 items-center rounded-lg border border-line-strong bg-surface px-3 text-sm font-medium text-foreground transition hover:bg-surface-sunken"
          >
            {showArchived ? "Hide archived" : "Show archived"}
          </Link>
        }
      />

      <StatRow>
        <Stat label="Brands" value={brandTotal} />
        <Stat label="Fragrances" value={variantTotal} />
        <Stat label="Sizes" value={skuTotal} />
        <Stat
          label="Archived"
          value={archivedTotal}
          hint="brands, fragrances and sizes"
        />
      </StatRow>

      <Card className="mb-4">
        <SectionTitle>New brand</SectionTitle>
        <div className="mt-3">
          <AddBrandForm />
        </div>
      </Card>

      {brands.length === 0 ? (
        <EmptyState title="No brands yet">Add one above to get started.</EmptyState>
      ) : (
        <ul className="space-y-2.5">
          {brands.map((brand) => {
            const isOpen = brand.id === openBrandId;
            const records = historyFor(brand);

            return (
              <li key={brand.id}>
                <Card padded={false} className={brand.isActive ? "" : "opacity-70"}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4">
                    <Link
                      href={
                        isOpen
                          ? `/admin/catalogue${showArchived ? "?archived=1" : ""}`
                          : `/admin/catalogue?brand=${brand.id}${suffix}`
                      }
                      className="flex min-w-0 items-center gap-2"
                    >
                      <span aria-hidden className="text-muted-soft">
                        {isOpen ? "▾" : "▸"}
                      </span>
                      <span className="truncate font-semibold text-foreground">
                        {brand.name}
                      </span>
                      <span className="font-mono text-[11px] text-muted-soft">
                        {brand.code}
                      </span>
                    </Link>

                    <span className="nums text-xs text-muted">
                      {brand._count.variants} fragrances
                    </span>
                    {!brand.isActive ? <Badge>archived</Badge> : null}

                    <div className="ml-auto">
                      <BrandToolbar
                        brandId={brand.id}
                        name={brand.name}
                        isActive={brand.isActive}
                        canDelete={records === 0}
                      />
                    </div>
                  </div>

                  {isOpen && openBrand ? (
                    <div className="space-y-3 border-t border-line bg-surface-sunken/40 p-4">
                      <div className="rounded-lg border border-line bg-surface p-3">
                        <SectionTitle>New fragrance</SectionTitle>
                        <div className="mt-2">
                          <AddVariantForm brandId={brand.id} />
                        </div>
                      </div>

                      {variants.length === 0 ? (
                        <EmptyState title="No fragrances yet">
                          Add the first one above.
                        </EmptyState>
                      ) : (
                        variants.map((variant) => {
                          const variantRecords = variant.skus.reduce(
                            (sum, sku) => sum + sku._count.history,
                            0,
                          );
                          return (
                            <div
                              key={variant.id}
                              className="rounded-lg border border-line bg-surface p-3"
                            >
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <span className="font-medium text-foreground">
                                  {variant.name}
                                </span>
                                <Badge>{variant.gender}</Badge>
                                {!variant.isActive ? <Badge>archived</Badge> : null}
                              </div>
                              {variant.notes ? (
                                <p className="mt-1 text-xs text-muted">{variant.notes}</p>
                              ) : null}

                              <div className="mt-2">
                                <VariantToolbar
                                  variantId={variant.id}
                                  name={variant.name}
                                  gender={variant.gender}
                                  notes={variant.notes}
                                  isActive={variant.isActive}
                                  canDelete={variantRecords === 0}
                                />
                              </div>

                              <ul className="mt-3 space-y-2">
                                {variant.skus.map((sku) => (
                                  <li
                                    key={sku.id}
                                    className="rounded-lg border border-line bg-surface-sunken/60 p-3"
                                  >
                                    <div className="flex items-start gap-3">
                                      {sku.photoUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                          src={sku.photoUrl}
                                          alt=""
                                          className="h-16 w-16 shrink-0 rounded-lg border border-line object-cover"
                                        />
                                      ) : (
                                        <div
                                          aria-hidden
                                          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-line-strong text-[10px] text-muted-soft"
                                        >
                                          no photo
                                        </div>
                                      )}
                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                          <span className="nums font-medium text-foreground">
                                            {sku.sizeMl}ml · {sku.concentration}
                                          </span>
                                          {sku.isPriority ? (
                                            <Badge tone="accent">pinned</Badge>
                                          ) : null}
                                          {!sku.isActive ? <Badge>archived</Badge> : null}
                                          {sku.localStockQty !== null ? (
                                            <Badge>local {sku.localStockQty}</Badge>
                                          ) : null}
                                        </div>
                                        <p className="font-mono text-[11px] text-muted-soft">
                                          {sku.skuCode}
                                        </p>
                                        <PhotoUpload
                                          skuId={sku.id}
                                          skuCode={sku.skuCode}
                                          photoUrl={sku.photoUrl}
                                        />
                                      </div>
                                    </div>

                                    <SkuToolbar
                                      skuId={sku.id}
                                      skuCode={sku.skuCode}
                                      sizeMl={sku.sizeMl}
                                      concentration={sku.concentration}
                                      isActive={sku.isActive}
                                      isPriority={sku.isPriority}
                                      priorityNote={sku.priorityNote}
                                      localStockQty={sku.localStockQty}
                                      canDelete={sku._count.history === 0}
                                    />
                                  </li>
                                ))}
                              </ul>

                              <div className="mt-3 border-t border-line pt-3">
                                <AddSkuForm variantId={variant.id} />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
