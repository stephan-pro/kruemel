import { describe, expect, it } from "vitest";
import { doneEntries } from "./done";
import {
  canUndoCompletion,
  createOneOffTask,
  createRecurringTask,
  isOpen,
  openTasks,
  undoCompletion,
} from "./task";
import { d, oneOffTask, recurringTask, stateOf, tickOff } from "./task.fixtures";

describe("F3 Einmalige Aufgaben", () => {
  it("Eine einmalige Aufgabe hat Titel, Fälligkeitsdatum, zuständige Person und Notiz", () => {
    const task = createOneOffTask({
      id: "t-1",
      title: "  Paket abholen ",
      dueDate: d("2026-10-22"),
      assignee: "personB",
      note: " Postfiliale, Ausweis mitnehmen ",
    });

    expect(task).toEqual({
      kind: "oneOff",
      id: "t-1",
      title: "Paket abholen",
      symbol: "standard",
      dueDate: "2026-10-22",
      assignee: "personB",
      note: "Postfiliale, Ausweis mitnehmen",
      done: false,
      checklist: [],
    });
  });

  it("Die Notiz einer einmaligen Aufgabe ist optional", () => {
    const withoutNote = createOneOffTask({
      id: "t-1",
      title: "Müll rausbringen",
      dueDate: d("2026-10-22"),
      assignee: "both",
    });
    const blankNote = createOneOffTask({
      id: "t-2",
      title: "Müll rausbringen",
      dueDate: d("2026-10-22"),
      assignee: "both",
      note: "   ",
    });

    expect(withoutNote).not.toHaveProperty("note");
    expect(blankNote).not.toHaveProperty("note");
  });

  it("Eine Aufgabe ohne Titel oder mit ungültiger Zuständigkeit wird abgelehnt", () => {
    const valid = {
      id: "t-1",
      title: "Einkaufen",
      dueDate: d("2026-10-22"),
      assignee: "both",
    } as const;

    expect(() => createOneOffTask({ ...valid, title: "   " })).toThrow(RangeError);
    expect(() => createOneOffTask({ ...valid, assignee: "nobody" as unknown as "both" })).toThrow(
      RangeError,
    );
  });

  it("Nach dem Abhaken verschwindet eine einmalige Aufgabe aus der Wochenübersicht", () => {
    const open = oneOffTask();
    const recurring = recurringTask();
    expect(openTasks([open, recurring]).map((task) => task.id)).toEqual([open.id, recurring.id]);

    const ticked = tickOff(stateOf(open), "2026-10-21");

    expect(isOpen(ticked.task)).toBe(false);
    expect(openTasks([ticked.task, recurring]).map((task) => task.id)).toEqual([recurring.id]);
  });

  it("Nach dem Abhaken landet eine einmalige Aufgabe bei „Erledigt“", () => {
    const ticked = tickOff(stateOf(oneOffTask()), "2026-10-21", "c-1", "personB");

    const entries = doneEntries([ticked.task], ticked.completions);

    expect(entries).toHaveLength(1);
    expect(entries[0]?.task.id).toBe("task-2");
    expect(entries[0]?.completion).toMatchObject({
      completedOn: "2026-10-21",
      completedBy: "personB",
    });
  });

  it("Eine einmalige Aufgabe bekommt nach dem Abhaken keinen neuen Termin", () => {
    const ticked = tickOff(stateOf(oneOffTask({ dueDate: d("2026-10-22") })), "2026-10-21");

    expect(ticked.task.dueDate).toBe("2026-10-22");
    expect(ticked.completions[0]).not.toHaveProperty("nextDueDate");
  });

  it("Eine bereits erledigte einmalige Aufgabe lässt sich nicht noch einmal abhaken", () => {
    const ticked = tickOff(stateOf(oneOffTask()), "2026-10-21");

    expect(() => tickOff(ticked, "2026-10-22", "c-2")).toThrow(RangeError);
  });

  it("Rückgängig macht eine erledigte einmalige Aufgabe wieder offen", () => {
    const before = stateOf(oneOffTask());
    const ticked = tickOff(before, "2026-10-21");
    expect(canUndoCompletion(ticked, "c-1")).toBe(true);

    const restored = undoCompletion(ticked, "c-1");

    expect(isOpen(restored.task)).toBe(true);
    expect(restored).toEqual(before);
  });

  it("(Entscheidung F3) Eine wiederkehrende Aufgabe bleibt nach dem Abhaken in der Wochenübersicht", () => {
    const ticked = tickOff(stateOf(recurringTask()), "2026-10-21");

    expect(isOpen(ticked.task)).toBe(true);
    expect(openTasks([ticked.task])).toEqual([ticked.task]);
  });
});

describe("F1 Wiederkehrende Aufgaben anlegen", () => {
  it("(Entscheidung F1) Der erste Fälligkeitstermin ist der gewählte, nicht heute und nicht berechnet", () => {
    const task = createRecurringTask({
      id: "t-1",
      title: "Fenster putzen",
      recurrence: { unit: "month", interval: 3 },
      assignee: "personA",
      dueDate: d("2026-12-05"),
    });

    expect(task.dueDate).toBe("2026-12-05");
    expect(task).toMatchObject({ kind: "recurring", checklist: [] });
    expect(task).not.toHaveProperty("note");
  });

  it("Ein ungültiger Rhythmus oder ein leerer Titel wird abgelehnt", () => {
    const valid = {
      id: "t-1",
      title: "Fenster putzen",
      recurrence: { unit: "week", interval: 1 },
      assignee: "personA",
      dueDate: d("2026-12-05"),
    } as const;

    expect(() =>
      createRecurringTask({ ...valid, recurrence: { unit: "week", interval: 0 } }),
    ).toThrow(RangeError);
    expect(() => createRecurringTask({ ...valid, title: "" })).toThrow(RangeError);
  });
});

describe("F8 Symbol beim Anlegen", () => {
  const recurring = {
    id: "t-1",
    title: "Bad putzen",
    recurrence: { unit: "week", interval: 1 },
    assignee: "personA",
    dueDate: d("2026-10-22"),
  } as const;

  it("F8 Eine Aufgabe ohne gewähltes Symbol bekommt das Standardsymbol", () => {
    expect(createRecurringTask(recurring).symbol).toBe("standard");
    expect(createOneOffTask({ ...recurring, title: "Paket abholen" }).symbol).toBe("standard");
  });

  it("F8 Eine Aufgabe trägt das gewählte Symbol", () => {
    expect(createRecurringTask({ ...recurring, symbol: "bath" }).symbol).toBe("bath");
    expect(createOneOffTask({ ...recurring, symbol: "parcel" }).symbol).toBe("parcel");
  });

  it("F8 Ein unbekanntes Symbol wird abgelehnt", () => {
    expect(() =>
      createRecurringTask({ ...recurring, symbol: "rocket" as unknown as "bath" }),
    ).toThrow(RangeError);
  });
});
