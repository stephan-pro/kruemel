// The language of the app (EN-a): which one is chosen on this device, where it is kept and how the
// page is told. One module-level value, like the colour scheme on `<html>`: the app draws again when
// it changes (`useLanguage`), and code outside the components reads it with `getLanguage()`.

import type { KeyValueStore } from "../storage/localStorage";

export type Language = "de" | "en";

/** The languages in the order the switch shows them. */
export const LANGUAGES: readonly Language[] = ["de", "en"];

/** Used when nothing was chosen and the browser asks for something else. */
export const DEFAULT_LANGUAGE: Language = "de";

/**
 * The storage key of the choice on this device (not in the account, not in the backup). The script
 * in `index.html` reads the same key before the first drawing.
 */
export const LANGUAGE_KEY = "kruemel:language";

/** The names of the languages, each in its own language; never translated. */
export const LANGUAGE_NAMES: Readonly<Record<Language, string>> = {
  de: "Deutsch",
  en: "English",
};

export function isLanguage(value: unknown): value is Language {
  return value === "de" || value === "en";
}

/**
 * The language for a browser's list of preferred languages (`navigator.languages`): the first one
 * decides. "de", "de-AT" give German, "en", "en-GB" English, everything else German.
 */
export function languageFromBrowser(preferred: readonly string[]): Language {
  const first = preferred[0]?.toLowerCase().split("-")[0];
  return first === "en" ? "en" : DEFAULT_LANGUAGE;
}

let current: Language = DEFAULT_LANGUAGE;
let keeper: KeyValueStore | undefined;
const listeners = new Set<() => void>();

export function getLanguage(): Language {
  return current;
}

/** Tells the page which language it is in (screen readers and the browser's hyphenation use it). */
function applyToPage(language: Language) {
  if (typeof document !== "undefined") {
    document.documentElement.lang = language;
  }
}

/** The choice kept on this device, if there is one and the storage can be read. */
export function storedLanguage(store: KeyValueStore): Language | undefined {
  try {
    const value = store.getItem(LANGUAGE_KEY);
    return isLanguage(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Sets the language at the start: the choice kept on this device, otherwise the browser's. Does
 * not write anything: only a deliberate choice (`setLanguage`) overrides the browser.
 */
export function initLanguage(store: KeyValueStore, preferred: readonly string[]): Language {
  keeper = store;
  current = storedLanguage(store) ?? languageFromBrowser(preferred);
  applyToPage(current);
  return current;
}

/**
 * A deliberate choice: shown at once, kept on this device. A storage that refuses (private window,
 * blocked site data) does not stop the change; it lasts until the page is closed then.
 */
export function setLanguage(language: Language) {
  current = language;
  applyToPage(language);
  try {
    keeper?.setItem(LANGUAGE_KEY, language);
  } catch {
    // Not kept; the choice still applies to this visit.
  }
  for (const listener of [...listeners]) {
    listener();
  }
}

export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** For tests: back to the state before `initLanguage`. */
export function resetLanguage() {
  current = DEFAULT_LANGUAGE;
  keeper = undefined;
  listeners.clear();
  applyToPage(current);
}
