import { Alert, Card } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { currencyInfo } from "@/lib/currencies";
import { getFxStatus } from "@/lib/fx";
import { providerLabel } from "@/lib/fx-providers";
import { CurrencyConverter } from "./CurrencyConverter";
import {
  CurrencySetupForm,
  ManualRatesForm,
  RefreshForm,
  SourceForm,
} from "./FxForms";

export const metadata = { title: "FX rates · Perfume Price Tool" };

function formatWhen(value: Date | null): string {
  if (!value) return "never";
  return value.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function FxSettingsPage() {
  await requireAdmin();

  const { settings, rates, health, conversion } = await getFxStatus();

  const current: Record<string, number> = {};
  for (const rate of rates) current[rate.currency] = rate.rate;

  const manualTargets = settings.selectedCurrencies.filter(
    (code) => code !== settings.baseCurrency,
  );

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">
      <h1 className="text-xl font-bold tracking-tight text-foreground">
        FX rates
      </h1>
      <p className="mt-0.5 text-sm text-muted">
        Prices are entered in whichever currency a shop quotes. These rates convert
        between them.
      </p>

      <div className="mt-5 space-y-4">
        {health.stale ? (
          <Alert tone="warning" title="Rates may be out of date">
            {health.reason} The last known good rates are still being used — price entry
            is never blocked.
          </Alert>
        ) : null}

        {health.missing.length > 0 ? (
          <Alert tone="info" title="Some currencies have no rate yet">
            Nothing stored for {health.missing.join(", ")} against{" "}
            {settings.baseCurrency}. Fetch or enter rates to show them on the dashboard.
          </Alert>
        ) : null}

        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Currencies
          </h2>
          <CurrencySetupForm
            baseCurrency={settings.baseCurrency}
            priceEntryCurrency={settings.priceEntryCurrency}
            selectedCurrencies={settings.selectedCurrencies}
          />
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Current rates
          </h2>
          {rates.length === 0 ? (
            <p className="text-sm text-muted">
              No rates stored for {settings.baseCurrency} yet.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {rates.map((rate) => (
                <li key={rate.currency} className="flex flex-wrap items-baseline gap-x-2 py-2">
                  <span className="font-medium text-foreground">
                    1 {settings.baseCurrency} = {rate.rate} {rate.currency}
                  </span>
                  <span className="text-xs text-muted">
                    {currencyInfo(rate.currency).name} · {providerLabel(rate.source)} ·{" "}
                    {formatWhen(rate.fetchedAt)}
                    {rate.setBy ? ` · ${rate.setBy}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {conversion.displayOrder.length > 0 ? (
            <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
              Shown on the dashboard, in order: {conversion.displayOrder.join(" · ")}
            </p>
          ) : null}
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Convert
          </h2>
          <CurrencyConverter
            rates={conversion.rates}
            available={conversion.displayOrder}
            baseCurrency={settings.baseCurrency}
            initialFrom={settings.baseCurrency}
            initialTo={
              conversion.displayOrder.find((code) => code !== settings.baseCurrency) ??
              settings.baseCurrency
            }
          />
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Source
          </h2>
          <SourceForm
            source={settings.source}
            refreshIntervalHours={settings.refreshIntervalHours}
          />
          <div className="mt-4 border-t border-line pt-4">
            <p className="mb-2 text-xs text-muted">
              Last fetch: {formatWhen(settings.lastFetchAt)}
              {settings.lastFetchError ? " — failed" : ""}
            </p>
            <RefreshForm source={settings.source} />
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Enter rates manually
          </h2>
          <ManualRatesForm
            baseCurrency={settings.baseCurrency}
            targets={manualTargets}
            current={current}
          />
        </Card>
      </div>
    </main>
  );
}
