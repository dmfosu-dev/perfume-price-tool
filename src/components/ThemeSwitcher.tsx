"use client";

import { useSyncExternalStore } from "react";
import { useState } from "react";
import { isThemeId, THEMES, THEME_STORAGE_KEY, type ThemeId } from "@/lib/themes";

// The stored theme is external state (localStorage + the data-theme attribute),
// so it is read through useSyncExternalStore rather than mirrored into an effect.
// That keeps the server snapshot honest during hydration and avoids a setState
// during the first commit.

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getSnapshot(): ThemeId {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemeId(stored) ? stored : "system";
}

/** Matches the pre-paint script's fallback, so hydration agrees with the DOM. */
function getServerSnapshot(): ThemeId {
  return "system";
}

function applyTheme(theme: ThemeId) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

function setTheme(theme: ThemeId) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private-mode storage failures shouldn't stop the theme from applying.
  }
  applyTheme(theme);
  for (const listener of listeners) listener();
}

export function ThemeSwitcher() {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [open, setOpen] = useState(false);
  const active = THEMES.find((option) => option.id === theme) ?? THEMES[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex w-full items-center gap-2 rounded-lg border border-line px-2.5 py-2 text-xs font-medium text-muted transition hover:bg-surface-sunken hover:text-foreground"
      >
        <Swatch option={active} />
        <span className="flex-1 text-left">Theme: {active.label}</span>
        <span aria-hidden className="text-[10px] text-muted-soft">
          {open ? "▾" : "▴"}
        </span>
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close theme menu"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="menu"
            className="absolute bottom-full left-0 z-50 mb-1.5 w-full min-w-52 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-lg"
          >
            {THEMES.map((option) => {
              const current = option.id === theme;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={current}
                  onClick={() => {
                    setTheme(option.id);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition ${
                    current
                      ? "bg-accent-soft text-accent"
                      : "text-muted hover:bg-surface-sunken hover:text-foreground"
                  }`}
                >
                  <Swatch option={option} />
                  <span className="flex-1">
                    <span className="block text-xs font-medium">{option.label}</span>
                    <span className="block text-[11px] text-muted-soft">{option.hint}</span>
                  </span>
                  {current ? (
                    <span aria-hidden className="text-xs">
                      ✓
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Swatch({ option }: { option: (typeof THEMES)[number] }) {
  const [surface, accent] = option.swatch;
  return (
    <span
      aria-hidden
      className="flex h-5 w-5 shrink-0 overflow-hidden rounded-full border border-line-strong"
    >
      <span className="h-full w-1/2" style={{ background: surface }} />
      <span className="h-full w-1/2" style={{ background: accent }} />
    </span>
  );
}
