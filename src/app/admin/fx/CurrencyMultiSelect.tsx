"use client";

import { useMemo, useState } from "react";
import { orderCurrencies, SUPPORTED_CURRENCIES } from "@/lib/currencies";

/**
 * Dropdown with checkboxes. A native <select multiple> needs ctrl-click and is
 * unusable on a phone, so this uses a disclosure panel instead.
 *
 * Ordering follows the brief: base currency first, then the rest of the
 * selection, then everything else alphabetically.
 */
export function CurrencyMultiSelect({
  name,
  base,
  priceEntry,
  selected,
  onChange,
}: {
  name: string;
  base: string;
  priceEntry: string;
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selectedSet = useMemo(() => new Set(selected), [selected]);

  // Re-sorted only when the panel opens, so a currency does not jump to the top
  // under the finger that just ticked it.
  const [orderSnapshot, setOrderSnapshot] = useState(() =>
    orderCurrencies(base, selected),
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orderSnapshot;
    return orderSnapshot.filter(
      (entry) =>
        entry.code.toLowerCase().includes(q) || entry.name.toLowerCase().includes(q),
    );
  }, [orderSnapshot, query]);

  function toggle(code: string) {
    // The base and the default entry currency are structurally required — the
    // server re-adds them anyway, so the UI should not pretend otherwise.
    if (code === base || code === priceEntry) return;
    onChange(
      selectedSet.has(code)
        ? selected.filter((entry) => entry !== code)
        : [...selected, code],
    );
  }

  const ordered = orderCurrencies(base, selected).filter((entry) =>
    selectedSet.has(entry.code),
  );

  return (
    <div>
      {/* Submitted values. Checkboxes live outside the form flow so the panel
          can be closed without losing the selection. */}
      {selected.map((code) => (
        <input key={code} type="hidden" name={name} value={code} />
      ))}

      <button
        type="button"
        onClick={() => {
          setOrderSnapshot(orderCurrencies(base, selected));
          setOpen((value) => !value);
        }}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-2 rounded-lg border border-line bg-surface px-3 text-left text-sm text-foreground"
      >
        <span className="flex-1 truncate">
          {ordered.map((entry) => entry.code).join(", ")}
        </span>
        <span className="shrink-0 rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-medium text-muted nums">
          {selected.length}
        </span>
        <span aria-hidden className={`text-muted-soft ${open ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>

      {open ? (
        <div className="mt-1.5 rounded-lg border border-line-strong bg-surface">
          <div className="border-b border-line p-2">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search currency"
              aria-label="Search currency"
              className="h-10 w-full rounded-lg border border-line bg-surface px-2.5 text-sm text-foreground outline-none"
            />
          </div>

          <ul className="max-h-64 overflow-y-auto p-1">
            {visible.map((entry) => {
              const checked = selectedSet.has(entry.code);
              const locked = entry.code === base || entry.code === priceEntry;

              return (
                <li key={entry.code}>
                  <label
                    className={`flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 ${
                      locked
                        ? "cursor-not-allowed opacity-70"
                        : "cursor-pointer hover:bg-surface-sunken"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={locked}
                      onChange={() => toggle(entry.code)}
                      className="h-4 w-4 shrink-0"
                    />
                    <span aria-hidden className="text-base leading-none">
                      {entry.flag}
                    </span>
                    <span className="flex-1 text-sm text-foreground">
                      <span className="font-medium">{entry.code}</span>{" "}
                      <span className="text-muted">
                        {entry.name}
                      </span>
                    </span>
                    {entry.code === base ? (
                      <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase text-on-accent">
                        base
                      </span>
                    ) : entry.code === priceEntry ? (
                      <span className="shrink-0 rounded-full bg-surface-sunken px-2 py-0.5 text-[10px] font-bold uppercase text-muted">
                        entry
                      </span>
                    ) : null}
                  </label>
                </li>
              );
            })}
            {visible.length === 0 ? (
              <li className="px-2.5 py-3 text-sm text-muted">No match.</li>
            ) : null}
          </ul>

          <div className="border-t border-line p-2 text-xs text-muted">
            {SUPPORTED_CURRENCIES.length} available · only ticked currencies are fetched
            and stored
          </div>
        </div>
      ) : null}
    </div>
  );
}
