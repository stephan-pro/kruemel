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
// - A device that has never got the data does not show anything before the first answer
//   (`StorageUnavailableError`): an empty list would look as if all tasks were gone.
// - When the household holds data of a newer app, the changes wait and the copy is not updated
//   (the rows may have a format this app does not know); the storage reports `outdated`.
// - A change the server refuses for good (invalid, not allowed) would block all later ones. It is
//   moved aside (`rejected`, kept with the copy) and the rest goes on; it stays there until the
//   person has downloaded or discarded it, so nothing is lost without a word.
// - When the person no longer belongs to the household (removed or left, E2-5a), nothing is moved
//   aside: the storage reports `notMember` and the app closes it (waiting changes as a file).
// - Every read-modify-write of the stored state happens under a lock shared by all tabs.

import { type AppData, emptyAppData, SCHEMA_VERSION } from "../storage/appData";
import type { KeyValueStore } from "../storage/localStorage";
import {
  type AppStorage,
  StorageError,
  StorageUnavailableError,
  type StorageUpdate,
  type SyncStatus,
} from "../storage/storage";
import { applyChange, type Change, diffData, isDeepEqual, type PushResult } from "./changes";
import { browserLocker, type Locker } from "./locks";
import { mergeDelta, viewOf } from "./merge";
import { type RejectedChange, type SyncState, SyncStateStore } from "./outbox";
import { type Remote, RemoteError } from "./remote";

const STATE_LOCK = "kruemel-sync-state";
const SYNC_LOCK = "kruemel-sync-run";

export interface SyncedStorageOptions {
  readonly remote: Remote;
  /** Where the copy and the outbox are kept (the browser's `localStorage`). */
  readonly store: KeyValueStore;
  /** Settings of this device ("Ich bin", colour scheme …) stay local and are not synced. */
  readonly device: Pick<AppStorage, "loadDevice" | "saveDevice">;
  /**
   * Prefix of the key; default "kruemel". The app puts the household and the person into it, so
   * each account on a device has a copy of its own and nothing reaches the wrong account.
   */
  readonly namespace?: string;
  /** The app's `schemaVersion`; default `SCHEMA_VERSION` (tests play other versions). */
  readonly schemaVersion?: number;
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
  /**
   * Changes the server refused for good, oldest first (E2-3c). They are no longer part of what
   * the app shows and wait for the person: "Als Datei herunterladen" or "Verwerfen".
   */
  rejected(): readonly RejectedChange[];
  /** "Verwerfen": forgets the refused changes; reports the new state through `subscribe`. */
  discardRejected(): Promise<void>;
  /**
   * Signing out: stops the sync for good, waits for a running one and deletes the copy and the
   * outbox. Changes still waiting are lost, so the app warns first and saves a backup file.
   */
  close(): Promise<void>;
}

type Connection = "ok" | "offline" | "unreachable";

function emptyState(): SyncState {
  return { base: emptyAppData(), cursor: null, outbox: [] };
}

/**
 * The task a change concerns and its title, looked up in what the device knew before sending it:
 * the shown data, else the server's state (a deleted task, a taken back completion).
 */
function taskOf(change: Change, known: readonly AppData[]): { taskId?: string; title?: string } {
  let taskId: string | undefined;
  if (change.type === "complete") {
    taskId = change.completion.taskId;
  } else if (change.type === "saveTask" || change.type === "deleteTask") {
    taskId = change.taskId;
  } else if (change.type === "undo") {
    taskId = known
      .flatMap((data) => data.completions)
      .find((completion) => completion.id === change.completionId)?.taskId;
  }
  if (taskId === undefined) {
    return {};
  }
  const title =
    known.flatMap((data) => data.tasks).find((task) => task.id === taskId)?.title ??
    (change.type === "saveTask" ? change.create?.title : undefined);
  return title === undefined ? { taskId } : { taskId, title };
}

function conflictOf(
  task: { taskId?: string; title?: string },
  result: Exclude<Extract<PushResult, { status: "rejected" }>, { reason: "outdated" }>,
) {
  return {
    type: "conflict",
    reason: result.reason,
    ...task,
    ...(result.reason === "alreadyDone" ? { by: result.by } : {}),
  } satisfies StorageUpdate;
}

export function createSyncedStorage(options: SyncedStorageOptions): SyncedStorage {
  const { remote, device } = options;
  const states = new SyncStateStore(options.store, `${options.namespace ?? "kruemel"}:sync`);
  const locker = options.locker ?? browserLocker();
  const newId = options.newId ?? (() => crypto.randomUUID());
  const isOnline = options.isOnline ?? (() => globalThis.navigator?.onLine !== false);
  const schemaVersion = options.schemaVersion ?? SCHEMA_VERSION;
  const listeners = new Set<(update: StorageUpdate) => void>();

  /** What the app was given last; `save` works out its changes against it. */
  let delivered: AppData | undefined;
  let connection: Connection = "ok";
  let syncing = false;
  let running: Promise<void> | undefined;
  let again = false;
  /** After `close`: no sync starts or writes any more. */
  let closed = false;
  const stops = new Set<() => void>();

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
      if (error instanceof RemoteError && !error.notMember) {
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
    let outdated = false;
    let notMember = false;
    try {
      let reachable = true;
      for (;;) {
        const before = closed ? null : await inState(() => states.read());
        const next = before?.outbox[0];
        if (before == null || next === undefined) {
          break;
        }
        const task = taskOf(next, [show(before), before.base]);
        let result: PushResult;
        try {
          result = await remote.push(next);
        } catch (error) {
          if (!(error instanceof RemoteError)) {
            throw error;
          }
          if (error.notMember) {
            // Not in the household any more: nothing is moved aside, the app takes over.
            notMember = true;
            reachable = false;
            break;
          }
          if (!error.permanent) {
            connection = isOnline() ? "unreachable" : "offline";
            reachable = false;
            break;
          }
          // Refused for good: moved aside, so it does not hold up the changes after it.
          await inState(() => {
            const state = states.read();
            if (state !== null) {
              const entry: RejectedChange = {
                change: next,
                rejectedAt: new Date().toISOString(),
                message: error.message,
                ...(task.title === undefined ? {} : { title: task.title }),
              };
              states.write({
                ...state,
                outbox: state.outbox.filter((c) => c.id !== next.id),
                rejected: [...(state.rejected ?? []), entry],
              });
            }
          });
          continue;
        }
        if (result.status === "rejected" && result.reason === "outdated") {
          // The household holds data of a newer app: the changes wait until this app is updated.
          outdated = true;
          break;
        }
        // The server took the change over exactly like `applyChange`: it moves from the outbox into
        // the base in one step. Otherwise the copy would show the old state until the next pull,
        // and for good if that pull fails (no connection right after sending).
        await inState(() => {
          const state = states.read();
          if (state !== null) {
            states.write({
              ...state,
              base: result.status === "applied" ? applyChange(state.base, next).data : state.base,
              outbox: state.outbox.filter((c) => c.id !== next.id),
            });
          }
        });
        if (result.status === "rejected") {
          conflicts.push(conflictOf(task, result));
        }
      }
      if (reachable && !closed) {
        const cursor = (await inState(() => states.read()))?.cursor ?? null;
        const delta = await attempt(() => remote.pull(cursor)).catch((error: unknown) => {
          if (error instanceof RemoteError && error.notMember) {
            notMember = true;
            return undefined;
          }
          throw error;
        });
        if (delta !== undefined) {
          connection = "ok";
          if (delta.schemaVersion > schemaVersion) {
            // Rows of a newer app: kept on the server until this app is updated.
            outdated = true;
          } else if (!closed) {
            await inState(() => {
              const state = states.read() ?? emptyState();
              states.write({ ...state, base: mergeDelta(state.base, delta), cursor: delta.cursor });
            });
          }
        }
      }
    } finally {
      syncing = false;
    }
    if (closed) {
      return;
    }
    await refresh();
    for (const conflict of conflicts) {
      emit(conflict);
    }
    if (outdated) {
      emit({ type: "outdated" });
    }
    if (notMember) {
      emit({ type: "notMember" });
    }
    emit({ type: "status", status: status() });
  }

  /** One sync at a time in this tab; a call during a run makes it run once more afterwards. */
  function sync(): Promise<void> {
    if (closed) {
      return Promise.resolve();
    }
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
        } while (again && !closed);
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
        if (state === null) {
          throw new StorageUnavailableError();
        }
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
        throw new StorageError("replaceNotSynced");
      }
      const result = await attempt(() => remote.push({ type: "replaceAll", data, id: newId() }));
      if (result === undefined) {
        throw new StorageError("replaceOffline");
      }
      if (result.status === "rejected") {
        throw new StorageError("replaceNewer");
      }
      await sync();
    },

    start(): () => void {
      if (closed) {
        return () => undefined;
      }
      const stopHints = remote.subscribe(syncInBackground);
      const stopTriggers =
        options.triggers?.({
          sync: syncInBackground,
          refresh: () => {
            // Another tab may also have moved a change aside or discarded the refused ones.
            refresh()
              .then(() => emit({ type: "status", status: status() }))
              .catch(() => undefined);
          },
        }) ?? (() => undefined);
      syncInBackground();
      // Called by `close` and later by the app as well; only the first call does something.
      const stop = () => {
        if (stops.delete(stop)) {
          stopHints();
          stopTriggers();
        }
      };
      stops.add(stop);
      return stop;
    },

    rejected(): readonly RejectedChange[] {
      try {
        return states.read()?.rejected ?? [];
      } catch {
        return [];
      }
    },

    async discardRejected(): Promise<void> {
      await inState(() => {
        const state = states.read();
        if (state !== null) {
          states.write({ ...state, rejected: [] });
        }
      });
      emit({ type: "status", status: status() });
    },

    async close(): Promise<void> {
      closed = true;
      for (const stop of [...stops]) {
        stop();
      }
      await running?.catch(() => undefined);
      await inState(() => states.clear());
      delivered = undefined;
    },
  };
}
