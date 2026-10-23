import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "../../src/storage/appData";
import { call, couple, type Person, withHousehold } from "./setup";

// E2-3a, what only the database can show (the rules themselves are in the contract series,
// `contract.test.ts`): where the household keeps its version, taking over in one transaction, both
// devices taking over at the same time, and invalid data. Access only for members: `security.test.ts`.

const task = (id: string, title: string) => ({
  kind: "recurring",
  id,
  title,
  symbol: "standard",
  recurrence: { unit: "week", interval: 1 },
  assignee: "personA",
  dueDate: "2026-10-19",
  checklist: [],
});

const completion = (id: string, taskId: string, previousDueDate = "2026-10-19") => ({
  id,
  taskId,
  completedOn: "2026-10-21",
  completedBy: "personA",
  previousDueDate,
  checkedItemIds: [],
});

type Pulled = {
  schemaVersion: number;
  tasks: { id: string }[];
  completions: { id: string }[];
};

const pull = (person: Person) => call<Pulled>(person, "pull_changes", { p_cursor: null });

function addAll(person: Person, data: unknown, schemaVersion: number = SCHEMA_VERSION) {
  return call(person, "add_household_data", {
    p_change_id: crypto.randomUUID(),
    p_schema_version: schemaVersion,
    p_data: data,
  });
}

async function failure(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return (error as Error).message;
  }
  return "kein Fehler";
}

describe("Versionsschutz in der Datenbank", () => {
  it("Versionsschutz: Der Haushalt merkt sich die neueste Version, sie sinkt nie", async () => {
    const a = await withHousehold();
    const version = async () => {
      const { data } = await a.client.from("households").select("schema_version").single();
      return data?.schema_version;
    };
    const newer = SCHEMA_VERSION + 1;

    expect(await version()).toBe(SCHEMA_VERSION);
    await addAll(a, { tasks: [task("t-1", "Bad putzen")], completions: [] }, newer);
    expect(await version()).toBe(newer);
    expect(await addAll(a, { tasks: [], completions: [] })).toEqual({
      status: "rejected",
      reason: "outdated",
    });

    expect(await version()).toBe(newer);
    expect((await pull(a)).schemaVersion).toBe(newer);
  });

  it("Versionsschutz: Eine unsinnige Version wird abgelehnt", async () => {
    const a = await withHousehold();

    for (const schemaVersion of [0, 1001, null]) {
      expect(
        await failure(addAll(a, { tasks: [], completions: [] }, schemaVersion as number)),
        String(schemaVersion),
      ).toBe("invalid_change");
    }
  });
});

describe("Übernahme in der Datenbank", () => {
  it("Übernahme: Beide Geräte gleichzeitig – keine Aufgabe doppelt", async () => {
    const { a, b } = await couple();
    const from = (prefix: string) => ({
      tasks: [task(`${prefix}-1`, "Bad putzen"), task(`${prefix}-2`, "Müll rausbringen")],
      completions: [completion(`${prefix}-c`, `${prefix}-1`)],
    });

    await Promise.all([addAll(a, from("a")), addAll(b, from("b"))]);
    const pulled = await pull(a);

    // Whoever came first brought both tasks; the other one's are the same by title.
    expect(pulled.tasks).toHaveLength(2);
    expect(new Set(pulled.tasks.map((row) => row.id.slice(0, 1))).size).toBe(1);
    expect(pulled.completions).toHaveLength(1);
  });

  it("Übernahme: In einem Schritt – scheitert ein Teil, kommt nichts an", async () => {
    const a = await withHousehold();

    const broken = addAll(a, {
      tasks: [task("t-1", "Bad putzen"), task("t-2", "Fenster")],
      completions: [completion("c-1", "t-1", "2026-13-40")],
    });

    expect(await failure(broken)).not.toBe("kein Fehler");
    expect((await pull(a)).tasks).toEqual([]);
  });

  it("Übernahme: Ungültige Daten werden abgelehnt", async () => {
    const a = await withHousehold();
    const valid = task("t-1", "Bad putzen");

    for (const data of [
      null,
      { tasks: [valid] },
      { tasks: [{ ...valid, title: undefined }], completions: [] },
      { tasks: [{ ...valid, id: "" }], completions: [] },
      { tasks: ["t-1"], completions: [] },
      { tasks: [valid], completions: [{ ...completion("c-1", "t-1"), previousDueDate: 5 }] },
    ]) {
      expect(await failure(addAll(a, data)), JSON.stringify(data)).toBe("invalid_change");
    }
    expect((await pull(a)).tasks).toEqual([]);
  });
});
