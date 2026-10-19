import { describe, expect, it } from "vitest";
import { calendarDay, weekdayOf } from "./date";
import {
  canUndoCompletion,
  completeTask,
  isRecurrence,
  lastCompletion,
  nextDueDate,
  type Recurrence,
  type RecurringTask,
  type TaskState,
  undoCompletion,
} from "./task";

const d = calendarDay;

function stateOf(recurrence: Recurrence, dueDate: string): TaskState {
  const task: RecurringTask = {
    kind: "recurring",
    checklist: [],
    id: "task-1",
    title: "Bad putzen",
    symbol: "standard",
    recurrence,
    assignee: "personA",
    dueDate: d(dueDate),
  };
  return { task, completions: [] };
}

function tickOff(state: TaskState, completedOn: string, completionId = "c-1"): TaskState {
  return completeTask(state, { completionId, completedOn: d(completedOn), completedBy: "personA" });
}

describe("F2 Nächster Termin – der Zyklus startet beim Abhaken", () => {
  it("Wöchentlich, fällig Mo 19.10., abgehakt Mi 21.10. → neu fällig Mi 28.10.", () => {
    expect(weekdayOf(d("2026-10-19"))).toBe(0);
    expect(weekdayOf(d("2026-10-21"))).toBe(2);

    const result = tickOff(stateOf({ unit: "week", interval: 1 }, "2026-10-19"), "2026-10-21");

    expect(result.task.dueDate).toBe("2026-10-28");
    expect(weekdayOf(result.task.dueDate)).toBe(2);
  });

  it("Täglich, abgehakt am 21.10. → neu fällig 22.10.", () => {
    const result = tickOff(stateOf({ unit: "day", interval: 1 }, "2026-10-21"), "2026-10-21");

    expect(result.task.dueDate).toBe("2026-10-22");
  });

  it("Alle 2 Wochen, abgehakt am 21.10. → neu fällig 04.11.", () => {
    const result = tickOff(stateOf({ unit: "week", interval: 2 }, "2026-10-21"), "2026-10-21");

    expect(result.task.dueDate).toBe("2026-11-04");
  });

  it("Monatlich, abgehakt am 15.10. → neu fällig 15.11.", () => {
    const result = tickOff(stateOf({ unit: "month", interval: 1 }, "2026-10-15"), "2026-10-15");

    expect(result.task.dueDate).toBe("2026-11-15");
  });

  it("Monatlich, abgehakt am 31.01. → neu fällig am letzten Tag des Folgemonats (28.02.)", () => {
    const result = tickOff(stateOf({ unit: "month", interval: 1 }, "2026-01-31"), "2026-01-31");

    expect(result.task.dueDate).toBe("2026-02-28");
  });

  it("Monatlich, abgehakt am 31.01. → neu fällig am letzten Tag des Folgemonats (29.02. im Schaltjahr)", () => {
    const result = tickOff(stateOf({ unit: "month", interval: 1 }, "2028-01-31"), "2028-01-31");

    expect(result.task.dueDate).toBe("2028-02-29");
  });

  it("Überfällige Aufgabe, verspätet abgehakt → neuer Zyklus startet am Tag des Abhakens", () => {
    // Due 05.10., ticked off 3 weeks late on 26.10.: the next date counts from 26.10., not from 05.10.
    const weekly = tickOff(stateOf({ unit: "week", interval: 1 }, "2026-10-05"), "2026-10-26");
    const daily = tickOff(stateOf({ unit: "day", interval: 3 }, "2026-10-05"), "2026-10-26");
    const monthly = tickOff(stateOf({ unit: "month", interval: 1 }, "2026-08-10"), "2026-10-26");

    expect(weekly.task.dueDate).toBe("2026-11-02");
    expect(daily.task.dueDate).toBe("2026-10-29");
    expect(monthly.task.dueDate).toBe("2026-11-26");
  });

  it("Versehentliches Abhaken lässt sich rückgängig machen; der vorherige Termin wird wiederhergestellt", () => {
    const before = stateOf({ unit: "week", interval: 1 }, "2026-10-19");
    const ticked = tickOff(before, "2026-10-21");
    expect(ticked.task.dueDate).toBe("2026-10-28");

    const restored = undoCompletion(ticked, "c-1");

    expect(restored.task.dueDate).toBe("2026-10-19");
    expect(restored.completions).toEqual([]);
    expect(restored).toEqual(before);
  });

  it("Rückgängig ist nur für das letzte Abhaken einer Aufgabe möglich", () => {
    const first = tickOff(
      stateOf({ unit: "week", interval: 1 }, "2026-10-19"),
      "2026-10-21",
      "c-1",
    );
    const second = tickOff(first, "2026-10-28", "c-2");

    expect(canUndoCompletion(second, "c-1")).toBe(false);
    expect(canUndoCompletion(second, "c-2")).toBe(true);
    expect(() => undoCompletion(second, "c-1")).toThrow(RangeError);

    // After taking back the last one, the one before becomes the last.
    const afterUndo = undoCompletion(second, "c-2");
    expect(afterUndo.task.dueDate).toBe("2026-10-28");
    expect(lastCompletion(afterUndo)?.id).toBe("c-1");
    expect(canUndoCompletion(afterUndo, "c-1")).toBe(true);
  });
});

describe("Abhaken hält fest, wer es wann erledigt hat", () => {
  it("speichert Abhaktag, erledigt von sowie vorherigen und neuen Termin", () => {
    const result = completeTask(stateOf({ unit: "week", interval: 1 }, "2026-10-19"), {
      completionId: "c-1",
      completedOn: d("2026-10-21"),
      completedBy: "personB",
    });

    expect(result.completions).toEqual([
      {
        id: "c-1",
        taskId: "task-1",
        completedOn: "2026-10-21",
        completedBy: "personB",
        previousDueDate: "2026-10-19",
        nextDueDate: "2026-10-28",
        checkedItemIds: [],
      },
    ]);
  });

  it("verändert den übergebenen Zustand nicht", () => {
    const before = stateOf({ unit: "day", interval: 1 }, "2026-10-19");
    tickOff(before, "2026-10-19");

    expect(before.task.dueDate).toBe("2026-10-19");
    expect(before.completions).toEqual([]);
  });

  it("lastCompletion kennt nur Abhakungen der eigenen Aufgabe", () => {
    const ticked = tickOff(stateOf({ unit: "day", interval: 1 }, "2026-10-19"), "2026-10-19");
    const other = { ...ticked, task: { ...ticked.task, id: "task-2" } };

    expect(lastCompletion(other)).toBeUndefined();
    expect(canUndoCompletion(other, "c-1")).toBe(false);
    expect(() => undoCompletion(other, "c-1")).toThrow(RangeError);
  });
});

describe("Rhythmus prüfen", () => {
  it("akzeptiert Tag, Woche und Monat mit ganzer Zahl ab 1", () => {
    expect(isRecurrence({ unit: "day", interval: 1 })).toBe(true);
    expect(isRecurrence({ unit: "week", interval: 2 })).toBe(true);
    expect(isRecurrence({ unit: "month", interval: 12 })).toBe(true);
  });

  it("lehnt unbekannte Einheiten und unzulässige Zahlen ab", () => {
    expect(isRecurrence({ unit: "year", interval: 1 })).toBe(false);
    expect(isRecurrence({ unit: "week", interval: 0 })).toBe(false);
    expect(isRecurrence({ unit: "week", interval: -1 })).toBe(false);
    expect(isRecurrence({ unit: "week", interval: 1.5 })).toBe(false);
    expect(isRecurrence({ unit: "week", interval: "2" })).toBe(false);
    expect(isRecurrence({ unit: "week" })).toBe(false);
    expect(isRecurrence(null)).toBe(false);
    expect(isRecurrence("week")).toBe(false);
  });

  it("nextDueDate weist einen ungültigen Rhythmus ab", () => {
    expect(() => nextDueDate({ unit: "week", interval: 0 }, d("2026-10-21"))).toThrow(RangeError);
  });
});
