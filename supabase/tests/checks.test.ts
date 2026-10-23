import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "../../src/storage/appData";
import { call, type Person, withHousehold } from "./setup";

// K2b (Prüfbericht E2-5d): the database checks every task and completion it stores, whichever
// function writes it, and a household has at most 500 tasks. The app checks what it pulls as well
// (`mergeDelta`); here only the database side.

const task = (id: string, title = "Bad putzen") => ({
  kind: "recurring",
  id,
  title,
  symbol: "standard",
  recurrence: { unit: "week", interval: 1 },
  assignee: "personA",
  dueDate: "2026-10-19",
  checklist: [],
});

const completion = {
  id: "c-1",
  taskId: "t-1",
  completedOn: "2026-10-21",
  completedBy: "personA",
  previousDueDate: "2026-10-19",
  checkedItemIds: [],
};

const change = () => ({ p_change_id: crypto.randomUUID(), p_schema_version: SCHEMA_VERSION });

const create = (person: Person, data: Record<string, unknown>) =>
  call(person, "save_task", {
    ...change(),
    p_task_id: data.id,
    p_set: data,
    p_unset: [],
    p_create: data,
  });

const addAll = (person: Person, tasks: unknown[], completions: unknown[] = []) =>
  call(person, "add_household_data", { ...change(), p_data: { tasks, completions } });

const pull = (person: Person) =>
  call<{ tasks: { id: string }[]; completions: { id: string }[] }>(person, "pull_changes", {
    p_cursor: null,
  });

async function failure(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return (error as Error).message;
  }
  return "kein Fehler";
}

describe("K2b Der Server prüft den Aufbau", () => {
  it("K2b Aufgaben, die die App nicht lesen könnte, lehnt der Server ab – auf jedem Weg", async () => {
    const a = await withHousehold();
    const valid = task("t-1");

    for (const broken of [
      { ...valid, assignee: "personC" },
      { ...valid, kind: "manchmal" },
      { ...valid, dueDate: "morgen" },
      { ...valid, title: "" },
      { ...valid, title: "x".repeat(201) },
      { ...valid, checklist: "Herd" },
      { ...valid, note: 5 },
      { ...valid, symbol: undefined },
      { ...valid, padding: "x".repeat(17_000) },
    ]) {
      expect(await failure(create(a, broken)), JSON.stringify(broken).slice(0, 80)).toBe(
        "invalid_change",
      );
      expect(await failure(addAll(a, [broken]))).toBe("invalid_change");
    }
    // Die Kennung im Inhalt muss die der Zeile sein.
    const other = { ...valid, id: "t-anders" };
    const mismatch = call(a, "save_task", {
      ...change(),
      p_task_id: "t-1",
      p_set: other,
      p_unset: [],
      p_create: other,
    });
    expect(await failure(mismatch)).toBe("invalid_change");
    expect((await pull(a)).tasks).toEqual([]);

    await create(a, valid);
    expect((await pull(a)).tasks.map((row) => row.id)).toEqual(["t-1"]);
  });

  it("K2b Erledigungen mit falschem Aufbau lehnt der Server ab; gültige gehen durch", async () => {
    const a = await withHousehold();
    await create(a, task("t-1"));

    for (const broken of [
      { ...completion, completedBy: "personC" },
      { ...completion, completedOn: "gestern" },
      { ...completion, checkedItemIds: "alle" },
    ]) {
      const answer = call(a, "complete_task", {
        ...change(),
        p_completion: broken,
        p_set: { dueDate: "2026-10-26" },
        p_unset: [],
      });
      expect(await failure(answer), JSON.stringify(broken)).toBe("invalid_change");
    }
    expect((await pull(a)).completions).toEqual([]);

    await call(a, "complete_task", {
      ...change(),
      p_completion: completion,
      p_set: { dueDate: "2026-10-26" },
      p_unset: [],
    });
    expect((await pull(a)).completions.map((row) => row.id)).toEqual(["c-1"]);
  });
});

describe("K2b Obergrenzen je Haushalt", () => {
  it("K2b Höchstens 500 Aufgaben: die 501. lehnt der Server ab, gelöschte zählen nicht", async () => {
    const a = await withHousehold();
    const many = Array.from({ length: 500 }, (_, index) => task(`t-${index}`, `Aufgabe ${index}`));

    await addAll(a, many);
    expect(await failure(create(a, task("t-zu-viel", "Eine zu viel")))).toBe("too_many_tasks");

    await call(a, "delete_task", { ...change(), p_task_id: "t-0" });
    await create(a, task("t-neu", "Jetzt passt sie"));
    expect((await pull(a)).tasks).toHaveLength(500);
  });

  it("K2b Mehr als 500 Aufgaben auf einmal (Übernahme) kommen gar nicht an", async () => {
    const a = await withHousehold();
    const many = Array.from({ length: 501 }, (_, index) => task(`t-${index}`, `Aufgabe ${index}`));

    expect(await failure(addAll(a, many))).toBe("too_many_tasks");
    expect((await pull(a)).tasks).toEqual([]);
  });
});
