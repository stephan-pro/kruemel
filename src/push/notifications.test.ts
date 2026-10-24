import { describe, expect, it } from "vitest";
import type { KeyValueStore } from "../storage/localStorage";
import { FAKE_VAPID_PUBLIC_KEY } from "./fakeHttpPushApi";
import {
  addressFrom,
  Notifications,
  notificationWay,
  type Permission,
  PUSH_DEVICE_KEY,
  type PushAddress,
  type PushPort,
  type PushSupport,
  pushSupport,
} from "./notifications";
import { type DeviceRegistration, type PushApi, PushError } from "./pushApi";

const KEY = FAKE_VAPID_PUBLIC_KEY;
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15";
const FIREFOX_ANDROID = "Mozilla/5.0 (Android 15; Mobile; rv:140.0) Gecko/140.0 Firefox/140.0";
const CHROME = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0";

function memoryStore(): KeyValueStore & { items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
    removeItem: (key) => {
      items.delete(key);
    },
  };
}

/** The browser: permission, answer to the question, push address; records the calls. */
function browser(
  options: { support?: PushSupport; permission?: Permission; answer?: Permission } = {},
) {
  const calls: string[] = [];
  let permission = options.permission ?? "default";
  let address: PushAddress | null = null;
  let made = 0;
  const port: PushPort = {
    support: () => options.support ?? "supported",
    permission: () => permission,
    requestPermission: async () => {
      calls.push("ask");
      permission = options.answer ?? "granted";
      return permission;
    },
    subscription: async () => address,
    subscribe: async (serverKey) => {
      calls.push(`subscribe ${serverKey.length}`);
      made++;
      address = {
        endpoint: `https://fcm.googleapis.com/fcm/send/geraet-${made}`,
        p256dh: `B${"p".repeat(86)}`,
        auth: "a".repeat(22),
        serverKey: KEY,
      };
      return address;
    },
    unsubscribe: async () => {
      calls.push("unsubscribe");
      address = null;
    },
  };
  return {
    port,
    calls,
    setAddress: (next: PushAddress | null) => {
      address = next;
    },
  };
}

/** The server: devices by id; `failure` makes every call fail with it. */
function server() {
  const devices = new Map<string, DeviceRegistration>();
  const tests: string[] = [];
  const state: { failure?: PushError } = {};
  const api: PushApi = {
    register: async (device) => {
      if (state.failure) throw state.failure;
      devices.set(device.deviceId, device);
    },
    unregister: async (deviceId) => {
      if (state.failure) throw state.failure;
      devices.delete(deviceId);
    },
    sendTest: async (deviceId) => {
      if (state.failure) throw state.failure;
      tests.push(deviceId);
    },
  };
  return { api, devices, tests, state };
}

function setup(
  options: Parameters<typeof browser>[0] & { publicKey?: string; userId?: string } = {},
) {
  const b = browser(options);
  const s = server();
  const store = memoryStore();
  const make = (userId = options.userId ?? "u-alex") =>
    new Notifications({
      port: b.port,
      api: s.api,
      store,
      publicKey: options.publicKey ?? KEY,
      userId,
      timeZone: () => "Europe/Berlin",
    });
  return { ...b, ...s, store, notifications: make(), make };
}

async function failureOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(PushError);
    return (error as PushError).failure;
  }
  throw new Error("Sollte scheitern");
}

describe("NT-a Unterstützung und Anleitung je Browser", () => {
  it("NT-a Unterstützungsprüfung: Push-API da, iPhone ohne Home-Bildschirm, sonst nicht unterstützt", () => {
    const traits = { userAgent: CHROME, maxTouchPoints: 0, standalone: false };

    expect(pushSupport({ ...traits, hasPush: true })).toBe("supported");
    expect(pushSupport({ ...traits, hasPush: false })).toBe("unsupported");
    expect(pushSupport({ ...traits, userAgent: IPHONE, hasPush: false })).toBe("iosHomeScreen");
    // From the home screen but still without the Push API (iOS before 16.4).
    expect(
      pushSupport({ userAgent: IPHONE, maxTouchPoints: 5, standalone: true, hasPush: false }),
    ).toBe("unsupported");
  });

  it("NT-a Anleitung bei „Blockiert“ passt zum Browser", () => {
    expect(notificationWay({ userAgent: IPHONE, maxTouchPoints: 5 })).toBe("ios");
    expect(notificationWay({ userAgent: FIREFOX_ANDROID, maxTouchPoints: 5 })).toBe(
      "firefoxAndroid",
    );
    expect(notificationWay({ userAgent: CHROME, maxTouchPoints: 0 })).toBe("other");
  });

  it("NT-a Die Push-Adresse des Browsers ohne Auffüllzeichen, mit dem Schlüssel, zu dem sie gehört", () => {
    expect(addressFrom({ endpoint: "https://x", keys: { p256dh: "abc=", auth: "de==" } })).toEqual({
      endpoint: "https://x",
      p256dh: "abc",
      auth: "de",
    });
    expect(addressFrom({}, Uint8Array.from([251, 255]).buffer).serverKey).toBe("-_8");
    expect(addressFrom({}, null)).toEqual({ endpoint: "", p256dh: "", auth: "" });
  });
});

describe("NT-a Berechtigungsstatus", () => {
  it("NT-a Status ohne Schlüssel, ohne Unterstützung, blockiert, aus", async () => {
    expect(await setup({ publicKey: "" }).notifications.status()).toBe("notConfigured");
    expect(await setup({ publicKey: "kaputt" }).notifications.status()).toBe("notConfigured");
    expect(await setup({ support: "unsupported" }).notifications.status()).toBe("unsupported");
    expect(await setup({ support: "iosHomeScreen" }).notifications.status()).toBe("iosHomeScreen");
    expect(await setup({ permission: "denied" }).notifications.status()).toBe("blocked");
    expect(await setup({ permission: "default" }).notifications.status()).toBe("off");
    // Allowed, but never switched on here.
    expect(await setup({ permission: "granted" }).notifications.status()).toBe("off");
  });

  it("NT-a Einschalten nur über „Aktivieren“: erst die Frage, dann Adresse, dann Anmeldung am Server", async () => {
    const { notifications, calls, devices } = setup();

    expect(await notifications.status()).toBe("off");
    expect(calls).toEqual([]);
    expect(await notifications.enable()).toBe("active");

    expect(calls).toEqual(["ask", "subscribe 65"]);
    expect([...devices.values()]).toEqual([
      {
        deviceId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        endpoint: "https://fcm.googleapis.com/fcm/send/geraet-1",
        p256dh: `B${"p".repeat(86)}`,
        auth: "a".repeat(22),
        keyId: expect.stringMatching(/^[A-Za-z0-9_-]{16}$/),
        timeZone: "Europe/Berlin",
        locale: "de",
      },
    ]);
    expect(await notifications.status()).toBe("active");
  });

  it("NT-a Frage abgelehnt: blockiert; Frage geschlossen: weiter aus; nichts am Server", async () => {
    const denied = setup({ answer: "denied" });
    expect(await denied.notifications.enable()).toBe("blocked");
    const closed = setup({ answer: "default" });
    expect(await closed.notifications.enable()).toBe("off");

    expect(denied.devices.size + closed.devices.size).toBe(0);
    expect(await setup({ publicKey: "" }).notifications.enable()).toBe("notConfigured");
    expect(await setup({ support: "unsupported" }).notifications.enable()).toBe("unsupported");
  });

  it("NT-a Schon erlaubt: keine zweite Frage; eine Adresse zum alten Schlüssel wird ersetzt", async () => {
    const { notifications, calls, setAddress } = setup({ permission: "granted" });
    setAddress({
      endpoint: "https://fcm.googleapis.com/fcm/send/alt",
      p256dh: `B${"p".repeat(86)}`,
      auth: "a".repeat(22),
      serverKey: `B${"x".repeat(86)}`,
    });

    expect(await notifications.enable()).toBe("active");
    expect(calls).toEqual(["unsubscribe", "subscribe 65"]);
  });

  it("NT-a Vorhandene Adresse zum selben Schlüssel wird weiter benutzt", async () => {
    const { notifications, calls, setAddress, devices } = setup({ permission: "granted" });
    setAddress({
      endpoint: "https://fcm.googleapis.com/fcm/send/schon-da",
      p256dh: `B${"p".repeat(86)}`,
      auth: "a".repeat(22),
    });

    expect(await notifications.enable()).toBe("active");
    expect(calls).toEqual([]);
    expect([...devices.values()][0]?.endpoint).toBe("https://fcm.googleapis.com/fcm/send/schon-da");
  });

  it("NT-a Push-Dienst außerhalb der Erlaubtliste: nicht unterstützt, die Adresse wird verworfen", async () => {
    const { notifications, calls, setAddress, devices } = setup({ permission: "granted" });
    setAddress({ endpoint: "https://push.example.com/abc", p256dh: "p", auth: "a" });

    expect(await failureOf(notifications.enable())).toBe("endpointInvalid");
    expect(calls).toEqual(["unsubscribe"]);
    expect(devices.size).toBe(0);
  });

  it("NT-a Ein anderes Konto auf demselben Browser sieht die Benachrichtigungen als aus", async () => {
    const { notifications, make } = setup();
    await notifications.enable();

    expect(await make("u-robin").status()).toBe("off");
    expect(await failureOf(make("u-robin").sendTest())).toBe("deviceUnknown");
  });

  it("NT-a Status aus, wenn der Browser die Adresse verloren hat oder der Speicher kaputt ist", async () => {
    const lost = setup();
    await lost.notifications.enable();
    lost.setAddress(null);
    expect(await lost.notifications.status()).toBe("off");

    const broken = setup({ permission: "granted" });
    broken.store.setItem(PUSH_DEVICE_KEY, "{kaputt");
    expect(await broken.notifications.status()).toBe("off");
    expect(JSON.parse(broken.store.getItem(PUSH_DEVICE_KEY) ?? "{}").deviceId).toMatch(/-/);
  });
});

describe("NT-a Testbenachrichtigung und Abmelden des Geräts", () => {
  it("NT-a Testbenachrichtigung geht an genau dieses Gerät", async () => {
    const { notifications, devices, tests } = setup();
    await notifications.enable();

    await notifications.sendTest();

    expect(tests).toEqual([...devices.keys()]);
  });

  it("NT-a Gerät beim Server weg (abgelaufen, unbekannt, neuer Schlüssel): danach aus", async () => {
    for (const failure of ["deviceGone", "deviceUnknown", "keyChanged"] as const) {
      const { notifications, state } = setup();
      await notifications.enable();
      state.failure = new PushError(failure);

      expect(await failureOf(notifications.sendTest())).toBe(failure);
      expect(await notifications.status()).toBe("off");
    }
    const waiting = setup();
    await waiting.notifications.enable();
    waiting.state.failure = new PushError("testWait");
    expect(await failureOf(waiting.notifications.sendTest())).toBe("testWait");
    expect(await waiting.notifications.status()).toBe("active");
  });

  it("NT-a Abmelden des Geräts: erst der Server, dann der Browser; die Geräte-Kennung bleibt", async () => {
    const { notifications, calls, devices, store } = setup();
    await notifications.enable();
    const deviceId = [...devices.keys()][0];

    expect(await notifications.disable()).toBe("off");
    expect(devices.size).toBe(0);
    expect(calls.at(-1)).toBe("unsubscribe");
    expect(JSON.parse(store.getItem(PUSH_DEVICE_KEY) ?? "{}")).toEqual({ deviceId });
    // Switched on again: the same device.
    await notifications.enable();
    expect([...devices.keys()]).toEqual([deviceId]);
  });

  it("NT-a Ohne Internet bleibt beim Ausschalten alles, wie es war", async () => {
    const { notifications, state, calls } = setup();
    await notifications.enable();
    state.failure = new PushError("offline");

    expect(await failureOf(notifications.disable())).toBe("offline");
    expect(calls).not.toContain("unsubscribe");
    delete state.failure;
    expect(await notifications.status()).toBe("active");
  });
});
