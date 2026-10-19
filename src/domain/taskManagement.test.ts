import { describe, expect, it } from "vitest";
import { d, oneOffTask, recurringTask, stateOf, tickOff } from "./task.fixtures";
import { completionCount, deleteTask, groupOpenTasks } from "./taskManagement";

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
