import { describe, expect, it } from "vitest";
import { FakeHousehold } from "./fakeHousehold";
import { FakeRemote } from "./fakeRemote";
import { RemoteError } from "./remote";
import { describeRemoteContract } from "./remote.contract";
import { completion, dataWith, weekly } from "./sync.fixtures";

describeRemoteContract("FakeRemote (im Speicher)", async () => {
  const household = new FakeHousehold();
  return { a: new FakeRemote(household), b: new FakeRemote(household) };
});

describe("FakeRemote und FakeHousehold", () => {
  it("Ein Haushalt kann mit Daten beginnen; ein erster Abruf liefert sie", async () => {
    const start = dataWith([weekly()], [completion()]);
    const remote = new FakeRemote(new FakeHousehold(start));

    const result = await remote.pull(null);

    expect(result.tasks.map((row) => row.id)).toEqual(["t-bad"]);
    expect(result.completions.map((row) => row.id)).toEqual(["c-1"]);
    expect(result.settings?.personNames).toEqual({ personA: "Alex", personB: "Robin" });
    expect(remote.household.snapshot()).toEqual(start);
  });

  it("Ohne Verbindung scheitern Abruf, Senden und Hinweise mit einem RemoteError", async () => {
    const remote = new FakeRemote(new FakeHousehold());
    remote.online = false;

    await expect(remote.pull(null)).rejects.toBeInstanceOf(RemoteError);
    await expect(remote.push({ id: "x", type: "deleteTask", taskId: "t" })).rejects.toBeInstanceOf(
      RemoteError,
    );
    expect(remote.pushed).toEqual([]);
  });

  it("Ohne Verbindung kommen keine Hinweise an", async () => {
    const household = new FakeHousehold();
    const other = new FakeRemote(household);
    const remote = new FakeRemote(household);
    let hints = 0;
    remote.subscribe(() => {
      hints++;
    });
    remote.online = false;

    await other.push({ id: "x", type: "setNames", names: { personA: "A", personB: "B" } });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(hints).toBe(0);
  });

  it("Geht die Antwort verloren, hat der Server die Änderung trotzdem; ein zweiter Versuch zählt einmal", async () => {
    const household = new FakeHousehold(dataWith([weekly()]));
    const remote = new FakeRemote(household);
    const ticked = {
      id: "x-1",
      type: "complete" as const,
      completion: completion(),
      patch: { set: { dueDate: "2026-10-28" }, unset: [] },
    };
    remote.loseNextAnswer = true;

    await expect(remote.push(ticked)).rejects.toBeInstanceOf(RemoteError);
    expect(household.snapshot().completions).toHaveLength(1);
    const retry = await remote.push(ticked);

    expect(retry).toEqual({ status: "applied" });
    expect(household.snapshot().completions).toHaveLength(1);
    expect(remote.pushed).toHaveLength(2);
  });
});
