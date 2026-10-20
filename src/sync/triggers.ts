// The browser events that call for a sync (stage 2): the device is online again, the app is shown
// again (a phone's browser may have paused it for hours), another tab of the app changed the
// stored copy. Given the browser objects as parameters, so a test can play them.

import type { SyncedStorageOptions } from "./syncedStorage";

interface EventHost {
  addEventListener(type: string, listener: (event: Event) => void): void;
  removeEventListener(type: string, listener: (event: Event) => void): void;
}

export interface TriggerEnvironment {
  readonly window: EventHost;
  readonly document: EventHost & { readonly visibilityState: string };
  /** Part of the key the sync keeps its copy under, to tell its changes from other storage events. */
  readonly keySuffix?: string;
}

/** The `triggers` option of `createSyncedStorage` for a browser page. */
export function browserTriggers(
  environment: TriggerEnvironment,
): NonNullable<SyncedStorageOptions["triggers"]> {
  const suffix = environment.keySuffix ?? ":sync";
  return ({ sync, refresh }) => {
    const online = () => sync();
    const visibility = () => {
      if (environment.document.visibilityState === "visible") {
        sync();
      }
    };
    // Fired in the other tabs when one tab writes to the storage.
    const storage = (event: Event) => {
      if ((event as StorageEvent).key?.endsWith(suffix)) {
        refresh();
      }
    };
    environment.window.addEventListener("online", online);
    environment.window.addEventListener("storage", storage);
    environment.document.addEventListener("visibilitychange", visibility);
    return () => {
      environment.window.removeEventListener("online", online);
      environment.window.removeEventListener("storage", storage);
      environment.document.removeEventListener("visibilitychange", visibility);
    };
  };
}
