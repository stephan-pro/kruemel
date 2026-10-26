import { DICTIONARIES } from "../i18n";
import { LOCALES } from "../i18n/intl";
import { getLanguage, type Language } from "../i18n/language";

/** When and from which commit a build was made (`__APP_BUILD__`, see vite.config.ts). */
export interface BuildInfo {
  /** ISO time of the build. */
  readonly time: string;
  /** Short commit hash; `null` for a build on a developer's computer. */
  readonly commit: string | null;
}

export const APP_BUILD: BuildInfo = __APP_BUILD__;

/**
 * "20.10.2026, 14:32 Uhr (a1b2c3d)": what "Einstellungen → Version" shows, in the device's time
 * zone unless one is given (tests), in the language set (or the given one).
 */
export function formatBuild(
  build: BuildInfo,
  timeZone?: string,
  language: Language = getLanguage(),
): string {
  const time = new Date(build.time);
  const zone = timeZone === undefined ? {} : { timeZone };
  const locale = LOCALES[language];
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium", ...zone }).format(time);
  const clock = new Intl.DateTimeFormat(locale, { timeStyle: "short", ...zone }).format(time);
  const { version } = DICTIONARIES[language];
  return version.builtAt(date, clock, build.commit ?? version.builtLocally);
}

/** The address of the app, e.g. "https://stephan-pro.github.io/kruemel/": what the QR code holds. */
export function appAddress(
  origin: string = location.origin,
  base: string = import.meta.env.BASE_URL,
): string {
  return new URL(base, origin).href;
}
