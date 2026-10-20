// Brings stored data or a backup from an older version of the app up to `SCHEMA_VERSION`, before
// `parseAppData` checks it. Pure: the input is never changed. Only the version is looked at here;
// everything else is checked afterwards, so a broken old file gets the usual messages.

import { DEFAULT_TASK_SYMBOL } from "../domain/taskSymbols";
import { SCHEMA_VERSION } from "./appData";

export type MigrationResult =
  | { readonly ok: true; readonly value: Readonly<Record<string, unknown>> }
  | { readonly ok: false; readonly errors: readonly string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Version 1 → 2 (F8): every task gets the default symbol; nothing else changes. */
function toVersion2(root: Record<string, unknown>): Record<string, unknown> {
  const tasks = Array.isArray(root.tasks)
    ? root.tasks.map((task: unknown) =>
        isRecord(task) ? { ...task, symbol: DEFAULT_TASK_SYMBOL } : task,
      )
    : root.tasks;
  return { ...root, schemaVersion: 2, tasks };
}

/** Version 2 → 3: the two new completion fields are optional and stay missing ("unknown"). */
function toVersion3(root: Record<string, unknown>): Record<string, unknown> {
  return { ...root, schemaVersion: 3 };
}

/**
 * The data in the current version. Data in the current version comes back as it is; a missing or
 * invalid version and one newer than this app are refused with a message for the user.
 */
export function migrateAppData(raw: unknown): MigrationResult {
  if (!isRecord(raw)) {
    return { ok: false, errors: ["Datei: erwartet ein Objekt"] };
  }
  const version = raw.schemaVersion;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    return {
      ok: false,
      errors: ["schemaVersion fehlt oder ist ungültig – das ist keine Krümel-Sicherung."],
    };
  }
  if (version > SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [
        `Die Datei stammt aus einer neueren Version der App (schemaVersion ${version}). Diese App kennt bis Version ${SCHEMA_VERSION}.`,
      ],
    };
  }
  // One step after the other, so a version 1 file passes through every migration.
  let value: Record<string, unknown> = raw;
  if (version === 1) {
    value = toVersion2(value);
  }
  if (version <= 2) {
    value = toVersion3(value);
  }
  return { ok: true, value };
}
