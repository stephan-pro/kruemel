import type { ColorScheme } from "../storage/storage";

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
}
