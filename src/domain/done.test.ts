import { describe, expect, it } from "vitest";
import { addDays } from "./date";
import { doneEntries } from "./done";
import { type Completion, type TaskState, undoCompletion } from "./task";
import { d, oneOffTask, recurringTask, stateOf, tickOff } from "./task.fixtures";

/** Ticks a recurring task off once per day, `count` times, with ids c-1, c-2, …. */
function tickOffDaily(state: TaskState, start: string, count: number): TaskState {
  let current = state;
  for (let index = 0; index < count; index++) {
    current = tickOff(current, addDays(d(start), index), `c-${index + 1}`);
  }
  return current;
}

describe("F3 Erledigt-Liste", () => {
  it("(Entscheidung F3) „Erledigt“ enthält jeden erledigten Durchgang einer wiederkehrenden Aufgabe", () => {
    const ticked = tickOffDaily(stateOf(recurringTask()), "2026-10-21", 3);

    const entries = doneEntries([ticked.task], ticked.completions);

    expect(entries.map((entry) => entry.completion.id)).toEqual(["c-3", "c-2", "c-1"]);
    expect(entries.every((entry) => entry.task.id === "task-1")).toBe(true);
  });

  it("(Entscheidung F3) Einträge in „Erledigt“ bleiben unbegrenzt erhalten", () => {
    const ticked = tickOffDaily(stateOf(recurringTask()), "2026-01-01", 1000);

    const entries = doneEntries([ticked.task], ticked.completions);

    expect(entries).toHaveLength(1000);
  });

  it("„Erledigt“ zeigt die neuesten Einträge zuerst, bei gleichem Tag den später abgehakten", () => {
    const first = tickOff(stateOf(oneOffTask({ id: "x" })), "2026-10-20", "c-x");
    const second = tickOff(stateOf(oneOffTask({ id: "y" })), "2026-10-22", "c-y");
    const third = tickOff(stateOf(oneOffTask({ id: "z" })), "2026-10-22", "c-z");

    const entries = doneEntries(
      [first.task, second.task, third.task],
      [...first.completions, ...second.completions, ...third.completions],
    );

    expect(entries.map((entry) => entry.completion.id)).toEqual(["c-z", "c-y", "c-x"]);
  });

  it("(Entscheidung F2) Rückgängig über „Erledigt“ geht jederzeit, aber nur für das letzte Abhaken einer Aufgabe", () => {
    const ticked = tickOffDaily(stateOf(recurringTask()), "2026-10-21", 3);
    const other = tickOff(stateOf(oneOffTask()), "2026-10-10", "c-other");

    const entries = doneEntries(
      [ticked.task, other.task],
      [...other.completions, ...ticked.completions],
    );
    const undoable = Object.fromEntries(
      entries.map((entry) => [entry.completion.id, entry.canUndo]),
    );

    expect(undoable).toEqual({ "c-1": false, "c-2": false, "c-3": true, "c-other": true });
  });

  it("Ein rückgängig gemachter Durchgang verschwindet aus „Erledigt“, der vorherige wird rückgängig-fähig", () => {
    const ticked = tickOffDaily(stateOf(recurringTask()), "2026-10-21", 2);

    const afterUndo = undoCompletion(ticked, "c-2");
    const entries = doneEntries([afterUndo.task], afterUndo.completions);

    expect(entries.map((entry) => [entry.completion.id, entry.canUndo])).toEqual([["c-1", true]]);
  });

  it("„Erledigt“ führt keine Einträge zu Aufgaben auf, die es nicht mehr gibt", () => {
    const ticked = tickOff(stateOf(oneOffTask()), "2026-10-21");
    const orphan: Completion = {
      ...(ticked.completions[0] as Completion),
      id: "c-9",
      taskId: "weg",
    };

    const entries = doneEntries([ticked.task], [...ticked.completions, orphan]);

    expect(entries.map((entry) => entry.completion.id)).toEqual(["c-1"]);
  });
});
