import { describe, expect, it } from "vitest";
import type { AppData } from "../storage/appData";
import type { Change } from "./changes";
import { mergeDelta, viewOf } from "./merge";
import type { PullResult } from "./remote";
import { completion, dataWith, once, weekly } from "./sync.fixtures";

function delta(parts: Partial<PullResult> = {}): PullResult {
  return { cursor: "1", tasks: [], completions: [], ...parts };
}

const live = (task: ReturnType<typeof weekly> | ReturnType<typeof once>) => ({
  id: task.id,
  schemaVersion: 3,
  deleted: false,
  task,
});

describe("Sync: Serverstand zusammenführen (mergeDelta)", () => {
  it("Neue Zeilen kommen dazu, geänderte ersetzen, alte bleiben an ihrem Platz", () => {
    const base = dataWith([weekly(), once()]);

    const merged = mergeDelta(
      base,
      delta({ tasks: [live(weekly({ title: "Neu" })), live(weekly({ id: "t-3" }))] }),
    );

    expect(merged.tasks.map((task) => [task.id, task.title])).toEqual([
      ["t-bad", "Neu"],
      ["t-paket", "Paket abholen"],
      ["t-3", "Bad putzen"],
    ]);
  });

  it("Gelöschte Zeilen entfernen Aufgabe und Erledigungen", () => {
    const base = dataWith([weekly(), once()], [completion()]);

    const merged = mergeDelta(
      base,
      delta({ tasks: [{ id: "t-bad", schemaVersion: 3, deleted: true }] }),
    );

    expect(merged.tasks.map((task) => task.id)).toEqual(["t-paket"]);
    expect(merged.completions).toEqual([]);
  });

  it("Gelöschte Erledigungen werden entfernt, neue hängen hinten an", () => {
    const base = dataWith([weekly()], [completion({ id: "c-1" })]);

    const merged = mergeDelta(
      base,
      delta({
        completions: [
          { id: "c-1", taskId: "t-bad", schemaVersion: 3, deleted: true },
          {
            id: "c-2",
            taskId: "t-bad",
            schemaVersion: 3,
            deleted: false,
            completion: completion({ id: "c-2" }),
          },
        ],
      }),
    );

    expect(merged.completions.map((c) => c.id)).toEqual(["c-2"]);
  });

  it("Eine Zeile ohne Inhalt gilt als gelöscht", () => {
    const merged = mergeDelta(
      dataWith([weekly()]),
      delta({ tasks: [{ id: "t-bad", schemaVersion: 3, deleted: false }] }),
    );

    expect(merged.tasks).toEqual([]);
  });

  it("Die Einstellungen kommen mit, wenn sie sich geändert haben, sonst bleiben sie", () => {
    const base = dataWith([]);

    expect(mergeDelta(base, delta()).settings).toBe(base.settings);
    expect(
      mergeDelta(base, delta({ settings: { personNames: { personA: "A", personB: "B" } } }))
        .settings,
    ).toEqual({ personNames: { personA: "A", personB: "B" } });
  });

  it("Dieselben Zeilen zweimal (überlappender Abruf) ändern nichts", () => {
    const rows = delta({
      tasks: [live(weekly())],
      completions: [
        { id: "c-1", taskId: "t-bad", schemaVersion: 3, deleted: false, completion: completion() },
      ],
    });

    const once = mergeDelta(dataWith([]), rows);
    const twice = mergeDelta(once, rows);

    expect(twice).toEqual(once);
    expect(twice.tasks).toHaveLength(1);
    expect(twice.completions).toHaveLength(1);
  });

  it("Ein erster Abruf auf leeren Daten baut den Stand auf", () => {
    const empty: AppData = dataWith([]);

    const merged = mergeDelta(empty, delta({ tasks: [live(once())] }));

    expect(merged.tasks).toEqual([once()]);
  });
});

describe("Sync: Anzeige = Serverstand + wartende Änderungen (viewOf)", () => {
  it("Ohne wartende Änderungen ist es der Serverstand", () => {
    const base = dataWith([weekly()]);

    expect(viewOf(base, [])).toBe(base);
  });

  it("Wartende Änderungen werden der Reihe nach daraufgelegt", () => {
    const outbox: Change[] = [
      {
        id: "x-1",
        type: "saveTask",
        taskId: "t-bad",
        patch: { set: { title: "Eins" }, unset: [] },
      },
      {
        id: "x-2",
        type: "saveTask",
        taskId: "t-bad",
        patch: { set: { title: "Zwei" }, unset: [] },
      },
    ];

    expect(viewOf(dataWith([weekly()]), outbox).tasks[0]?.title).toBe("Zwei");
  });

  it("Eine wartende Änderung, die der Server nicht annehmen würde, verändert die Anzeige nicht", () => {
    const base = dataWith([weekly()], [completion({ completedBy: "personB" })]);
    const outbox: Change[] = [
      {
        id: "x-1",
        type: "complete",
        completion: completion({ id: "c-9" }),
        patch: { set: { dueDate: "2026-12-01" }, unset: [] },
      },
    ];

    expect(viewOf(base, outbox)).toEqual(base);
  });
});
