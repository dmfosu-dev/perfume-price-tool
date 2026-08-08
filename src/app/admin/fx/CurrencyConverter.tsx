"use client";

import { useMemo, useState } from "react";
import {
  convertAmount,
  currencyInfo,
  decimalsFor,
  orderCurrencies,
} from "@/lib/currencies";

/**
 * From/To converter in the style of XE: type an amount, pick both currencies,
 * swap with one tap. Uses the rates already stored — no extra API calls, which
 * matters on a 1500-request monthly quota.
 */
export function CurrencyConverter({
  rates,
  available,
  baseCurrency,
  initialFrom,
  initialTo,
}: {
  rates: Record<string, number>;
  available: string[];
  baseCurrency: string;
  initialFrom: string;
  initialTo: string;
}) {
  const [amount, setAmount] = useState("1");
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  const options = useMemo(
    () => orderCurrencies(baseCurrency, available).filter((entry) => available.includes(entry.code)),
    [baseCurrency, available],
  );

  const parsed = Number(amount.replace(/[\s,]/g, ""));
  const valid = amount.trim() !== "" && Number.isFinite(parsed) && parsed >= 0;
  const converted = valid ? convertAmount(parsed, from, to, rates) : null;

  const unitRate = convertAmount(1, from, to, rates);

  function swap() {
    setFrom(to);
    setTo(from);
  }

  if (options.length < 2) {
    return (
      <p className="text-sm text-muted">
        At least two currencies need rates before conversions can be shown.
      </p>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <Panel label="From">
          <input
            type="text"
            inputMode="decimal"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            aria-label="Amount to convert"
            className="w-full min-w-0 flex-1 bg-transparent text-2xl font-semibold nums text-foreground outline-none"
          />
          <CurrencyPicker
            value={from}
            onChange={setFrom}
            options={options}
            label="Convert from"
          />
        </Panel>

        <div className="flex items-center justify-center sm:px-1">
          <button
            type="button"
            onClick={swap}
            aria-label="Swap currencies"
            title="Swap currencies"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line-strong bg-surface text-muted transition hover:bg-surface-sunken"
          >
            ⇄
          </button>
        </div>

        <Panel label="To">
          <output
            className="w-full min-w-0 flex-1 truncate text-2xl font-semibold nums text-foreground"
            aria-live="polite"
          >
            {converted === null
              ? "—"
              : `${currencyInfo(to).symbol}${converted.toFixed(decimalsFor(to))}`}
          </output>
          <CurrencyPicker value={to} onChange={setTo} options={options} label="Convert to" />
        </Panel>
      </div>

      <p className="mt-2 text-xs text-muted">
        {unitRate === null ? (
          "No rate available for that pair yet."
        ) : (
          <>
            1 {from} = {unitRate.toFixed(6).replace(/0+$/, "").replace(/\.$/, "")} {to}
          </>
        )}
      </p>
    </div>
  );
}

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex-1 rounded-xl border border-line bg-surface px-3 py-2">
      <span className="block text-xs font-medium text-muted">
        {label}
      </span>
      <div className="mt-0.5 flex items-center gap-2">{children}</div>
    </div>
  );
}

function CurrencyPicker({
  value,
  onChange,
  options,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  options: { code: string; name: string; flag: string }[];
  label: string;
}) {
  return (
    <span className="relative flex shrink-0 items-center gap-1.5 rounded-lg px-1.5 py-1 text-sm font-medium text-muted">
      <span aria-hidden className="text-base leading-none">
        {currencyInfo(value).flag}
      </span>
      <span className="nums">{value}</span>
      <span aria-hidden className="text-muted-soft">
        ▾
      </span>
      {/* Native select overlaid for a real mobile picker, styled chip beneath. */}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {options.map((entry) => (
          <option key={entry.code} value={entry.code}>
            {entry.code} — {entry.name}
          </option>
        ))}
      </select>
    </span>
  );
}
