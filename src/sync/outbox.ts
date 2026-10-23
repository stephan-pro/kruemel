// What a device keeps for the sync, in the browser storage (stage 2): the last state it got from the
// server (`base`), the cursor to ask for what changed since, and the outbox, the changes the
// server has not confirmed yet. All in one entry, so a change of the outbox and of the base are
// never half written. Nothing in it is trusted blindly: it is read like an import file.

import type { AppData } from "../storage/appData";
import { type KeyValueStore, readKey, removeKey, writeKey } from "../storage/localStorage";
import { StorageError } from "../storage/storage";
import { parseAppData } from "../storage/validate";
import type { Change } from "./changes";

export interface SyncState {
  /** The server's data as of `cursor`. */
  readonly base: AppData;
  /** Where to continue asking the server; `null` until the first answer. */
  readonly cursor: string | null;
  /** Changes to send, oldest first. */
  readonly outbox: readonly Change[];
}

const CHANGE_TYPES = [
  "setNames",
  "saveTask",
  "deleteTask",
  "complete",
  "undo",
  "replaceAll",
  "addAll",
];

function isChange(value: unknown): value is Change {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { id, type } = value as { id?: unknown; type?: unknown };
  return (
    typeof id === "string" && id !== "" && typeof type === "string" && CHANGE_TYPES.includes(type)
  );
}

/** Reads and writes the `SyncState` under one key. Reading throws `StorageError` if it is broken. */
export class SyncStateStore {
  constructor(
    private readonly store: KeyValueStore,
    private readonly key: string,
  ) {}

  /** The state, or `null` if this device has not synced yet. */
  read(): SyncState | null {
    const text = readKey(this.store, this.key);
    return text === null ? null : SyncStateStore.parse(text);
  }

  /** The state as it is kept (for a download when it is unreadable), or `null`. */
  readRaw(): string | null {
    return readKey(this.store, this.key);
  }

  write(state: SyncState): void {
    writeKey(this.store, this.key, JSON.stringify(state));
  }

  clear(): void {
    removeKey(this.store, this.key);
  }

  private static parse(text: string): SyncState {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new StorageError(
        "Die lokale Kopie der gemeinsamen Daten ist beschädigt (kein gültiges JSON).",
      );
    }
    const { base, cursor, outbox } = (parsed ?? {}) as Record<string, unknown>;
    const result = parseAppData(base);
    if (!result.ok) {
      throw new StorageError(
        "Die lokale Kopie der gemeinsamen Daten ist unvollständig oder beschädigt.",
        result.errors.map((error) => `Kopie: ${error}`),
      );
    }
    if (!(cursor === null || typeof cursor === "string")) {
      throw new StorageError("Die lokale Kopie der gemeinsamen Daten ist beschädigt.", [
        "Kopie.cursor: erwartet Text oder nichts",
      ]);
    }
    if (!Array.isArray(outbox) || !outbox.every(isChange)) {
      throw new StorageError("Die wartenden Änderungen sind beschädigt.", [
        "Kopie.outbox: erwartet eine Liste von Änderungen",
      ]);
    }
    return { base: result.data, cursor, outbox };
  }
}
