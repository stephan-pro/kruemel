import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PUSH_SETTINGS,
  keyIdOf,
  type PushSettings,
} from "../../supabase/functions/push/rules";
import type { KeyValueStore } from "../storage/localStorage";
import { FAKE_VAPID_PUBLIC_KEY } from "./fakeHttpPushApi";
import {
  addressFrom,
  Notifications,
  notificationWay,
  type Permission,
  PUSH_DEVICE_KEY,
  PUSH_SETTINGS_KEY,
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

type ApiCall = "register" | "unregister" | "sendTest" | "settings" | "updateSettings";

/**
 * The server: devices by id and their settings; `failure` makes every call fail with it, `fail`
 * only the named calls. `apiCalls` lists what was asked.
 */
function server() {
  const devices = new Map<string, DeviceRegistration>();
  const settings = new Map<string, PushSettings>();
  const tests: string[] = [];
  const apiCalls: string[] = [];
  const state: { failure?: PushError; fail: Partial<Record<ApiCall, PushError>> } = { fail: {} };
  const enter = (call: ApiCall) => {
    apiCalls.push(call);
    const failure = state.fail[call] ?? state.failure;
    if (failure) throw failure;
  };
  const api: PushApi = {
    register: async (device) => {
      enter("register");
      devices.set(device.deviceId, device);
      if (!settings.has(device.deviceId)) settings.set(device.deviceId, DEFAULT_PUSH_SETTINGS);
    },
    unregister: async (deviceId) => {
      enter("unregister");
      devices.delete(deviceId);
      settings.delete(deviceId);
    },
    sendTest: async (deviceId) => {
      enter("sendTest");
      tests.push(deviceId);
    },
    settings: async (deviceId) => {
      enter("settings");
      return settings.get(deviceId) ?? null;
    },
    updateSettings: async (deviceId, next) => {
      enter("updateSettings");
      settings.set(deviceId, next);
    },
  };
  return { api, devices, settings, tests, apiCalls, state };
}

function setup(
  options: Parameters<typeof browser>[0] & {
    publicKey?: string;
    userId?: string;
    timeZone?: () => string;
  } = {},
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
      timeZone: options.timeZone ?? (() => "Europe/Berlin"),
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

  it("NT-a Status aus, wenn der Speicher kaputt ist", async () => {
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

  it("NT-b Gerät beim Server weg (abgelaufen, unbekannt, neuer Schlüssel): danach „abgemeldet“", async () => {
    for (const failure of ["deviceGone", "deviceUnknown", "keyChanged"] as const) {
      const { notifications, state } = setup();
      await notifications.enable();
      state.failure = new PushError(failure);

      expect(await failureOf(notifications.sendTest())).toBe(failure);
      expect(await notifications.status()).toBe("lost");
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

const NEW_ADDRESS: PushAddress = {
  endpoint: "https://fcm.googleapis.com/fcm/send/vom-browser-ersetzt",
  p256dh: `B${"q".repeat(86)}`,
  auth: "b".repeat(22),
};

describe("NT-b Abgleich beim Start", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("NT-b Zeitzone und neue Adresse des Browsers werden nachgeführt, die Einstellungen bleiben", async () => {
    let zone = "Europe/Berlin";
    const { notifications, make, setAddress, devices, settings, store } = setup({
      timeZone: () => zone,
    });
    await notifications.enable();
    const deviceId = [...devices.keys()][0] ?? "";
    const chosen = { ...DEFAULT_PUSH_SETTINGS, dailyTime: "06:45" };
    await notifications.saveSettings(chosen);
    zone = "America/New_York";
    setAddress(NEW_ADDRESS);

    await make().sync();

    expect(devices.get(deviceId)).toMatchObject({
      endpoint: NEW_ADDRESS.endpoint,
      timeZone: "America/New_York",
    });
    expect(settings.get(deviceId)).toEqual(chosen);
    expect(JSON.parse(store.getItem(PUSH_DEVICE_KEY) ?? "{}")).toMatchObject({
      endpoint: NEW_ADDRESS.endpoint,
      timeZone: "America/New_York",
    });
    expect(await notifications.status()).toBe("active");
  });

  it("NT-b Hat der Browser die Adresse verloren, macht die App still eine neue; gelingt das nicht: abgemeldet", async () => {
    const lost = setup();
    await lost.notifications.enable();
    lost.setAddress(null);
    await lost.make().sync();
    expect(lost.calls).toEqual(["ask", "subscribe 65", "subscribe 65"]);
    expect(await lost.notifications.status()).toBe("active");

    const stuck = setup();
    await stuck.notifications.enable();
    stuck.setAddress(null);
    stuck.port.subscribe = async () => {
      throw new PushError("pushFailed");
    };
    await stuck.make().sync();
    expect(await stuck.notifications.status()).toBe("lost");
    // "Neu einschalten" is a tap on "Aktivieren" again.
    stuck.port.subscribe = browser().port.subscribe;
    expect(await stuck.make().enable()).toBe("active");
    expect(await stuck.notifications.status()).toBe("active");
  });

  it("NT-b Kennt der Server das Gerät nicht mehr (90 Tage nicht benutzt), ist es abgemeldet", async () => {
    const { notifications, make, settings, store, devices } = setup();
    await notifications.enable();
    settings.clear();
    devices.clear();

    await make().sync();

    expect(await notifications.status()).toBe("lost");
    expect(store.getItem(PUSH_SETTINGS_KEY)).toBeNull();
    expect(await failureOf(notifications.saveSettings(DEFAULT_PUSH_SETTINGS))).toBe(
      "deviceUnknown",
    );
  });

  it("NT-b Ohne Internet, ohne Erlaubnis, für ein anderes Konto oder ohne Einschalten ändert der Abgleich nichts", async () => {
    const offline = setup();
    await offline.notifications.enable();
    offline.state.failure = new PushError("offline");
    await offline.make().sync();
    expect(offline.apiCalls.at(-1)).toBe("settings");
    expect(await offline.notifications.status()).toBe("active");

    const robin = setup();
    await robin.notifications.enable();
    robin.apiCalls.length = 0;
    await robin.make("u-robin").sync();
    expect(robin.apiCalls).toEqual([]);

    const blocked = setup({ permission: "denied" });
    blocked.store.setItem(
      PUSH_DEVICE_KEY,
      JSON.stringify({
        deviceId: "d-1",
        userId: "u-alex",
        keyId: await keyIdOf(KEY),
        endpoint: "https://fcm.googleapis.com/fcm/send/x",
      }),
    );
    await blocked.make().sync();
    expect(blocked.apiCalls).toEqual([]);
    expect(await setup({ publicKey: "" }).make().sync()).toBeUndefined();
  });

  it("NT-b Gleich noch einmal angestoßen, passiert nichts; „wieder online“ erzwingt den Abgleich", async () => {
    const { notifications, make, apiCalls } = setup();
    await notifications.enable();
    const same = make();
    const asked = () => apiCalls.filter((call) => call === "settings").length;

    await Promise.all([same.sync(), same.sync()]);
    await same.sync();
    expect(asked()).toBe(1);
    await same.sync(true);
    expect(asked()).toBe(2);
  });

  it("NT-b Abmelden schaltet aus, ohne Verbindung holt der nächste Start desselben Kontos es nach", async () => {
    const { notifications, make, state, devices, calls, store } = setup();
    await notifications.enable();
    const deviceId = [...devices.keys()][0] ?? "";
    state.fail.unregister = new PushError("offline");

    await notifications.release();

    expect(calls.at(-1)).toBe("unsubscribe");
    expect(devices.size).toBe(1);
    expect(JSON.parse(store.getItem(PUSH_DEVICE_KEY) ?? "{}")).toEqual({
      deviceId,
      unregisterFor: "u-alex",
    });
    expect(await notifications.status()).toBe("off");

    // Somebody else on the same browser leaves it alone.
    await make("u-robin").sync();
    expect(devices.size).toBe(1);
    state.fail = {};
    await make().sync();
    expect(devices.size).toBe(0);
    expect(JSON.parse(store.getItem(PUSH_DEVICE_KEY) ?? "{}")).toEqual({ deviceId });
  });

  it("NT-b Abmelden: erst der Server, dann der Browser; bei einem Gerät ohne Einschalten nichts; hängt das Netz, wartet es nicht ewig", async () => {
    const on = setup();
    await on.notifications.enable();
    await on.notifications.release();
    expect(on.devices.size).toBe(0);
    expect(await on.notifications.status()).toBe("off");

    const off = setup();
    await off.notifications.release();
    expect(off.calls).toEqual([]);

    vi.useFakeTimers();
    const hanging = setup();
    await hanging.notifications.enable();
    hanging.api.unregister = () => new Promise(() => undefined);
    const released = hanging.notifications.release();
    await vi.advanceTimersByTimeAsync(4_000);
    await released;
    expect(JSON.parse(hanging.store.getItem(PUSH_DEVICE_KEY) ?? "{}").unregisterFor).toBe("u-alex");
  });

  it("NT-b Konto gelöscht: nur die Adresse des Browsers endet, der Server wird nicht gefragt", async () => {
    const { notifications, calls, store, devices, make } = setup();
    await notifications.enable();
    calls.length = 0;

    await make("u-robin").forget();
    expect(calls).toEqual([]);
    await notifications.forget();

    expect(calls).toEqual(["unsubscribe"]);
    expect(Object.keys(JSON.parse(store.getItem(PUSH_DEVICE_KEY) ?? "{}"))).toEqual(["deviceId"]);
    expect(devices.size).toBe(1);
  });
});

describe("NT-b Einstellungen des Geräts", () => {
  it("NT-b Laden: Standardwerte vom Server, andere Konten und abgemeldete Geräte bekommen nichts", async () => {
    const { notifications, make, settings, devices } = setup();
    expect(await failureOf(notifications.loadSettings())).toBe("deviceUnknown");
    await notifications.enable();

    expect(await notifications.loadSettings()).toEqual({
      settings: DEFAULT_PUSH_SETTINGS,
      pending: false,
    });
    expect(await failureOf(make("u-robin").loadSettings())).toBe("deviceUnknown");

    // The server forgot the device: the settings cannot be read, the device is "lost".
    settings.clear();
    devices.clear();
    expect(await failureOf(notifications.loadSettings())).toBe("deviceUnknown");
    expect(await notifications.status()).toBe("lost");
  });

  it("NT-b Ohne Internet zeigt das Laden die zuletzt bekannten Einstellungen, ohne sie gibt es einen Fehler", async () => {
    const { notifications, state } = setup();
    await notifications.enable();
    state.fail.settings = new PushError("offline");
    expect(await failureOf(notifications.loadSettings())).toBe("offline");
    delete state.fail.settings;
    await notifications.loadSettings();

    state.fail.settings = new PushError("offline");
    expect(await notifications.loadSettings()).toEqual({
      settings: DEFAULT_PUSH_SETTINGS,
      pending: false,
    });
    state.fail.settings = new PushError("unknown");
    expect(await failureOf(notifications.loadSettings())).toBe("unknown");
  });

  it("NT-b Speichern: prüft die Werte, schickt sie zum Server und merkt sie sich", async () => {
    const { notifications, settings, devices, apiCalls, store } = setup();
    await notifications.enable();
    const deviceId = [...devices.keys()][0] ?? "";
    const chosen: PushSettings = {
      ...DEFAULT_PUSH_SETTINGS,
      dailyTime: "06:00",
      dailyDays: 0b0011111,
      partnerEnabled: false,
      quietEnabled: false,
    };

    expect(await notifications.saveSettings(chosen)).toBe("saved");

    expect(settings.get(deviceId)).toEqual(chosen);
    expect(JSON.parse(store.getItem(PUSH_SETTINGS_KEY) ?? "{}")).toMatchObject({
      pending: false,
      settings: chosen,
    });
    apiCalls.length = 0;
    expect(await failureOf(notifications.saveSettings({ ...chosen, dailyTime: "25:00" }))).toBe(
      "settingsInvalid",
    );
    expect(await failureOf(notifications.saveSettings({ ...chosen, dailyDays: 0 }))).toBe(
      "settingsInvalid",
    );
    expect(apiCalls).toEqual([]);
  });

  it("NT-b Ohne Internet bleibt die Änderung „noch nicht übertragen“ und geht später von selbst hinaus", async () => {
    const { notifications, make, state, settings, devices, store } = setup();
    await notifications.enable();
    const deviceId = [...devices.keys()][0] ?? "";
    const chosen = { ...DEFAULT_PUSH_SETTINGS, householdEnabled: false };
    state.fail.updateSettings = new PushError("offline");

    expect(await notifications.saveSettings(chosen)).toBe("pending");

    expect(settings.get(deviceId)).toEqual(DEFAULT_PUSH_SETTINGS);
    expect(JSON.parse(store.getItem(PUSH_SETTINGS_KEY) ?? "{}").pending).toBe(true);
    // Still no internet: the form shows what was chosen, marked as waiting.
    expect(await notifications.loadSettings()).toEqual({ settings: chosen, pending: true });
    expect(await notifications.sendWaitingSettings()).toBe(true);

    // The next start with internet sends it.
    delete state.fail.updateSettings;
    await make().sync();
    expect(settings.get(deviceId)).toEqual(chosen);
    expect(await notifications.loadSettings()).toEqual({ settings: chosen, pending: false });
    expect(await notifications.sendWaitingSettings()).toBe(false);
  });

  it("NT-b Lehnt der Server die Einstellungen ab, bleibt das Bisherige; ist das Gerät weg, ist es abgemeldet", async () => {
    const { notifications, state, settings, devices, store } = setup();
    await notifications.enable();
    const deviceId = [...devices.keys()][0] ?? "";

    // Nothing kept before: nothing kept after.
    state.fail.updateSettings = new PushError("settingsInvalid");
    expect(await failureOf(notifications.saveSettings(DEFAULT_PUSH_SETTINGS))).toBe(
      "settingsInvalid",
    );
    expect(store.getItem(PUSH_SETTINGS_KEY)).toBeNull();

    // Something kept before: that stays.
    delete state.fail.updateSettings;
    await notifications.loadSettings();
    state.fail.updateSettings = new PushError("unknown");
    const other = { ...DEFAULT_PUSH_SETTINGS, quietEnabled: false };
    expect(await failureOf(notifications.saveSettings(other))).toBe("unknown");
    expect(await notifications.loadSettings()).toEqual({
      settings: DEFAULT_PUSH_SETTINGS,
      pending: false,
    });
    expect(settings.get(deviceId)).toEqual(DEFAULT_PUSH_SETTINGS);

    state.fail.updateSettings = new PushError("deviceUnknown");
    expect(await failureOf(notifications.saveSettings(other))).toBe("deviceUnknown");
    expect(await notifications.status()).toBe("lost");
  });

  it("NT-b Eine wartende Änderung, die der Server nie annimmt, wird verworfen; ein weg gewordenes Gerät ist abgemeldet", async () => {
    const refused = setup();
    await refused.notifications.enable();
    refused.state.fail.updateSettings = new PushError("offline");
    await refused.notifications.saveSettings({ ...DEFAULT_PUSH_SETTINGS, quietEnabled: false });
    refused.state.fail.updateSettings = new PushError("settingsInvalid");

    expect(await refused.notifications.sendWaitingSettings()).toBe(false);
    expect(refused.store.getItem(PUSH_SETTINGS_KEY)).toBeNull();
    expect(await refused.notifications.status()).toBe("active");

    const gone = setup();
    await gone.notifications.enable();
    gone.state.fail.updateSettings = new PushError("offline");
    await gone.notifications.saveSettings({ ...DEFAULT_PUSH_SETTINGS, quietEnabled: false });
    gone.state.fail.updateSettings = new PushError("deviceGone");

    expect(await gone.notifications.sendWaitingSettings()).toBe(false);
    expect(await gone.notifications.status()).toBe("lost");
  });

  it("NT-b Kaputte oder fremde Einstellungen im Gerätespeicher werden nicht benutzt", async () => {
    const { notifications, store, make } = setup();
    await notifications.enable();
    store.setItem(PUSH_SETTINGS_KEY, "{kaputt");
    expect((await notifications.loadSettings()).settings).toEqual(DEFAULT_PUSH_SETTINGS);

    store.setItem(
      PUSH_SETTINGS_KEY,
      JSON.stringify({
        userId: "u-alex",
        deviceId: "ein-anderes-geraet",
        pending: true,
        settings: { ...DEFAULT_PUSH_SETTINGS, dailyEnabled: false },
      }),
    );
    expect((await make().loadSettings()).pending).toBe(false);
    store.setItem(
      PUSH_SETTINGS_KEY,
      JSON.stringify({
        userId: "u-alex",
        deviceId: JSON.parse(store.getItem(PUSH_DEVICE_KEY) ?? "{}").deviceId,
        pending: true,
        settings: { ...DEFAULT_PUSH_SETTINGS, dailyDays: 0 },
      }),
    );
    expect((await make().loadSettings()).pending).toBe(false);
  });
});
