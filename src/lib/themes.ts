// Theme registry. Shared by the switcher and the pre-paint script, so the list
// of valid values exists in exactly one place.

export const THEME_STORAGE_KEY = "ppt-theme";

export type ThemeId = "system" | "mono" | "bloom" | "grove" | "neon";

export type ThemeOption = {
  id: ThemeId;
  label: string;
  hint: string;
  /// Two swatch colours shown in the picker: [surface, accent].
  swatch: [string, string];
};

export const THEMES: ThemeOption[] = [
  { id: "mono", label: "Mono", hint: "White & black", swatch: ["#ffffff", "#0a0a0a"] },
  { id: "bloom", label: "Bloom", hint: "Soft pastels", swatch: ["#f7f5fd", "#7c6bc4"] },
  { id: "grove", label: "Grove", hint: "Organic neutrals", swatch: ["#f5f5dc", "#2e8b57"] },
  { id: "neon", label: "Neon", hint: "Dark & sky blue", swatch: ["#0f172a", "#38bdf8"] },
  { id: "system", label: "System", hint: "Follow device", swatch: ["#ffffff", "#0f172a"] },
];

export function isThemeId(value: unknown): value is ThemeId {
  return (
    typeof value === "string" &&
    (value === "system" || THEMES.some((theme) => theme.id === value))
  );
}

/**
 * Runs before first paint, inlined into <head>. Reads the stored choice and
 * stamps data-theme on <html> so the correct palette is present in the very
 * first frame — without this the default theme flashes on every load.
 * "system" deliberately removes the attribute so the media query takes over.
 */
export const THEME_INIT_SCRIPT = `(function(){try{
var k=${JSON.stringify(THEME_STORAGE_KEY)};
var v=localStorage.getItem(k);
if(v&&v!=="system"){document.documentElement.setAttribute("data-theme",v);}
else{document.documentElement.removeAttribute("data-theme");}
}catch(e){}})();`;
