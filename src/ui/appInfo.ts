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
 * zone unless one is given (tests).
 */
export function formatBuild(build: BuildInfo, timeZone?: string): string {
  const time = new Date(build.time);
  const zone = timeZone === undefined ? {} : { timeZone };
  const date = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", ...zone }).format(time);
  const clock = new Intl.DateTimeFormat("de-DE", { timeStyle: "short", ...zone }).format(time);
  return `${date}, ${clock} Uhr (${build.commit ?? "lokal gebaut"})`;
}

/** The address of the app, e.g. "https://stephan-pro.github.io/putzplan/": what the QR code holds. */
export function appAddress(
  origin: string = location.origin,
  base: string = import.meta.env.BASE_URL,
): string {
  return new URL(base, origin).href;
}
