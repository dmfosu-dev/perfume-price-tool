"use client";

import { useActionState, useState } from "react";
import {
  refreshRatesNow,
  saveCurrencySetup,
  saveFxSource,
  saveManualRates,
  type FxActionState,
} from "@/app/actions/fx";
import { SubmitButton } from "@/components/SubmitButton";
import { Alert, Field } from "@/components/ui";
import { orderCurrencies, SUPPORTED_CURRENCIES } from "@/lib/currencies";
import { FX_SOURCES } from "@/lib/enums";
import { CurrencyMultiSelect } from "./CurrencyMultiSelect";

const SOURCE_LABELS: Record<string, string> = {
  exchangerate_api: "ExchangeRate-API",
  wise: "Wise",
  manual: "Manual",
};

const SOURCE_HINTS: Record<string, string> = {
  exchangerate_api: "Primary. Falls back to Wise automatically if it fails.",
  wise: "Use Wise directly.",
  manual: "Type the rates in yourself.",
};

function Feedback({ state }: { state: FxActionState }) {
  if (state.error) return <Alert tone="error">{state.error}</Alert>;
  if (state.notice) return <Alert tone="success">{state.notice}</Alert>;
  return null;
}

export function CurrencySetupForm({
  baseCurrency,
  priceEntryCurrency,
  selectedCurrencies,
}: {
  baseCurrency: string;
  priceEntryCurrency: string;
  selectedCurrencies: string[];
}) {
  const [state, formAction] = useActionState<FxActionState, FormData>(
    saveCurrencySetup,
    {},
  );
  const [base, setBase] = useState(baseCurrency);
  const [entry, setEntry] = useState(priceEntryCurrency);
  const [selected, setSelected] = useState(selectedCurrencies);

  return (
    <form action={formAction} className="space-y-3">
      <Feedback state={state} />

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-muted">
          Default currency
        </span>
        <select
          name="baseCurrency"
          value={base}
          onChange={(event) => {
            const next = event.target.value;
            setBase(next);
            // Keep the new base in the tracked set straight away.
            setSelected((prev) => (prev.includes(next) ? prev : [...prev, next]));
          }}
          className="h-11 w-full rounded-lg border border-line bg-surface px-2.5 text-base text-foreground"
        >
          {orderCurrencies(base, selected).map((option) => (
            <option key={option.code} value={option.code}>
              {option.flag} {option.code} — {option.name}
            </option>
          ))}
        </select>
        <span className="mt-1.5 block text-xs text-muted">
          Rates are quoted from this currency, and it leads the list everywhere.
        </span>
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-muted">
          Default price-entry currency
        </span>
        <select
          name="priceEntryCurrency"
          value={entry}
          onChange={(event) => {
            const next = event.target.value;
            setEntry(next);
            setSelected((prev) => (prev.includes(next) ? prev : [...prev, next]));
          }}
          className="h-11 w-full rounded-lg border border-line bg-surface px-2.5 text-base text-foreground"
        >
          {orderCurrencies(entry, selected).map((entryOption) => (
            <option key={entryOption.code} value={entryOption.code}>
              {entryOption.flag} {entryOption.code} — {entryOption.name}
            </option>
          ))}
        </select>
        <span className="mt-1.5 block text-xs text-muted">
          What the catalogue offers by default. An intermediary can switch on the
          catalogue itself when a shop quotes in something else.
        </span>
      </label>

      <div>
        <span className="mb-1.5 block text-sm font-medium text-muted">
          Currencies to track
        </span>
        <CurrencyMultiSelect
          name="currencies"
          base={base}
          priceEntry={entry}
          selected={selected}
          onChange={setSelected}
        />
        <span className="mt-1.5 block text-xs text-muted">
          Only these are fetched and stored. Any currency listed here can be used for
          price entry.
        </span>
      </div>

      <SubmitButton pendingLabel="Saving…">Save currencies</SubmitButton>
    </form>
  );
}

export function SourceForm({
  source,
  refreshIntervalHours,
}: {
  source: string;
  refreshIntervalHours: number;
}) {
  const [state, formAction] = useActionState<FxActionState, FormData>(saveFxSource, {});
  const [chosen, setChosen] = useState(source);

  return (
    <form action={formAction} className="space-y-3">
      <Feedback state={state} />

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-muted">
          Rate source
        </legend>
        <div className="space-y-1.5">
          {FX_SOURCES.map((option) => (
            <label
              key={option}
              className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border border-line-strong px-3 has-[:checked]:border-accent has-[:checked]:bg-surface-sunken-strong"
            >
              <input
                type="radio"
                name="source"
                value={option}
                checked={chosen === option}
                onChange={() => setChosen(option)}
                className="h-4 w-4 shrink-0"
              />
              <span className="text-sm">
                <span className="font-medium text-foreground">
                  {SOURCE_LABELS[option]}
                </span>
                <span className="block text-xs text-muted">
                  {SOURCE_HINTS[option]}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        label="Refresh every (hours)"
        name="refreshIntervalHours"
        type="number"
        inputMode="numeric"
        min={1}
        max={720}
        defaultValue={refreshIntervalHours}
        hint="Guides when rates are flagged stale. Fetching only happens when you tap Fetch now, to protect the free-tier quota."
      />

      <SubmitButton pendingLabel="Saving…">Save source</SubmitButton>
    </form>
  );
}

export function ManualRatesForm({
  baseCurrency,
  targets,
  current,
}: {
  baseCurrency: string;
  targets: string[];
  current: Record<string, number>;
}) {
  const [state, formAction] = useActionState<FxActionState, FormData>(
    saveManualRates,
    {},
  );

  if (targets.length === 0) {
    return (
      <p className="text-sm text-muted">
        Select at least one currency besides {baseCurrency} first.
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <Feedback state={state} />
      <p className="text-sm text-muted">
        How much of each currency <strong>1 {baseCurrency}</strong> buys.
      </p>

      {targets.map((code) => {
        const info = SUPPORTED_CURRENCIES.find((entry) => entry.code === code);
        return (
          <Field
            key={code}
            label={`1 ${baseCurrency} to ${code}`}
            name={`rate_${code}`}
            type="text"
            inputMode="decimal"
            required
            defaultValue={current[code] ?? ""}
            placeholder="0.0000"
            hint={info?.name}
          />
        );
      })}

      <SubmitButton pendingLabel="Saving…">Save rates</SubmitButton>
    </form>
  );
}

export function RefreshForm({ source }: { source: string }) {
  const [state, formAction] = useActionState<FxActionState, FormData>(
    refreshRatesNow,
    {},
  );

  return (
    <form action={formAction} className="space-y-3">
      <Feedback state={state} />
      {source === "manual" ? (
        <p className="text-sm text-muted">
          Choose ExchangeRate-API or Wise to fetch rates automatically.
        </p>
      ) : (
        <SubmitButton variant="neutral" pendingLabel="Fetching…">
          Fetch rates now
        </SubmitButton>
      )}
    </form>
  );
}
