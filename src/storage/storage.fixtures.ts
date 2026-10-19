// Shared building blocks for the storage tests (not part of the app, excluded from coverage).

import { addChecklistItem, setChecklistItemChecked } from "../domain/checklist";
import { oneOffTask, recurringTask, stateOf, tickOff } from "../domain/task.fixtures";
import type { AppData } from "./appData";
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

  private check(): void {
    if (this.failWith !== undefined) {
      throw this.failWith;
    }
  }
}

/** Data that uses every field: both task kinds, checklists, a takeover, optional notes. */
export function sampleData(): AppData {
  let cleaning = addChecklistItem(recurringTask({ id: "t-bad", note: "Mit Essigreiniger" }), {
    id: "i-1",
    text: "Waschbecken",
  });
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
    stateOf(oneOffTask({ id: "t-paket", assignee: "both" })),
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
    schemaVersion: 1,
    settings: { personNames: { personA: "Alex", personB: "Robin" } },
    tasks: [again.task, windows, parcel.task, open],
    completions: [...again.completions, ...parcel.completions],
  };
}
