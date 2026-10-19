import type { ColorScheme } from "../storage/storage";

/**
 * The colour of the browser bar and the status bar of a phone: the page background (`--bg` in
 * tokens.css) of each scheme. `tokens.test.ts` keeps them equal to the tokens; index.html and the
 * manifest repeat them (`pwa.test.ts` checks that too).
 */
export const THEME_COLORS = { light: "#eef1f5", dark: "#0f1115" } as const;

/**
 * Shows the app in the chosen colour scheme (N8). "Automatisch" removes the choice, so the
 * stylesheet follows the device (`prefers-color-scheme`). The script in index.html does the same
 * before the first paint.
 */
export function applyColorScheme(
  scheme: ColorScheme,
  root: HTMLElement = document.documentElement,
) {
  if (scheme === "auto") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", scheme);
  }
  applyThemeColor(scheme, root.ownerDocument);
}

/**
 * Sets `<meta name="theme-color">`. With a chosen scheme both tags (one per `prefers-color-scheme`)
 * get its colour, so the bar matches the page even when the device prefers the other scheme;
 * "Automatisch" gives each tag its own colour back, and the browser picks by the device.
 */
export function applyThemeColor(scheme: ColorScheme, doc: Document = document) {
  for (const meta of doc.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const own = meta.dataset.scheme === "dark" ? "dark" : "light";
    meta.content = THEME_COLORS[scheme === "auto" ? own : scheme];
  }
}
