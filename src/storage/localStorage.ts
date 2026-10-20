// `AppStorage` on top of the browser's localStorage. The browser object is passed in, so tests use
// a fake and the demo (package 6) can use its own namespace.

import { isPerson } from "../domain/task";
import { type AppData, emptyAppData } from "./appData";
import { type AppStorage, type DeviceSettings, isColorScheme, StorageError } from "./storage";
import { parseAppData } from "./validate";

/** The part of the browser's `Storage` that is used. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LocalStorageOptions {
  readonly store: KeyValueStore;
  /** Prefix of the keys; different namespaces never see each other's data. */
  readonly namespace?: string;
}

const DEFAULT_NAMESPACE = "putzplan";

function read(store: KeyValueStore, key: string): string | null {
  try {
    return store.getItem(key);
  } catch (error) {
    throw new StorageError("Der Browser-Speicher ist nicht verfügbar.", [String(error)]);
  }
}

function write(store: KeyValueStore, key: string, value: string): void {
  try {
    store.setItem(key, value);
  } catch (error) {
    throw new StorageError(
      "Speichern nicht möglich: Der Browser-Speicher ist voll oder gesperrt. Bitte jetzt eine Sicherung exportieren.",
      [String(error)],
    );
  }
}

function remove(store: KeyValueStore, key: string): void {
  try {
    store.removeItem(key);
  } catch (error) {
    throw new StorageError("Löschen nicht möglich: Der Browser-Speicher ist gesperrt.", [
      String(error),
    ]);
  }
}

export function createLocalStorage(options: LocalStorageOptions): AppStorage {
  const { store } = options;
  const namespace = options.namespace ?? DEFAULT_NAMESPACE;
  const dataKey = `${namespace}:data`;
  const deviceKey = `${namespace}:device`;

  return {
    async load(): Promise<AppData> {
      const text = read(store, dataKey);
      if (text === null) {
        return emptyAppData();
      }
      // Unreadable data is reported, never replaced by empty data: saving afterwards would
      // destroy what might still be repairable.
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new StorageError("Die gespeicherten Daten sind beschädigt (kein gültiges JSON).");
      }
      const result = parseAppData(parsed);
      if (!result.ok) {
        throw new StorageError(
          "Die gespeicherten Daten sind unvollständig oder beschädigt.",
          result.errors,
        );
      }
      return result.data;
    },

    async save(data: AppData): Promise<void> {
      write(store, dataKey, JSON.stringify(data));
    },

    async loadRaw(): Promise<string | null> {
      return read(store, dataKey);
    },

    async discard(): Promise<void> {
      remove(store, dataKey);
    },

    async loadDevice(): Promise<DeviceSettings> {
      const text = read(store, deviceKey);
      if (text === null) {
        return {};
      }
      // Only preferences: what is unreadable is left out, so the app asks "Ich bin" again and
      // follows the device's colour scheme. Each value counts on its own.
      let parsed: {
        currentPerson?: unknown;
        colorScheme?: unknown;
        installHintDismissed?: unknown;
      } | null;
      try {
        parsed = JSON.parse(text);
      } catch {
        return {};
      }
      const person = parsed?.currentPerson;
      const scheme = parsed?.colorScheme;
      return {
        ...(isPerson(person) ? { currentPerson: person } : {}),
        ...(isColorScheme(scheme) ? { colorScheme: scheme } : {}),
        ...(parsed?.installHintDismissed === true ? { installHintDismissed: true } : {}),
      };
    },

    async saveDevice(settings: DeviceSettings): Promise<void> {
      write(store, deviceKey, JSON.stringify(settings));
    },
  };
}

/**
 * Asks the browser not to delete the data when space runs low (needs a secure page).
 * Returns whether the data is now protected; never throws.
 */
export async function requestPersistentStorage(
  manager: Pick<StorageManager, "persist"> | undefined = globalThis.navigator?.storage,
): Promise<boolean> {
  try {
    return (await manager?.persist()) ?? false;
  } catch {
    return false;
  }
}
