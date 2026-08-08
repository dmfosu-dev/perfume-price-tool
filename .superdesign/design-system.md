# Aromatic Ghana — Price Tool Design System

## 0. Brand

**Name:** Aromatic Ghana · **Product:** Price & Inventory Tool

**Logo:** `public/brand/aromatik-logo.png` (289×289, transparent). A tall black
serif capital **A** whose apex is replaced by a gold perfume **atomiser / spray
pump**, with a gold ribbon swash sweeping through the crossbar. Black and gold only.

**Logo usage**
- Always the real file — never a substitute letter tile or generic placeholder.
- Sidebar: 32×32 (`h-8 w-8`), `object-contain`, no background plate, no border,
  no radius. It carries its own transparent padding.
- Beside it the wordmark **"Aromatic Ghana"** — `text-sm font-semibold`,
  `--foreground`. On narrow sidebars the wordmark may hide; the mark never does.
- Login / signup: 48×48 centred above the card title.
- Never recolour, rotate, add a drop shadow, or place on a coloured tile.

**Brand gold** — `#C9A227` (highlight `#E8D48B`, shade `#8B6914`).
Sourced from the mark. It is a **brand** colour, not a UI accent: use it for the
logo, and at most a hairline or small ornament. **Never** for buttons, links,
focus rings, active nav, or status. Functional colour stays with `--accent`
and the status palette, so the interface still reads as an instrument.

---

## 1. Product context

An **internal back-office tool**, not a consumer app. A business owner in Ghana sources
perfume from wholesale markets in Saudi Arabia and the UAE through sourcing agents
("intermediaries"). The tool is the single source of truth for what each product costs
at source.

**Two roles, two very different contexts of use:**

| Role | Where they use it | What matters |
|---|---|---|
| **Intermediary** | Standing in a noisy wholesale market, one hand, on a phone, patchy signal | Speed of price entry, huge tap targets, works offline, never loses an edit |
| **Admin** (owner) | Desk, laptop, planning a purchase | Density, comparison, margin maths, audit trail |

This split is the single most important design constraint. The catalogue screen is a
**data-entry instrument**, not a dashboard. Everything else is a back-office console.

### Jobs to be done
1. *"Tell me what this bottle costs today, in the currency this shop quotes."*
2. *"Let me update 20 prices in a market with no signal and lose none of them."*
3. *"Show me what it lands at in USD after freight and duty, and what margin I get."*
4. *"Prove who changed this price and when."*

### Key screens (11)
- `/dashboard` **Catalogue** — the primary screen. Brand → fragrance → size accordion, inline price entry, batch save per brand.
- `/admin/catalogue` **Products** — CRUD for brands/fragrances/sizes, photos, local stock.
- `/admin/planning` **Planning** — landed cost & margin, restock capital, volatility, competitors (tabs).
- `/admin/history` **History** — filterable append-only price log + CSV export.
- `/admin/fx` **Currencies** — base + tracked currencies, rates, converter.
- `/admin/conflicts`, `/admin/discrepancies`, `/admin/users`, `/admin/import`, `/account`, `/login`.

---

## 2. Layout architecture

**App shell:** fixed left sidebar `w-60` on `lg+`; below that a top bar with a hamburger
opening a `w-64` slide-over drawer. Content area is a single scrolling column.

**Sidebar contents (top → bottom):** brand mark + wordmark · nav list (icon, label,
optional count badge) · flexible gap · identity block (email, role, sign-out).

**Page anatomy** — every screen follows the same rhythm:
```
PageHeader ........ title (text-xl semibold) + one-line description, primary action right
[KPI row] ......... optional: 2–4 Stat tiles
Toolbar ........... search, filter chips / segmented tabs, secondary actions
Content ........... Card-wrapped table, list, or form
[Pagination] ...... where lists can exceed one page
```

Page container: `max-w-4xl` (Products), `max-w-3xl` (most admin), `max-w-2xl` (account),
padding `px-4 py-6 sm:px-6`.

**Reference idiom:** Zoho Inventory / modern SaaS inventory consoles — white canvas,
generous whitespace, hairline borders, one accent colour used sparingly, status carried
by small tinted pills rather than heavy colour blocks. Tables are dense and quiet;
colour appears only where it means something.

---

## 3. Theming — FOUR selectable themes

The app ships a **theme switcher**. Each theme is a complete set of CSS custom properties
under a `[data-theme]` attribute on `<html>`. **Component markup never changes between
themes** — only token values.

Every theme MUST define this exact token contract:

```
--background        page canvas
--surface           cards, sidebar, inputs, table rows
--surface-sunken    nested panels, hovers, chips, table header
--border            hairlines, card borders
--border-strong     input borders, outline buttons
--foreground        primary text
--muted             secondary text
--muted-soft        tertiary text, placeholders
--accent            primary buttons, active nav, focus ring, links
--accent-hover      primary hover
--accent-soft       active-nav background, subtle accent fill
```

### Theme 1 — "Mono" (DEFAULT)
White background, black ink — and the closest match to the black-and-gold logo. The
default, because a pricing tool should feel like an instrument. Brand gold #C9A227
appears only in the logo itself.
```
--background #FFFFFF   --surface #FFFFFF        --surface-sunken #F4F4F5
--border #E4E4E7       --border-strong #D4D4D8
--foreground #0A0A0A   --muted #52525B          --muted-soft #A1A1AA
--accent #0A0A0A       --accent-hover #27272A   --accent-soft #F4F4F5
```
Accent is black — primary buttons are black with white text. Status pills supply the
only colour on screen.

### Theme 2 — "Bloom" (calm soft-tech pastels)
```
--background #FCFCFD   --surface #FFFFFF        --surface-sunken #F7F5FD
--border #EAE7F5       --border-strong #D8D3EC
--foreground #1E1B2E   --muted #5D5878          --muted-soft #9A94B4
--accent #7C6BC4       --accent-hover #6A59B0   --accent-soft #E6E6FA   (lavender)
```
Secondary/pink accent `#F8C8DC` — used ONLY for a decorative highlight or a secondary
chart series, never for primary actions. `#E6E6FA` lavender is the accent-soft fill.

### Theme 3 — "Grove" (nature organic neutrals)
```
--background #FAF9F5   --surface #FFFFFF        --surface-sunken #F5F5DC   (beige)
--border #E6E3D5       --border-strong #D2CEBB
--foreground #1C2B22   --muted #55665C          --muted-soft #8C9A91
--accent #2E8B57       --accent-hover #256F46   --accent-soft #E3F0E8     (sea-green)
```

### Theme 4 — "Neon" (high-contrast dark)
```
--background #0F172A   --surface #16203A        --surface-sunken #0B1220   (slate)
--border #24314F       --border-strong #33456B
--foreground #F1F5F9   --muted #94A3B8          --muted-soft #64748B
--accent #38BDF8       --accent-hover #7DD3FC   --accent-soft #0C2A3F     (sky-blue)
```
The only dark theme. Accent glows against the slate; keep large saturated fills rare.

### Status colours (semantic, per theme)
Status is **not** the accent. Each theme defines light/dark-appropriate tints for:
`success` (in stock, approved, synced) · `warning` (pending, stale, below minimum) ·
`danger` (out of stock, revoked, conflict) · `info` (offline sync, verification).
Pills are `rounded-full`, `text-[11px] font-medium`, tinted background + darker text.

---

## 4. Typography

- **Sans:** Geist (`--font-geist-sans`), fallback `system-ui`. **Do not introduce any
  other typeface** — no serif, no display face, no Playfair, no Inter substitution.
- **Mono:** Geist Mono — SKU codes only, `text-[11px]`, `--muted-soft`.
- Scale: `text-[10px]` badge caps · `text-[11px]` SKU/meta · `text-xs` labels ·
  `text-sm` body & controls · `text-base` **inputs** (16px, so iOS does not zoom) ·
  `text-xl font-semibold` page titles · `text-2xl` converter/KPI figures.
- Weights: 400 body, 500 labels/nav, 600 headings and figures. Never 700+.
- **`.nums` (tabular figures) on every money, count and date figure** so columns align.

---

## 5. Shape, spacing, elevation

- Radii: `rounded-lg` (8px) controls · `rounded-xl` (12px) cards · `rounded-full` pills.
- Control heights: `h-9` compact · `h-10` default · `h-11` touch · `min-h-12` the
  in-stock/out-of-stock toggle (thumb-sized on purpose).
- Card padding `p-4 sm:p-5`; section gap `space-y-4`; inline gap `gap-2`.
- **One shadow only:** `0 1px 2px rgba(16,24,40,0.04)` on cards. No layered or
  coloured shadows, no glows.
- Borders do the structural work, not shadows.

---

## 6. Components

**Buttons** — `primary` (accent fill, white text — in Mono that is black/white),
`neutral` (surface + `border-strong`), `ghost` (transparent, muted text, hover
`surface-sunken`), `danger` (red fill). One primary per page header.

**Inputs** — `h-10`, `rounded-lg`, `border-line`, `bg-surface`, `text-base`; focus
switches border to accent. Labels `text-xs font-medium text-muted` above.

**Cards** — `bg-surface`, `border-line`, `rounded-xl`, the single shadow.

**Tables / lists** — header row `bg-surface-sunken`, `text-xs uppercase tracking-wider
text-muted-soft`; rows separated by `border-line` hairlines; row hover
`bg-surface-sunken`; right-aligned numeric columns with `.nums`; a trailing `⋯` action
menu where row actions exist.

**Filter chips / segmented tabs** — `rounded-full h-9 px-3 text-sm`; selected = accent
fill + contrasting text; unselected = `border-line-strong text-muted`.

**Status pills** — see §3.

**KPI Stat tiles** — bordered `rounded-xl` tile: uppercase micro-label, `text-2xl`
tabular figure, optional delta/hint line. Used in rows of 2–4.

**Empty states** — dashed `border-line`, centred, title + one supporting line.

**Banners** (offline / syncing / synced) — full-width, sticky under the header,
`text-sm font-semibold`, tinted per status.

---

## 7. Motion

Restrained. `transition` on colour/background for hover and focus (~150ms ease-out).
Accordion open/close may animate height. **No** page transitions, parallax, entrance
animations, skeleton shimmer or spring physics. A tool used in a market must feel
instant, and a tool used for money must feel steady.

---

## 8. Non-negotiables

1. **Catalogue price entry stays thumb-first.** Large targets, numeric keypads
   (`inputmode="decimal"`), the stock toggle full-width and unmissable. Density must
   never win over reach on that screen.
2. **Intermediaries never see money maths** — no landed cost, margin, retail price or
   competitor data on any non-admin screen.
3. **Currency is always explicit.** Every figure states its currency; conversions are
   clearly secondary to the entered price.
4. **Staleness and offline state are always visible**, never hidden behind a menu.
5. **Only the fonts, colours, spacing and component styles defined above.** Do not
   introduce fonts, colours, gradients, shadows or visual styles not in this document.
