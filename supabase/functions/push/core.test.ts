import { buildPushPayload } from "@block65/webcrypto-web-push";
import { describe, expect, it } from "vitest";
import {
  BackendRefusal,
  handlePush,
  type LogEntry,
  type PushBackend,
  type PushConfig,
  type PushDeps,
  pushConfig,
  routeOf,
  type TestTarget,
} from "./core";
import { base64Url, fromBase64Url, keyIdOf } from "./rules";

// NT-a: the Edge Function `push` against a mock push service (a `fetch` that records the requests
// and answers as told) and a fake database that follows the rules of `request_test_push`: a device
// is found only for its own account. One test encrypts for real with the library and decrypts
// with WebCrypto as a browser would (RFC 8291), and checks the VAPID signature (RFC 8292). All keys
// are made in the test and forgotten afterwards.

const ORIGIN = "https://stephan-pro.github.io";
const ALEX = "token-alex";
const ROBIN = "token-robin";
const ALEX_PHONE = "11111111-1111-4111-8111-111111111111";
const ROBIN_PHONE = "22222222-2222-4222-8222-222222222222";

async function vapidKeys(): Promise<PushConfig & { verifyKey: CryptoKey }> {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return {
    publicKey: base64Url(raw),
    privateKey: jwk.d ?? "",
    subject: "mailto:test@beispiel.de",
    verifyKey: pair.publicKey,
  };
}

/** A browser's push address: its key pair and secret, as `pushManager.subscribe` makes them. */
async function browserKeys() {
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
    "deriveBits",
  ]);
  const publicBytes = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const secret = crypto.getRandomValues(new Uint8Array(16));
  return { pair, publicBytes, secret, p256dh: base64Url(publicBytes), auth: base64Url(secret) };
}

interface Sent {
  readonly url: string;
  readonly init: RequestInit;
}

/** The mock push service: records every request, answers with `status` (or fails). */
function pushService(status: number | "offline" = 201) {
  const sent: Sent[] = [];
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    sent.push({ url: String(input), init: init ?? {} });
    if (status === "offline") {
      throw new TypeError("fetch failed");
    }
    return new Response(null, { status });
  }) as typeof globalThis.fetch;
  return { sent, fetch };
}

/** The database as `request_test_push` and `unregister_push_device` treat it. */
function database(targets: Record<string, TestTarget>, refusal?: string) {
  const owners: Record<string, string> = { [ALEX_PHONE]: ALEX, [ROBIN_PHONE]: ROBIN };
  const forgotten: string[] = [];
  const backend: PushBackend = {
    userOf: async (token) => ({ [ALEX]: "u-alex", [ROBIN]: "u-robin" })[token] ?? null,
    requestTest: async (token, deviceId) => {
      const target = targets[deviceId];
      if (owners[deviceId] !== token || target === undefined) {
        throw new BackendRefusal("push_device_unknown");
      }
      if (refusal !== undefined) {
        throw new BackendRefusal(refusal);
      }
      return target;
    },
    forget: async (token, deviceId) => {
      if (owners[deviceId] === token) {
        forgotten.push(deviceId);
      }
    },
  };
  return { backend, forgotten };
}

function testRequest(
  token: string | undefined,
  body: unknown = { deviceId: ALEX_PHONE },
  { method = "POST", path = "/functions/v1/push/test", origin = ORIGIN } = {},
) {
  const headers: Record<string, string> = { Origin: origin, "Content-Type": "application/json" };
  if (token !== undefined) {
    headers.Authorization = `Bearer ${token}`;
  }
  return new Request(`https://projekt.supabase.co${path}`, {
    method,
    headers,
    ...(method === "POST" ? { body: JSON.stringify(body) } : {}),
  });
}

/** Everything the function needs, with a real key pair and two devices (Alex's, Robin's). */
async function setup(
  options: {
    status?: number | "offline";
    refusal?: string;
    endpoint?: string;
    keyId?: string;
  } = {},
) {
  const vapid = await vapidKeys();
  const browser = await browserKeys();
  const keyId = options.keyId ?? (await keyIdOf(vapid.publicKey));
  const target = (endpoint: string): TestTarget => ({
    endpoint,
    p256dh: browser.p256dh,
    auth: browser.auth,
    keyId,
  });
  const db = database(
    {
      [ALEX_PHONE]: target(options.endpoint ?? "https://fcm.googleapis.com/fcm/send/alex-phone"),
      [ROBIN_PHONE]: target("https://fcm.googleapis.com/fcm/send/robin-phone"),
    },
    options.refusal,
  );
  const service = pushService(options.status);
  const logs: LogEntry[] = [];
  const deps: PushDeps = {
    config: vapid,
    backend: db.backend,
    encrypt: buildPushPayload,
    fetch: service.fetch,
    log: (entry) => logs.push(entry),
  };
  return { vapid, browser, db, service, logs, deps };
}

async function failureOf(response: Response) {
  return { status: response.status, body: await response.json() };
}

/** HKDF with SHA-256 (RFC 5869) through WebCrypto, independent of the library's own. */
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number) {
  const key = await crypto.subtle.importKey("raw", ikm as BufferSource, "HKDF", false, [
    "deriveBits",
  ]);
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "HKDF", hash: "SHA-256", salt: salt as BufferSource, info: info as BufferSource },
      key,
      length * 8,
    ),
  );
}

const text = (value: string) => new TextEncoder().encode(value);
const join = (...parts: Uint8Array[]) => {
  const all = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    all.set(part, at);
    at += part.length;
  }
  return all;
};

/** Decrypts an `aes128gcm` push body as the browser does (RFC 8291, 8188). */
async function decrypt(body: Uint8Array, browser: Awaited<ReturnType<typeof browserKeys>>) {
  const salt = body.slice(0, 16);
  const idLength = body[20] ?? 0;
  const serverPublic = body.slice(21, 21 + idLength);
  const record = body.slice(21 + idLength);
  const serverKey = await crypto.subtle.importKey(
    "raw",
    serverPublic,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: serverKey },
      browser.pair.privateKey,
      256,
    ),
  );
  const keyInfo = join(text("WebPush: info\0"), browser.publicBytes, serverPublic);
  const ikm = await hkdf(browser.secret, shared, keyInfo, 32);
  const cek = await hkdf(salt, ikm, text("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, text("Content-Encoding: nonce\0"), 12);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const padded = new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, aes, record),
  );
  // The last record ends with 0x02, then only zeros of padding.
  const end = padded.lastIndexOf(2);
  expect([...padded.slice(end + 1)].every((byte) => byte === 0)).toBe(true);
  return new TextDecoder().decode(padded.slice(0, end));
}

describe("NT-a Edge Function push: Testbenachrichtigung", () => {
  it("NT-a Echte Verschlüsselung: das Gerät entschlüsselt die Nutzlast, die VAPID-Signatur stimmt", async () => {
    const { vapid, browser, service, deps } = await setup();

    const response = await handlePush(testRequest(ALEX), deps);

    expect(await failureOf(response)).toEqual({ status: 200, body: { sent: true } });
    expect(service.sent).toHaveLength(1);
    const [request] = service.sent;
    const headers = request?.init.headers as Record<string, string>;
    expect(request?.url).toBe("https://fcm.googleapis.com/fcm/send/alex-phone");
    expect(request?.init.method).toBe("POST");
    expect(headers).toMatchObject({
      ttl: "300",
      topic: "test",
      urgency: "normal",
      "content-encoding": "aes128gcm",
      "content-type": "application/octet-stream",
    });
    const body = request?.init.body as Uint8Array;
    expect(await decrypt(body, browser)).toBe('{"v":1,"k":"test"}');

    const vapidHeader = /^vapid t=([^,]+), k=(\S+)$/.exec(headers.authorization ?? "");
    expect(vapidHeader?.[2]).toBe(vapid.publicKey);
    const [head, claims, signature] = (vapidHeader?.[1] ?? "").split(".");
    const valid = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      vapid.verifyKey,
      fromBase64Url(signature ?? "") as BufferSource,
      text(`${head}.${claims}`),
    );
    expect(valid).toBe(true);
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(claims ?? "")));
    expect(payload).toMatchObject({
      aud: "https://fcm.googleapis.com",
      sub: "mailto:test@beispiel.de",
    });
    expect(payload.exp * 1000 - Date.now()).toBeLessThanOrEqual(24 * 60 * 60_000);
  });

  it("NT-a Antwort 404 oder 410 des Push-Dienstes: Gerät wird gelöscht, Fehler deviceGone", async () => {
    for (const status of [404, 410]) {
      const { db, deps } = await setup({ status });

      expect(await failureOf(await handlePush(testRequest(ALEX), deps))).toEqual({
        status: 410,
        body: { error: "deviceGone" },
      });
      expect(db.forgotten).toEqual([ALEX_PHONE]);
    }
  });

  it("NT-a Andere Fehler des Push-Dienstes oder kein Netz: pushFailed, das Gerät bleibt", async () => {
    for (const status of [400, 403, 413, 429, 500, "offline"] as const) {
      const { db, deps } = await setup({ status });

      expect(await failureOf(await handlePush(testRequest(ALEX), deps)), String(status)).toEqual({
        status: 502,
        body: { error: "pushFailed" },
      });
      expect(db.forgotten).toEqual([]);
    }
  });

  it("NT-a S5 Fremdes Konto: das Gerät einer anderen Person ist unbekannt, es geht nichts raus", async () => {
    const { service, deps } = await setup();

    const response = await handlePush(testRequest(ALEX, { deviceId: ROBIN_PHONE }), deps);

    expect(await failureOf(response)).toEqual({ status: 404, body: { error: "deviceUnknown" } });
    expect(service.sent).toEqual([]);
  });

  it("NT-a Ohne gültige Anmeldung: notSignedIn, die Datenbank wird nicht gefragt", async () => {
    const { service, deps } = await setup();
    let asked = 0;
    const backend: PushBackend = {
      ...deps.backend,
      requestTest: async (...args) => {
        asked++;
        return deps.backend.requestTest(...args);
      },
      userOf: async (token) => {
        if (token === "kaputt") {
          throw new Error("network");
        }
        return deps.backend.userOf(token);
      },
    };

    for (const token of [undefined, "unbekannt", "kaputt"]) {
      const response = await handlePush(testRequest(token), { ...deps, backend });
      expect(await failureOf(response), String(token)).toEqual({
        status: 401,
        body: { error: "notSignedIn" },
      });
    }
    expect(asked).toBe(0);
    expect(service.sent).toEqual([]);
  });

  it("NT-a Grenzen der Datenbank werden weitergegeben: eine pro Minute, zehn am Tag", async () => {
    for (const [refusal, failure] of [
      ["push_test_wait", "testWait"],
      ["push_test_today", "testToday"],
      ["etwas anderes", "unknown"],
    ] as const) {
      const { service, deps } = await setup({ refusal });

      const response = await handlePush(testRequest(ALEX), deps);

      expect(await failureOf(response)).toEqual({
        status: failure === "unknown" ? 500 : 429,
        body: { error: failure },
      });
      expect(service.sent).toEqual([]);
    }
  });

  it("NT-a Fehlende oder falsche Schlüssel: notConfigured, ohne den Namen des Secrets", async () => {
    const vapid = await vapidKeys();
    const env = (values: Record<string, string>) => (name: string) => values[name];
    const complete = {
      VAPID_PUBLIC_KEY: vapid.publicKey,
      VAPID_PRIVATE_KEY: vapid.privateKey,
      VAPID_SUBJECT: "mailto:kruemel@beispiel.de",
    };
    expect(pushConfig(env(complete))).toEqual({
      publicKey: vapid.publicKey,
      privateKey: vapid.privateKey,
      subject: "mailto:kruemel@beispiel.de",
    });
    for (const broken of [
      {},
      { ...complete, VAPID_PRIVATE_KEY: "" },
      { ...complete, VAPID_PUBLIC_KEY: "kurz" },
      { ...complete, VAPID_SUBJECT: "kruemel@beispiel.de" },
    ]) {
      expect(pushConfig(env(broken))).toBeNull();
    }

    const { service, deps, vapid: used } = await setup();
    const response = await handlePush(testRequest(ALEX), { ...deps, config: null });
    expect(await failureOf(response)).toEqual({ status: 503, body: { error: "notConfigured" } });
    // A private key that only looks right: the library fails, nothing is sent.
    const wrong = { ...used, privateKey: "A".repeat(43) };
    const refused = await handlePush(testRequest(ALEX), { ...deps, config: wrong });
    expect(await failureOf(refused)).toEqual({ status: 503, body: { error: "notConfigured" } });
    expect(service.sent).toEqual([]);
  });

  it("NT-a Adresse außerhalb der Erlaubtliste oder mit anderem Schlüssel: nichts geht raus", async () => {
    const outside = await setup({ endpoint: "https://intern.example.com/push" });
    const response = await handlePush(testRequest(ALEX), outside.deps);
    expect(await failureOf(response)).toEqual({ status: 422, body: { error: "endpointInvalid" } });
    expect(outside.service.sent).toEqual([]);

    const other = await setup({ keyId: "alter-schluessel" });
    const changed = await handlePush(testRequest(ALEX), other.deps);
    expect(await failureOf(changed)).toEqual({ status: 409, body: { error: "keyChanged" } });
    expect(other.service.sent).toEqual([]);
  });

  it("NT-a Falsche Anfragen: unbekannte Wege 404, kaputter Inhalt 400", async () => {
    const { deps } = await setup();

    for (const [request, status, error] of [
      [testRequest(ALEX, {}, { path: "/functions/v1/push/flush" }), 404, "notFound"],
      [testRequest(ALEX, {}, { method: "GET" }), 404, "notFound"],
      [testRequest(ALEX, { deviceId: "kein-uuid" }), 400, "badRequest"],
      [testRequest(ALEX, "kein json"), 400, "badRequest"],
    ] as const) {
      expect(await failureOf(await handlePush(request, deps))).toEqual({
        status,
        body: { error },
      });
    }
    expect(routeOf("/push/test")).toBe("test");
    expect(routeOf("/functions/v1/push/test/")).toBe("test");
    expect(routeOf("/anders/test")).toBeUndefined();
  });

  it("NT-a CORS nur für die Seiten der App", async () => {
    const { deps } = await setup();
    const preflight = (origin: string) =>
      handlePush(testRequest(undefined, undefined, { method: "OPTIONS", origin }), deps);

    const allowed = await preflight(ORIGIN);
    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
    expect(allowed.headers.get("Access-Control-Allow-Headers")).toContain("x-region");
    const foreign = await preflight("https://boese.example");
    expect(foreign.status).toBe(403);
    expect(foreign.headers.get("Access-Control-Allow-Origin")).toBeNull();
    const answered = await handlePush(testRequest(ALEX), deps);
    expect(answered.headers.get("Access-Control-Allow-Origin")).toBe(ORIGIN);
  });

  it("NT-a Das Protokoll nennt nur Weg, Status und Dauer: keine Adresse, kein Schlüssel, kein Token", async () => {
    const { vapid, browser, logs, deps } = await setup({ status: 410 });

    await handlePush(testRequest(ALEX), deps);
    await handlePush(testRequest(ALEX, { deviceId: ROBIN_PHONE }), deps);

    expect(logs).toEqual([
      { route: "test", status: 410, push: 410, ms: expect.any(Number) },
      { route: "test", status: 404, ms: expect.any(Number) },
    ]);
    const written = JSON.stringify(logs);
    for (const secret of [
      ALEX,
      "alex-phone",
      vapid.privateKey,
      vapid.publicKey,
      browser.p256dh,
      browser.auth,
    ]) {
      expect(written).not.toContain(secret);
    }
  });
});
