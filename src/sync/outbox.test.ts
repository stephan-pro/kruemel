import { describe, expect, it } from "vitest";
import { emptyAppData } from "../storage/appData";
import { StorageError } from "../storage/storage";
import { FakeStore } from "../storage/storage.fixtures";
import type { Change } from "./changes";
import { type SyncState, SyncStateStore } from "./outbox";
import { dataWith, weekly } from "./sync.fixtures";

const KEY = "kruemel:sync";

function problems(store: FakeStore): readonly string[] {
  try {
    new SyncStateStore(store, KEY).read();
  } catch (error) {
    expect(error).toBeInstanceOf(StorageError);
    return (error as StorageError).details;
  }
  throw new Error("Lesen sollte scheitern");
}

const change: Change = { id: "x-1", type: "deleteTask", taskId: "t-bad" };

describe("Sync: Warteschlange und lokale Kopie im Browser-Speicher (Outbox)", () => {
  it("Ein Gerät, das noch nie abgeglichen hat, hat keinen Stand", () => {
    const states = new SyncStateStore(new FakeStore(), KEY);

    expect(states.read()).toBeNull();
    expect(states.readRaw()).toBeNull();
  });

  it("Kopie, Stand und wartende Änderungen werden zusammen gespeichert und gelesen", () => {
    const store = new FakeStore();
    const state: SyncState = {
      base: dataWith([weekly()]),
      cursor: "7",
      outbox: [change, { id: "x-2", type: "setNames", names: { personA: "A", personB: "B" } }],
    };

    new SyncStateStore(store, KEY).write(state);

    expect(new SyncStateStore(store, KEY).read()).toEqual(state);
    expect(JSON.parse(new SyncStateStore(store, KEY).readRaw() as string).outbox).toHaveLength(2);
  });

  it("clear entfernt alles", () => {
    const store = new FakeStore();
    const states = new SyncStateStore(store, KEY);
    states.write({ base: emptyAppData(), cursor: null, outbox: [] });

    states.clear();

    expect(states.read()).toBeNull();
  });

  it("Eine Kopie ohne Stand (cursor null) ist gültig", () => {
    const store = new FakeStore();
    new SyncStateStore(store, KEY).write({ base: emptyAppData(), cursor: null, outbox: [] });

    expect(new SyncStateStore(store, KEY).read()?.cursor).toBeNull();
  });

  it("Kein gültiges JSON wird als beschädigt gemeldet", () => {
    const store = new FakeStore();
    store.items.set(KEY, "{kaputt");

    expect(() => new SyncStateStore(store, KEY).read()).toThrow(/kein gültiges JSON/);
  });

  it("Eine fehlerhafte Kopie wird mit Fundstelle gemeldet", () => {
    const store = new FakeStore();
    store.items.set(KEY, JSON.stringify({ base: { schemaVersion: 3 }, cursor: null, outbox: [] }));

    expect(problems(store)[0]).toMatch(/^Kopie: settings/);
  });

  it("Ein falscher Stand (cursor) wird gemeldet", () => {
    const store = new FakeStore();
    store.items.set(KEY, JSON.stringify({ base: emptyAppData(), cursor: 5, outbox: [] }));

    expect(problems(store)).toEqual(["Kopie.cursor: erwartet Text oder nichts"]);
  });

  it.each([
    ["keine Liste", "x"],
    ["ein Eintrag ohne Kennung", [{ type: "deleteTask" }]],
    ["ein Eintrag mit unbekannter Art", [{ id: "x", type: "sprengen" }]],
    ["ein Eintrag, der kein Objekt ist", [5]],
  ])("Eine beschädigte Warteschlange wird gemeldet: %s", (_name, outbox) => {
    const store = new FakeStore();
    store.items.set(KEY, JSON.stringify({ base: emptyAppData(), cursor: null, outbox }));

    expect(problems(store)).toEqual(["Kopie.outbox: erwartet eine Liste von Änderungen"]);
  });

  it("Ein gesperrter Browser-Speicher wird als StorageError gemeldet", () => {
    const store = new FakeStore();
    store.failWith = new Error("gesperrt");
    const states = new SyncStateStore(store, KEY);

    expect(() => states.read()).toThrow(StorageError);
    expect(() => states.write({ base: emptyAppData(), cursor: null, outbox: [] })).toThrow(
      StorageError,
    );
    expect(() => states.clear()).toThrow(StorageError);
  });

  it("Eine Kopie im Format einer älteren App wird beim Lesen migriert", () => {
    const store = new FakeStore();
    store.items.set(
      KEY,
      JSON.stringify({
        base: { schemaVersion: 2, settings: {}, tasks: [], completions: [] },
        cursor: null,
        outbox: [],
      }),
    );

    expect(new SyncStateStore(store, KEY).read()?.base.schemaVersion).toBe(3);
  });
});
