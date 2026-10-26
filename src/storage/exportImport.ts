// Data backup (F7): all data as one JSON file, and back again after checking it.

import type { CalendarDay } from "../domain/date";
import { t } from "../i18n";
import type { AppData } from "./appData";
import { type ParseResult, parseAppData } from "./validate";

/** The file content for a backup; it is the stored data itself, so it carries `schemaVersion`. */
export function exportData(data: AppData): string {
  return `${JSON.stringify(data, null, 2)}\n`;
}

/** Name of the backup file, e.g. "kruemel-2026-10-19.json" (files "putzplan-….json" still import). */
export function exportFileName(today: CalendarDay): string {
  return `kruemel-${today}.json`;
}

/**
 * Name of the copy the app downloads by itself before an import replaces the data, e.g.
 * "kruemel-vor-import-2026-10-19.json". Different from `exportFileName`, so it never hides
 * (or gets mistaken for) a backup the user made on purpose.
 */
export function autoBackupFileName(today: CalendarDay): string {
  return `kruemel-vor-import-${today}.json`;
}

/**
 * Name of the copy the app downloads by itself when someone signs out while changes still wait
 * for the server (stage 2), e.g. "kruemel-vor-abmelden-2026-10-19.json".
 */
export function signOutBackupFileName(today: CalendarDay): string {
  return `kruemel-vor-abmelden-${today}.json`;
}

/**
 * Name of the copy the app downloads by itself before leaving the household or deleting the
 * account, when the household goes with it or changes still wait (E2-5a), and after being removed
 * with changes waiting, e.g. "kruemel-vor-austritt-2026-10-19.json".
 */
export function leaveBackupFileName(today: CalendarDay): string {
  return `kruemel-vor-austritt-${today}.json`;
}

/**
 * Name of the file with changes the server refused for good (stage 2, E2-3c), e.g.
 * "kruemel-nicht-gespeichert-2026-10-19.json".
 */
export function rejectedFileName(today: CalendarDay): string {
  return `kruemel-nicht-gespeichert-${today}.json`;
}

/** Name of the file with unreadable stored data, e.g. "kruemel-rohdaten-2026-10-19.json". */
export function rawDataFileName(today: CalendarDay): string {
  return `kruemel-rohdaten-${today}.json`;
}

/**
 * The largest file taken for a backup. Browser storage holds about 5 MB, so a bigger file is not
 * one of ours; it is not even read (a wrong choice such as a video must not freeze the page).
 */
export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

/** Whether a file of this size is too big to be a backup (the page says so in its own words). */
export function importTooBig(bytes: number): boolean {
  return bytes > MAX_IMPORT_BYTES;
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
    return { ok: false, errors: [t().validation.notBackup] };
  }
  return parseAppData(parsed);
}
