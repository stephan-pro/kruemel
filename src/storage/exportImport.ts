// Data backup (F7): all data as one JSON file, and back again after checking it.

import type { CalendarDay } from "../domain/date";
import type { AppData } from "./appData";
import { type ParseResult, parseAppData } from "./validate";

/** The file content for a backup; it is the stored data itself, so it carries `schemaVersion`. */
export function exportData(data: AppData): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

/** Name of the backup file, e.g. "putzplan-2026-10-19.json". */
export function exportFileName(today: CalendarDay): string {
  return `putzplan-${today}.json`;
}

/**
 * Name of the copy the app downloads by itself before an import replaces the data, e.g.
 * "putzplan-vor-import-2026-10-19.json". Different from `exportFileName`, so it never hides
 * (or gets mistaken for) a backup the user made on purpose.
 */
export function autoBackupFileName(today: CalendarDay): string {
  return `putzplan-vor-import-${today}.json`;
}

/** Name of the file with unreadable stored data, e.g. "putzplan-rohdaten-2026-10-19.json". */
export function rawDataFileName(today: CalendarDay): string {
  return `putzplan-rohdaten-${today}.json`;
}

/**
 * The largest file taken for a backup. Browser storage holds about 5 MB, so a bigger file is not
 * one of ours; it is not even read (a wrong choice such as a video must not freeze the page).
 */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/** The reason a file of this size cannot be a backup, or `undefined` if the size is fine. */
export function importSizeError(bytes: number): string | undefined {
  return bytes > MAX_IMPORT_BYTES
    ? "Die Datei ist zu groß für eine Sicherung (höchstens 5 MB)."
    : undefined;
}

/**
 * Reads a backup file. Nothing is changed here: the caller replaces the stored data only after
 * a successful result and the user's confirmation.
 */
export function importData(text: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, errors: ["Die Datei ist kein gültiges JSON."] };
  }
  return parseAppData(parsed);
}
