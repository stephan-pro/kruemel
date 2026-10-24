import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
  type SupabaseClient,
} from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { DEFAULT_PUSH_SETTINGS, isVapidPublicKey } from "../../supabase/functions/push/rules";
import { FAKE_VAPID_KEY_OVERRIDE, FakeHttpPushApi, fakeVapidPublicKey } from "./fakeHttpPushApi";
import { PushError } from "./pushApi";
import { SupabasePushApi } from "./supabasePushApi";

// The rules are tested against the database (supabase/tests/push.test.ts) and the Edge Function
// (supabase/functions/push/core.test.ts). Here: how the app calls them and reads their answers.

const DEVICE = {
  deviceId: "11111111-1111-4111-8111-111111111111",
  endpoint: "https://fcm.googleapis.com/fcm/send/abc",
  p256dh: `B${"p".repeat(86)}`,
  auth: "a".repeat(22),
  keyId: "schluessel-1",
  timeZone: "Europe/Berlin",
  locale: "de",
};

interface Stub {
  rpcError?: { message: string; code?: string };
  invokeError?: unknown;
  /** The row `select` finds ("HH:MM:SS" times), or `null` for none. */
  row?: Record<string, unknown> | null;
  calls: unknown[];
}

function client(stub: Stub): SupabaseClient {
  return {
    from: (table: string) => ({
      select: (columns: string) => ({
        eq: (column: string, value: string) => ({
          maybeSingle: async () => {
            stub.calls.push([table, columns.split(", ").length, column, value]);
            return { data: stub.row ?? null, error: stub.rpcError ?? null };
          },
        }),
      }),
    }),
    rpc: async (name: string, args: unknown) => {
      stub.calls.push([name, args]);
      return { data: null, error: stub.rpcError ?? null };
    },
    functions: {
      invoke: async (name: string, options: unknown) => {
        stub.calls.push([name, options]);
        return { data: null, error: stub.invokeError ?? null };
      },
    },
  } as unknown as SupabaseClient;
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

const httpError = (status: number, body: unknown) =>
  new FunctionsHttpError(new Response(JSON.stringify(body), { status }));

describe("NT-a SupabasePushApi", () => {
  it("NT-a Ein- und Ausschalten über die Datenbankfunktionen, Test über die Edge Function in Paris", async () => {
    const stub: Stub = { calls: [] };
    const api = new SupabasePushApi(client(stub));

    await api.register(DEVICE);
    await api.unregister(DEVICE.deviceId);
    await api.sendTest(DEVICE.deviceId);

    expect(stub.calls).toEqual([
      [
        "register_push_device",
        {
          p_device_id: DEVICE.deviceId,
          p_endpoint: DEVICE.endpoint,
          p_p256dh: DEVICE.p256dh,
          p_auth: DEVICE.auth,
          p_key_id: "schluessel-1",
          p_time_zone: "Europe/Berlin",
          p_locale: "de",
        },
      ],
      ["unregister_push_device", { p_device_id: DEVICE.deviceId }],
      ["push/test", { body: { deviceId: DEVICE.deviceId }, region: "eu-west-3" }],
    ]);
  });

  it("NT-a Fehler der Datenbank und der Edge Function werden zu klaren Gründen", async () => {
    const rpc = (rpcError: Stub["rpcError"]) =>
      new SupabasePushApi(client({ calls: [], ...(rpcError ? { rpcError } : {}) }));
    expect(
      await failureOf(rpc({ message: "push_endpoint_invalid", code: "P0001" }).register(DEVICE)),
    ).toBe("endpointInvalid");
    expect(await failureOf(rpc({ message: "Failed to fetch" }).unregister("x"))).toBe("offline");
    expect(await failureOf(rpc({ message: "anders", code: "42501" }).unregister("x"))).toBe(
      "unknown",
    );

    const invoke = (invokeError: unknown) =>
      new SupabasePushApi(client({ calls: [], invokeError })).sendTest("x");
    expect(await failureOf(invoke(httpError(429, { error: "testWait" })))).toBe("testWait");
    expect(await failureOf(invoke(httpError(500, { error: "geheim" })))).toBe("unknown");
    expect(await failureOf(invoke(new FunctionsHttpError(new Response("kaputt"))))).toBe("unknown");
    expect(await failureOf(invoke(new FunctionsFetchError(new Error("x"))))).toBe("offline");
    expect(await failureOf(invoke(new FunctionsRelayError(new Error("x"))))).toBe("unknown");
  });
});

describe("NT-b SupabasePushApi: Einstellungen", () => {
  it("NT-b Lesen aus der eigenen Zeile der Tabelle, Speichern über die Datenbankfunktion", async () => {
    const stub: Stub = {
      calls: [],
      row: {
        daily_enabled: false,
        daily_time: "06:30:00",
        daily_days: 31,
        partner_enabled: true,
        household_enabled: false,
        quiet_enabled: true,
        quiet_from: "22:00:00",
        quiet_to: "06:00:00",
      },
    };
    const api = new SupabasePushApi(client(stub));

    const settings = await api.settings(DEVICE.deviceId);
    await api.updateSettings(DEVICE.deviceId, DEFAULT_PUSH_SETTINGS);

    expect(settings).toEqual({
      dailyEnabled: false,
      dailyTime: "06:30",
      dailyDays: 31,
      partnerEnabled: true,
      householdEnabled: false,
      quietEnabled: true,
      quietFrom: "22:00",
      quietTo: "06:00",
    });
    expect(stub.calls).toEqual([
      ["push_devices", 8, "device_id", DEVICE.deviceId],
      [
        "update_push_settings",
        {
          p_device_id: DEVICE.deviceId,
          p_daily_enabled: true,
          p_daily_time: "07:30",
          p_daily_days: 127,
          p_partner_enabled: true,
          p_household_enabled: true,
          p_quiet_enabled: true,
          p_quiet_from: "21:00",
          p_quiet_to: "07:00",
        },
      ],
    ]);
  });

  it("NT-b Ein Gerät, das der Server nicht kennt, ist kein Fehler; Fehler werden zu klaren Gründen", async () => {
    const none = new SupabasePushApi(client({ calls: [], row: null }));
    expect(await none.settings("x")).toBeNull();

    const failing = (rpcError: Stub["rpcError"]) =>
      new SupabasePushApi(client({ calls: [], ...(rpcError ? { rpcError } : {}) }));
    expect(await failureOf(failing({ message: "Failed to fetch" }).settings("x"))).toBe("offline");
    expect(
      await failureOf(
        failing({ message: "push_settings_invalid", code: "P0001" }).updateSettings(
          "x",
          DEFAULT_PUSH_SETTINGS,
        ),
      ),
    ).toBe("settingsInvalid");
    expect(
      await failureOf(
        failing({ message: "push_device_unknown", code: "P0001" }).updateSettings(
          "x",
          DEFAULT_PUSH_SETTINGS,
        ),
      ),
    ).toBe("deviceUnknown");
  });
});

describe("NT-a FakeHttpPushApi", () => {
  it("NT-a Ruft den Fake-Server mit der Sitzung des Geräts und liest seine Fehlercodes", async () => {
    const sent: [string, RequestInit][] = [];
    const answers = [
      new Response("{}"),
      new Response(JSON.stringify({ error: "testToday" }), { status: 429 }),
      new Response("kaputt", { status: 500 }),
    ];
    const store = new Map([
      [
        "kruemel-fake:auth",
        JSON.stringify({ token: "geheim", session: { userId: "u", email: "e" } }),
      ],
    ]);
    const api = new FakeHttpPushApi({
      baseUrl: "http://fake",
      store: {
        getItem: (key) => store.get(key) ?? null,
        setItem: () => undefined,
        removeItem: () => undefined,
      },
      fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
        sent.push([String(input), init ?? {}]);
        const next = answers.shift();
        if (next === undefined) {
          throw new TypeError("offline");
        }
        return next;
      }) as typeof fetch,
    });

    await api.register(DEVICE);
    expect(await failureOf(api.sendTest("x"))).toBe("testToday");
    expect(await failureOf(api.unregister("x"))).toBe("unknown");
    expect(await failureOf(api.unregister("x"))).toBe("offline");
    expect(sent.map(([url]) => url)).toEqual([
      "http://fake/push/register",
      "http://fake/push/test",
      "http://fake/push/unregister",
      "http://fake/push/unregister",
    ]);
    const headers = (sent[0]?.[1].headers ?? {}) as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer geheim");
  });

  it("NT-b Einstellungen lesen und speichern über den Fake-Server", async () => {
    const sent: [string, unknown][] = [];
    const answers = [
      new Response(JSON.stringify({ settings: DEFAULT_PUSH_SETTINGS })),
      new Response(JSON.stringify({ settings: null })),
      new Response("{}"),
    ];
    const api = new FakeHttpPushApi({
      baseUrl: "http://fake",
      store: { getItem: () => null, setItem: () => undefined, removeItem: () => undefined },
      fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
        sent.push([String(input), JSON.parse(String(init?.body))]);
        return answers.shift() ?? new Response("{}");
      }) as typeof fetch,
    });

    expect(await api.settings("a")).toEqual(DEFAULT_PUSH_SETTINGS);
    expect(await api.settings("b")).toBeNull();
    await api.updateSettings("a", DEFAULT_PUSH_SETTINGS);

    expect(sent).toEqual([
      ["http://fake/push/settings", { deviceId: "a" }],
      ["http://fake/push/settings", { deviceId: "b" }],
      ["http://fake/push/update-settings", { deviceId: "a", ...DEFAULT_PUSH_SETTINGS }],
    ]);
  });

  it("NT-a Testschlüssel des Fake-Modus: sieht aus wie ein öffentlicher Schlüssel, ein Test kann ihn entfernen", () => {
    const items = new Map<string, string>();
    const store = {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: () => undefined,
      removeItem: () => undefined,
    };

    expect(isVapidPublicKey(fakeVapidPublicKey(store))).toBe(true);
    items.set(FAKE_VAPID_KEY_OVERRIDE, "");
    expect(fakeVapidPublicKey(store)).toBe("");
  });
});
