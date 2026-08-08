# Perfume Price & Inventory Tool — Build Spec

**Purpose:** An internal web dashboard where a Saudi-based intermediary updates local source prices and stock availability for a fixed perfume catalog. The owner (admin) uses it as the single source of truth for pricing decisions.

**Explicitly NOT in scope for v1:** This is separate from the existing customer-facing sales website. No customer access, no order handling, no automatic sync to the storefront.

---

## 1. Roles

| Role | Who | Can do |
|---|---|---|
| **Admin** | Business owner | Everything: approve accounts, add/remove products, set FX source, view history, export CSV, upload photos, resolve sync conflicts |
| **Intermediary** | Sourcing agent(s) in KSA | View full catalog, update prices, toggle stock status |

**Access rules:**
- Signup is email + password
- New signups land in `pending` status and **cannot log in** until an admin approves
- Admin is notified of pending signups (in-app badge/list at minimum)
- Once approved, an intermediary has **full access to all brands and products** — no per-brand restrictions
- Admin can suspend or revoke an intermediary account at any time
- Intermediaries cannot see profit margins, retail pricing, or any owner-side financial logic

---

## 2. Data Model

Three levels: **Brand → Variant → SKU**. Price lives on the SKU.

### Brand
| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| name | string | e.g. "Lattafa Perfumes" |
| sort_order | int | controls dashboard ordering |

### Variant
A distinct fragrance. Multiple SKUs hang off it when it comes in several sizes/concentrations.

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| brand_id | fk | |
| name | string | e.g. "Khamrah Qahwa", "Hawas Ice for Him" |
| gender | enum | male / female / unisex |
| notes | text (optional) | short scent description, admin-editable |
| is_active | bool | soft-hide from dashboard without deleting history |

### SKU
The priceable unit.

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| variant_id | fk | |
| sku_code | string | auto-generated, unique — see convention below |
| size_ml | int | e.g. 100 |
| concentration | enum | EDP / EDT / Extrait / Parfum |
| current_price_sar | decimal | nullable until first entry |
| stock_status | enum | in_stock / out_of_stock / unknown |
| photo_url | string, nullable | manually added later by admin |
| last_updated_at | timestamp | |
| last_updated_by | fk → user | |

**SKU code convention:** `BRAND-VARIANT-SIZE-CONC`
Examples: `LAT-KHAMRAH-QAHWA-100-EDP`, `ARM-CDNIM-150-PARFUM`, `RAS-HAWAS-ICE-100-EDP`

### PriceHistory
Append-only. Never overwritten.

| Field | Type |
|---|---|
| id | uuid |
| sku_id | fk |
| price_sar | decimal |
| stock_status | enum |
| changed_by | fk → user |
| changed_at | timestamp |
| source | enum: online / offline_sync |

### FXRate
| Field | Type | Notes |
|---|---|---|
| currency | enum | USD / GHS / AED |
| rate_from_sar | decimal | 1 SAR = X |
| source | enum | xe / wise / manual |
| fetched_at | timestamp | |
| set_by | fk → user, nullable | only for manual entries |

### User
| Field | Type |
|---|---|
| id, email, password_hash | |
| role | enum: admin / intermediary |
| status | enum: pending / approved / suspended |
| created_at, approved_at, approved_by | |

---

## 3. Screens

### 3.1 Login / Signup
- Email + password
- Signup form clearly states: *"Your account must be approved by the administrator before you can log in."*
- Attempting to log in while `pending` shows a clear pending-approval message, not a generic error

### 3.2 Price Dashboard (intermediary's main screen — **mobile-first**)

This is the screen that matters most. The intermediary uses it on a phone, often standing in a shop.

**Layout:**
- Brand sections, **collapsed by default**, tap to expand
- Inside a brand: list of variants
  - **Single-SKU variant** → renders as one flat row with the price field directly editable
  - **Multi-SKU variant** → renders as one row showing the variant name + a size count badge; tap to expand into sub-rows (one per size/concentration), each independently editable
- Each SKU row shows: thumbnail placeholder (or photo if uploaded) · size + concentration · price field (SAR) · converted values (USD/GHS/AED, read-only) · stock toggle · "updated X ago"

**Interaction requirements:**
- Tapping a price field opens a **numeric keypad** (`inputmode="decimal"`)
- Prices are entered in **SAR only**; USD/GHS/AED are display-only conversions
- Stock toggle is a large, obvious tap target — this is a frequently used action
- **Batch save:** edits within an expanded brand queue up and commit on one "Save" tap, not one save per field
- Sticky search bar at top — filters across brand, variant, and SKU code
- Filter chips: "Out of stock", "Not updated in 7+ days", "All"
- Stale prices (>14 days since update) get a subtle visual flag

### 3.3 Offline Mode
- App is installable/offline-capable (PWA or equivalent); catalog cached locally
- Edits made offline are **queued locally and never lost** — surviving app close and phone restart
- Persistent, unmissable banner while offline: *"Offline — N changes waiting to sync"*
- On reconnect: auto-sync, then a summary toast (*"12 changes synced"*)
- **Conflict handling:** if a SKU was changed by someone else while this user was offline, do **not** silently overwrite. Mark the SKU `conflicted`, keep both values, and surface it in an admin "Conflicts" queue showing both entries (value, user, timestamp) for the admin to pick the correct one. Price remains at the last confirmed value until resolved.

### 3.4 Admin — Catalog Management
- Add / edit / archive brands, variants, SKUs
- Upload or replace a photo per SKU (manual, optional, added over time — never blocks anything else)
- Reorder brands

### 3.5 Admin — Users
- Pending signups list with Approve / Reject
- Approved users list with Suspend / Revoke
- Per-user activity summary (last login, number of updates made)

### 3.6 Admin — FX Settings
- Choose rate source: **XE**, **Wise**, or **Manual**
- If XE/Wise: set refresh interval (e.g. daily), show last-fetched timestamp
- If Manual: input fields for SAR→USD, SAR→GHS, SAR→AED with the date set
- **Fallback rule:** if an automatic fetch fails, keep using the last known good rate, display it as stale with a visible warning, and never block price entry

### 3.7 Admin — History & Export
- Full price-change log, filterable by SKU, brand, user, and date range
- Simple per-SKU price trend view (optional, low priority)
- **CSV export** of the current price list — this is the manual bridge to the storefront

**CSV columns:**
`sku_code, brand, variant, size_ml, concentration, price_sar, price_usd, price_ghs, price_aed, stock_status, last_updated_at, last_updated_by`

---

## 4. Seed Catalog

Load these on first run. Sizes listed with a `/` mean that variant has multiple SKUs.

### Lattafa Perfumes
| Variant | SKUs |
|---|---|
| Eclaire | 100ml EDP |
| Yara (Original Pink) | 100ml EDP |
| Pride Vintage Radio | 100ml EDP |
| Pride Nebras | 100ml EDP |
| Pride Infini Rose | 100ml EDP |
| Maahir Legacy | 100ml EDP |
| Khamrah (Original) | 100ml EDP |
| Khamrah Qahwa | 100ml EDP |
| Asad | 100ml EDP |
| Fakhar Black (Fakhar Lattafa Men) | 100ml EDP |
| Angham | 100ml EDP |
| Qaed Al Fursan | 90ml EDP |
| Bade'e Al Oud Oud for Glory | 100ml EDP |
| Bade'e Al Oud Honor & Glory (White Bottle) | 100ml EDP |
| Al Nashama Caprice | 100ml EDP |

### Afnan & Subsidiaries
| Variant | SKUs |
|---|---|
| Afnan 9 PM (Original) | 100ml EDP |
| Afnan 9 PM Rebel | 100ml EDP |
| Afnan Supremacy Not Only Intense | 100ml Extrait · 150ml Extrait |
| Afnan Turathi Blue | 100ml EDP |
| Zimaya Sharaf Blend | 100ml EDP |

### Rasasi
| Variant | SKUs |
|---|---|
| Hawas for Him (Original) | 100ml EDP |
| Hawas Ice for Him | 100ml EDP |
| Hawas Dare for Him (Fire) | 100ml EDP |
| Hawas Black | 100ml EDP |
| La Yuqawam Pour Homme | 75ml EDP |
| Daarej pour Homme | 100ml EDP |

### Armaf
| Variant | SKUs |
|---|---|
| Club de Nuit Intense Man (EDT) | 105ml EDT · 200ml EDT |
| Club de Nuit Intense Man (Parfum) | 150ml Parfum |

### Other Middle Eastern Brands
| Brand | Variant | SKUs |
|---|---|---|
| French Avenue (Fragrance World) | Liquid Brun | 100ml Extrait · 150ml Extrait |
| Al Haramain | Amber Oud Gold Edition | 60ml EDP · 125ml EDP |
| Swiss Arabian | Shaghaf Oud (Original) | 75ml EDP |
| Swiss Arabian | Shaghaf Oud Tonka | 75ml EDP |
| Fragrance World | Essence de Blanc | 100ml EDP |
| Arabian Oud | Madawi | 90ml EDP |

> **Note:** Names and sizes should be confirmed against physical stock by the intermediary during first use. Add an admin flag/note field so he can report a naming or size discrepancy.

---

## 5. Suggested Tech Stack

Chosen for: small scale, offline support, single developer, cheap hosting, easy for Claude Code to scaffold end-to-end.

- **Framework:** Next.js (App Router) — frontend + API in one project
- **Language:** TypeScript
- **Database:** SQLite via Prisma (dev) → Postgres if it ever outgrows it. Prisma keeps the migration path easy.
- **Auth:** email/password with hashed passwords + session cookies. Keep it simple; no OAuth needed.
- **Offline:** PWA with a service worker + IndexedDB queue for pending edits
- **Styling:** Tailwind CSS, mobile-first breakpoints
- **Photos:** local `/public/uploads` initially, or an object store later
- **Hosting:** any Node-friendly host; keep DB persistence in mind if using a serverless platform

---

## 6. Build Order

1. Project scaffold + database schema + seed the catalog above
2. Auth: signup → pending → admin approval → login
3. Price dashboard, read-only (collapsible brand → variant → SKU rendering)
4. Inline price editing + stock toggle + batch save
5. FX rates: manual entry first, then XE/Wise integration
6. Price history logging + admin history view
7. CSV export
8. Offline/PWA layer + sync queue
9. Conflict detection + admin resolution queue
10. Photo upload

Ship 1–7 first. That's a fully usable tool. 8–10 are hardening and polish.

---

## 7. Explicit Non-Goals for v1

- No automatic sync to the sales website (Phase 2 — but keep the export/API shape clean so it's easy to add)
- No approval workflow on price changes — approved intermediaries update freely
- No per-brand permissions
- No order or customer data of any kind
- ~~No retail-price or margin calculation inside this tool~~ **Amended** — see §8.0. Admin-only landed-cost and margin simulation is now in scope. Intermediaries still never see margins or retail pricing (§1 access rules are unchanged).

---

## 8. Addenda — EXTRA_FEATURES.md

Items from `EXTRA_FEATURES.md`, triaged by whether they touch the database.
**The schema-affecting ones are already built** (migration `20260806150914_extra_features_schema`, applied before step 2). Everything below is the *behaviour* still to write, filed against the build step that should pick it up.

### 8.0 Scope decisions taken

- **§7 non-goal amended.** Admin-only landed-cost / margin / suggested-retail is in scope. Intermediary-facing screens must still never expose margin, landed cost, competitor data, or retail pricing.
- **Volume pricing is single-vs-carton, not open tiers.** Each SKU carries `singlePriceSar`, `cartonPriceSar`, and `cartonQty`. The mobile row shows two price inputs plus a small carton-size label. This deliberately cannot express three or more price breaks; going tiered later means a new table and a data migration.
- **`singlePriceSar` replaced `currentPriceSar`.** The per-bottle price *is* the single price, so keeping both would have been redundant. Same rename on `PriceHistory.priceSar`. **This changes the §3.7 CSV export contract** — see 8.4.

### 8.1 Schema — done, behaviour outstanding

| Feature | Schema in place | Build step to implement UI |
|---|---|---|
| Volume pricing (single/carton) | `Sku` + `PriceHistory`: `singlePriceSar`, `cartonPriceSar`, `cartonQty` | 4 (price editing) |
| Barcode (UPC/EAN) scanning | `SkuBarcode` table — several codes per SKU, since production runs and regional packaging differ | 4, camera in 8 (PWA) |
| One-tap "Verify Price" | `Sku.lastVerifiedAt/ById`; `PriceHistory.entryType` = `price_change` \| `verification` | 4 |
| Vendor / market tagging | `Vendor` table + `PriceHistory.vendorId` | 4, filtering in 6 |
| Receipt / quote capture | `PriceHistory.receiptImageUrl` | 10 (with photo upload) |
| "Bounty" / urgent flags | `Sku.isPriority`, `priorityNote`, `prioritySetAt/ById` | 3 (sort), 4 (toggle) |
| Discrepancy workflow | `DiscrepancyReport` table (author, status, resolution) — replaced the single `Sku.discrepancyNote` field | 4 (report), 6 (admin queue) |
| Local inventory sync | `Sku.localStockQty`, `localStockUpdatedAt/ById` | 6 |
| Competitor benchmarking | `CompetitorPrice` table | after 7 |
| Landed cost & margin | `CostAssumption` table (shipping, customs, fees, target margin) | after 7 |

Notes for whoever implements these:

- **`stockStatus` means source-side (KSA) availability.** `localStockQty` is our own Ghana-side inventory. Never conflate them. The "optimized shopping list" filter is `localStockQty = 0 AND stockStatus = 'in_stock'`.
- **Verifications must not clutter history.** They are real `PriceHistory` rows (so "who confirmed this, and when" survives), but the default history view filters to `entryType = 'price_change'`.
- **Vendor is an FK, not free text**, so history can be grouped per market without typos fragmenting it. Intermediaries need a pick-or-create control, not a text box.

### 8.2 Purely UI / behaviour — no schema needed

- **Capital Restock Forecaster** — transient. Select out-of-stock SKUs, enter quantities, multiply by current price, convert via active FX. Persists nothing unless we later want saved shopping lists.
- **Price Volatility Scoring** — derived entirely from the existing append-only `PriceHistory`. Add a cached score column only if it measurably slows down.
- **Bulk CSV Import** — writes to existing tables. The unique constraints on `Brand.name`, `Variant(brandId, name)`, `Sku.skuCode`, and `Sku(variantId, sizeMl, concentration)` already make idempotent re-import safe. Reuse `prisma/catalog.ts`'s `buildSkuCode` for generated codes.

### 8.3 Needs care when built

- **FX Stress Testing** — must stay ephemeral. `FxRate` is append-only and "newest row per currency wins", so writing a what-if scenario into it would silently become the live rate. If scenarios ever need saving, add an `isScenario` flag *and* exclude it from the live-rate query in the same change.

### 8.3b Step 2 (auth) — decisions that extend §2

- **Two extra user statuses.** §2 lists only `pending`/`approved`/`suspended`, but §3.5 requires a **Reject** action on pending signups and a **Revoke** distinct from Suspend. Added `rejected` (signup never accepted) and `revoked` (approval withdrawn). Both are terminal; `suspended` stays reversible. Accounts are never deleted, so their `PriceHistory` rows keep a valid author.
- **`Session` table added.** Required so Suspend/Revoke cuts off a live login immediately rather than at cookie expiry — verified. Only the SHA-256 of the cookie token is stored.
- **First admin is seeded**, not signed up, otherwise nobody could approve the first signup. Controlled by `ADMIN_EMAIL` / `ADMIN_PASSWORD`; if the password is unset the seed generates one and prints it once.
- **Admin accounts are not editable from the Users screen**, and an admin cannot change their own status — either would allow locking every admin out of user management.

### 8.3c Step 5 (FX) — prices are multi-currency

The original design assumed every price was SAR. That does not survive contact with
reality: a shop in Dubai quotes AED, one in Accra quotes GHS, and making the
intermediary convert in their head before typing is exactly the error-prone step
this tool exists to remove. So:

- **`Sku.priceCurrency` and `PriceHistory.priceCurrency`** record what each price
  was actually quoted in. `singlePriceSar`/`cartonPriceSar` became
  `singlePrice`/`cartonPrice`.
- **`PriceHistory.fxBaseCurrency` + `fxRateToBase`** snapshot the rate at entry.
  History is append-only and rates move, so this cannot be reconstructed later.
- **`FxSetting.priceEntryCurrency`** is the catalogue default; an intermediary can
  switch per session from the dashboard when they walk into a shop that quotes
  differently.
- **SAR is no longer force-included** in the tracked currencies — it is just the
  default. What *is* forced is the base currency and the default entry currency,
  since a price with no rate can never be converted.
- **Rate sources are ExchangeRate-API (primary) → Wise (automatic fallback) →
  manual.** XE was dropped. Fetching only happens on an explicit admin action, to
  protect the 1500-request monthly free tier.

### 8.3d Hosting — Supabase + Vercel

The datasource moved from SQLite to Postgres and the app is deployable. See
`DEPLOYMENT.md` for the step-by-step.

- **Two connection strings.** `DATABASE_URL` is Supabase's transaction pooler
  (6543) for the app; `DIRECT_URL` is the direct connection (5432) for
  migrations, which pgbouncer cannot serve. Mixing them up produces confusing
  runtime errors rather than a clean failure.
- **Photos go to Supabase Storage** when configured, falling back to
  `public/uploads` locally. Vercel's filesystem does not persist between
  requests, so the fallback is development-only.
- **`/api/keepalive` + a daily Vercel cron** stop the free-tier project pausing
  after 7 days idle. It runs a real query — a 200 that never touches Postgres
  would not reset the timer.
- **The Prisma client is lazily constructed.** `next build` evaluates every
  module while collecting page data; connecting there would fail a build that
  never touches the database.
- Enum-valued columns stay `String` rather than becoming Postgres enums: these
  sets (currencies, statuses) are expected to grow, and adding an enum value
  needs its own migration that cannot share a transaction.

### 8.4 Known follow-ups

- **CSV export contract — decided.** §3.7's single `price_sar` column is replaced by
  `single_price, carton_price, carton_qty, price_currency` (what was actually quoted)
  **plus `single_price_usd`** — every row converted to **USD**, which is the export
  currency for the storefront bridge. One consistent column means the storefront
  never has to know about mixed source currencies. Rows whose currency has no rate
  export a blank USD value rather than a guess. Build at step 7.
- **Conflict handling (step 9) still needs schema.** §3.3 requires a `conflicted` state holding two competing values with authors and timestamps. Not built — it is step 9's own work, but it will add fields to `Sku` and likely a `PriceConflict` table.
- **Gender values are guesses.** All 34 variants were assigned by hand at seed time; the spec never specified them. Confirm alongside the §4 naming/size check.
