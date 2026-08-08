"use client";

import { useState, useTransition } from "react";
import { commitImport, planImport, type ImportPlan } from "@/app/actions/import";
import { Alert } from "@/components/ui";

export function ImportForm() {
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function reset() {
    setCsv(null);
    setFileName(null);
    setPlan(null);
    setResult(null);
    setError(null);
  }

  async function onFile(file: File | undefined) {
    reset();
    if (!file) return;
    if (file.size > 2_000_000) {
      setError("That file is over 2 MB. Split it into smaller batches.");
      return;
    }

    const text = await file.text();
    setCsv(text);
    setFileName(file.name);

    startTransition(async () => {
      const next = await planImport(text);
      if (!next.ok) setError(next.error ?? "Could not read that file.");
      setPlan(next.ok ? next : null);
    });
  }

  function commit() {
    if (!csv) return;
    setError(null);
    startTransition(async () => {
      const outcome = await commitImport(csv);
      if (!outcome.ok) {
        setError(outcome.error ?? "Import failed.");
        return;
      }
      setResult(
        `Imported ${outcome.created} new ${outcome.created === 1 ? "product" : "products"}` +
          (outcome.skipped ? `, skipped ${outcome.skipped} already present.` : "."),
      );
      setPlan(null);
      setCsv(null);
    });
  }

  const badge: Record<string, string> = {
    create: "bg-success-bg text-success-fg",
    skip: "bg-surface-sunken text-muted",
    error: "bg-danger-bg text-danger-fg",
    update: "bg-info-bg text-info-fg",
  };

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-muted">
          Choose a CSV
        </span>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => void onFile(event.target.files?.[0])}
          className="block w-full text-sm text-muted file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-accent file:px-4 file:text-sm file:font-semibold file:text-on-accent"
        />
      </label>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {result ? <Alert tone="success">{result}</Alert> : null}

      {pending ? (
        <p className="text-sm text-muted">Reading {fileName}…</p>
      ) : null}

      {plan ? (
        <div className="space-y-3">
          <Alert tone={plan.counts.error > 0 ? "warning" : "info"} title="Nothing saved yet">
            {plan.counts.create} to add · {plan.counts.skip} already present ·{" "}
            {plan.counts.error} with problems. Review below, then confirm.
          </Alert>

          <div className="max-h-80 overflow-y-auto rounded-xl border border-line">
            <ul className="divide-y divide-line">
              {plan.rows.map((row) => (
                <li key={`${row.line}-${row.skuCode}`} className="px-3 py-2">
                  <div className="flex items-start gap-2">
                    <span
                      className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${badge[row.action]}`}
                    >
                      {row.action}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {row.brand || "—"} · {row.variant || "—"}
                        {row.sizeMl > 0 ? ` · ${row.sizeMl}ml ${row.concentration}` : ""}
                      </p>
                      <p className="text-xs text-muted">
                        line {row.line}
                        {row.skuCode ? ` · ${row.skuCode}` : ""} · {row.detail}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={commit}
              disabled={pending || plan.counts.error > 0 || plan.counts.create === 0}
              className="min-h-11 flex-1 rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent disabled:opacity-50"
            >
              {plan.counts.error > 0
                ? "Fix the errors first"
                : plan.counts.create === 0
                  ? "Nothing new to add"
                  : `Import ${plan.counts.create}`}
            </button>
            <button
              type="button"
              onClick={reset}
              className="min-h-11 rounded-lg border border-line-strong px-4 text-sm font-medium text-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
