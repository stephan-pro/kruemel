import { describe, expect, it } from "vitest";
import { addChecklistItem } from "./checklist";
import type { Completion } from "./task";
import { d, oneOffTask, recurringTask, stateOf, tickOff } from "./task.fixtures";
import {
  completeInData,
  completionCount,
  deleteTask,
  groupOpenTasks,
  setChecklistItemInData,
  takeOverInData,
  undoInData,
} from "./taskManagement";

describe("F1 Aufgabenliste", () => {
  it("F1 Die Liste trennt wiederkehrende und einmalige Aufgaben", () => {
    const groups = groupOpenTasks([oneOffTask({ id: "o" }), recurringTask({ id: "r" })]);

    expect(groups.recurring.map((task) => task.id)).toEqual(["r"]);
    expect(groups.oneOff.map((task) => task.id)).toEqual(["o"]);
  });

  it("F1 Innerhalb einer Gruppe steht die früheste Fälligkeit vorn, bei gleichem Tag nach Titel", () => {
    const groups = groupOpenTasks([
      recurringTask({ id: "spaet", title: "Fenster", dueDate: d("2026-10-30") }),
      recurringTask({ id: "zett", title: "Zimmer", dueDate: d("2026-10-20") }),
      recurringTask({ id: "aepfel", title: "Äpfel", dueDate: d("2026-10-20") }),
      recurringTask({ id: "bad", title: "Bad", dueDate: d("2026-10-20") }),
    ]);

    expect(groups.recurring.map((task) => task.id)).toEqual(["aepfel", "bad", "zett", "spaet"]);
  });

  it("F3 Erledigte einmalige Aufgaben stehen nicht in der Liste, sondern bei „Erledigt“", () => {
    const groups = groupOpenTasks([
      oneOffTask({ id: "offen" }),
      oneOffTask({ id: "fertig", done: true }),
    ]);

    expect(groups.oneOff.map((task) => task.id)).toEqual(["offen"]);
  });

  it("F1 Ohne Aufgaben sind beide Gruppen leer", () => {
    expect(groupOpenTasks([])).toEqual({ recurring: [], oneOff: [] });
  });

  it("F1 Die übergebene Liste wird nicht verändert", () => {
    const tasks = [
      recurringTask({ id: "b", dueDate: d("2026-10-30") }),
      recurringTask({ id: "a", dueDate: d("2026-10-20") }),
    ];

    groupOpenTasks(tasks);

    expect(tasks.map((task) => task.id)).toEqual(["b", "a"]);
  });
});

describe("F1 Aufgaben löschen", () => {
  const task = recurringTask({ id: "bad" });
  const other = recurringTask({ id: "staub", title: "Staubsaugen" });
  const first = tickOff(stateOf(task), "2026-10-19", "c-1");
  const second = tickOff(first, "2026-10-26", "c-2");
  const otherDone = tickOff(stateOf(other), "2026-10-20", "c-3");
  const data = {
    schemaVersion: 1,
    tasks: [second.task, otherDone.task],
    completions: [...second.completions, ...otherDone.completions],
  };

  it("F1 Beim Löschen verschwindet die Aufgabe", () => {
    const result = deleteTask(data, "bad");

    expect(result.tasks.map((t) => t.id)).toEqual(["staub"]);
  });

  it("F3 Beim Löschen verschwinden auch die Erledigungen der Aufgabe, die anderen bleiben", () => {
    const result = deleteTask(data, "bad");

    expect(result.completions.map((c) => c.id)).toEqual(["c-3"]);
  });

  it("F1 Übrige Felder der Daten bleiben unverändert", () => {
    expect(deleteTask(data, "bad").schemaVersion).toBe(1);
  });

  it("F1 Die ursprünglichen Daten bleiben unverändert", () => {
    deleteTask(data, "bad");

    expect(data.tasks).toHaveLength(2);
    expect(data.completions).toHaveLength(3);
  });

  it("F1 Eine unbekannte Aufgabe lässt sich nicht löschen", () => {
    expect(() => deleteTask(data, "gibt-es-nicht")).toThrow(RangeError);
  });

  it("F3 Die Rückfrage kann nennen, wie viele Erledigungen mit verschwinden", () => {
    expect(completionCount(data.completions, "bad")).toBe(2);
    expect(completionCount(data.completions, "staub")).toBe(1);
    expect(completionCount(data.completions, "gibt-es-nicht")).toBe(0);
  });
});

describe("F2 Abhaken und Rückgängig in den Daten", () => {
  const bad = recurringTask({ id: "bad", dueDate: d("2026-10-19") });
  const staub = recurringTask({ id: "staub", title: "Staubsaugen", dueDate: d("2026-10-20") });
  const data = { schemaVersion: 1, tasks: [bad, staub], completions: [] as Completion[] };
  const input = {
    completionId: "c-1",
    completedOn: d("2026-10-21"),
    completedBy: "personB",
  } as const;

  it("F2 Das Abhaken ändert nur die Aufgabe und hängt die Erledigung an", () => {
    const result = completeInData(data, "bad", input);

    expect(result.data.tasks.map((task) => [task.id, task.dueDate])).toEqual([
      ["bad", "2026-10-28"],
      ["staub", "2026-10-20"],
    ]);
    expect(result.data.completions).toEqual([result.completion]);
    expect(result.completion).toMatchObject({
      id: "c-1",
      taskId: "bad",
      completedBy: "personB",
      previousDueDate: "2026-10-19",
      nextDueDate: "2026-10-28",
    });
    expect(result.task).toBe(result.data.tasks[0]);
  });

  it("F2 Das Abhaken lässt die ursprünglichen Daten unverändert und die übrigen Felder stehen", () => {
    const result = completeInData(data, "bad", input);

    expect(data.completions).toHaveLength(0);
    expect(data.tasks[0]).toBe(bad);
    expect(result.data.schemaVersion).toBe(1);
  });

  it("F2 Eine unbekannte Aufgabe lässt sich nicht abhaken", () => {
    expect(() => completeInData(data, "gibt-es-nicht", input)).toThrow(RangeError);
  });

  it("F2 Rückgängig stellt den vorherigen Termin wieder her und entfernt die Erledigung", () => {
    const ticked = completeInData(data, "bad", input).data;

    const result = undoInData(ticked, "c-1");

    expect(result.data.tasks).toEqual(data.tasks);
    expect(result.data.completions).toEqual([]);
    expect(result.task).toEqual(bad);
  });

  it("F2 Rückgängig gilt nur für das letzte Abhaken einer Aufgabe", () => {
    const first = completeInData(data, "bad", input).data;
    const second = completeInData(first, "bad", {
      ...input,
      completionId: "c-2",
      completedOn: d("2026-10-22"),
    }).data;

    expect(() => undoInData(second, "c-1")).toThrow(RangeError);
    expect(undoInData(second, "c-2").data.completions.map((c) => c.id)).toEqual(["c-1"]);
  });

  it("F2 Rückgängig lässt die Erledigungen anderer Aufgaben stehen", () => {
    const first = completeInData(data, "staub", { ...input, completionId: "c-s" }).data;
    const second = completeInData(first, "bad", input).data;

    const result = undoInData(second, "c-1");

    expect(result.data.completions.map((c) => c.id)).toEqual(["c-s"]);
  });

  it("F2 Eine unbekannte Erledigung lässt sich nicht rückgängig machen", () => {
    expect(() => undoInData(data, "gibt-es-nicht")).toThrow(RangeError);
  });
});

describe("F5 Übernehmen in den Daten", () => {
  const bad = recurringTask({ id: "bad", assignee: "personA" });
  const paket = oneOffTask({ id: "paket", assignee: "personA" });
  const data = { schemaVersion: 2, tasks: [bad, paket], completions: [] as Completion[] };

  it("F5 „Nur dieses Mal“ setzt die Übernahme und lässt die feste Zuständigkeit stehen", () => {
    const result = takeOverInData(data, "bad", "personB", "once");

    expect(result.task).toMatchObject({ assignee: "personA", takenOverBy: "personB" });
    expect(result.data.tasks[0]).toBe(result.task);
    expect(result.data.tasks[1]).toBe(paket);
  });

  it("F5 „Dauerhaft“ macht die Person zur festen Zuständigen", () => {
    const result = takeOverInData(data, "bad", "personB", "permanently");

    expect(result.task).toMatchObject({ assignee: "personB" });
    expect("takenOverBy" in result.task).toBe(false);
  });

  it("F5 Eine einmalige Aufgabe wird ohne Rückfrage umgewiesen, gleich welche Art gewählt ist", () => {
    const result = takeOverInData(data, "paket", "personB", "once");

    expect(result.task).toMatchObject({ kind: "oneOff", assignee: "personB" });
    expect(result.data.tasks[1]).toBe(result.task);
  });

  it("F5 Übernehmen lässt Erledigungen und übrige Felder der Daten unverändert", () => {
    const done = tickOff(stateOf(bad), "2026-10-19", "c-1");
    const withCompletion = { ...data, tasks: [done.task, paket], completions: done.completions };

    const result = takeOverInData(withCompletion, "bad", "personB", "once");

    expect(result.data.completions).toBe(done.completions);
    expect(result.data.schemaVersion).toBe(2);
    expect(data.tasks[0]).toBe(bad);
  });

  it("F5 Eine unbekannte Aufgabe lässt sich nicht übernehmen", () => {
    expect(() => takeOverInData(data, "gibt-es-nicht", "personB", "once")).toThrow(RangeError);
  });
});

describe("F4 Checkliste abhaken in den Daten", () => {
  const withItems = addChecklistItem(
    addChecklistItem(recurringTask({ id: "bad" }), { id: "i-1", text: "Waschbecken" }),
    { id: "i-2", text: "Dusche" },
  );
  const other = oneOffTask({ id: "paket" });
  const data = { schemaVersion: 2, tasks: [withItems, other], completions: [] as Completion[] };

  it("F4 Ein Eintrag lässt sich abhaken und wieder abwählen; die anderen bleiben", () => {
    const ticked = setChecklistItemInData(data, "bad", "i-2", true);

    expect(ticked.task.checklist.map((item) => item.checked)).toEqual([false, true]);
    expect(ticked.data.tasks[0]).toBe(ticked.task);
    expect(ticked.data.tasks[1]).toBe(other);

    const unticked = setChecklistItemInData(ticked.data, "bad", "i-2", false);
    expect(unticked.task.checklist.map((item) => item.checked)).toEqual([false, false]);
  });

  it("F4 Die ursprünglichen Daten bleiben unverändert", () => {
    setChecklistItemInData(data, "bad", "i-1", true);

    expect(data.tasks[0]?.checklist.every((item) => !item.checked)).toBe(true);
  });

  it("F4 Eine unbekannte Aufgabe oder ein unbekannter Eintrag lässt sich nicht abhaken", () => {
    expect(() => setChecklistItemInData(data, "gibt-es-nicht", "i-1", true)).toThrow(RangeError);
    expect(() => setChecklistItemInData(data, "bad", "gibt-es-nicht", true)).toThrow(RangeError);
  });
});
