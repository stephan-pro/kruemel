// Shared building blocks for the storage tests (not part of the app, excluded from coverage).

import { addChecklistItem, setChecklistItemChecked } from "../domain/checklist";
import { oneOffTask, recurringTask, stateOf, tickOff } from "../domain/task.fixtures";
import { type AppData, SCHEMA_VERSION } from "./appData";
import type { KeyValueStore } from "./localStorage";

/** A stand-in for the browser's localStorage. */
export class FakeStore implements KeyValueStore {
  readonly items = new Map<string, string>();
  /** When set, reading or writing throws it (full or blocked storage). */
  failWith: Error | undefined;

  getItem(key: string): string | null {
    this.check();
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.check();
    this.items.set(key, value);
  }

  removeItem(key: string): void {
    this.check();
    this.items.delete(key);
  }

  private check(): void {
    if (this.failWith !== undefined) {
      throw this.failWith;
    }
  }
}

/** Data that uses every field: both task kinds, checklists, a takeover, optional notes. */
export function sampleData(): AppData {
  let cleaning = addChecklistItem(
    recurringTask({ id: "t-bad", note: "Mit Essigreiniger", symbol: "bath" }),
    { id: "i-1", text: "Waschbecken" },
  );
  cleaning = addChecklistItem(cleaning, { id: "i-2", text: "Toilette" });
  cleaning = setChecklistItemChecked(cleaning, "i-1", true);
  const ticked = tickOff(stateOf({ ...cleaning, takenOverBy: "personB" }), "2026-10-21", "c-1");
  const again = tickOff(
    { task: { ...cleaning, takenOverBy: "personB" }, completions: ticked.completions },
    "2026-10-28",
    "c-2",
    "personB",
  );
  const parcel = tickOff(
    stateOf(oneOffTask({ id: "t-paket", assignee: "both", symbol: "parcel" })),
    "2026-10-20",
    "c-3",
  );
  const windows = recurringTask({
    id: "t-fenster",
    title: "Fenster putzen",
    assignee: "personB",
    takenOverBy: "personA",
    recurrence: { unit: "month", interval: 2 },
  });
  const open = oneOffTask({ id: "t-offen", title: "Geschenk kaufen" });
  return {
    schemaVersion: SCHEMA_VERSION,
    settings: { personNames: { personA: "Alex", personB: "Robin" } },
    tasks: [again.task, windows, parcel.task, open],
    // The first completion also knows the moment of ticking off (the others only who was
    // responsible), so both shapes of version 3 are in the sample.
    completions: [...again.completions, ...parcel.completions].map((completion, index) =>
      index === 0 ? { ...completion, completedAt: "2026-10-21T08:30:00.000Z" } : completion,
    ),
  };
}

/** The data without what only version 3 knows: what loading an older file comes out as. */
export function withoutVersion3Fields(data: AppData): AppData {
  return {
    ...data,
    completions: data.completions.map(
      ({ completedAt: _at, assigneeAtCompletion: _assignee, ...rest }) => rest,
    ),
  };
}

/**
 * The data as version 2 stored or exported it (before stage 2): completions without `completedAt`
 * and `assigneeAtCompletion`. Plain JSON values.
 */
// biome-ignore lint/suspicious/noExplicitAny: old files are plain JSON of their own shape
export function asVersion2(data: AppData): any {
  const copy = JSON.parse(JSON.stringify(data));
  copy.schemaVersion = 2;
  for (const completion of copy.completions) {
    delete completion.completedAt;
    delete completion.assigneeAtCompletion;
  }
  return copy;
}

/** The data as version 1 stored or exported it (before F8): no symbols. Plain JSON values. */
// biome-ignore lint/suspicious/noExplicitAny: old files are plain JSON of their own shape
export function asVersion1(data: AppData): any {
  const copy = asVersion2(data);
  copy.schemaVersion = 1;
  for (const task of copy.tasks) {
    delete task.symbol;
  }
  return copy;
}
