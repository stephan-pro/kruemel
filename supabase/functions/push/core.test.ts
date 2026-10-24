import { buildPushPayload } from "@block65/webcrypto-web-push";
import { describe, expect, it } from "vitest";
import {
  BackendRefusal,
  cronTokenOf,
  type FlushLogEntry,
  handlePush,
  type JobResult,
  type JobsBackend,
  type LogEntry,
  type PushBackend,
  type PushConfig,
  type PushDeps,
  type PushJob,
  pushConfig,
  routeOf,
  type TestTarget,
} from "./core";
import { encryptPush } from "./encrypt";
import {
  base64Url,
  fromBase64Url,
  keyIdOf,
  MAX_PUSH_BODY_BYTES,
  retryAfterSeconds,
  sameSecret,
} from "./rules";

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

/**
 * How the mock push service answers: a status (without a body), no connection, no answer until the
 * function gives up, or as a function of the request (`autopush`).
 */
type Answer = number | "offline" | "silent" | ((request: Sent) => Response);

/** The mock push service: records every request, answers as `answer` says. */
function pushService(answer: Answer = 201) {
  const sent: Sent[] = [];
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = { url: String(input), init: init ?? {} };
    sent.push(request);
    if (answer === "offline") {
      throw new TypeError("fetch failed");
    }
    if (answer === "silent") {
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });
    }
    return typeof answer === "function" ? answer(request) : new Response(null, { status: answer });
  }) as typeof globalThis.fetch;
  return { sent, fetch };
}

const MOZILLA = "https://updates.push.services.mozilla.com/wpush/v2/gAAAAABredmi";

/**
 * Mozilla's push service (autopush) as its documentation describes it
 * (https://mozilla-services.github.io/autopush-rs/http.html, docs/BENACHRICHTIGUNGEN.md, 6.3):
 * `TTL` is required, `Topic` at most 32 characters of `[A-Za-z0-9_-]`, a VAPID header, `aes128gcm`;
 * for Firefox on Android (through FCM) at most 2744 bytes, else 413 with an error body; success is
 * 201 without a body.
 */
function autopush(request: Sent): Response {
  const headers = request.init.headers as Record<string, string>;
  const body = request.init.body as Uint8Array;
  const error = (code: number, errno: number) =>
    new Response(JSON.stringify({ code, errno, error: "refused" }), { status: code });
  if (!/^\d+$/.test(headers.ttl ?? "")) {
    return error(400, 111);
  }
  if (headers.topic !== undefined && !/^[A-Za-z0-9_-]{1,32}$/.test(headers.topic)) {
    return error(400, 113);
  }
  if (!/^vapid t=[^,]+, k=\S+$/.test(headers.authorization ?? "")) {
    return error(401, 109);
  }
  if (headers["content-encoding"] !== "aes128gcm") {
    return error(400, 110);
  }
  if (body.byteLength > 2744) {
    return error(413, 104);
  }
  return new Response(null, { status: 201, headers: { Location: `${MOZILLA}/m/1` } });
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
  options: { status?: Answer; refusal?: string; endpoint?: string; keyId?: string } = {},
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
  const logs: (LogEntry | FlushLogEntry)[] = [];
  const deps: PushDeps = {
    config: vapid,
    backend: db.backend,
    encrypt: encryptPush,
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

  it("NT-a Vorübergehend (429, 5xx, kein Netz, keine Antwort in der Zeit): pushFailed, das Gerät bleibt", async () => {
    for (const [status, cause] of [
      [429, undefined],
      [500, undefined],
      [503, undefined],
      ["offline", "network"],
      ["silent", "timeout"],
    ] as const) {
      const { db, deps, logs } = await setup({ status });

      const response = await handlePush(testRequest(ALEX), { ...deps, timeoutMs: 20 });

      expect(await failureOf(response), String(status)).toEqual({
        status: 502,
        body: { error: "pushFailed" },
      });
      expect(db.forgotten).toEqual([]);
      expect(logs[0], String(status)).toMatchObject({
        error: "pushFailed",
        host: "fcm.googleapis.com",
        ...(cause === undefined ? { push: status } : { cause }),
      });
    }
  });

  it("NT-a Abgelehnt (400, 401, 403, 413): pushRejected statt „nicht erreichbar“, das Gerät bleibt", async () => {
    for (const status of [400, 401, 403, 413]) {
      const { db, deps, logs } = await setup({ status });

      expect(await failureOf(await handlePush(testRequest(ALEX), deps)), String(status)).toEqual({
        status: 502,
        body: { error: "pushRejected" },
      });
      expect(db.forgotten).toEqual([]);
      expect(logs[0]).toMatchObject({ error: "pushRejected", push: status });
    }
  });

  it("NT-a Mozilla (Firefox Android): Nachricht unter 2744 Byte, Antwort 201 ohne Inhalt gilt als gesendet", async () => {
    const { vapid, browser, service, logs, deps } = await setup({
      endpoint: MOZILLA,
      status: autopush,
    });

    const response = await handlePush(testRequest(ALEX), deps);

    expect(await failureOf(response)).toEqual({ status: 200, body: { sent: true } });
    const [request] = service.sent;
    const body = request?.init.body as Uint8Array;
    expect(body.byteLength).toBeLessThanOrEqual(MAX_PUSH_BODY_BYTES);
    expect(await decrypt(body, browser)).toBe('{"v":1,"k":"test"}');
    expect(request?.init.redirect).toBe("error");
    const headers = request?.init.headers as Record<string, string>;
    const claims = (/^vapid t=[^.]+\.([^.]+)\./.exec(headers.authorization ?? "") ?? [])[1];
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(claims ?? "")));
    expect(payload).toMatchObject({
      aud: "https://updates.push.services.mozilla.com",
      sub: vapid.subject,
    });
    expect(payload.exp * 1000 - Date.now()).toBeLessThanOrEqual(24 * 60 * 60_000);
    expect(logs).toEqual([
      {
        route: "test",
        status: 200,
        host: "updates.push.services.mozilla.com",
        bytes: body.byteLength,
        push: 201,
        ms: expect.any(Number),
      },
    ]);

    // The cause of NT-a's failure on the Redmi: the library's own `buildPushPayload` pads every
    // body to 4096 bytes, Mozilla answers 413. Such a body is no longer sent at all.
    const padded = await setup({ endpoint: MOZILLA, status: autopush });
    const library = await handlePush(testRequest(ALEX), {
      ...padded.deps,
      encrypt: buildPushPayload,
    });
    expect(await failureOf(library)).toEqual({ status: 502, body: { error: "pushRejected" } });
    expect(padded.service.sent).toEqual([]);
    expect(padded.logs[0]).toMatchObject({ bytes: 4096, cause: "tooLarge" });
    const answer = autopush({
      url: MOZILLA,
      init: (await buildPushPayload(
        { data: { v: 1, k: "test" }, options: { ttl: 300, topic: "test", urgency: "normal" } },
        { endpoint: MOZILLA, expirationTime: null, keys: browser },
        vapid,
      )) as RequestInit,
    });
    expect(answer.status).toBe(413);
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
      [testRequest(ALEX, {}, { path: "/functions/v1/push/senden" }), 404, "notFound"],
      [testRequest(ALEX, {}, { method: "GET" }), 404, "notFound"],
      [testRequest(ALEX, {}, { method: "GET", path: "/functions/v1/push/flush" }), 404, "notFound"],
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

  it("NT-a Das Protokoll nennt nur Weg, Status, Fehler, Dienst, Größe und Dauer: keine Adresse, kein Schlüssel, kein Token", async () => {
    const { vapid, browser, logs, deps } = await setup({ status: 410 });

    await handlePush(testRequest(ALEX), deps);
    await handlePush(testRequest(ALEX, { deviceId: ROBIN_PHONE }), deps);

    expect(logs).toEqual([
      {
        route: "test",
        status: 410,
        error: "deviceGone",
        host: "fcm.googleapis.com",
        bytes: expect.any(Number),
        push: 410,
        ms: expect.any(Number),
      },
      { route: "test", status: 404, error: "deviceUnknown", ms: expect.any(Number) },
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

// NT-c: the route `flush`, called by the schedule of the database with its token. The fake
// database hands out its due messages as `claim_push_jobs` would (in order, at most as many as
// asked for) and records what `finish_push_jobs` is told. The token is made up for the test.

const CRON = "Zeitplan-Token-nur-fuer-den-Test-0123456789ab";

function cronRequest(token: string | undefined) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token !== undefined) {
    headers["x-kruemel-cron"] = token;
  }
  return new Request("https://projekt.supabase.co/functions/v1/push/flush", {
    method: "POST",
    headers,
    body: "{}",
  });
}

/** The due messages of the database; `afterFinish` runs after each batch (e.g. to move the clock). */
function jobQueue(jobs: PushJob[], afterFinish: () => void = () => {}) {
  const waiting = [...jobs];
  const claims: number[] = [];
  const finished: JobResult[][] = [];
  const backend: JobsBackend = {
    claim: async (limit) => {
      claims.push(limit);
      // The first batch also says that two overviews had nothing to tell and one was over the limit.
      const first = claims.length === 1;
      return { jobs: waiting.splice(0, limit), empty: first ? 2 : 0, dropped: first ? 1 : 0 };
    },
    finish: async (results) => {
      finished.push([...results]);
      afterFinish();
    },
  };
  return { backend, claims, finished, waiting };
}

/** `setup` with due messages for devices whose address ends in `name` (`/device-<name>`). */
async function flushSetup(names: readonly string[], status: Answer = 201) {
  const base = await setup({ status });
  const keyId = await keyIdOf(base.vapid.publicKey);
  const jobs = names.map(
    (name, index): PushJob => ({
      id: index + 1,
      kind: "daily",
      endpoint: name.startsWith("https://")
        ? name
        : `https://fcm.googleapis.com/fcm/send/device-${name}`,
      p256dh: base.browser.p256dh,
      auth: base.browser.auth,
      keyId: name === "alter-schluessel" ? "anderer-schluessel" : keyId,
      due: 3,
      overdue: 1,
    }),
  );
  const queue = jobQueue(jobs);
  const deps: PushDeps = { ...base.deps, cronToken: CRON, jobs: queue.backend, now: () => 0 };
  return { ...base, deps, queue };
}

const outcomes = (finished: JobResult[][]) => finished.flat();

describe("NT-c Edge Function push: Senden für den Zeitplan (flush)", () => {
  it("NT-c Ohne Token, mit falschem Token oder ohne eingerichtetes Token: 401 ohne Details, die Datenbank wird nicht gefragt", async () => {
    const { deps, queue, service, logs } = await flushSetup(["a"]);

    for (const token of [undefined, "", "falsch", `${CRON}x`, CRON.slice(0, -1)]) {
      const response = await handlePush(cronRequest(token), deps);
      expect(await failureOf(response), String(token)).toEqual({
        status: 401,
        body: { error: "notSignedIn" },
      });
    }
    const unset = await handlePush(cronRequest(CRON), { ...deps, cronToken: null });
    expect(await failureOf(unset)).toEqual({ status: 401, body: { error: "notSignedIn" } });
    expect(queue.claims).toEqual([]);
    expect(service.sent).toEqual([]);
    expect(logs.at(-1)).toEqual({
      route: "flush",
      status: 401,
      error: "notSignedIn",
      jobs: 0,
      sent: 0,
      retry: 0,
      gone: 0,
      dropped: 0,
      empty: 0,
      ms: 0,
    });

    // The token of the function: trimmed, at least 32 characters; compared in constant time.
    const env = (value: string) => (name: string) =>
      name === "PUSH_CRON_TOKEN" ? value : undefined;
    expect(cronTokenOf(env(` ${CRON}\n`))).toBe(CRON);
    expect(cronTokenOf(env("zu-kurz"))).toBeNull();
    expect(cronTokenOf(() => undefined)).toBeNull();
    expect(await sameSecret(CRON, CRON)).toBe(true);
    expect(await sameSecret(CRON, `${CRON} `)).toBe(false);
    expect(await sameSecret("", CRON)).toBe(false);
  });

  it("NT-c Tagesüberblick: nur Zahlen verschlüsselt, Thema „daily“, sechs Stunden aufbewahrt, Ergebnis an die Datenbank", async () => {
    const { deps, queue, service, browser } = await flushSetup(["a"]);

    const response = await handlePush(cronRequest(CRON), deps);

    expect(await failureOf(response)).toEqual({
      status: 200,
      body: { sent: 1, retry: 0, gone: 0, dropped: 1, empty: 2 },
    });
    const [request] = service.sent;
    expect(request?.url).toBe("https://fcm.googleapis.com/fcm/send/device-a");
    expect(request?.init.headers).toMatchObject({
      ttl: "21600",
      topic: "daily",
      urgency: "normal",
      "content-encoding": "aes128gcm",
    });
    expect(await decrypt(request?.init.body as Uint8Array, browser)).toBe(
      '{"v":1,"k":"daily","due":3,"overdue":1}',
    );
    expect(queue.finished).toEqual([[{ id: 1, outcome: "sent" }]]);
  });

  it("NT-c Antworten des Push-Dienstes: 404/410 Gerät weg, 429/5xx/kein Netz später erneut (mit Retry-After), sonst verworfen", async () => {
    const answers: Record<string, number> = {
      gone404: 404,
      gone410: 410,
      busy: 429,
      broken: 500,
      refused: 400,
      large: 413,
    };
    const { deps, queue, service } = await flushSetup(
      [
        "ok",
        "gone404",
        "gone410",
        "busy",
        "broken",
        "offline",
        "refused",
        "large",
        "alter-schluessel",
        "https://intern.example.com/push",
      ],
      (request) => {
        const name = request.url.split("device-")[1] ?? "";
        if (name === "offline") {
          throw new TypeError("fetch failed");
        }
        const status = answers[name] ?? 201;
        return new Response(null, {
          status,
          headers: status === 429 ? { "Retry-After": "120" } : {},
        });
      },
    );

    const response = await handlePush(cronRequest(CRON), deps);

    expect(await failureOf(response)).toEqual({
      status: 200,
      body: { sent: 1, retry: 3, gone: 2, dropped: 5, empty: 2 },
    });
    expect(outcomes(queue.finished)).toEqual([
      { id: 1, outcome: "sent" },
      { id: 2, outcome: "gone" },
      { id: 3, outcome: "gone" },
      { id: 4, outcome: "retry", retryAfter: 120 },
      { id: 5, outcome: "retry" },
      { id: 6, outcome: "retry" },
      { id: 7, outcome: "dropped" },
      { id: 8, outcome: "dropped" },
      { id: 9, outcome: "dropped" },
      { id: 10, outcome: "dropped" },
    ]);
    // Neither the device with another key nor the address outside the allow list was asked.
    expect(service.sent).toHaveLength(8);
    expect(service.sent.some((sent) => sent.url.includes("example.com"))).toBe(false);

    expect(retryAfterSeconds("120")).toBe(120);
    expect(retryAfterSeconds(" 7 ")).toBe(7);
    expect(retryAfterSeconds("99999")).toBe(3600);
    expect(retryAfterSeconds("Wed, 21 Oct 2026 07:28:00 GMT")).toBeUndefined();
    expect(retryAfterSeconds(null)).toBeUndefined();
  });

  it("NT-c Stapel und Grenzen: höchstens 25 auf einmal, höchstens 100 je Lauf, nach Ablauf der Zeit kein neuer Stapel", async () => {
    const many = Array.from({ length: 130 }, (_, index) => String(index));
    const { deps, queue, service } = await flushSetup(many);

    const response = await handlePush(cronRequest(CRON), deps);

    expect(response.status).toBe(200);
    expect(queue.claims).toEqual([25, 25, 25, 25]);
    expect(service.sent).toHaveLength(100);
    expect(queue.waiting).toHaveLength(30);

    // A run that is already late takes no new batch; one with less than a batch stops at once.
    const late = await flushSetup(many);
    let clock = 0;
    const slow = jobQueue(late.queue.waiting, () => {
      clock = 31_000;
    });
    await handlePush(cronRequest(CRON), { ...late.deps, jobs: slow.backend, now: () => clock });
    expect(slow.claims).toEqual([25]);

    const few = await flushSetup(["a", "b"]);
    await handlePush(cronRequest(CRON), few.deps);
    expect(few.queue.claims).toEqual([25]);
  });

  it("NT-c Ohne Schlüssel oder ohne Datenbankzugang: notConfigured; Schlüssel, die nicht passen: später erneut", async () => {
    const { deps, queue, service, vapid } = await flushSetup(["a"]);

    const unconfigured: PushDeps[] = [
      { ...deps, config: null },
      { ...deps, jobs: null },
    ];
    for (const broken of unconfigured) {
      const response = await handlePush(cronRequest(CRON), broken);
      expect(await failureOf(response)).toEqual({ status: 503, body: { error: "notConfigured" } });
    }
    expect(queue.claims).toEqual([]);

    const wrong = { ...vapid, privateKey: "A".repeat(43) };
    await handlePush(cronRequest(CRON), { ...deps, config: wrong });
    expect(outcomes(queue.finished)).toEqual([{ id: 1, outcome: "retry" }]);
    expect(service.sent).toEqual([]);
  });

  it("NT-c Datenbank nicht erreichbar: Fehler ohne Details, nichts gesendet", async () => {
    const { deps, service, logs } = await flushSetup(["a"]);
    const failing: JobsBackend = {
      claim: async () => {
        throw new BackendRefusal("claim");
      },
      finish: async () => {},
    };

    const response = await handlePush(cronRequest(CRON), { ...deps, jobs: failing });

    expect(await failureOf(response)).toEqual({ status: 500, body: { error: "unknown" } });
    expect(service.sent).toEqual([]);
    expect(logs.at(-1)).toMatchObject({ route: "flush", status: 500, error: "unknown", jobs: 0 });
  });

  it("NT-c Das Protokoll eines Laufs nennt nur Zahlen, Fehlercodes und Dienste: keine Adresse, kein Schlüssel, kein Token", async () => {
    const { deps, logs, vapid, browser } = await flushSetup(
      ["a", "b", "c", "https://updates.push.services.mozilla.com/wpush/v2/geheim"],
      (request) => new Response(null, { status: request.url.includes("mozilla") ? 410 : 503 }),
    );

    await handlePush(cronRequest(CRON), deps);

    expect(logs).toEqual([
      {
        route: "flush",
        status: 200,
        jobs: 4,
        sent: 0,
        retry: 3,
        gone: 1,
        dropped: 1,
        empty: 2,
        // In the order the answers came.
        problems: expect.arrayContaining([
          { error: "pushFailed", host: "fcm.googleapis.com", push: 503, count: 3 },
          {
            error: "deviceGone",
            host: "updates.push.services.mozilla.com",
            push: 410,
            count: 1,
          },
        ]),
        ms: expect.any(Number),
      },
    ]);
    expect((logs[0] as FlushLogEntry).problems).toHaveLength(2);
    const written = JSON.stringify(logs);
    for (const secret of [
      CRON,
      "device-",
      "geheim",
      vapid.privateKey,
      vapid.publicKey,
      browser.p256dh,
      browser.auth,
    ]) {
      expect(written).not.toContain(secret);
    }
  });
});
