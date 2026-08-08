// Allowed values for the String-backed enum columns in prisma/schema.prisma.
// SQLite cannot express enums, so these are the authoritative definitions.

export const USER_ROLES = ["admin", "intermediary"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/// Spec §2 lists only pending/approved/suspended, but §3.5 requires a Reject
/// action on pending signups and a Revoke distinct from Suspend. So:
///   pending   — awaiting admin decision, cannot log in
///   approved  — full access
///   suspended — temporarily blocked, admin can reinstate
///   rejected  — signup was never accepted (terminal)
///   revoked   — approval withdrawn (terminal); kept rather than deleted so
///               their PriceHistory rows keep a valid author
export const USER_STATUSES = [
  "pending",
  "approved",
  "suspended",
  "rejected",
  "revoked",
] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const GENDERS = ["male", "female", "unisex"] as const;
export type Gender = (typeof GENDERS)[number];

export const CONCENTRATIONS = ["EDP", "EDT", "Extrait", "Parfum"] as const;
export type Concentration = (typeof CONCENTRATIONS)[number];

export const STOCK_STATUSES = ["in_stock", "out_of_stock", "unknown"] as const;
export type StockStatus = (typeof STOCK_STATUSES)[number];

export const PRICE_SOURCES = ["online", "offline_sync"] as const;
export type PriceSource = (typeof PRICE_SOURCES)[number];

/// A "verification" is a one-tap confirmation that the price is unchanged;
/// the default history view hides these so they don't drown out real edits.
export const PRICE_ENTRY_TYPES = ["price_change", "verification"] as const;
export type PriceEntryType = (typeof PRICE_ENTRY_TYPES)[number];

export const DISCREPANCY_STATUSES = ["open", "resolved", "dismissed"] as const;
export type DiscrepancyStatus = (typeof DISCREPANCY_STATUSES)[number];

export const BARCODE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "other"] as const;
export type BarcodeFormat = (typeof BARCODE_FORMATS)[number];

// Currencies are no longer a fixed enum — the admin picks a base currency and a
// set to track. See src/lib/currencies.ts.

export const FX_SOURCES = ["exchangerate_api", "wise", "manual"] as const;
export type FxSource = (typeof FX_SOURCES)[number];
