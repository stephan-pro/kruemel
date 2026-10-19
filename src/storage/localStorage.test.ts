import { describe, expect, it } from "vitest";
import { emptyAppData } from "./appData";
import { createLocalStorage, requestPersistentStorage } from "./localStorage";
import { StorageError } from "./storage";
import { FakeStore, sampleData } from "./storage.fixtures";

describe("F7 Speicher (localStorage)", () => {
  it("F7 Ohne gespeicherte Daten liefert der Speicher leere Daten", async () => {
    const storage = createLocalStorage({ store: new FakeStore() });

    expect(await storage.load()).toEqual(emptyAppData());
  });

  it("F7 Gespeicherte Daten kommen beim nächsten Laden unverändert zurück", async () => {
    const store = new FakeStore();
    await createLocalStorage({ store }).save(sampleData());

    const reloaded = await createLocalStorage({ store }).load();

    expect(reloaded).toEqual(sampleData());
  });

  it("F7 Speichern ersetzt alle früheren Daten", async () => {
    const storage = createLocalStorage({ store: new FakeStore() });
    await storage.save(sampleData());

    await storage.save(emptyAppData());

    expect(await storage.load()).toEqual(emptyAppData());
  });

  it("F7 Der Speicher legt die Daten mit schemaVersion ab", async () => {
    const store = new FakeStore();

    await createLocalStorage({ store }).save(sampleData());

    expect(JSON.parse(store.items.get("putzplan:data") as string).schemaVersion).toBe(1);
  });

  it("F7 Verschiedene Namensräume sehen die Daten der anderen nicht", async () => {
    const store = new FakeStore();
    const real = createLocalStorage({ store });
    const demo = createLocalStorage({ store, namespace: "putzplan-demo" });

    await demo.save(sampleData());
    await demo.saveDevice({ currentPerson: "personB" });

    expect(await real.load()).toEqual(emptyAppData());
    expect(await real.loadDevice()).toEqual({});
    expect(await demo.load()).toEqual(sampleData());
  });

  it("F7 Kein gültiges JSON im Speicher: Laden meldet einen Fehler, überschreibt aber nichts", async () => {
    const store = new FakeStore();
    store.items.set("putzplan:data", "{kaputt");
    const storage = createLocalStorage({ store });

    await expect(storage.load()).rejects.toThrow(StorageError);

    expect(store.items.get("putzplan:data")).toBe("{kaputt");
  });

  it("F7 Gespeicherte Daten mit falschem Aufbau: Laden meldet einen Fehler mit Einzelheiten", async () => {
    const store = new FakeStore();
    store.items.set("putzplan:data", JSON.stringify({ schemaVersion: 1, settings: {}, tasks: 5 }));
    const storage = createLocalStorage({ store });

    const error = await storage.load().catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(StorageError);
    expect((error as StorageError).details).toContain("tasks: erwartet eine Liste");
  });

  it("F7 Ist der Browser-Speicher nicht lesbar, meldet Laden einen Fehler", async () => {
    const store = new FakeStore();
    store.failWith = new Error("SecurityError");
    const storage = createLocalStorage({ store });

    await expect(storage.load()).rejects.toThrow("nicht verfügbar");
    await expect(storage.loadDevice()).rejects.toThrow("nicht verfügbar");
  });

  it("F7 Ist der Speicher voll, meldet Speichern einen Fehler und die alten Daten bleiben", async () => {
    const store = new FakeStore();
    const storage = createLocalStorage({ store });
    await storage.save(sampleData());
    store.failWith = new Error("QuotaExceededError");

    await expect(storage.save(emptyAppData())).rejects.toThrow("voll oder gesperrt");
    await expect(storage.saveDevice({ currentPerson: "personA" })).rejects.toThrow(StorageError);

    store.failWith = undefined;
    expect(await storage.load()).toEqual(sampleData());
  });
});

describe("F5 „Ich bin“ auf diesem Gerät", () => {
  it("F5 Ohne Auswahl ist „Ich bin“ nicht gesetzt", async () => {
    const storage = createLocalStorage({ store: new FakeStore() });

    expect(await storage.loadDevice()).toEqual({});
  });

  it("F5 Die Auswahl „Ich bin“ bleibt gespeichert", async () => {
    const store = new FakeStore();
    await createLocalStorage({ store }).saveDevice({ currentPerson: "personB" });

    expect(await createLocalStorage({ store }).loadDevice()).toEqual({ currentPerson: "personB" });
  });

  it("F5 „Ich bin“ gehört zum Gerät und steht nicht in den Daten der Sicherung", async () => {
    const store = new FakeStore();
    const storage = createLocalStorage({ store });

    await storage.saveDevice({ currentPerson: "personA" });
    await storage.save(sampleData());

    expect(store.items.get("putzplan:data")).not.toContain("currentPerson");
  });

  it.each([
    ["kein JSON", "{kaputt"],
    ["kein Objekt", "null"],
    ["eine unbekannte Person", JSON.stringify({ currentPerson: "both" })],
  ])("F5 Unlesbare Auswahl („%s“) wird ignoriert; die App fragt dann neu", async (_name, text) => {
    const store = new FakeStore();
    store.items.set("putzplan:device", text);

    expect(await createLocalStorage({ store }).loadDevice()).toEqual({});
  });
});

describe("Dauerhafter Speicher", () => {
  it("Die Anfrage nach dauerhaftem Speicher gibt die Antwort des Browsers weiter", async () => {
    expect(await requestPersistentStorage({ persist: async () => true })).toBe(true);
    expect(await requestPersistentStorage({ persist: async () => false })).toBe(false);
  });

  it("Ohne Browser-Unterstützung oder bei einem Fehler gilt der Speicher als nicht geschützt", async () => {
    expect(await requestPersistentStorage(undefined)).toBe(false);
    expect(
      await requestPersistentStorage({
        persist: async () => {
          throw new Error("nicht erlaubt");
        },
      }),
    ).toBe(false);
  });
});
