import { describe, expect, it } from "vitest";
import { browserTriggers } from "./triggers";

class FakeHost {
  readonly listeners = new Map<string, Set<(event: Event) => void>>();
  visibilityState = "visible";

  addEventListener(type: string, listener: (event: Event) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)?.add(listener);
  }

  removeEventListener(type: string, listener: (event: Event) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  fire(type: string, event: object = {}) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      listener(event as Event);
    }
  }
}

function setup() {
  const window = new FakeHost();
  const document = new FakeHost();
  const calls: string[] = [];
  const stop = browserTriggers({ window, document })({
    sync: () => calls.push("sync"),
    refresh: () => calls.push("refresh"),
  });
  return { window, document, calls, stop };
}

describe("Sync: Anlässe zum Abgleichen im Browser", () => {
  it("Wieder online: abgleichen", () => {
    const { window, calls } = setup();

    window.fire("online");

    expect(calls).toEqual(["sync"]);
  });

  it("App wieder sichtbar: abgleichen; unsichtbar: nichts", () => {
    const { document, calls } = setup();

    document.visibilityState = "hidden";
    document.fire("visibilitychange");
    document.visibilityState = "visible";
    document.fire("visibilitychange");

    expect(calls).toEqual(["sync"]);
  });

  it("Ein anderer Tab hat die lokale Kopie geändert: neu ansehen; andere Einträge ignorieren", () => {
    const { window, calls } = setup();

    window.fire("storage", { key: "kruemel:sync" });
    window.fire("storage", { key: "putzplan:device" });
    window.fire("storage", { key: null });

    expect(calls).toEqual(["refresh"]);
  });

  it("Nach stop reagiert nichts mehr", () => {
    const { window, document, calls, stop } = setup();

    stop();
    window.fire("online");
    window.fire("storage", { key: "kruemel:sync" });
    document.fire("visibilitychange");

    expect(calls).toEqual([]);
  });
});
