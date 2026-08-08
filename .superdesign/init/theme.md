# Theme & Design Tokens

**Tailwind CSS v4** — no `tailwind.config.ts`; tokens are declared as CSS custom
properties in `src/app/globals.css` and exposed to Tailwind via `@theme inline`.
That means utilities like `bg-surface`, `text-muted`, `border-line`, `text-accent`
resolve to the variables below. Light/dark switch via `prefers-color-scheme`.

**There is currently no theme *chooser*** — dark mode follows the OS only.

## Part 1 — Token summary

### Colour (light `:root`)
| Token | Value | Used for |
|---|---|---|
| `--background` | `#f6f7f9` | page background |
| `--surface` | `#ffffff` | cards, sidebar, inputs |
| `--surface-sunken` | `#f1f2f5` | nested panels, hover, chips |
| `--border` | `#e3e5ea` | hairlines, card borders (`border-line`) |
| `--border-strong` | `#cfd3db` | input borders, outline buttons (`border-line-strong`) |
| `--foreground` | `#15181f` | primary text |
| `--muted` | `#5c6473` | secondary text |
| `--muted-soft` | `#8b93a3` | tertiary text, placeholders |
| `--accent` | `#4f46e5` (indigo 600) | primary buttons, active nav, focus ring |
| `--accent-hover` | `#4338ca` | primary hover |
| `--accent-soft` | `#eef2ff` | active nav background, subtle accent fills |

### Colour (dark, `@media (prefers-color-scheme: dark)`)
| Token | Value |
|---|---|
| `--background` | `#0b0d12` |
| `--surface` | `#14171f` |
| `--surface-sunken` | `#0f1219` |
| `--border` | `#242833` |
| `--border-strong` | `#333949` |
| `--foreground` | `#eef0f4` |
| `--muted` | `#9aa2b2` |
| `--muted-soft` | `#6b7385` |
| `--accent` | `#818cf8` |
| `--accent-hover` | `#a5b4fc` |
| `--accent-soft` | `#1e1b4b` |

### Semantic status colours
Not tokenised — applied as raw Tailwind palette classes inside `Badge`/`Alert`:
- success / in stock → `emerald-100 / emerald-800` (dark: `emerald-950 / emerald-200`)
- warning / pending → `amber-100 / amber-800`
- danger / out of stock → `red-100 / red-800`
- info / offline-sync → `sky-100 / sky-800`
- neutral / archived → `surface-sunken / muted`

### Type
- Sans: `--font-geist-sans` (next/font `Geist`), fallback `system-ui, sans-serif`
- Mono: `--font-geist-mono` (next/font `Geist_Mono`) — used for SKU codes at `text-[11px]`
- Scale in use: `text-[10px]` (badge caps) · `text-[11px]` (SKU code) · `text-xs` (meta, labels)
  · `text-sm` (body, controls) · `text-base` (inputs — deliberately 16px so iOS does not zoom)
  · `text-xl font-semibold` (page titles) · `text-2xl` (converter figures)
- `.nums` utility → `font-variant-numeric: tabular-nums`, applied to every money/count figure

### Spacing / shape
- Radii: `rounded-lg` (0.5rem) on controls · `rounded-xl` (0.75rem) on cards · `rounded-full` on pills
- Control heights: `h-9` (small), `h-10` (default), `h-11` (touch targets), `min-h-12` (stock toggle)
- Card padding: `p-4 sm:p-5`; page padding `px-4 py-6 sm:px-6`
- Page max widths: `max-w-2xl` (account) · `max-w-3xl` (most admin) · `max-w-4xl` (products)
- Sidebar: `w-60` desktop, `w-64` mobile drawer
- Shadow: only one — `shadow-[0_1px_2px_rgba(16,24,40,0.04)]` on `Card`

### Focus
Global rule in `globals.css`: `2px solid var(--accent)` outline, `2px` offset, on any
`a, button, input, select, textarea, [tabindex]`.

---

## Part 2 — Raw source

### `src/app/globals.css`

```css
@import "tailwindcss";

/* Design tokens. One accent (indigo) against a warm-neutral surface stack, in
   the vein of Zoho Inventory and similar back-office tools: dense, calm, and
   heavy on hierarchy rather than colour. */
:root {
  --background: #f6f7f9;
  --surface: #ffffff;
  --surface-sunken: #f1f2f5;
  --border: #e3e5ea;
  --border-strong: #cfd3db;
  --foreground: #15181f;
  --muted: #5c6473;
  --muted-soft: #8b93a3;
  --accent: #4f46e5;
  --accent-hover: #4338ca;
  --accent-soft: #eef2ff;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0b0d12;
    --surface: #14171f;
    --surface-sunken: #0f1219;
    --border: #242833;
    --border-strong: #333949;
    --foreground: #eef0f4;
    --muted: #9aa2b2;
    --muted-soft: #6b7385;
    --accent: #818cf8;
    --accent-hover: #a5b4fc;
    --accent-soft: #1e1b4b;
  }
}

@theme inline {
  --color-background: var(--background);
  --color-surface: var(--surface);
  --color-surface-sunken: var(--surface-sunken);
  --color-line: var(--border);
  --color-line-strong: var(--border-strong);
  --color-foreground: var(--foreground);
  --color-muted: var(--muted);
  --color-muted-soft: var(--muted-soft);
  --color-accent: var(--accent);
  --color-accent-hover: var(--accent-hover);
  --color-accent-soft: var(--accent-soft);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-geist-sans), system-ui, sans-serif;
  -webkit-font-smoothing: antialiased;
}

/* Tabular figures everywhere money or counts appear, so columns line up. */
.nums {
  font-variant-numeric: tabular-nums;
}

/* Consistent focus ring across every interactive control. */
:where(a, button, input, select, textarea, [tabindex]):focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 0.5rem;
}

```

### `postcss.config.mjs`

```js
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;

```

### `src/app/layout.tsx` (font wiring)

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Perfume Price Tool",
  description: "Internal source-price and stock tracking for the perfume catalogue.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

```

_No `tailwind.config.*` exists — Tailwind v4 is configured entirely from CSS._
