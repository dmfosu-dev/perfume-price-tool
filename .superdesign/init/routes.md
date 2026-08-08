# Routes

Next.js App Router, file-based. Every page is dynamic (`ƒ`) because they all read
the session cookie. Two roles: `admin` and `intermediary`.

| URL | File | Layout | Access | Renders |
|---|---|---|---|---|
| `/` | `src/app/page.tsx` | root | any | Redirect only — to `/login`, `/account` or the role's landing page |
| `/login` | `src/app/login/page.tsx` | root (standalone) | public | Centred sign-in card |
| `/signup` | `src/app/signup/page.tsx` | root (standalone) | public | Request-access form + "must be approved" notice |
| `/account` | `src/app/account/page.tsx` | AppShell (approved) / standalone (blocked) | any signed-in | Change email + password; or a blocked-status explainer |
| `/dashboard` | `src/app/dashboard/page.tsx` | `dashboard/layout.tsx` → AppShell + OfflineProvider | approved | **The main screen.** Collapsible brand → fragrance → size price entry |
| `/admin` | `src/app/admin/page.tsx` | `admin/layout.tsx` | admin | Redirect to `/admin/users` |
| `/admin/catalogue` | `src/app/admin/catalogue/page.tsx` | AppShell | admin | Products CRUD: brands/fragrances/sizes, photos, local stock, priority pin |
| `/admin/planning` | `src/app/admin/planning/page.tsx` | AppShell | admin | Landed cost & margin, restock capital, volatility, competitors (tabbed) |
| `/admin/history` | `src/app/admin/history/page.tsx` | AppShell | admin | Filterable append-only price log + CSV export card |
| `/admin/conflicts` | `src/app/admin/conflicts/page.tsx` | AppShell | admin | Offline-sync clashes, two values side by side |
| `/admin/discrepancies` | `src/app/admin/discrepancies/page.tsx` | AppShell | admin | Naming/size problems reported from the field |
| `/admin/fx` | `src/app/admin/fx/page.tsx` | AppShell | admin | Currency setup, rates, XE-style converter, source config |
| `/admin/import` | `src/app/admin/import/page.tsx` | AppShell | admin | Bulk CSV import with dry-run preview |
| `/admin/users` | `src/app/admin/users/page.tsx` | AppShell | admin | Pending signups (approve/reject) + all accounts |

## Non-page routes

| URL | File | Purpose |
|---|---|---|
| `/admin/export` | `src/app/admin/export/route.ts` | CSV download of the current price list (admin-guarded) |
| `/api/keepalive` | `src/app/api/keepalive/route.ts` | Cron-hit endpoint that queries Postgres so Supabase does not pause |
| `/icons/[size]` | `src/app/icons/[size]/route.tsx` | PNG app icons (192/512) generated via `next/og` |
| `/manifest.webmanifest` | `src/app/manifest.ts` | PWA manifest |

## Key page summaries

**`/dashboard`** — the screen that matters most; used one-handed on a phone in a shop.
Sticky search + filter chips + "entering prices in <currency>" selector. Brands collapsed
by default. A single-size fragrance renders as one flat row; a multi-size one collapses
behind a "N sizes" badge. Each row: photo thumb, size · concentration, price inputs
(single / carton / bottles / min qty), live currency conversions, large in-stock /
out-of-stock toggle, "updated X ago" with a stale flag. Edits queue per brand and commit
on one Save.

**`/admin/catalogue`** — brand cards, expandable to fragrances and sizes. Inline add
forms at each level, toolbars for reorder/rename/archive/delete, per-size panel for
size+concentration, local stock and priority pin.

**`/admin/planning`** — four tabs sharing an FX stress-test slider: landed cost & margin
table, restock capital calculator, volatility ranking, competitor price log.
