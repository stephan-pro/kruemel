import { describe, expect, it } from "vitest";
import { completeInData, undoInData } from "../domain/taskManagement";
import { emptyAppData } from "../storage/appData";
import { StorageError } from "../storage/storage";
import { FakeStore } from "../storage/storage.fixtures";
import { FakeRemote } from "./fakeRemote";
import { memoryLocker } from "./locks";
import { RemoteError } from "./remote";
import { completion, d, dataWith, household, idCounter, once, weekly } from "./sync.fixtures";
import { createSyncedStorage } from "./syncedStorage";

const names = { personA: "Alex", personB: "Robin" } as const;

/** Ticks the first task off in the data, as the app does. */
function ticked(data: ReturnType<typeof dataWith>, id: string, by: "personA" | "personB") {
  return completeInData(data, data.tasks[0]?.id ?? "", {
    completionId: id,
    completedOn: d("2026-10-21"),
    completedBy: by,
  }).data;
}

describe("Sync: Anzeigen und Speichern gehen lokal, auch offline", () => {
  it("Das erste Gerät holt die Daten vom Server, bevor es etwas zeigt", async () => {
    const { device } = household(dataWith([weekly()]));
    const a = device("a");

    const data = await a.storage.load();

    expect(data.tasks.map((task) => task.id)).toEqual(["t-bad"]);
    expect(data.settings.personNames).toEqual(names);
  });

  it("Ein Gerät ohne Verbindung und ohne Kopie zeigt leere Daten, bis es Verbindung hat", async () => {
    const { device } = household(dataWith([weekly()]));
    const a = device("a");
    a.remote.online = false;

    expect(await a.storage.load()).toEqual(emptyAppData());
    a.remote.online = true;
    await a.storage.sync();

    expect(a.updates.some((u) => u.type === "data" && u.data.tasks.length === 1)).toBe(true);
    expect((await a.storage.load()).tasks).toHaveLength(1);
  });

  it("Eine vorhandene Kopie wird sofort gezeigt, der Abgleich läuft danach", async () => {
    const { device, server } = household(dataWith([weekly()]));
    const a = device("a");
    await a.storage.load();
    const b = device("b");
    await b.storage.load();
    await b.storage.save(dataWith([weekly(), once()]));
    await b.storage.sync();
    a.remote.online = false;

    const offline = await a.storage.load();
    a.remote.online = true;
    await a.storage.sync();

    expect(offline.tasks).toHaveLength(1);
    expect(a.updates.at(-1)).toMatchObject({ type: "status", status: { state: "synced" } });
    expect((await a.storage.load()).tasks).toHaveLength(2);
    expect(server.snapshot().tasks).toHaveLength(2);
  });

  it("Speichern ändert sofort die lokale Anzeige und wartet nicht auf den Server", async () => {
    const { device } = household(dataWith([]));
    const a = device("a");
    await a.storage.load();
    a.remote.online = false;

    const shown = await a.storage.save(dataWith([weekly()]));

    expect(shown.tasks).toHaveLength(1);
    expect((await a.storage.load()).tasks).toHaveLength(1);
  });

  it("Speichern gleicher Daten tut nichts", async () => {
    const { device } = household(dataWith([weekly()]));
    const a = device("a");
    const data = await a.storage.load();

    await a.storage.save(data);
    await a.storage.sync();

    expect(a.remote.pushed).toEqual([]);
  });

  it("Der Abgleichsstand: übertragen, wartend, offline, Server nicht erreichbar", async () => {
    const { device } = household(dataWith([]));
    const a = device("a");
    await a.storage.load();
    expect(a.storage.syncStatus()).toEqual({ state: "synced" });

    a.remote.online = false;
    await a.storage.save(dataWith([weekly()]));
    await a.storage.sync();
    expect(a.storage.syncStatus()).toEqual({ state: "offline", pending: 1 });

    const unreachable = device("u");
    const reachable = createSyncedStorage({
      remote: unreachable.remote,
      store: unreachable.store,
      device: { loadDevice: async () => ({}), saveDevice: async () => undefined },
      locker: memoryLocker(),
      isOnline: () => true, // online, but the server does not answer
    });
    unreachable.remote.online = false;
    await reachable.load();
    expect(reachable.syncStatus()).toEqual({ state: "unreachable", pending: 0 });

    a.remote.online = true;
    await a.storage.sync();
    expect(a.storage.syncStatus()).toEqual({ state: "synced" });
  });

  it("Der Stand 'wird übertragen' gilt, solange Änderungen warten und noch nichts versucht wurde", async () => {
    const { device } = household(dataWith([]));
    const a = device("a");
    await a.storage.load();
    a.remote.online = false;
    await a.storage.save(dataWith([weekly()]));
    await a.storage.sync();
    a.remote.online = true;

    const connectionNotYetTried = createSyncedStorage({
      remote: a.remote,
      store: a.store,
      device: { loadDevice: async () => ({}), saveDevice: async () => undefined },
      locker: memoryLocker(),
    });

    expect(connectionNotYetTried.syncStatus()).toEqual({ state: "syncing", pending: 1 });
  });
});

describe("Sync: Offline – Änderungen werden nachgereicht", () => {
  it("Offline geändert und abgehakt: nach dem Wiederverbinden sieht das andere Gerät alles", async () => {
    const { device } = household(dataWith([weekly(), once()]));
    const a = device("a");
    const b = device("b");
    const start = await a.storage.load();
    await b.storage.load();
    a.remote.online = false;

    const edited = await a.storage.save({
      ...start,
      tasks: start.tasks.map((task) => (task.id === "t-paket" ? { ...task, title: "Neu" } : task)),
    });
    await a.storage.save(ticked(edited, "c-a", "personA"));
    await a.storage.sync();
    await b.storage.sync();

    expect(a.storage.syncStatus()).toEqual({ state: "offline", pending: 2 });
    expect((await b.storage.load()).completions).toEqual([]);

    a.remote.online = true;
    await a.storage.sync();
    await b.storage.sync();

    const seen = await b.storage.load();
    expect(seen.tasks.find((task) => task.id === "t-paket")?.title).toBe("Neu");
    expect(seen.completions.map((c) => c.id)).toEqual(["c-a"]);
    expect(seen.tasks.find((task) => task.id === "t-bad")?.dueDate).toBe("2026-10-28");
    expect(a.storage.syncStatus()).toEqual({ state: "synced" });
  });

  it("Die wartenden Änderungen überstehen einen Neustart (sie liegen im Browser-Speicher)", async () => {
    const { device, server } = household(dataWith([]));
    const a = device("a");
    await a.storage.load();
    a.remote.online = false;
    await a.storage.save(dataWith([weekly()]));

    const restarted = createSyncedStorage({
      remote: a.remote,
      store: a.store,
      device: { loadDevice: async () => ({}), saveDevice: async () => undefined },
      locker: memoryLocker(),
      newId: idCounter("neu"),
    });
    expect((await restarted.load()).tasks).toHaveLength(1);
    a.remote.online = true;
    await restarted.sync();

    expect(server.snapshot().tasks.map((task) => task.id)).toEqual(["t-bad"]);
    expect(restarted.syncStatus()).toEqual({ state: "synced" });
  });

  it("Geht die Antwort des Servers verloren, wird die Änderung beim nächsten Versuch nicht doppelt angewendet", async () => {
    const { device, server } = household(dataWith([weekly()]));
    const a = device("a");
    const start = await a.storage.load();
    a.remote.loseNextAnswer = true;

    await a.storage.save(ticked(start, "c-a", "personA"));
    await a.storage.sync();

    // Delivered twice (the first answer was lost), counted once.
    expect(a.remote.pushed.map((c) => c.id)).toEqual(["a-1", "a-1"]);
    expect(server.snapshot().completions.map((c) => c.id)).toEqual(["c-a"]);
    expect(a.updates.filter((u) => u.type === "conflict")).toEqual([]);
    expect(a.storage.syncStatus()).toEqual({ state: "synced" });
  });
});

describe("Sync: Zwei Geräte", () => {
  it("Eine Änderung auf A erscheint auf B, ohne dass B etwas tut", async () => {
    const { device } = household(dataWith([weekly()]));
    const a = device("a");
    const b = device("b");
    const start = await a.storage.load();
    await b.storage.load();
    b.updates.length = 0;

    await a.storage.save({ ...start, tasks: [{ ...weekly(), title: "Badezimmer" }] });
    await a.storage.sync();
    await b.storage.sync();

    const update = b.updates.find((u) => u.type === "data");
    expect(update).toMatchObject({ type: "data", data: { tasks: [{ title: "Badezimmer" }] } });
  });

  it("start: ein Hinweis des Servers löst den Abgleich aus, stop beendet ihn", async () => {
    const { device } = household(dataWith([weekly()]));
    const a = device("a");
    const b = device("b");
    await b.storage.load();
    const start = await a.storage.load();
    const stop = b.storage.start();
    await new Promise((resolve) => setTimeout(resolve, 20));

    await a.storage.save({ ...start, tasks: [{ ...weekly(), title: "Per Hinweis" }] });
    await a.storage.sync();
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect((await b.storage.load()).tasks[0]?.title).toBe("Per Hinweis");
    stop();
    await a.storage.save({ ...start, tasks: [{ ...weekly(), title: "Nach dem Stopp" }] });
    await a.storage.sync();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(b.updates.filter((u) => u.type === "data").at(-1)).toMatchObject({
      data: { tasks: [{ title: "Per Hinweis" }] },
    });
  });

  it("Speichern vergleicht mit dem, was die App zuletzt bekommen hat – auch mit dem, was vom anderen Gerät kam", async () => {
    const { device } = household(dataWith([weekly()]));
    const a = device("a");
    const b = device("b");
    await a.storage.load();
    await b.storage.load();
    await b.storage.save(dataWith([weekly(), once()]));
    await b.storage.sync();
    await a.storage.sync(); // the app of A is told about the new task ...
    const update = a.updates.filter((u) => u.type === "data").at(-1);
    expect(update).toMatchObject({ data: { tasks: [{ id: "t-bad" }, { id: "t-paket" }] } });

    // ... and then deletes it: that is one change, not a loss of everything the app did not know.
    await a.storage.save(dataWith([weekly()]));
    await a.storage.sync();
    await b.storage.sync();

    expect((await b.storage.load()).tasks.map((task) => task.id)).toEqual(["t-bad"]);
  });

  it("Speichern gibt zurück, was die Warteschlange zusätzlich enthält (zwei Tabs)", async () => {
    const { device } = household(dataWith([weekly()]));
    const a = device("a");
    const old = await a.storage.load();
    // Another tab of the same device saved a new task; this tab's app does not know yet.
    const otherTab = createSyncedStorage({
      remote: a.remote,
      store: a.store,
      device: { loadDevice: async () => ({}), saveDevice: async () => undefined },
      locker: memoryLocker(),
      newId: idCounter("tab2"),
    });
    await otherTab.load();
    await otherTab.save(dataWith([weekly(), once()]));

    const shown = await a.storage.save({ ...old, settings: { personNames: names } });

    expect(shown.tasks.map((task) => task.id).sort()).toEqual(["t-bad", "t-paket"]);
  });
});

describe("Sync: Konflikte auf zwei Geräten", () => {
  it("Konflikt: Bearbeiten verschiedener Felder – beide Änderungen bleiben erhalten", async () => {
    const { device } = household(dataWith([weekly()]));
    const a = device("a");
    const b = device("b");
    const start = await a.storage.load();
    await b.storage.load();
    a.remote.online = false;
    b.remote.online = false;

    await a.storage.save({ ...start, tasks: [{ ...weekly(), title: "Badezimmer" }] });
    await b.storage.save({ ...start, tasks: [{ ...weekly(), assignee: "personB" }] });
    a.remote.online = true;
    b.remote.online = true;
    await a.storage.sync();
    await b.storage.sync();
    await a.storage.sync();

    for (const side of [a, b]) {
      expect((await side.storage.load()).tasks[0]).toMatchObject({
        title: "Badezimmer",
        assignee: "personB",
      });
    }
  });

  it("Konflikt: Dasselbe Feld – die zuletzt beim Server angekommene Änderung gewinnt, nicht die zuletzt gemachte", async () => {
    const { device } = household(dataWith([weekly()]));
    const a = device("a");
    const b = device("b");
    const start = await a.storage.load();
    await b.storage.load();
    a.remote.online = false;
    b.remote.online = false;

    await b.storage.save({ ...start, tasks: [{ ...weekly(), title: "Von B (zuerst gemacht)" }] });
    await a.storage.save({ ...start, tasks: [{ ...weekly(), title: "Von A (später gemacht)" }] });
    a.remote.online = true;
    await a.storage.sync(); // A reaches the server first
    b.remote.online = true;
    await b.storage.sync(); // B arrives last
    await a.storage.sync();

    expect((await a.storage.load()).tasks[0]?.title).toBe("Von B (zuerst gemacht)");
    expect((await b.storage.load()).tasks[0]?.title).toBe("Von B (zuerst gemacht)");
  });

  it("Konflikt: Gleichzeitiges Abhaken zählt einmal – das zweite Gerät zeigt den Serverstand und meldet, wer es war", async () => {
    const { device, server } = household(dataWith([weekly()]));
    const a = device("a");
    const b = device("b");
    const start = await a.storage.load();
    await b.storage.load();
    a.remote.online = false;
    b.remote.online = false;

    await a.storage.save(ticked(start, "c-a", "personA"));
    await b.storage.save(ticked(start, "c-b", "personB"));
    a.remote.online = true;
    await a.storage.sync();
    b.remote.online = true;
    await b.storage.sync();

    expect(server.snapshot().completions.map((c) => c.id)).toEqual(["c-a"]);
    const shownOnB = await b.storage.load();
    expect(shownOnB.completions.map((c) => c.id)).toEqual(["c-a"]);
    expect(shownOnB.tasks[0]?.dueDate).toBe("2026-10-28");
    expect(b.updates).toContainEqual({
      type: "conflict",
      reason: "alreadyDone",
      taskId: "t-bad",
      by: "personA",
    });
    expect(a.updates.filter((u) => u.type === "conflict")).toEqual([]);
    await b.storage.sync(); // the `load` above started a sync of its own
    expect(b.storage.syncStatus()).toEqual({ state: "synced" });
  });

  it("Konflikt: Löschen gewinnt gegen Bearbeiten", async () => {
    const { device, server } = household(dataWith([weekly(), once()]));
    const a = device("a");
    const b = device("b");
    const start = await a.storage.load();
    await b.storage.load();
    a.remote.online = false;
    b.remote.online = false;

    await a.storage.save({ ...start, tasks: start.tasks.filter((task) => task.id !== "t-bad") });
    await b.storage.save({
      ...start,
      tasks: start.tasks.map((task) =>
        task.id === "t-bad" ? { ...task, title: "Bearbeitet" } : task,
      ),
    });
    a.remote.online = true;
    await a.storage.sync();
    b.remote.online = true;
    await b.storage.sync();

    expect(server.snapshot().tasks.map((task) => task.id)).toEqual(["t-paket"]);
    expect((await b.storage.load()).tasks.map((task) => task.id)).toEqual(["t-paket"]);
    expect(b.updates).toContainEqual({ type: "conflict", reason: "taskGone", taskId: "t-bad" });
  });

  it("Konflikt: Rückgängig geht nicht, wenn die Aufgabe inzwischen erneut abgehakt wurde", async () => {
    const { device, server } = household(dataWith([weekly()]));
    const a = device("a");
    const b = device("b");
    const start = await a.storage.load();
    await b.storage.load();
    await a.storage.save(ticked(start, "c-1", "personA"));
    await a.storage.sync();
    await b.storage.sync();
    const onB = await b.storage.load();
    a.remote.online = false;
    const withUndo = undoInData(await a.storage.load(), "c-1").data;
    await a.storage.save(withUndo);
    await b.storage.save(
      completeInData(onB, "t-bad", {
        completionId: "c-2",
        completedOn: d("2026-10-28"),
        completedBy: "personB",
      }).data,
    );
    await b.storage.sync();
    a.remote.online = true;
    await a.storage.sync();

    expect(server.snapshot().completions.map((c) => c.id)).toEqual(["c-1", "c-2"]);
    expect((await a.storage.load()).completions.map((c) => c.id)).toEqual(["c-1", "c-2"]);
    expect(a.updates).toContainEqual({ type: "conflict", reason: "notLast" });
  });

  it("Alles wird von beiden Geräten gesehen, auch Löschen einer Aufgabe mit Erledigungen", async () => {
    const { device } = household(dataWith([weekly()], [completion()]));
    const a = device("a");
    const b = device("b");
    const start = await a.storage.load();
    await b.storage.load();

    await a.storage.save({ ...start, tasks: [], completions: [] });
    await a.storage.sync();
    await b.storage.sync();

    const seen = await b.storage.load();
    expect(seen.tasks).toEqual([]);
    expect(seen.completions).toEqual([]);
  });
});

describe("Sync: mehrere Tabs und Sonderfälle", () => {
  it("Zwei Tabs mit demselben Browser-Speicher: beide Änderungen landen in der Warteschlange und werden gesendet", async () => {
    const { server } = household(dataWith([weekly()]));
    const store = new FakeStore();
    const locker = memoryLocker();
    const remote = new FakeRemote(server);
    remote.online = false;
    const tab = (prefix: string) =>
      createSyncedStorage({
        remote,
        store,
        device: { loadDevice: async () => ({}), saveDevice: async () => undefined },
        locker,
        newId: idCounter(prefix),
        isOnline: () => false,
      });
    const one = tab("eins");
    const two = tab("zwei");
    remote.online = true;
    const start = await one.load();
    await two.load();
    remote.online = false;

    await one.save({ ...start, tasks: [{ ...weekly(), title: "Tab 1" }] });
    await two.save({
      ...start,
      tasks: [...start.tasks, once()],
    });
    remote.online = true;
    // Both tabs are told; the one that gets the lock does the work for both.
    await Promise.all([one.sync(), two.sync()]);

    expect(server.snapshot().tasks.map((task) => [task.id, task.title])).toEqual([
      ["t-bad", "Tab 1"],
      ["t-paket", "Paket abholen"],
    ]);
  });

  it("Ein Tab, der den Speicher eines anderen sieht, meldet geänderte Daten (refresh über triggers)", async () => {
    const { server } = household(dataWith([]));
    const store = new FakeStore();
    const make = (triggers?: Parameters<typeof createSyncedStorage>[0]["triggers"]) => {
      const remote = new FakeRemote(server);
      remote.online = false;
      return createSyncedStorage({
        remote,
        store,
        device: { loadDevice: async () => ({}), saveDevice: async () => undefined },
        locker: memoryLocker(),
        isOnline: () => false,
        ...(triggers === undefined ? {} : { triggers }),
      });
    };
    let refresh = () => {};
    let stopped = false;
    const watching = make((actions) => {
      refresh = actions.refresh;
      return () => {
        stopped = true;
      };
    });
    const other = make();
    const seen: unknown[] = [];
    watching.subscribe((update) => {
      if (update.type === "data") seen.push(update.data.tasks.length);
    });
    await watching.load();
    const stop = watching.start();

    await other.load();
    await other.save(dataWith([weekly()]));
    refresh();
    await new Promise((resolve) => setTimeout(resolve, 20));
    stop();

    expect(seen).toEqual([1]);
    expect(stopped).toBe(true);
  });

  it("loadRaw zeigt die lokale Kopie, discard wirft sie weg und der nächste Start holt sie vom Server", async () => {
    const { device } = household(dataWith([weekly()]));
    const a = device("a");
    expect(await a.storage.loadRaw()).toBeNull();
    await a.storage.load();
    expect(JSON.parse((await a.storage.loadRaw()) as string).base.tasks).toHaveLength(1);

    await a.storage.discard();

    expect(await a.storage.loadRaw()).toBeNull();
    expect((await a.storage.load()).tasks).toHaveLength(1);
  });

  it("Eine beschädigte lokale Kopie wird gemeldet statt überschrieben", async () => {
    const { device } = household(dataWith([weekly()]));
    const a = device("a");
    a.store.items.set("kruemel:sync", "{kaputt");

    await expect(a.storage.load()).rejects.toBeInstanceOf(StorageError);
    expect(a.store.items.get("kruemel:sync")).toBe("{kaputt");
  });

  it("Ist der Browser-Speicher voll, scheitert Speichern mit StorageError und nichts wird gesendet", async () => {
    const { device } = household(dataWith([]));
    const a = device("a");
    await a.storage.load();
    a.store.failWith = new Error("voll");

    await expect(a.storage.save(dataWith([weekly()]))).rejects.toBeInstanceOf(StorageError);
    a.store.failWith = undefined;
    await a.storage.sync();

    expect(a.remote.pushed).toEqual([]);
  });

  it("Einspielen ersetzt die gemeinsamen Daten für beide, aber nur online", async () => {
    const { device, server } = household(dataWith([weekly()]));
    const a = device("a");
    const b = device("b");
    await a.storage.load();
    await b.storage.load();

    a.remote.online = false;
    await expect(a.storage.replaceAll(dataWith([once()]))).rejects.toBeInstanceOf(StorageError);
    a.remote.online = true;
    await a.storage.replaceAll(dataWith([once()]));
    await b.storage.sync();

    expect(server.snapshot().tasks.map((task) => task.id)).toEqual(["t-paket"]);
    expect((await b.storage.load()).tasks.map((task) => task.id)).toEqual(["t-paket"]);
  });

  it("Einspielen wird abgelehnt, solange noch Änderungen warten", async () => {
    const { device, server } = household(dataWith([weekly()]));
    const a = device("a");
    const start = await a.storage.load();
    a.remote.online = false;
    await a.storage.save({ ...start, tasks: [] });
    a.remote.online = true;
    // The pending deletion cannot be sent (the server fails on it), so nothing is replaced.
    a.remote.push = async () => {
      throw new RemoteError("Server meldet einen Fehler");
    };

    await expect(a.storage.replaceAll(dataWith([once()]))).rejects.toBeInstanceOf(StorageError);
    expect(server.snapshot().tasks.map((task) => task.id)).toEqual(["t-bad"]);
  });

  it("Einspielen: Geht der Server während des Sendens verloren, bleibt die Fehlermeldung verständlich", async () => {
    const { device, server } = household(dataWith([weekly()]));
    const a = device("a");
    await a.storage.load();
    a.remote.loseNextAnswer = true;

    await expect(a.storage.replaceAll(dataWith([once()]))).rejects.toThrow(
      "Das Einspielen einer Sicherung geht nur mit Internet.",
    );
    expect(server.snapshot().tasks.map((task) => task.id)).toEqual(["t-paket"]);
  });

  it("Gerätedaten (Ich bin, Darstellung) gehen am Server vorbei", async () => {
    const stored: unknown[] = [];
    const { server } = household(dataWith([]));
    const storage = createSyncedStorage({
      remote: new FakeRemote(server),
      store: new FakeStore(),
      device: {
        loadDevice: async () => ({ currentPerson: "personB" }),
        saveDevice: async (settings) => {
          stored.push(settings);
        },
      },
      locker: memoryLocker(),
    });

    expect(await storage.loadDevice()).toEqual({ currentPerson: "personB" });
    await storage.saveDevice({ colorScheme: "dark" });

    expect(stored).toEqual([{ colorScheme: "dark" }]);
  });

  it("Ein Aufruf des Abgleichs während eines Laufs läuft danach noch einmal und nimmt neue Änderungen mit", async () => {
    const { device, server } = household(dataWith([weekly()]));
    const a = device("a");
    const start = await a.storage.load();

    const first = a.storage.sync();
    await a.storage.save({ ...start, tasks: [{ ...weekly(), title: "Mitten im Lauf" }] });
    await first;
    await a.storage.sync();

    expect(server.snapshot().tasks[0]?.title).toBe("Mitten im Lauf");
  });

  it("Die Stände werden gemeldet: übertragen wird, dann übertragen ist", async () => {
    const { device } = household(dataWith([weekly()]));
    const a = device("a");
    const start = await a.storage.load();
    a.updates.length = 0;

    await a.storage.save({ ...start, tasks: [{ ...weekly(), title: "X" }] });
    await a.storage.sync();

    const states = a.updates.flatMap((u) => (u.type === "status" ? [u.status.state] : []));
    expect(states).toContain("syncing");
    expect(states.at(-1)).toBe("synced");
  });

  it("Unerwartete Fehler des Servers gehen nicht verloren", async () => {
    const { device } = household(dataWith([]));
    const a = device("a");
    await a.storage.load();
    a.remote.pull = async () => {
      throw new TypeError("kaputt");
    };

    await expect(a.storage.sync()).rejects.toThrow("kaputt");
  });
});
