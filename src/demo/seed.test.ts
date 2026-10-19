import { describe, expect, it } from "vitest";
import { d } from "../domain/task.fixtures";
import { type AppData, emptyAppData } from "../storage/appData";
import { createLocalStorage } from "../storage/localStorage";
import type { AppStorage } from "../storage/storage";
import { FakeStore, sampleData } from "../storage/storage.fixtures";
import { DEMO_DEVICE, DEMO_NAMESPACE, demoData } from "./demoData";
import { seedDemo } from "./seed";

const today = d("2026-10-19");

function demoStorage(store = new FakeStore()) {
  return { store, storage: createLocalStorage({ store, namespace: DEMO_NAMESPACE }) };
}

/** A change someone could make while trying the app; the result is still valid data. */
function withoutGift(data: AppData): AppData {
  return { ...data, tasks: data.tasks.filter((task) => task.id !== "demo-geschenk") };
}

describe("seedDemo", () => {
  it("füllt einen leeren Demo-Speicher mit den Beispieldaten und setzt „Ich bin“", async () => {
    const { storage } = demoStorage();
    const result = await seedDemo(storage, today);
    expect(result).toEqual(demoData(today));
    expect(await storage.load()).toEqual(demoData(today));
    expect(await storage.loadDevice()).toEqual(DEMO_DEVICE);
  });

  it("behält vorhandene Demo-Daten, damit man ausprobieren und neu laden kann", async () => {
    const { storage } = demoStorage();
    const changed = withoutGift(demoData(today));
    await storage.save(changed);
    expect(await seedDemo(storage, today)).toEqual(changed);
    expect(await storage.load()).toEqual(changed);
  });

  it("ersetzt vorhandene Demo-Daten bei „reset“ durch frische Beispieldaten", async () => {
    const { storage } = demoStorage();
    await storage.save(withoutGift(demoData(d("2026-01-01"))));
    await seedDemo(storage, today, { reset: true });
    expect(await storage.load()).toEqual(demoData(today));
  });

  it("füllt auch einen Speicher, der nur leere Daten enthält", async () => {
    const { storage } = demoStorage();
    await storage.save(emptyAppData());
    expect(await seedDemo(storage, today)).toEqual(demoData(today));
  });

  it("ersetzt unlesbare Demo-Daten durch Beispieldaten", async () => {
    const { store, storage } = demoStorage();
    store.setItem(`${DEMO_NAMESPACE}:data`, "{kaputt");
    expect(await seedDemo(storage, today)).toEqual(demoData(today));
    expect(await storage.load()).toEqual(demoData(today));
  });

  it("lässt echte Daten im selben Browser unberührt", async () => {
    const store = new FakeStore();
    const real = createLocalStorage({ store });
    await real.save(sampleData());
    await real.saveDevice({ currentPerson: "personB" });
    await seedDemo(demoStorage(store).storage, today, { reset: true });
    expect(await real.load()).toEqual(sampleData());
    expect(await real.loadDevice()).toEqual({ currentPerson: "personB" });
  });

  it("gibt unerwartete Fehler weiter, statt sie zu verschlucken", async () => {
    const broken = {
      load: () => Promise.reject(new TypeError("Programmfehler")),
    } as unknown as AppStorage;
    await expect(seedDemo(broken, today)).rejects.toThrow("Programmfehler");
  });
});
