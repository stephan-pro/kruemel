// Shared building blocks for the sync tests (not part of the app, excluded from coverage).

import { calendarDay } from "../domain/date";
import type { Completion, OneOffTask, RecurringTask, Task } from "../domain/task";
import { type AppData, emptyAppData, SCHEMA_VERSION } from "../storage/appData";
import type { StorageUpdate } from "../storage/storage";
import { FakeStore } from "../storage/storage.fixtures";
import { FakeHousehold } from "./fakeHousehold";
import { FakeRemote } from "./fakeRemote";
import { memoryLocker } from "./locks";
import { createSyncedStorage, type SyncedStorage } from "./syncedStorage";

export const d = calendarDay;

export function weekly(overrides: Partial<RecurringTask> = {}): RecurringTask {
  return {
    kind: "recurring",
    id: "t-bad",
    title: "Bad putzen",
    symbol: "standard",
    recurrence: { unit: "week", interval: 1 },
    assignee: "personA",
    dueDate: d("2026-10-19"),
    checklist: [],
    ...overrides,
  };
}

export function once(overrides: Partial<OneOffTask> = {}): OneOffTask {
  return {
    kind: "oneOff",
    id: "t-paket",
    title: "Paket abholen",
    symbol: "standard",
    assignee: "personB",
    dueDate: d("2026-10-22"),
    done: false,
    checklist: [],
    ...overrides,
  };
}

export function completion(overrides: Partial<Completion> = {}): Completion {
  return {
    id: "c-1",
    taskId: "t-bad",
    completedOn: d("2026-10-21"),
    completedBy: "personA",
    previousDueDate: d("2026-10-19"),
    nextDueDate: d("2026-10-28"),
    checkedItemIds: [],
    ...overrides,
  };
}

export function dataWith(tasks: readonly Task[], completions: readonly Completion[] = []): AppData {
  return {
    ...emptyAppData(),
    settings: { personNames: { personA: "Alex", personB: "Robin" } },
    tasks,
    completions,
  };
}

/** One device: its own browser storage and a connection to the shared household. */
export interface Device {
  readonly storage: SyncedStorage;
  readonly remote: FakeRemote;
  readonly store: FakeStore;
  /** Everything the storage reported. */
  readonly updates: StorageUpdate[];
}

/** A counter for ids that are the same in every run. */
export function idCounter(prefix: string): () => string {
  let count = 0;
  return () => `${prefix}-${++count}`;
}

/**
 * Two or more devices of one household; `devices[i].remote.online = false` cuts one off. A device
 * can run another app version (`schemaVersion`) and use the browser storage of an earlier one
 * (`store`: the same device after reloading a new version).
 */
export function household(initial?: AppData) {
  const server = new FakeHousehold(initial);
  const device = (
    name: string,
    schemaVersion: number = SCHEMA_VERSION,
    store: FakeStore = new FakeStore(),
  ): Device => {
    const remote = new FakeRemote(server);
    remote.schemaVersion = schemaVersion;
    const storage = createSyncedStorage({
      remote,
      store,
      schemaVersion,
      device: {
        loadDevice: async () => ({}),
        saveDevice: async () => undefined,
      },
      locker: memoryLocker(),
      newId: idCounter(name),
      isOnline: () => remote.online,
    });
    const updates: Device["updates"] = [];
    storage.subscribe((update) => updates.push(update));
    return { storage, remote, store, updates };
  };
  return { server, device };
}
