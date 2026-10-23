// One series of tests that every `Remote` must pass: the fakes (in memory and over HTTP) and
// `SupabaseRemote` against a local database (`npm run check:db`, in CI). If all pass the same
// series, the fakes do not drift away from the real rules. Not a test file by itself: a test file
// calls `describeRemoteContract`.

import { describe, expect, it } from "vitest";
import type { Task } from "../domain/task";
import { SCHEMA_VERSION } from "../storage/appData";
import { type Change, type ChangeBody, OUTDATED } from "./changes";
import { mergeDelta } from "./merge";
import type { PullResult, Remote } from "./remote";
import { completion, d, dataWith, once, weekly } from "./sync.fixtures";

/** Two devices of one fresh, empty household. */
export interface ContractSetup {
  readonly a: Remote;
  readonly b: Remote;
  /** Another connection of person A or B, from an app with another `schemaVersion`. */
  readonly device: (person: "a" | "b", schemaVersion: number) => Remote;
}

const APPLIED = { status: "applied" };

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

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface ContractOptions {
  /**
   * The connection hints once as soon as it is ready (Realtime): the test of `subscribe` waits
   * for that hint before it changes anything.
   */
  readonly hintOnConnect?: boolean;
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
      expect(result.schemaVersion).toBe(SCHEMA_VERSION);
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

    it("Versionsschutz: Ein Gerät mit älterer App überschreibt keine Daten im neueren Format", async () => {
      const { a, device } = await setup();
      await a.push(create(weekly()));
      await a.push(tick("c-1", "2026-10-19"));
      const before = await a.pull(null);

      const newer = await device("b", SCHEMA_VERSION + 1).push(edit("t-bad", { title: "Neu" }));
      const late: Change[] = [
        change({ type: "setNames", names: { personA: "Alt", personB: "Alt" } }),
        edit("t-bad", { title: "Alt" }),
        create(once()),
        tick("c-2", "2026-10-28"),
        change({ type: "undo", completionId: "c-1", patch: { set: {}, unset: [] } }),
        change({ type: "deleteTask", taskId: "t-bad" }),
        change({ type: "replaceAll", data: dataWith([]) }),
        change({ type: "addAll", tasks: [once()], completions: [] }),
      ];

      expect(newer).toEqual(APPLIED);
      for (const refused of late) {
        expect(await a.push(refused), refused.type).toEqual(OUTDATED);
      }
      const after = await a.pull(null);
      expect(after.schemaVersion).toBe(SCHEMA_VERSION + 1);
      expect(after.tasks.map((row) => row.task?.title)).toEqual(["Neu"]);
      expect(after.completions.map((row) => row.id)).toEqual(["c-1"]);
      expect(after.settings).toEqual(before.settings);
    });

    it("Versionsschutz: Nach dem Neuladen der App geht dieselbe Änderung durch", async () => {
      const { a, device } = await setup();
      await device("b", SCHEMA_VERSION + 1).push(create(weekly()));
      const late = edit("t-bad", { title: "Nach dem Neuladen" });

      const refused = await a.push(late);
      const accepted = await device("a", SCHEMA_VERSION + 1).push(late);

      expect(refused).toEqual(OUTDATED);
      expect(accepted).toEqual(APPLIED);
      expect((await a.pull(null)).tasks[0]?.task?.title).toBe("Nach dem Neuladen");
    });

    it("Übernahme: Aufgaben samt Erledigungen kommen in einem Schritt und in ihrer Reihenfolge an", async () => {
      const { a, b } = await setup();

      const result = await a.push(
        change({
          type: "addAll",
          tasks: [weekly(), once()],
          completions: [
            completion({ id: "c-1" }),
            completion({ id: "c-2", previousDueDate: d("2026-10-28") }),
          ],
        }),
      );
      const pulled = await b.pull(null);
      const undoLast = await b.push(
        change({ type: "undo", completionId: "c-2", patch: { set: {}, unset: [] } }),
      );

      expect(result).toEqual(APPLIED);
      expect(ids(pulled)).toEqual(["t-bad", "t-paket"]);
      expect(pulled.completions.map((row) => row.id)).toEqual(["c-1", "c-2"]);
      expect(undoLast).toEqual(APPLIED);
    });

    it("Übernahme: Aufgaben mit vorhandenem Titel oder bekannter Kennung entfallen samt Erledigungen", async () => {
      const { a, b } = await setup();
      await a.push(create(weekly()));
      await a.push(create(once({ id: "t-weg", title: "Weg" })));
      await a.push(change({ type: "deleteTask", taskId: "t-weg" }));

      await b.push(
        change({
          type: "addAll",
          tasks: [
            weekly({ id: "t-bad-b", title: "  bad   PUTZEN " }),
            once({ id: "t-weg", title: "Wieder da" }),
            once(),
            once({ id: "t-paket-2" }),
          ],
          completions: [
            completion({ id: "c-b", taskId: "t-bad-b" }),
            completion({ id: "c-p", taskId: "t-paket", previousDueDate: d("2026-10-22") }),
          ],
        }),
      );
      const pulled = await a.pull(null);

      // Two tasks of the same title in the taken-over data both stay: the device had them so.
      expect(ids(pulled)).toEqual(["t-bad", "t-paket", "t-paket-2"]);
      expect(pulled.completions.map((row) => row.id)).toEqual(["c-p"]);
    });

    it("Übernahme: wiederholt (dieselbe oder eine neue Änderung, auch vom anderen Gerät) – nichts doppelt", async () => {
      const { a, b } = await setup();
      const data = { tasks: [weekly(), once()], completions: [completion()] };
      const first = change({ type: "addAll", ...data });

      await a.push(first);
      const repeated = await a.push(first);
      const again = await a.push(change({ type: "addAll", ...data }));
      const other = await b.push(
        change({
          type: "addAll",
          tasks: [weekly({ id: "t-bad-b" }), once({ id: "t-paket-b", title: "paket abholen" })],
          completions: [completion({ id: "c-b", taskId: "t-bad-b" })],
        }),
      );
      const pulled = await a.pull(null);

      expect([repeated, again, other]).toEqual([APPLIED, APPLIED, APPLIED]);
      expect(ids(pulled)).toEqual(["t-bad", "t-paket"]);
      expect(pulled.completions.map((row) => row.id)).toEqual(["c-1"]);
    });

    it("Die Verbindung meldet eine Änderung des anderen Geräts", async () => {
      const { a, b } = await setup();
      let hints = 0;
      const stop = b.subscribe(() => {
        hints++;
      });
      if (options.hintOnConnect === true) {
        await expect.poll(() => hints, { timeout: 15_000 }).toBeGreaterThan(0);
      }
      const ready = hints;

      await a.push(create(weekly()));
      await expect.poll(() => hints, { timeout: 15_000 }).toBeGreaterThan(ready);
      stop();
      const seen = hints;
      await a.push(create(once()));
      await wait(options.hintOnConnect === true ? 1000 : 50);

      expect(hints).toBe(seen);
    });
  });
}
