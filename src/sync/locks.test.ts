import { describe, expect, it } from "vitest";
import { browserLocker, type LockManagerLike, memoryLocker, webLocker } from "./locks";

const pause = (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms));

describe("Sync: Sperren zwischen Tabs (Web Locks)", () => {
  it("Im Speicher: zwei Arbeiten mit demselben Namen laufen nacheinander", async () => {
    const locker = memoryLocker();
    const log: string[] = [];
    const job = (name: string) => async () => {
      log.push(`${name} Anfang`);
      await pause();
      log.push(`${name} Ende`);
      return name;
    };

    const results = await Promise.all([
      locker.exclusive("a", job("eins")),
      locker.exclusive("a", job("zwei")),
    ]);

    expect(results).toEqual(["eins", "zwei"]);
    expect(log).toEqual(["eins Anfang", "eins Ende", "zwei Anfang", "zwei Ende"]);
  });

  it("Im Speicher: verschiedene Namen blockieren sich nicht", async () => {
    const locker = memoryLocker();
    const log: string[] = [];
    const job = (name: string) => async () => {
      log.push(`${name} Anfang`);
      await pause();
      log.push(`${name} Ende`);
    };

    await Promise.all([locker.exclusive("a", job("eins")), locker.exclusive("b", job("zwei"))]);

    expect(log.slice(0, 2)).toEqual(["eins Anfang", "zwei Anfang"]);
  });

  it("Im Speicher: Scheitert eine Arbeit, kommt die nächste trotzdem dran", async () => {
    const locker = memoryLocker();

    const failing = locker.exclusive("a", async () => {
      throw new Error("kaputt");
    });
    const next = locker.exclusive("a", async () => "weiter");

    await expect(failing).rejects.toThrow("kaputt");
    await expect(next).resolves.toBe("weiter");
  });

  it("Im Speicher: tryExclusive gibt auf, wenn die Sperre belegt ist, und läuft sonst", async () => {
    const locker = memoryLocker();
    const busy = locker.exclusive("a", () => pause(20));

    expect(await locker.tryExclusive("a", async () => "nicht")).toBeUndefined();
    await busy;
    expect(await locker.tryExclusive("a", async () => "doch")).toBe("doch");
  });

  it("Web Locks: exclusive und tryExclusive reichen die Anfrage an den Browser weiter", async () => {
    const requests: { name: string; ifAvailable: boolean | undefined }[] = [];
    let held = false;
    const manager: LockManagerLike = {
      async request<T>(
        name: string,
        options: { readonly ifAvailable?: boolean },
        callback: (lock: object | null) => Promise<T>,
      ): Promise<T> {
        requests.push({ name, ifAvailable: options.ifAvailable });
        if (options.ifAvailable && held) {
          return callback(null);
        }
        return callback({});
      },
    };
    const locker = webLocker(manager);

    expect(await locker.exclusive("x", async () => 1)).toBe(1);
    expect(await locker.tryExclusive("x", async () => 2)).toBe(2);
    held = true;
    expect(await locker.tryExclusive("x", async () => 3)).toBeUndefined();
    expect(requests).toEqual([
      { name: "x", ifAvailable: undefined },
      { name: "x", ifAvailable: true },
      { name: "x", ifAvailable: true },
    ]);
  });

  it("Der Browser-Locker nimmt Web Locks, wenn es sie gibt, sonst Sperren im Speicher", async () => {
    let used = false;
    const manager: LockManagerLike = {
      async request(_name, _options, callback) {
        used = true;
        return callback({});
      },
    };

    await browserLocker(manager).exclusive("x", async () => undefined);
    expect(used).toBe(true);

    const without = browserLocker(undefined);
    expect(await without.exclusive("x", async () => "ok")).toBe("ok");
  });
});
