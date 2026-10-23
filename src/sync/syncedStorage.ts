// `AppStorage` for the shared data (stage 2): local first, the server as the place to compare.
//
// - Showing and saving always work on this device's copy and never wait for the network: `save`
//   works out what changed (`diffData`), puts the changes into the outbox and returns.
// - The sync pushes the outbox to the server in order, then asks what changed there since the
//   last time and merges that into the copy. It runs at the start, after every save, when the
//   server hints at a change, when the device comes back online and when the app is shown again.
//   The data always come from the pull, never from the hint, so nothing is lost when a hint fails
//   to arrive.
// - What the app shows is the server's state with the unsent changes carried out on top
//   (`viewOf`). When that differs from what the app was given last, the storage reports it
//   through `subscribe`.
// - Every read-modify-write of the stored state happens under a lock shared by all tabs.

import { type AppData, emptyAppData } from "../storage/appData";
import type { KeyValueStore } from "../storage/localStorage";
import {
  type AppStorage,
  StorageError,
  type StorageUpdate,
  type SyncStatus,
} from "../storage/storage";
import { type Change, diffData, isDeepEqual, type PushResult } from "./changes";
import { browserLocker, type Locker } from "./locks";
import { mergeDelta, viewOf } from "./merge";
import { type SyncState, SyncStateStore } from "./outbox";
import { type Remote, RemoteError } from "./remote";

const STATE_LOCK = "kruemel-sync-state";
const SYNC_LOCK = "kruemel-sync-run";

export interface SyncedStorageOptions {
  readonly remote: Remote;
  /** Where the copy and the outbox are kept (the browser's `localStorage`). */
  readonly store: KeyValueStore;
  /** Settings of this device ("Ich bin", colour scheme …) stay local and are not synced. */
  readonly device: Pick<AppStorage, "loadDevice" | "saveDevice">;
  /** Prefix of the key; default "kruemel". */
  readonly namespace?: string;
  /** Default: Web Locks if the browser has them, else locks inside the tab. */
  readonly locker?: Locker;
  /** Ids of changes; default `crypto.randomUUID`. */
  readonly newId?: () => string;
  /** Tells "offline" from "server not reachable"; default `navigator.onLine`. */
  readonly isOnline?: () => boolean;
  /**
   * Sets up the events that call for a sync (device online again, app shown again) and for a look
   * at the stored copy (another tab changed it); returns the way to stop. Default: none.
   */
  readonly triggers?: (actions: {
    readonly sync: () => void;
    readonly refresh: () => void;
  }) => () => void;
}

export interface SyncedStorage extends AppStorage {
  /** Pushes the outbox, pulls what changed and returns when that is done (or failed). */
  sync(): Promise<void>;
  /**
   * Replaces all shared data (restoring a backup). Only works online and with an empty outbox;
   * otherwise it throws `StorageError` and nothing changes.
   */
  replaceAll(data: AppData): Promise<void>;
  /** Starts the automatic sync (hints from the server and the `triggers`); returns the way to stop. */
  start(): () => void;
}

type Connection = "ok" | "offline" | "unreachable";

function emptyState(): SyncState {
  return { base: emptyAppData(), cursor: null, outbox: [] };
}

function conflictOf(
  change: Change,
  result: Exclude<Extract<PushResult, { status: "rejected" }>, { reason: "outdated" }>,
) {
  const taskId =
    change.type === "complete"
      ? change.completion.taskId
      : change.type === "saveTask"
        ? change.taskId
        : undefined;
  return {
    type: "conflict",
    reason: result.reason,
    ...(taskId === undefined ? {} : { taskId }),
    ...(result.reason === "alreadyDone" ? { by: result.by } : {}),
  } satisfies StorageUpdate;
}

export function createSyncedStorage(options: SyncedStorageOptions): SyncedStorage {
  const { remote, device } = options;
  const states = new SyncStateStore(options.store, `${options.namespace ?? "kruemel"}:sync`);
  const locker = options.locker ?? browserLocker();
  const newId = options.newId ?? (() => crypto.randomUUID());
  const isOnline = options.isOnline ?? (() => globalThis.navigator?.onLine !== false);
  const listeners = new Set<(update: StorageUpdate) => void>();

  /** What the app was given last; `save` works out its changes against it. */
  let delivered: AppData | undefined;
  let connection: Connection = "ok";
  let syncing = false;
  let running: Promise<void> | undefined;
  let again = false;

  const emit = (update: StorageUpdate) => {
    for (const listener of [...listeners]) {
      listener(update);
    }
  };
  const inState = <T>(work: () => T): Promise<T> =>
    locker.exclusive(STATE_LOCK, async () => work());
  const show = (state: SyncState | null): AppData =>
    state === null ? emptyAppData() : viewOf(state.base, state.outbox);

  function pending(): number {
    try {
      return states.read()?.outbox.length ?? 0;
    } catch {
      return 0;
    }
  }

  function status(): SyncStatus {
    if (connection !== "ok") {
      return { state: connection, pending: pending() };
    }
    const waiting = pending();
    return syncing || waiting > 0 ? { state: "syncing", pending: waiting } : { state: "synced" };
  }

  function publishData(data: AppData): void {
    delivered = data;
    emit({ type: "data", data });
  }

  /**
   * Reports the shown data if they differ from what the app was given last. Before the app has
   * loaded anything there is nothing to compare with, and `load` hands it the data anyway.
   */
  async function refresh(): Promise<void> {
    const data = show(await inState(() => states.read()));
    if (delivered !== undefined && !isDeepEqual(delivered, data)) {
      publishData(data);
    }
  }

  /** Runs a call to the server; a failure is noted and gives `undefined`. */
  async function attempt<T>(call: () => Promise<T>): Promise<T | undefined> {
    try {
      return await call();
    } catch (error) {
      if (error instanceof RemoteError) {
        connection = isOnline() ? "unreachable" : "offline";
        return undefined;
      }
      throw error;
    }
  }

  async function runSync(): Promise<void> {
    syncing = true;
    emit({ type: "status", status: status() });
    const conflicts: StorageUpdate[] = [];
    try {
      let reachable = true;
      for (;;) {
        const next = (await inState(() => states.read()))?.outbox[0];
        if (next === undefined) {
          break;
        }
        const result = await attempt(() => remote.push(next));
        if (result === undefined) {
          reachable = false;
          break;
        }
        if (result.status === "rejected" && result.reason === "outdated") {
          // The household holds data of a newer app: the changes wait until this app is updated.
          break;
        }
        await inState(() => {
          const state = states.read();
          if (state !== null) {
            states.write({ ...state, outbox: state.outbox.filter((c) => c.id !== next.id) });
          }
        });
        if (result.status === "rejected") {
          conflicts.push(conflictOf(next, result));
        }
      }
      if (reachable) {
        const cursor = (await inState(() => states.read()))?.cursor ?? null;
        const delta = await attempt(() => remote.pull(cursor));
        if (delta !== undefined) {
          await inState(() => {
            const state = states.read() ?? emptyState();
            states.write({ ...state, base: mergeDelta(state.base, delta), cursor: delta.cursor });
          });
          connection = "ok";
        }
      }
    } finally {
      syncing = false;
    }
    await refresh();
    for (const conflict of conflicts) {
      emit(conflict);
    }
    emit({ type: "status", status: status() });
  }

  /** One sync at a time in this tab; a call during a run makes it run once more afterwards. */
  function sync(): Promise<void> {
    if (running !== undefined) {
      again = true;
      return running;
    }
    running = (async () => {
      try {
        do {
          again = false;
          // Another tab may be syncing already; it picks up what this tab saved as well.
          await locker.tryExclusive(SYNC_LOCK, runSync);
        } while (again);
      } finally {
        running = undefined;
      }
    })();
    return running;
  }

  const syncInBackground = () => {
    sync().catch(() => undefined);
  };

  return {
    async load(): Promise<AppData> {
      let state = await inState(() => states.read());
      if (state === null) {
        // A device that has never synced has nothing to show before the first answer.
        await sync();
        state = await inState(() => states.read());
      } else {
        syncInBackground();
      }
      const data = show(state);
      delivered = data;
      return data;
    },

    async save(data: AppData): Promise<AppData> {
      const state = await inState(() => {
        const current = states.read() ?? emptyState();
        const bodies = diffData(delivered ?? show(current), data);
        if (bodies.length === 0) {
          return current;
        }
        const next = {
          ...current,
          outbox: [...current.outbox, ...bodies.map((body) => ({ ...body, id: newId() }))],
        };
        states.write(next);
        return next;
      });
      // What came from the server meanwhile is part of the result, so the app does not show an
      // older state than the storage has.
      const shown = show(state);
      delivered = shown;
      if (state.outbox.length > 0) {
        syncInBackground();
      }
      return shown;
    },

    async loadRaw(): Promise<string | null> {
      return states.readRaw();
    },

    async discard(): Promise<void> {
      await inState(() => states.clear());
      delivered = undefined;
    },

    loadDevice: () => device.loadDevice(),
    saveDevice: (settings) => device.saveDevice(settings),

    subscribe(listener: (update: StorageUpdate) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    syncStatus: status,

    sync,

    async replaceAll(data: AppData): Promise<void> {
      await sync();
      if (pending() > 0 || connection !== "ok") {
        throw new StorageError(
          "Das Einspielen einer Sicherung geht nur mit Internet, wenn alle Änderungen übertragen sind.",
        );
      }
      const result = await attempt(() => remote.push({ type: "replaceAll", data, id: newId() }));
      if (result === undefined) {
        throw new StorageError("Das Einspielen einer Sicherung geht nur mit Internet.");
      }
      if (result.status === "rejected") {
        throw new StorageError(
          "Eure Daten stammen aus einer neueren Version der App. Lade die App neu und versuche es dann noch einmal.",
        );
      }
      await sync();
    },

    start(): () => void {
      const stopHints = remote.subscribe(syncInBackground);
      const stopTriggers =
        options.triggers?.({
          sync: syncInBackground,
          refresh: () => {
            refresh().catch(() => undefined);
          },
        }) ?? (() => undefined);
      syncInBackground();
      return () => {
        stopHints();
        stopTriggers();
      };
    },
  };
}
