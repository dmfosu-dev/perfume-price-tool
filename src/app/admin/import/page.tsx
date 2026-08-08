import { Alert, Card, PageHeader, SectionTitle } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { CONCENTRATIONS, GENDERS } from "@/lib/enums";
import { ImportForm } from "./ImportForm";

export const metadata = { title: "Import · Aromatic Ghana" };

export default async function ImportPage() {
  await requireAdmin();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
      <PageHeader
        title="Bulk import"
        description="Add brands, variants and sizes from a spreadsheet. You see exactly what will change before anything is saved."
      />

      <div className="space-y-4">
        <Card>
          <ImportForm />
        </Card>

        <Card>
          <div className="mb-2">
            <SectionTitle>File format</SectionTitle>
          </div>
          <p className="text-sm text-muted">
            Required columns: <code>brand</code>, <code>variant</code>,{" "}
            <code>size_ml</code>, <code>concentration</code>. Optional:{" "}
            <code>gender</code>, <code>notes</code>, <code>brand_code</code>,{" "}
            <code>variant_code</code>.
          </p>
          <ul className="mt-2 space-y-1 text-xs text-muted">
            <li>concentration must be one of {CONCENTRATIONS.join(", ")}</li>
            <li>gender must be one of {GENDERS.join(", ")} — defaults to unisex</li>
            <li>
              codes are generated when omitted; supply them to match the spec&apos;s
              abbreviations (e.g. CDNIM for Club de Nuit Intense Man)
            </li>
          </ul>

          <Alert tone="info">
            Prices are not importable. They come from intermediaries in the field so that
            every figure carries an author, a timestamp and a currency.
          </Alert>

          <a
            href="/sample-import.csv"
            download
            className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-line-strong px-4 text-sm font-semibold text-foreground hover:bg-surface-sunken"
          >
            Download sample CSV
          </a>
        </Card>
      </div>
    </main>
  );
}
