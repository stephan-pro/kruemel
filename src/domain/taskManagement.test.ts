import { describe, expect, it } from "vitest";
import type { Completion } from "./task";
import { d, oneOffTask, recurringTask, stateOf, tickOff } from "./task.fixtures";
import {
  completeInData,
  completionCount,
  deleteTask,
  groupOpenTasks,
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
