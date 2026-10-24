import { describe, expect, it } from "vitest";
import { FakeServer } from "../sync/fakeServer";
import { FakePushService } from "./fakePush";
import { PushError } from "./pushApi";

// The fake server follows the rules of the database and the Edge Function (`push.test.ts` in
// supabase/tests, `core.test.ts` in supabase/functions/push), so the end-to-end tests see the same.

const device = (overrides: Record<string, unknown> = {}) => ({
  deviceId: crypto.randomUUID(),
  endpoint: `https://fcm.googleapis.com/fcm/send/${crypto.randomUUID()}`,
  p256dh: `B${"p".repeat(86)}`,
  auth: "a".repeat(22),
  keyId: "schluessel-1",
  timeZone: "Europe/Berlin",
  locale: "de",
  ...overrides,
});

function failureOf(action: () => void): string {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(PushError);
    return (error as PushError).failure;
  }
  return "kein Fehler";
}

describe("NT-a Fake-Server: Geräte und Testbenachrichtigung", () => {
  it("NT-a Einschalten prüft Adresse, Schlüssel, Zeitzone und Sprache wie die Datenbank", () => {
    const push = new FakePushService();
    const phone = device({ timeZone: "Mars/Olymp", locale: "x" });

    push.register("u1", phone);
    expect(push.devicesOf("u1")).toEqual([
      { deviceId: phone.deviceId, endpoint: phone.endpoint, timeZone: "Europe/Berlin" },
    ]);
    expect(failureOf(() => push.register("u1", device({ endpoint: "https://x.example/" })))).toBe(
      "endpointInvalid",
    );
    expect(failureOf(() => push.register("u1", device({ deviceId: "nein" })))).toBe(
      "endpointInvalid",
    );
    expect(failureOf(() => push.register("u1", device({ auth: "kurz" })))).toBe("badRequest");
    expect(failureOf(() => push.register("u1", device({ keyId: "" })))).toBe("badRequest");
  });

  it("NT-a Höchstens 10 Geräte, eine Adresse gehört einem Konto, Ausschalten nur eigenes", () => {
    let clock = 0;
    const push = new FakePushService(() => ++clock);
    const devices = Array.from({ length: 11 }, () => device());
    for (const next of devices) {
      push.register("u1", next);
    }
    expect(
      push
        .devicesOf("u1")
        .map((kept) => kept.deviceId)
        .sort(),
    ).toEqual(
      devices
        .slice(1)
        .map((next) => next.deviceId)
        .sort(),
    );

    const shared = devices[5] ?? device();
    push.register("u2", { ...shared, deviceId: crypto.randomUUID() });
    expect(push.devicesOf("u1")).toHaveLength(9);
    push.unregister("u1", shared.deviceId);
    expect(push.devicesOf("u2")).toHaveLength(1);
  });

  it("NT-a Testbenachrichtigung: nur eigenes Gerät, eine pro Minute, zehn am Tag, Antworten des Push-Dienstes", () => {
    let now = 0;
    const push = new FakePushService(() => now);
    const phones = Array.from({ length: 10 }, () => device());
    for (const phone of phones) {
      push.register("u1", phone);
    }
    const [first] = phones;
    const id = first?.deviceId ?? "";

    expect(failureOf(() => push.test("u2", id))).toBe("deviceUnknown");
    push.test("u1", id);
    expect(push.pushesOf("u1")).toEqual([{ deviceId: id, payload: { v: 1, k: "test" } }]);
    expect(failureOf(() => push.test("u1", id))).toBe("testWait");
    for (const phone of phones.slice(1)) {
      push.test("u1", phone.deviceId);
    }
    now += 61_000;
    expect(failureOf(() => push.test("u1", id))).toBe("testToday");
    now += 24 * 60 * 60_000;
    push.setAnswer("u1", 503);
    expect(failureOf(() => push.test("u1", id))).toBe("notConfigured");
    push.setAnswer("u1", 500);
    expect(failureOf(() => push.test("u1", id))).toBe("pushFailed");
    now += 61_000;
    push.setAnswer("u1", 410);
    expect(failureOf(() => push.test("u1", id))).toBe("deviceGone");
    expect(push.devicesOf("u1")).toHaveLength(9);
  });

  it("NT-a Wege des Fake-Servers: nur angemeldet, Fehler mit Code und Status der Edge Function", async () => {
    const server = new FakeServer();
    server.auth.addUser("alex@beispiel.de");
    server.auth.requestCode("alex@beispiel.de");
    const { token } = server.auth.verifyCode(
      "alex@beispiel.de",
      server.auth.lastCode("alex@beispiel.de") ?? "",
    );
    const call = (method: string, path: string, body?: unknown, as: string | undefined = token) =>
      server.handle({ method, path, query: {}, token: as, body });
    const phone = device();

    expect(call("POST", "/push/register", phone, "unbekannt")).toEqual({
      status: 401,
      body: { error: "notSignedIn" },
    });
    expect(call("POST", "/push/register", phone).status).toBe(200);
    expect(call("POST", "/push/test", { deviceId: phone.deviceId })).toEqual({
      status: 200,
      body: { sent: true },
    });
    expect(call("POST", "/push/test", { deviceId: phone.deviceId })).toEqual({
      status: 429,
      body: { error: "testWait" },
    });
    expect((call("GET", "/test/pushes").body as { pushes: unknown[] }).pushes).toHaveLength(1);
    expect(call("POST", "/test/push-answer", { status: 410 }).status).toBe(200);
    expect(call("POST", "/push/unregister", { deviceId: phone.deviceId }).status).toBe(200);
    expect(call("GET", "/test/push-devices").body).toEqual({ devices: [] });
    expect(call("GET", "/push/anders").status).toBe(404);
  });
});
