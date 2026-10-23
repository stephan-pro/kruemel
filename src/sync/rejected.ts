// The file "Als Datei herunterladen" for changes the server refused for good (E2-3c). It is not a
// backup and cannot be imported: it keeps the refused changes readable, so nothing is lost without
// a trace and a later repair can see what was meant.

import { SCHEMA_VERSION } from "../storage/appData";
import type { RejectedChange } from "./outbox";

/** The file content: the refused changes as they were, with when and why. */
export function exportRejected(rejected: readonly RejectedChange[], exportedAt: Date): string {
  const file = {
    app: "Krümel",
    contents: "Änderungen, die nicht gespeichert werden konnten",
    schemaVersion: SCHEMA_VERSION,
    exportedAt: exportedAt.toISOString(),
    changes: rejected,
  };
  return `${JSON.stringify(file, null, 2)}\n`;
}
