// The one place the rest of the app talks to when it needs to keep data. Asynchronous on purpose:
// stage 2 replaces the implementation with a shared database without touching any caller.
// (Named `AppStorage` so it does not hide the browser's own `Storage` type.)

import type { Person } from "../domain/task";
import { t } from "../i18n";
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
  /** `false`: the Krümel in the header stands still (E2-4c); missing means it moves. */
  readonly logoMotion?: false;
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
  /**
   * The household holds data of a newer app version: this device's changes wait and its view is
   * not updated until the app is reloaded ("Neue Version verfügbar – Neu laden").
   */
  | { readonly type: "outdated" }
  /**
   * The person no longer belongs to the household (removed, or left on another device; E2-5a).
   * The changes wait untouched; the app looks at the household and closes the storage.
   */
  | { readonly type: "notMember" }
  /** A change of this device was not taken over by the server. */
  | {
      readonly type: "conflict";
      readonly reason: ConflictReason;
      readonly taskId?: string;
      /** The task's title as this device knew it (also of a task deleted meanwhile). */
      readonly title?: string;
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

/**
 * What went wrong with the storage, as a code; `storageErrorText` (and `errorText`) say it to the
 * person in the language set at that moment.
 * - `unavailable` / `full` / `blocked`: the browser's storage cannot be read, is full or locked,
 *   or does not let anything be deleted.
 * - `damaged` / `incomplete`: the stored data cannot be read, or lack something.
 * - `copyDamaged` / `copyIncomplete` / `queueDamaged` / `rejectedDamaged`: the same for the device's
 *   copy of the shared data, the changes waiting to be sent and those the server refused.
 * - `replaceNotSynced` / `replaceOffline` / `replaceNewer`: putting a backup in place into the
 *   shared data is not possible now.
 * - `sharedNotLoaded`: the shared data have not reached this device yet and the server cannot be
 *   reached (`StorageUnavailableError`).
 */
export const STORAGE_FAILURES = [
  "unavailable",
  "full",
  "blocked",
  "damaged",
  "incomplete",
  "copyDamaged",
  "copyIncomplete",
  "queueDamaged",
  "rejectedDamaged",
  "replaceNotSynced",
  "replaceOffline",
  "replaceNewer",
  "sharedNotLoaded",
] as const;

export type StorageFailure = (typeof STORAGE_FAILURES)[number];

/** Something went wrong while reading or writing; `details` lists what exactly, if known. */
export class StorageError extends Error {
  readonly failure: StorageFailure;
  readonly details: readonly string[];

  /** The `message` is in the language set now; to show it later, use `failure` (`errorText`). */
  constructor(failure: StorageFailure, details: readonly string[] = []) {
    super(t().errors.storage[failure]);
    this.name = "StorageError";
    this.failure = failure;
    this.details = details;
  }
}

/**
 * The shared data cannot be shown yet: this device has never got them from the server and the
 * server cannot be reached now. Nothing is broken; it works once the device has a connection.
 */
export class StorageUnavailableError extends StorageError {
  constructor() {
    super("sharedNotLoaded");
    this.name = "StorageUnavailableError";
  }
}
