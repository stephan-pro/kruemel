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

/** Name of the file with unreadable stored data, e.g. "putzplan-rohdaten-2026-10-19.json". */
export function rawDataFileName(today: CalendarDay): string {
  return `putzplan-rohdaten-${today}.json`;
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
