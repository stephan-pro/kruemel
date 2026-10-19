// The one place the rest of the app talks to when it needs to keep data. Asynchronous on purpose:
// stage 2 replaces the implementation with a shared database without touching any caller.
// (Named `AppStorage` so it does not hide the browser's own `Storage` type.)

import type { Person } from "../domain/task";
import type { AppData } from "./appData";

/** Settings that belong to this device only; they are not part of the backup. */
export interface DeviceSettings {
  /** "Ich bin": who uses this device. Missing until chosen. */
  readonly currentPerson?: Person;
}

export interface AppStorage {
  /** The stored data, or empty data if nothing was stored yet. Throws `StorageError` if unreadable. */
  load(): Promise<AppData>;
  /** Replaces all stored data. Throws `StorageError` if it could not be saved. */
  save(data: AppData): Promise<void>;
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
