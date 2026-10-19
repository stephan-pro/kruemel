// Example data for trying the app by hand (`npm run demo`, Q8) and for the end-to-end tests.
// Everything is placed relative to "today", so the week view always has overdue, current and
// upcoming tasks. The names are invented. The data is built with the domain functions, so it
// always follows the same rules as data the app creates itself.

import { addChecklistItem, setChecklistItemChecked } from "../domain/checklist";
import { addDays, type CalendarDay } from "../domain/date";
import {
  type Completion,
  completeTask,
  createOneOffTask,
  createRecurringTask,
  type NewOneOffTask,
  type NewRecurringTask,
  type Person,
  type Task,
  type TaskState,
} from "../domain/task";
import { type AppData, SCHEMA_VERSION } from "../storage/appData";
import type { DeviceSettings } from "../storage/storage";

/** Own storage area, so the demo never touches real data in the same browser. */
export const DEMO_NAMESPACE = "putzplan-demo";

/** Invented names; the real ones are chosen by the users on first start (F5). */
export const DEMO_NAMES = { personA: "Alex", personB: "Robin" } as const;

/** In the demo this device already belongs to the first person ("Ich bin"). */
export const DEMO_DEVICE: DeviceSettings = { currentPerson: "personA" };

/** Builds one task together with the completions that led to its current state. */
class Builder {
  readonly tasks: Task[] = [];
  readonly completions: Completion[] = [];
  private completionCount = 0;

  constructor(private readonly today: CalendarDay) {}

  /** `daysFromToday`: negative = in the past. */
  day(daysFromToday: number): CalendarDay {
    return addDays(this.today, daysFromToday);
  }

  /**
   * Adds a recurring task. `history` lists, oldest first, how many days ago it was ticked off and
   * by whom; each completion moves the due date on, so the last one decides the current due date.
   */
  recurring(
    input: Omit<NewRecurringTask, "dueDate">,
    history: readonly (readonly [daysAgo: number, by: Person])[],
    options: { items?: readonly string[]; checked?: readonly number[]; takenOverBy?: Person } = {},
  ): void {
    const first = history[0];
    let state: TaskState = {
      task: createRecurringTask({ ...input, dueDate: this.day(-(first?.[0] ?? 0)) }),
      completions: [],
    };
    for (const [daysAgo, by] of history) {
      state = completeTask(state, {
        completionId: this.nextCompletionId(),
        completedOn: this.day(-daysAgo),
        completedBy: by,
      });
    }
    let task = this.withChecklist(state.task, options.items, options.checked);
    if (task.kind === "recurring" && options.takenOverBy !== undefined) {
      task = { ...task, takenOverBy: options.takenOverBy };
    }
    this.tasks.push(task);
    this.completions.push(...state.completions);
  }

  /** Adds a one-off task; `done` = ticked off that many days ago by that person. */
  oneOff(
    input: Omit<NewOneOffTask, "dueDate"> & { dueInDays: number },
    options: {
      items?: readonly string[];
      checked?: readonly number[];
      done?: readonly [daysAgo: number, by: Person];
    } = {},
  ): void {
    const { dueInDays, ...rest } = input;
    const created = this.withChecklist(
      createOneOffTask({ ...rest, dueDate: this.day(dueInDays) }),
      options.items,
      options.checked,
    );
    if (options.done === undefined) {
      this.tasks.push(created);
      return;
    }
    const [daysAgo, by] = options.done;
    const state = completeTask(
      { task: created, completions: [] },
      {
        completionId: this.nextCompletionId(),
        completedOn: this.day(-daysAgo),
        completedBy: by,
      },
    );
    this.tasks.push(state.task);
    this.completions.push(...state.completions);
  }

  private withChecklist(
    task: Task,
    items: readonly string[] = [],
    checked: readonly number[] = [],
  ): Task {
    let result = task;
    items.forEach((text, index) => {
      result = addChecklistItem(result, { id: `${task.id}-item-${index + 1}`, text });
    });
    for (const index of checked) {
      result = setChecklistItemChecked(result, `${task.id}-item-${index + 1}`, true);
    }
    return result;
  }

  private nextCompletionId(): string {
    this.completionCount += 1;
    return `demo-completion-${this.completionCount}`;
  }
}

/**
 * A lived-in household: one task overdue, several due today and in the next days, a task taken
 * over for one cycle, checklists with and without ticks, and a history in "Erledigt".
 */
export function demoData(today: CalendarDay): AppData {
  const b = new Builder(today);

  // Overdue by two days; its checklist is half ticked.
  b.recurring(
    {
      id: "demo-bad",
      title: "Bad putzen",
      recurrence: { unit: "week", interval: 1 },
      assignee: "personA",
      note: "Mit Essigreiniger, nicht mit Scheuermilch",
    },
    [
      [16, "personA"],
      [9, "personA"],
    ],
    { items: ["Waschbecken", "Toilette", "Dusche"], checked: [0] },
  );
  // Due today, for both.
  b.recurring(
    {
      id: "demo-staubsaugen",
      title: "Staubsaugen",
      recurrence: { unit: "week", interval: 1 },
      assignee: "both",
    },
    [
      [14, "personB"],
      [7, "personA"],
    ],
  );
  // Short rhythm, due tomorrow.
  b.recurring(
    {
      id: "demo-muell",
      title: "Müll rausbringen",
      recurrence: { unit: "day", interval: 3 },
      assignee: "personB",
    },
    [
      [5, "personB"],
      [2, "personA"],
    ],
  );
  b.recurring(
    {
      id: "demo-kueche",
      title: "Küche wischen",
      recurrence: { unit: "week", interval: 1 },
      assignee: "personB",
    },
    [[4, "personB"]],
    { items: ["Herd", "Arbeitsplatte", "Boden"] },
  );
  // Monthly rhythm, taken over by the other person for this cycle only.
  b.recurring(
    {
      id: "demo-fenster",
      title: "Fenster putzen",
      recurrence: { unit: "month", interval: 2 },
      assignee: "personB",
    },
    [[50, "personB"]],
    { takenOverBy: "personA" },
  );
  b.recurring(
    {
      id: "demo-bettwaesche",
      title: "Bettwäsche wechseln",
      recurrence: { unit: "week", interval: 2 },
      assignee: "both",
    },
    [[5, "personA"]],
  );

  // One-off tasks: overdue, today, soon, later, and one already done.
  b.oneOff({
    id: "demo-handwerker",
    title: "Handwerker anrufen",
    assignee: "personA",
    note: "Wegen des tropfenden Wasserhahns",
    dueInDays: -1,
  });
  b.oneOff(
    { id: "demo-einkaufen", title: "Einkaufen", assignee: "both", dueInDays: 0 },
    { items: ["Milch", "Brot", "Obst", "Spülmittel"], checked: [0, 1] },
  );
  b.oneOff({ id: "demo-paket", title: "Paket abholen", assignee: "personB", dueInDays: 1 });
  b.oneOff(
    { id: "demo-geschenk", title: "Geschenk kaufen", assignee: "personA", dueInDays: 6 },
    { items: ["Karte", "Geschenkpapier"] },
  );
  b.oneOff(
    { id: "demo-altglas", title: "Altglas wegbringen", assignee: "personB", dueInDays: -4 },
    { done: [3, "personB"] },
  );

  return {
    schemaVersion: SCHEMA_VERSION,
    settings: { personNames: DEMO_NAMES },
    tasks: b.tasks,
    completions: b.completions,
  };
}
