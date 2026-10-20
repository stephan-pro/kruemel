// The one place the rest of the app talks to when it needs to keep data. Asynchronous on purpose:
// stage 2 replaces the implementation with a shared database without touching any caller.
// (Named `AppStorage` so it does not hide the browser's own `Storage` type.)

import type { Person } from "../domain/task";
import type { AppData } from "./appData";

/** "Darstellung" (N8): light, dark, or following the device ("auto"). */
export type ColorScheme = "light" | "dark" | "auto";

export const COLOR_SCHEMES: readonly ColorScheme[] = ["light", "dark", "auto"];

/** Without a choice the app follows the device. */
export const DEFAULT_COLOR_SCHEME: ColorScheme = "auto";

export function isColorScheme(value: unknown): value is ColorScheme {
  return COLOR_SCHEMES.includes(value as ColorScheme);
}

/** Settings that belong to this device only; they are not part of the backup. */
export interface DeviceSettings {
  /** "Ich bin": who uses this device. Missing until chosen. */
  readonly currentPerson?: Person;
  /** Missing means `DEFAULT_COLOR_SCHEME`. */
  readonly colorScheme?: ColorScheme;
  /** The hint "Krümel als App" in the week view was closed; missing means it may show. */
  readonly installHintDismissed?: boolean;
}

/**
 * Where the data stands compared with the server (stage 2): "Alles übertragen", "Offline – N
 * Änderungen warten", "Server nicht erreichbar". The local storage never waits for anything.
 */
export type SyncStatus =
  | { readonly state: "synced" }
  /** Changes are waiting or being sent. */
  | { readonly state: "syncing"; readonly pending: number }
  /** The device has no connection. */
  | { readonly state: "offline"; readonly pending: number }
  /** The device is online but the server did not answer. */
  | { readonly state: "unreachable"; readonly pending: number };

/** Why the server did not take a change over (the server's state counts then). */
export type ConflictReason =
  /** The same pass of the task was already ticked off; `by` did it. */
  | "alreadyDone"
  /** The task was deleted meanwhile. */
  | "taskGone"
  /** The completion is not the last one of its task any more. */
  | "notLast"
  /** The completion does not exist any more. */
  | "completionGone";

/** What a storage reports on its own, after `subscribe`. */
export type StorageUpdate =
  /** The data changed, e.g. through the other device; these are the data to show now. */
  | { readonly type: "data"; readonly data: AppData }
  | { readonly type: "status"; readonly status: SyncStatus }
  /** A change of this device was not taken over by the server. */
  | {
      readonly type: "conflict";
      readonly reason: ConflictReason;
      readonly taskId?: string;
      readonly by?: Person;
    };

export interface AppStorage {
  /** The stored data, or empty data if nothing was stored yet. Throws `StorageError` if unreadable. */
  load(): Promise<AppData>;
  /**
   * Replaces all stored data. Throws `StorageError` if it could not be saved. Returns the data to
   * show now: `data` itself, or in the shared storage `data` plus whatever arrived from the other
   * device meanwhile.
   */
  save(data: AppData): Promise<AppData>;
  /**
   * The stored data exactly as it is kept, or `null` if nothing is stored. Does not check it, so it
   * also works when `load()` fails; the app offers it as a download for a later repair.
   * Throws `StorageError` if the storage itself cannot be read.
   */
  loadRaw(): Promise<string | null>;
  /**
   * Deletes the stored data (not the device settings). Only for starting over after `load()`
   * reported unreadable data and the user agreed. Throws `StorageError` if it could not be deleted.
   */
  discard(): Promise<void>;
  loadDevice(): Promise<DeviceSettings>;
  saveDevice(settings: DeviceSettings): Promise<void>;
  /** Reports changes that did not come from this app (the other device) and the sync state. */
  subscribe(listener: (update: StorageUpdate) => void): () => void;
  /** The state of the sync right now; the local storage is always "synced". */
  syncStatus(): SyncStatus;
}

/** Something went wrong while reading or writing; `details` lists what exactly, if known. */
export class StorageError extends Error {
  readonly details: readonly string[];

  constructor(message: string, details: readonly string[] = []) {
    super(message);
    this.name = "StorageError";
    this.details = details;
  }
}
