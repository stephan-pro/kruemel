import { describe, expect, it } from "vitest";
import { dayFromDate } from "../domain/date";
import { createLocalStorage } from "../storage/localStorage";
import { FakeStore } from "../storage/storage.fixtures";
import { DEMO_NAMESPACE, demoData } from "./demoData";
import { startDemo, wantsReset } from "./start";

const now = new Date(2026, 9, 19, 14, 30);

describe("wantsReset", () => {
  it("erkennt ?demo=neu in der Adresse", () => {
    expect(wantsReset("?demo=neu")).toBe(true);
    expect(wantsReset("?x=1&demo=neu")).toBe(true);
  });

  it("ignoriert alles andere", () => {
    expect(wantsReset("")).toBe(false);
    expect(wantsReset("?demo=alt")).toBe(false);
    expect(wantsReset("?neu")).toBe(false);
  });
});

describe("startDemo", () => {
  it("legt die Beispieldaten für den heutigen Tag im Demo-Bereich ab und meldet die Anzahl", async () => {
    const store = new FakeStore();
    const info = await startDemo(store, "", now);
    const expected = demoData(dayFromDate(now));
    expect(info).toEqual({
      taskCount: expected.tasks.length,
      completionCount: expected.completions.length,
      wasReset: false,
    });
    const storage = createLocalStorage({ store, namespace: DEMO_NAMESPACE });
    expect(await storage.load()).toEqual(expected);
  });

  it("lädt mit ?demo=neu frische Daten und meldet das", async () => {
    const store = new FakeStore();
    const storage = createLocalStorage({ store, namespace: DEMO_NAMESPACE });
    await startDemo(store, "", now);
    await storage.save({ ...(await storage.load()), tasks: [], completions: [] });
    const info = await startDemo(store, "?demo=neu", now);
    expect(info.wasReset).toBe(true);
    expect(info.taskCount).toBe(demoData(dayFromDate(now)).tasks.length);
  });
});
