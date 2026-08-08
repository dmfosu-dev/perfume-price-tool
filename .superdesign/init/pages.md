# Page dependency trees

Candidate `--context-file` sets per page. Every authenticated page also depends on the
shell chain, listed once here rather than repeated:

```
SHELL (implicit on every authenticated page)
- src/app/layout.tsx
- src/components/AppHeader.tsx        (server: badge counts + nav list)
  - src/components/AppShell.tsx       (client: sidebar / drawer)
  - src/components/SubmitButton.tsx
- src/app/globals.css                 (tokens)
```

---

## `/dashboard` — Catalogue (PRIMARY SCREEN)
Entry: `src/app/dashboard/page.tsx`
```
- src/app/dashboard/layout.tsx
  - src/components/AppHeader.tsx
  - src/components/OfflineSync.tsx          (offline banner + sync toast)
    - src/lib/offline-queue.ts
    - src/app/actions/prices.ts
  - src/components/ServiceWorkerRegistrar.tsx
- src/app/dashboard/PriceDashboard.tsx      (client: search, chips, currency picker, brand accordion)
  - src/app/dashboard/SkuRow.tsx            (the row: photo, price inputs, stock toggle, conversions)
    - src/components/PhotoUpload.tsx
    - src/lib/currencies.ts                 (convertAmount, formatMoney, flags)
    - src/lib/staleness.ts                  (relativeTime, isStale)
  - src/app/dashboard/BrandSaveBar.tsx      (sticky per-brand save + vendor field)
  - src/components/ui.tsx
- src/lib/catalogue.ts                      (BrandView / VariantView / SkuView shapes)
- src/lib/fx.ts                             (ConversionView)
```

## `/admin/catalogue` — Products
Entry: `src/app/admin/catalogue/page.tsx`
```
- src/app/admin/layout.tsx
- src/app/admin/catalogue/CatalogueForms.tsx   (client: all add/edit/archive/delete toolbars)
  - src/components/SubmitButton.tsx
  - src/components/ui.tsx
  - src/app/actions/catalogue.ts
- src/components/PhotoUpload.tsx
- src/components/ui.tsx                        (Badge, Card, EmptyState, PageHeader, SectionTitle)
```

## `/admin/planning` — Planning
Entry: `src/app/admin/planning/page.tsx`
```
- src/app/admin/planning/PlanningWorkbench.tsx  (client: tabs, stress slider, tables)
  - src/app/admin/planning/CompetitorPanel.tsx
  - src/lib/planning.ts                         (landedCost, marginAt, volatility)
  - src/lib/currencies.ts
- src/lib/planning-data.ts
- src/components/ui.tsx
```

## `/admin/history` — Price history + export
Entry: `src/app/admin/history/page.tsx`
```
- src/app/admin/history/HistoryFilters.tsx     (client: GET filter form)
- src/lib/history.ts
- src/lib/export.ts                            (EXPORT_CURRENCY, summary counts)
- src/lib/currencies.ts
- src/components/ui.tsx
```

## `/admin/fx` — Currencies
Entry: `src/app/admin/fx/page.tsx`
```
- src/app/admin/fx/FxForms.tsx                 (source, base + entry currency, manual rates)
  - src/app/admin/fx/CurrencyMultiSelect.tsx   (checkbox dropdown with search)
- src/app/admin/fx/CurrencyConverter.tsx       (XE-style From/To with swap)
- src/lib/fx.ts
- src/lib/currencies.ts
- src/components/ui.tsx
```

## `/admin/users` — Users
Entry: `src/app/admin/users/page.tsx`
```
- src/app/admin/users/UserActions.tsx
- src/components/ui.tsx                        (Card, StatusBadge)
```

## `/admin/conflicts` — Conflicts
Entry: `src/app/admin/conflicts/page.tsx`
```
- src/app/admin/conflicts/ConflictActions.tsx
- src/lib/currencies.ts
- src/components/ui.tsx
```

## `/admin/discrepancies` — Issues
Entry: `src/app/admin/discrepancies/page.tsx`
```
- src/app/admin/discrepancies/ResolveForm.tsx
- src/components/ui.tsx
```

## `/admin/import` — Bulk import
Entry: `src/app/admin/import/page.tsx`
```
- src/app/admin/import/ImportForm.tsx          (file picker, dry-run preview list)
- src/app/actions/import.ts
- src/components/ui.tsx
```

## `/account` — My account
Entry: `src/app/account/page.tsx`
```
- src/app/account/AccountForms.tsx             (change email, change password)
- src/components/ui.tsx
```

## `/login` and `/signup` — standalone (no shell)
```
- src/app/login/page.tsx  → src/app/login/LoginForm.tsx
- src/app/signup/page.tsx → src/app/signup/SignupForm.tsx
- both → src/components/ui.tsx, src/components/SubmitButton.tsx
```
