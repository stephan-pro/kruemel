// One series of tests that every `Remote` must pass: the fake in memory today, the one for
// Supabase against a local database from E2-1/E2-3 (`npm run check:db`, in CI). If both pass
// the same series, the fake does not drift away from the real rules. Not a test file by itself:
// a test file calls `describeRemoteContract`.

import { describe, expect, it } from "vitest";
import type { Task } from "../domain/task";
import type { Change, ChangeBody } from "./changes";
import { mergeDelta } from "./merge";
import type { PullResult, Remote } from "./remote";
import { completion, dataWith, once, weekly } from "./sync.fixtures";

/** Two devices of one fresh, empty household. */
export interface ContractSetup {
  readonly a: Remote;
  readonly b: Remote;
}

let counter = 0;
/** A change with an id nobody used before in this run. */
function change(body: ChangeBody): Change {
  counter++;
  return { ...body, id: `contract-${counter}` };
}

const create = (task: Task): Change =>
  change({
    type: "saveTask",
    taskId: task.id,
    patch: { set: { ...task }, unset: [] },
    create: task,
  });

const edit = (taskId: string, set: Record<string, unknown>, unset: string[] = []): Change =>
  change({ type: "saveTask", taskId, patch: { set, unset } });

const tick = (id: string, previousDueDate: string, by: "personA" | "personB" = "personA") =>
  change({
    type: "complete",
    completion: completion({ id, previousDueDate: previousDueDate as never, completedBy: by }),
    patch: { set: { dueDate: "2026-10-28" }, unset: [] },
  });

function ids(result: PullResult): string[] {
  return result.tasks.filter((row) => !row.deleted).map((row) => row.id);
}

export interface ContractOptions {
  /**
   * `false` leaves out the test of `subscribe`: the database functions of E2-1 are tested before
   * their `Remote` with realtime exists (E2-3).
   */
  readonly hints?: boolean;
}

export function describeRemoteContract(
  name: string,
  setup: () => Promise<ContractSetup>,
  options: ContractOptions = {},
): void {
  describe(`Vertrag: ${name}`, () => {
    it("Ein neuer Haushalt ist leer", async () => {
      const { a } = await setup();

      const result = await a.pull(null);

      expect(result.tasks).toEqual([]);
      expect(result.completions).toEqual([]);
    });

    it("Namen und Aufgaben, die A schickt, holt B ab", async () => {
      const { a, b } = await setup();

      await a.push(change({ type: "setNames", names: { personA: "Alex", personB: "Robin" } }));
      await a.push(create(weekly()));
      const result = await b.pull(null);

      expect(result.settings?.personNames).toEqual({ personA: "Alex", personB: "Robin" });
      expect(ids(result)).toEqual(["t-bad"]);
    });

    it("Mit dem Stand des letzten Abrufs kommt nur das Neue", async () => {
      const { a, b } = await setup();
      await a.push(create(weekly()));
      const first = await b.pull(null);

      await a.push(create(once()));
      const second = await b.pull(first.cursor);

      expect(ids(second)).toEqual(["t-paket"]);
      expect(second.settings).toBeUndefined();
      expect(ids(await b.pull(second.cursor))).toEqual([]);
    });

    it("Konflikt: Bearbeiten verschiedener Felder – beide Änderungen bleiben erhalten", async () => {
      const { a, b } = await setup();
      await a.push(create(weekly()));

      await a.push(edit("t-bad", { title: "Badezimmer" }));
      await b.push(edit("t-bad", { assignee: "personB" }));
      const task = (await a.pull(null)).tasks[0]?.task;

      expect(task).toMatchObject({ title: "Badezimmer", assignee: "personB" });
    });

    it("Konflikt: Dasselbe Feld – die zuletzt beim Server angekommene Änderung gewinnt", async () => {
      const { a, b } = await setup();
      await a.push(create(weekly()));

      // B hat seine Änderung früher gemacht, sie kommt aber später an.
      await a.push(edit("t-bad", { title: "Von A" }));
      await b.push(edit("t-bad", { title: "Von B" }));

      expect((await a.pull(null)).tasks[0]?.task?.title).toBe("Von B");
    });

    it("Konflikt: Die Checkliste zählt als ein Feld – die später angekommene ersetzt die ganze Liste", async () => {
      const { a, b } = await setup();
      const item = (id: string, checked: boolean) => ({ id, text: id, checked });
      await a.push(create(weekly({ checklist: [item("i-1", false), item("i-2", false)] })));

      await a.push(edit("t-bad", { checklist: [item("i-1", true), item("i-2", false)] }));
      await b.push(edit("t-bad", { checklist: [item("i-1", false), item("i-2", true)] }));

      const checklist = (await a.pull(null)).tasks[0]?.task?.checklist;
      expect(checklist).toEqual([item("i-1", false), item("i-2", true)]);
    });

    it("Ein entferntes Feld wird beim Server entfernt", async () => {
      const { a } = await setup();
      await a.push(create(weekly({ note: "Hinweis" })));

      await a.push(edit("t-bad", {}, ["note"]));

      expect((await a.pull(null)).tasks[0]?.task).not.toHaveProperty("note");
    });

    it("Konflikt: Gleichzeitiges Abhaken zählt einmal – das zweite wird abgelehnt und nennt, wer es schon war", async () => {
      const { a, b } = await setup();
      await a.push(create(weekly()));

      const first = await a.push(tick("c-a", "2026-10-19", "personA"));
      const second = await b.push(tick("c-b", "2026-10-19", "personB"));

      expect(first).toEqual({ status: "applied" });
      expect(second).toEqual({ status: "rejected", reason: "alreadyDone", by: "personA" });
      const result = await b.pull(null);
      expect(result.completions.filter((row) => !row.deleted).map((row) => row.id)).toEqual([
        "c-a",
      ]);
    });

    it("Abhaken und danach Rückgängig gibt den Durchgang wieder frei", async () => {
      const { a, b } = await setup();
      await a.push(create(weekly()));
      await a.push(tick("c-a", "2026-10-19"));

      const undone = await a.push(
        change({
          type: "undo",
          completionId: "c-a",
          patch: { set: { dueDate: "2026-10-19" }, unset: [] },
        }),
      );
      const again = await b.push(tick("c-b", "2026-10-19", "personB"));

      expect(undone).toEqual({ status: "applied" });
      expect(again).toEqual({ status: "applied" });
    });

    it("Konflikt: Rückgängig geht nur für die letzte Erledigung der Aufgabe", async () => {
      const { a, b } = await setup();
      await a.push(create(weekly()));
      await a.push(tick("c-1", "2026-10-19"));
      await b.push(tick("c-2", "2026-10-28", "personB"));

      const result = await a.push(
        change({ type: "undo", completionId: "c-1", patch: { set: {}, unset: [] } }),
      );

      expect(result).toEqual({ status: "rejected", reason: "notLast" });
    });

    it("Rückgängig einer Erledigung, die schon zurückgenommen wurde, wird abgelehnt", async () => {
      const { a, b } = await setup();
      await a.push(create(weekly()));
      await a.push(tick("c-1", "2026-10-19"));
      const undo = () =>
        change({ type: "undo", completionId: "c-1", patch: { set: {}, unset: [] } });
      await a.push(undo());

      expect(await b.push(undo())).toEqual({ status: "rejected", reason: "completionGone" });
    });

    it("Konflikt: Löschen gewinnt gegen Bearbeiten", async () => {
      const { a, b } = await setup();
      await a.push(create(weekly()));
      await a.push(change({ type: "deleteTask", taskId: "t-bad" }));

      const edited = await b.push(edit("t-bad", { title: "Zu spät" }));
      const recreated = await b.push(create(weekly()));
      const ticked = await b.push(tick("c-b", "2026-10-19", "personB"));

      expect(edited).toEqual({ status: "rejected", reason: "taskGone" });
      expect(recreated).toEqual({ status: "rejected", reason: "taskGone" });
      expect(ticked).toEqual({ status: "rejected", reason: "taskGone" });
      expect(ids(await b.pull(null))).toEqual([]);
    });

    it("Wer offline war, erfährt vom Löschen: Aufgabe und Erledigungen kommen als gelöscht", async () => {
      const { a, b } = await setup();
      await a.push(create(weekly()));
      await a.push(tick("c-1", "2026-10-19"));
      const known = await b.pull(null);

      await a.push(change({ type: "deleteTask", taskId: "t-bad" }));
      const result = await b.pull(known.cursor);

      expect(result.tasks.map((row) => [row.id, row.deleted])).toEqual([["t-bad", true]]);
      expect(result.completions.map((row) => [row.id, row.deleted])).toEqual([["c-1", true]]);
      expect(mergeDelta(mergeDelta(dataWith([]), known), result).tasks).toEqual([]);
    });

    it("Dieselbe Änderung zweimal zugestellt zählt einmal", async () => {
      const { a } = await setup();
      await a.push(create(weekly()));
      const ticked = tick("c-1", "2026-10-19");

      const first = await a.push(ticked);
      const second = await a.push(ticked);

      expect(second).toEqual(first);
      const result = await a.pull(null);
      expect(result.completions).toHaveLength(1);
    });

    it("Ein Abruf mit einem älteren Stand liefert Zeilen noch einmal; das Zusammenführen ändert nichts", async () => {
      const { a, b } = await setup();
      await a.push(create(weekly()));
      const early = await b.pull(null);
      await a.push(tick("c-1", "2026-10-19"));
      const late = await b.pull(early.cursor);

      const once = mergeDelta(mergeDelta(dataWith([]), early), late);
      const overlapping = await b.pull(early.cursor);
      const again = mergeDelta(once, overlapping);

      expect(again).toEqual(once);
    });

    it("Alles ersetzen: neue Daten gelten, nicht mehr vorhandene Zeilen kommen als gelöscht", async () => {
      const { a, b } = await setup();
      await a.push(create(weekly()));
      const known = await b.pull(null);

      const result = await a.push(change({ type: "replaceAll", data: dataWith([once()], []) }));
      const delta = await b.pull(known.cursor);

      expect(result).toEqual({ status: "applied" });
      expect(delta.tasks.map((row) => [row.id, row.deleted])).toEqual([
        ["t-paket", false],
        ["t-bad", true],
      ]);
      expect(mergeDelta(mergeDelta(dataWith([]), known), delta).tasks.map((t) => t.id)).toEqual([
        "t-paket",
      ]);
    });

    it.skipIf(options.hints === false)(
      "Die Verbindung meldet eine Änderung des anderen Geräts",
      async () => {
        const { a, b } = await setup();
        let hints = 0;
        const stop = b.subscribe(() => {
          hints++;
        });

        await a.push(create(weekly()));
        await new Promise((resolve) => setTimeout(resolve, 50));
        stop();
        await a.push(create(once()));
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(hints).toBe(1);
      },
    );
  });
}
