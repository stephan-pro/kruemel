import { describe, expect, it } from "vitest";
import type { Task } from "../domain/task";
import {
  applyChange,
  applyPatch,
  type ChangeBody,
  diffData,
  isDeepEqual,
  isEmptyPatch,
  taskPatch,
} from "./changes";
import { completion, dataWith, once, weekly } from "./sync.fixtures";

describe("Sync: Vergleich von Daten", () => {
  it("isDeepEqual vergleicht Objekte, Listen und einfache Werte", () => {
    expect(isDeepEqual(1, 1)).toBe(true);
    expect(isDeepEqual("a", "b")).toBe(false);
    expect(isDeepEqual(null, {})).toBe(false);
    expect(isDeepEqual({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
    expect(isDeepEqual({ a: [1, 2] }, { a: [1, 3] })).toBe(false);
    expect(isDeepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(isDeepEqual({ a: 1, b: 1 }, { a: 1, c: 1 })).toBe(false);
    expect(isDeepEqual([1], { 0: 1 })).toBe(false);
    expect(isDeepEqual([1, 2], [1])).toBe(false);
  });

  it("taskPatch nennt geänderte und neue Felder, entfernte Felder stehen unter unset", () => {
    const before = weekly({ note: "alt", title: "Bad" });
    const after = { ...weekly({ title: "Badezimmer" }), takenOverBy: "personB" as const };

    const patch = taskPatch(before, after);

    expect(patch.set).toEqual({ title: "Badezimmer", takenOverBy: "personB" });
    expect(patch.unset).toEqual(["note"]);
  });

  it("taskPatch einer unveränderten Aufgabe ist leer", () => {
    expect(isEmptyPatch(taskPatch(weekly(), weekly()))).toBe(true);
    expect(isEmptyPatch({ set: { a: 1 }, unset: [] })).toBe(false);
    expect(isEmptyPatch({ set: {}, unset: ["a"] })).toBe(false);
  });

  it("applyPatch setzt und entfernt Felder und lässt die übrigen stehen", () => {
    const task = weekly({ note: "alt" });

    const result = applyPatch(task, { set: { title: "Neu" }, unset: ["note"] });

    expect(result).toEqual({ ...weekly(), title: "Neu" });
    expect(task.note).toBe("alt");
  });
});

describe("Sync: Änderungen aus Daten ableiten (diffData)", () => {
  const base = dataWith([weekly(), once()]);

  it("Unveränderte Daten ergeben keine Änderung", () => {
    expect(diffData(base, structuredClone(base))).toEqual([]);
  });

  it("Neue Namen werden eine Änderung, gleiche Namen nicht", () => {
    const names = { personA: "Alex", personB: "Sam" };

    expect(diffData(base, { ...base, settings: { personNames: names } })).toEqual([
      { type: "setNames", names },
    ]);
    expect(diffData({ ...base, settings: {} }, { ...base, settings: {} })).toEqual([]);
  });

  it("Eine neue Aufgabe wird mit allen Feldern angelegt", () => {
    const added = weekly({ id: "t-neu", title: "Fenster" });

    const changes = diffData(base, { ...base, tasks: [...base.tasks, added] });

    expect(changes).toEqual([
      { type: "saveTask", taskId: "t-neu", create: added, patch: { set: { ...added }, unset: [] } },
    ]);
  });

  it("Bearbeiten schickt nur die geänderten Felder", () => {
    const edited = base.tasks.map((task) =>
      task.id === "t-bad" ? { ...task, title: "Badezimmer" } : task,
    );

    expect(diffData(base, { ...base, tasks: edited })).toEqual([
      { type: "saveTask", taskId: "t-bad", patch: { set: { title: "Badezimmer" }, unset: [] } },
    ]);
  });

  it("Eine entfernte Notiz wird als entferntes Feld geschickt", () => {
    const before = dataWith([weekly({ note: "x" })]);

    expect(diffData(before, dataWith([weekly()]))).toEqual([
      { type: "saveTask", taskId: "t-bad", patch: { set: {}, unset: ["note"] } },
    ]);
  });

  it("Die Checkliste zählt als ein Feld", () => {
    const before = dataWith([weekly({ checklist: [{ id: "i-1", text: "A", checked: false }] })]);
    const after = dataWith([
      weekly({
        checklist: [
          { id: "i-1", text: "A", checked: true },
          { id: "i-2", text: "B", checked: false },
        ],
      }),
    ]);

    const [change] = diffData(before, after);

    expect(change).toMatchObject({ type: "saveTask", taskId: "t-bad" });
    expect(Object.keys((change as { patch: { set: object } }).patch.set)).toEqual(["checklist"]);
  });

  it("Eine entfernte Aufgabe wird gelöscht; ihre Erledigungen kommen nicht einzeln vor", () => {
    const before = dataWith([weekly(), once()], [completion()]);
    const after = dataWith([once()]);

    expect(diffData(before, after)).toEqual([{ type: "deleteTask", taskId: "t-bad" }]);
  });

  it("Abhaken: die Erledigung trägt die Änderung der Aufgabe mit, es gibt keine zweite Änderung", () => {
    const done = completion();
    const ticked = weekly({ dueDate: done.nextDueDate as typeof done.previousDueDate });

    const changes = diffData(dataWith([weekly()]), dataWith([ticked], [done]));

    expect(changes).toEqual([
      {
        type: "complete",
        completion: done,
        patch: { set: { dueDate: done.nextDueDate }, unset: [] },
      },
    ]);
  });

  it("Rückgängig: die Änderung der Aufgabe reist mit, die Erledigung wird entfernt", () => {
    const done = completion();
    const ticked = weekly({ dueDate: done.nextDueDate as typeof done.previousDueDate });

    const changes = diffData(dataWith([ticked], [done]), dataWith([weekly()]));

    expect(changes).toEqual([
      { type: "undo", completionId: "c-1", patch: { set: { dueDate: "2026-10-19" }, unset: [] } },
    ]);
  });

  it("Eine neue Aufgabe, die gleich abgehakt wird, wird angelegt und dann abgehakt", () => {
    const done = completion();
    const ticked = weekly({ dueDate: done.nextDueDate as typeof done.previousDueDate });

    const changes = diffData(dataWith([]), dataWith([ticked], [done]));

    expect(changes.map((change) => change.type)).toEqual(["saveTask", "complete"]);
    expect(changes[1]).toMatchObject({ patch: { set: {}, unset: [] } });
  });

  it("Mehrere Rückgängig-Schritte kommen neueste zuerst und die Änderung der Aufgabe steht beim letzten", () => {
    const first = completion({ id: "c-1" });
    const second = completion({
      id: "c-2",
      previousDueDate: "2026-10-28" as typeof first.previousDueDate,
    });
    const before = dataWith([weekly({ dueDate: "2026-11-04" as never })], [first, second]);
    const after = dataWith([weekly()]);

    const changes = diffData(before, after);

    expect(changes.map((change) => (change as { completionId: string }).completionId)).toEqual([
      "c-2",
      "c-1",
    ]);
    expect(changes[0]).toMatchObject({ patch: { set: {}, unset: [] } });
    expect(changes[1]).toMatchObject({ patch: { set: { dueDate: "2026-10-19" } } });
  });

  it("Rückgängig und Abhaken in einem Schritt: erst Rückgängig, dann Abhaken", () => {
    const first = completion({ id: "c-1" });
    const again = completion({ id: "c-9" });

    const changes = diffData(dataWith([weekly()], [first]), dataWith([weekly()], [again]));

    expect(changes.map((change) => change.type)).toEqual(["undo", "complete"]);
  });

  it("Eine geänderte Erledigung bei gleicher Kennung erzeugt nichts, ebenso eine Erledigung ohne Aufgabe", () => {
    const changed = completion({ completedBy: "personB" });

    expect(diffData(dataWith([weekly()], [completion()]), dataWith([weekly()], [changed]))).toEqual(
      [],
    );
    expect(diffData(dataWith([]), dataWith([], [completion()]))).toEqual([]);
  });

  it("Reihenfolge: Namen, Löschungen, dann je Aufgabe", () => {
    const before = dataWith([weekly(), once()]);
    const after = {
      ...dataWith([once({ title: "Anders" })]),
      settings: { personNames: { personA: "A", personB: "B" } },
    };

    expect(diffData(before, after).map((change) => change.type)).toEqual([
      "setNames",
      "deleteTask",
      "saveTask",
    ]);
  });
});

describe("Sync: Änderung ausführen (applyChange)", () => {
  const tick = (id = "c-1", at = "2026-10-19"): ChangeBody => ({
    type: "complete",
    completion: completion({ id, previousDueDate: at as never }),
    patch: { set: { dueDate: "2026-10-28" }, unset: [] },
  });

  it("setNames setzt die Namen", () => {
    const { data, result } = applyChange(dataWith([]), {
      type: "setNames",
      names: { personA: "X", personB: "Y" },
    });

    expect(result).toEqual({ status: "applied" });
    expect(data.settings.personNames).toEqual({ personA: "X", personB: "Y" });
  });

  it("saveTask legt eine neue Aufgabe an, wenn sie dabei geschickt wird", () => {
    const created = weekly();

    const { data } = applyChange(dataWith([]), {
      type: "saveTask",
      taskId: created.id,
      patch: { set: { ...created }, unset: [] },
      create: created,
    });

    expect(data.tasks).toEqual([created]);
  });

  it("Konflikt: Eine Bearbeitung bringt keine gelöschte Aufgabe zurück", () => {
    const created = weekly();
    const change: ChangeBody = {
      type: "saveTask",
      taskId: created.id,
      patch: { set: { title: "x" }, unset: [] },
    };

    expect(applyChange(dataWith([]), change).result).toEqual({
      status: "rejected",
      reason: "taskGone",
    });
    expect(
      applyChange(dataWith([]), { ...change, create: created }, new Set([created.id])).result,
    ).toEqual({ status: "rejected", reason: "taskGone" });
  });

  it("saveTask ändert nur die genannten Felder", () => {
    const { data } = applyChange(dataWith([weekly()]), {
      type: "saveTask",
      taskId: "t-bad",
      patch: { set: { title: "Neu" }, unset: [] },
    });

    expect(data.tasks[0]).toEqual({ ...weekly(), title: "Neu" });
  });

  it("deleteTask entfernt Aufgabe und Erledigungen, und noch einmal schadet nicht", () => {
    const start = dataWith([weekly(), once()], [completion()]);

    const first = applyChange(start, { type: "deleteTask", taskId: "t-bad" });
    const second = applyChange(first.data, { type: "deleteTask", taskId: "t-bad" });

    expect(first.data.tasks.map((task) => task.id)).toEqual(["t-paket"]);
    expect(first.data.completions).toEqual([]);
    expect(second.result).toEqual({ status: "applied" });
    expect(second.data).toEqual(first.data);
  });

  it("complete hakt ab: Erledigung dazu, Aufgabe nach Patch", () => {
    const { data, result } = applyChange(dataWith([weekly()]), tick());

    expect(result).toEqual({ status: "applied" });
    expect(data.completions.map((c) => c.id)).toEqual(["c-1"]);
    expect((data.tasks[0] as Task).dueDate).toBe("2026-10-28");
  });

  it("Konflikt: Gleichzeitiges Abhaken zählt einmal – das zweite wird mit dem Namen des ersten abgelehnt", () => {
    const first = applyChange(dataWith([weekly()]), tick("c-1")).data;

    const second = applyChange(first, {
      type: "complete",
      completion: completion({ id: "c-2", completedBy: "personB" }),
      patch: { set: { dueDate: "2026-10-28" }, unset: [] },
    });

    expect(second.result).toEqual({ status: "rejected", reason: "alreadyDone", by: "personA" });
    expect(second.data).toBe(first);
    expect(second.data.completions).toHaveLength(1);
  });

  it("Dieselbe Erledigung noch einmal zugestellt ändert nichts und gilt als angenommen", () => {
    const first = applyChange(dataWith([weekly()]), tick("c-1")).data;

    const again = applyChange(first, tick("c-1"));

    expect(again.result).toEqual({ status: "applied" });
    expect(again.data).toBe(first);
  });

  it("Abhaken einer fehlenden Aufgabe wird abgelehnt", () => {
    expect(applyChange(dataWith([]), tick()).result).toEqual({
      status: "rejected",
      reason: "taskGone",
    });
  });

  it("Nach Rückgängig lässt sich derselbe Durchgang wieder abhaken", () => {
    const ticked = applyChange(dataWith([weekly()]), tick("c-1")).data;
    const undone = applyChange(ticked, {
      type: "undo",
      completionId: "c-1",
      patch: { set: { dueDate: "2026-10-19" }, unset: [] },
    }).data;

    const again = applyChange(undone, tick("c-2"));

    expect(again.result).toEqual({ status: "applied" });
    expect(again.data.completions.map((c) => c.id)).toEqual(["c-2"]);
  });

  it("undo nimmt die letzte Erledigung zurück und gibt der Aufgabe ihren Zustand", () => {
    const ticked = applyChange(dataWith([weekly()]), tick("c-1")).data;

    const { data, result } = applyChange(ticked, {
      type: "undo",
      completionId: "c-1",
      patch: { set: { dueDate: "2026-10-19" }, unset: [] },
    });

    expect(result).toEqual({ status: "applied" });
    expect(data.completions).toEqual([]);
    expect((data.tasks[0] as Task).dueDate).toBe("2026-10-19");
  });

  it("Konflikt: Rückgängig geht nur für die letzte Erledigung der Aufgabe", () => {
    const one = applyChange(dataWith([weekly()]), tick("c-1", "2026-10-19")).data;
    const two = applyChange(one, tick("c-2", "2026-10-28")).data;

    const { data, result } = applyChange(two, {
      type: "undo",
      completionId: "c-1",
      patch: { set: {}, unset: [] },
    });

    expect(result).toEqual({ status: "rejected", reason: "notLast" });
    expect(data).toBe(two);
  });

  it("Rückgängig einer Erledigung, die es nicht mehr gibt, wird abgelehnt", () => {
    expect(
      applyChange(dataWith([weekly()]), {
        type: "undo",
        completionId: "c-x",
        patch: { set: {}, unset: [] },
      }).result,
    ).toEqual({ status: "rejected", reason: "completionGone" });
  });

  it("Rückgängig bei einer Erledigung ohne Aufgabe entfernt nur die Erledigung", () => {
    const { data } = applyChange(dataWith([], [completion()]), {
      type: "undo",
      completionId: "c-1",
      patch: { set: {}, unset: [] },
    });

    expect(data.completions).toEqual([]);
  });

  it("replaceAll ersetzt alles", () => {
    const replacement = dataWith([once()]);

    expect(applyChange(dataWith([weekly()]), { type: "replaceAll", data: replacement }).data).toBe(
      replacement,
    );
  });
});
