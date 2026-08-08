# Extractable components

Candidates for reusable Superdesign `DraftComponent` entities. Props listed are only
the state/navigation ones that change per page — everything else (labels, icons,
classes) is hardcoded.

## Layout components

### AppShell
- Source: `src/components/AppShell.tsx`
- Category: layout
- Description: Persistent sidebar on `lg+`, slide-over drawer below; brand mark, nav list, identity block, sign-out
- Extractable props: `items` (NavItem[] — href/label/icon/badge), `userEmail` (string), `role` (string)
- Hardcoded: brand mark "P" tile, hamburger/close glyphs, all CSS, active-state logic (`usePathname`)

### AppHeader
- Source: `src/components/AppHeader.tsx`
- Category: layout
- Description: Server wrapper that counts nav badges (pending users, open conflicts, open issues) and renders AppShell
- Extractable props: `user` ({ email, role, status })
- Hardcoded: the nav item list itself, emoji icons, badge queries

### OfflineSync
- Source: `src/components/OfflineSync.tsx`
- Category: layout
- Description: Sticky offline banner, syncing banner, and success toast above dashboard content
- Extractable props: none (drives itself from `navigator.onLine` + IndexedDB)
- Hardcoded: all copy, colours, sticky offsets

## Basic components

### Card
- Source: `src/components/ui.tsx`
- Category: basic
- Description: White surface, hairline border, 1px shadow, `rounded-xl`
- Extractable props: `padded` (boolean, default true), `className` (string)
- Hardcoded: border/shadow/radius

### PageHeader
- Source: `src/components/ui.tsx`
- Category: basic
- Description: Page title + optional description on the left, action buttons on the right
- Extractable props: `title` (string), `description` (string?), `actions` (ReactNode?)
- Hardcoded: type scale, spacing

### Field
- Source: `src/components/ui.tsx`
- Category: basic
- Description: Labelled text input with optional hint; wraps `inputClass`
- Extractable props: `label` (string), `hint` (string?), plus native input props
- Hardcoded: label/hint typography, input height and border

### Select
- Source: `src/components/ui.tsx`
- Category: basic
- Description: Labelled native select sharing `inputClass`
- Extractable props: `label` (string?), `hint` (string?)
- Hardcoded: same as Field

### Badge / StatusBadge
- Source: `src/components/ui.tsx`
- Category: basic
- Description: Rounded pill; `StatusBadge` maps a status string to a tone and prettifies underscores
- Extractable props: `tone` (string, default "neutral"), `status` (string) for StatusBadge
- Hardcoded: the tone → colour map (approved/in_stock/pending/out_of_stock/revoked/accent/neutral)

### Alert
- Source: `src/components/ui.tsx`
- Category: basic
- Description: Bordered tinted message block with optional bold title
- Extractable props: `tone` ("error" | "info" | "success" | "warning", default "error"), `title` (string?)
- Hardcoded: the four tone colour sets

### EmptyState
- Source: `src/components/ui.tsx`
- Category: basic
- Description: Dashed-border placeholder with a title and optional supporting line
- Extractable props: `title` (string)
- Hardcoded: dashed border, padding, centring

### Stat
- Source: `src/components/ui.tsx`
- Category: basic
- Description: KPI tile — uppercase label, large tabular figure, optional hint
- Extractable props: `label` (string), `value` (ReactNode), `hint` (string?)
- Hardcoded: type scale, border, padding
- **Note:** defined but currently unused — the reference dashboards make heavy use of KPI rows, so this is the natural component for that

### SubmitButton
- Source: `src/components/SubmitButton.tsx`
- Category: basic
- Description: Submit button that disables and swaps label while its form is pending
- Extractable props: `variant` ("primary" | "danger" | "neutral" | "ghost", default primary), `size` ("sm" | "md"), `pendingLabel` (string?)
- Hardcoded: variant colour map, base classes

### PhotoUpload
- Source: `src/components/PhotoUpload.tsx`
- Category: basic
- Description: Add / replace / remove a product photo; hidden file input behind text buttons
- Extractable props: `skuId` (string), `skuCode` (string), `photoUrl` (string | null)
- Hardcoded: accepted MIME types, button copy

## Page-level patterns worth extracting

### SkuRow
- Source: `src/app/dashboard/SkuRow.tsx`
- Category: basic
- Description: The catalogue's core row — thumbnail, identifiers, four price inputs, currency conversions, large stock toggle, staleness meta, verify/report links
- Extractable props: `sku` (SkuView), `entryCurrency` (string), `dirty` / `touched` (boolean), `canManagePhotos` (boolean)
- Hardcoded: layout, input sizing, stock toggle colours

### BrandSaveBar
- Source: `src/app/dashboard/BrandSaveBar.tsx`
- Category: basic
- Description: Sticky bottom bar inside an expanded brand — vendor field, "Save N changes", Discard
- Extractable props: `count` (number), `saving` (boolean), `vendors` (string[])
- Hardcoded: sticky positioning, button styling

### CurrencyConverter
- Source: `src/app/admin/fx/CurrencyConverter.tsx`
- Category: basic
- Description: XE-style From/To panels with amount, flag+code pickers and a circular swap button
- Extractable props: `rates` (Record<string, number>), `available` (string[]), `initialFrom` / `initialTo` (string)
- Hardcoded: panel layout, swap glyph, rate line format
