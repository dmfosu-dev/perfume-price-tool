"use client";

export function BrandSaveBar({
  count,
  saving,
  vendors,
  vendorName,
  onVendorChange,
  onSave,
  onDiscard,
  error,
}: {
  count: number;
  saving: boolean;
  vendors: string[];
  vendorName: string;
  onVendorChange: (value: string) => void;
  onSave: () => void;
  onDiscard: () => void;
  error?: string | null;
}) {
  if (count === 0) return null;

  return (
    <div className="sticky bottom-0 z-[4] border-t border-line bg-surface/95 p-3 backdrop-blur">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted">
          Where did you find these prices? (optional)
        </span>
        <input
          type="text"
          list="vendor-options"
          value={vendorName}
          onChange={(event) => onVendorChange(event.target.value)}
          placeholder="Market or shop name"
          className="h-11 w-full rounded-lg border border-line-strong bg-surface px-2.5 text-base text-foreground outline-none focus:border-accent"
        />
      </label>
      <datalist id="vendor-options">
        {vendors.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      {error ? (
        <p role="alert" className="mt-2 text-xs font-medium text-danger-fg">
          {error}
        </p>
      ) : null}

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="min-h-12 flex-1 rounded-lg bg-accent text-sm font-bold text-on-accent disabled:opacity-60"
        >
          {saving ? "Saving…" : `Save ${count} ${count === 1 ? "change" : "changes"}`}
        </button>
        <button
          type="button"
          onClick={onDiscard}
          disabled={saving}
          className="min-h-12 rounded-lg border border-line-strong px-4 text-sm font-semibold text-muted disabled:opacity-60 "
        >
          Discard
        </button>
      </div>
    </div>
  );
}
