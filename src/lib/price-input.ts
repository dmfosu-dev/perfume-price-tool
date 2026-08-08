// Parsing/validation shared by the client form and the server action, so both
// agree on what counts as a valid price. No Node built-ins — this reaches the
// browser bundle.

export const MAX_PRICE_SAR = 1_000_000;
export const MAX_CARTON_QTY = 10_000;

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

/// Accepts "", "78", "78.5", "78.50", and Arabic-Indic digits (٠-٩) which a
/// phone keypad set to Arabic will produce. Returns null for a cleared field.
export function parsePrice(raw: string, label: string): ParseResult<string | null> {
  const normalised = raw
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\s,]/g, "")
    .replace(/٫/, ".") // Arabic decimal separator
    .trim();

  if (normalised === "") return { ok: true, value: null };

  if (!/^\d+(\.\d{1,2})?$/.test(normalised)) {
    return { ok: false, error: `${label} must be a number with at most 2 decimals.` };
  }

  const value = Number(normalised);
  if (!Number.isFinite(value)) return { ok: false, error: `${label} is not a number.` };
  if (value < 0) return { ok: false, error: `${label} cannot be negative.` };
  if (value > MAX_PRICE_SAR) {
    return { ok: false, error: `${label} looks too large.` };
  }

  return { ok: true, value: value.toFixed(2) };
}

export function parseQty(raw: string, label: string): ParseResult<number | null> {
  const normalised = raw
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\s,]/g, "")
    .trim();

  if (normalised === "") return { ok: true, value: null };
  if (!/^\d+$/.test(normalised)) {
    return { ok: false, error: `${label} must be a whole number.` };
  }

  const value = Number(normalised);
  if (value < 1) return { ok: false, error: `${label} must be at least 1.` };
  if (value > MAX_CARTON_QTY) return { ok: false, error: `${label} looks too large.` };

  return { ok: true, value };
}

/// A carton price is meaningless without knowing how many bottles it covers,
/// and vice versa — so they must be supplied together or not at all.
export function validateCartonPair(
  cartonPriceSar: string | null,
  cartonQty: number | null,
): string | null {
  if (cartonPriceSar !== null && cartonQty === null) {
    return "Enter how many bottles the carton price covers.";
  }
  if (cartonQty !== null && cartonPriceSar === null) {
    return "Enter the carton price, or clear the carton quantity.";
  }
  return null;
}
