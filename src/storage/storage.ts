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
  /** The hint "Putzplan als App" in the week view was closed; missing means it may show. */
  readonly installHintDismissed?: boolean;
}

export interface AppStorage {
  /** The stored data, or empty data if nothing was stored yet. Throws `StorageError` if unreadable. */
  load(): Promise<AppData>;
  /** Replaces all stored data. Throws `StorageError` if it could not be saved. */
  save(data: AppData): Promise<void>;
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
