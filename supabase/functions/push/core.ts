// The Edge Function `push` without Deno: what it answers to a request (NT-a: route `test`, the test
// notification for one device of the signed-in person). `index.ts` hands in the real parts
// (sign-in check and database calls through supabase-js, encryption by
// `@block65/webcrypto-web-push`, `fetch`, the log); the tests (`core.test.ts`) hand in a mock push
// service and a fake database.
//
// Rules (docs/BENACHRICHTIGUNGEN.md, 5 and 6.3):
// - Only `POST …/push/test` (and its CORS preflight); everything else is 404.
// - The sign-in is checked here and again by the database (`request_test_push` runs with the
//   person's token), so a test goes only to a device of that person, within the database's limits.
// - The keys come only from the secrets (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`);
//   without them the answer is `notConfigured`, without saying which one is missing.
// - The push address is checked against the allow list before every request (SSRF).
// - 404/410 from the push service: the address is dead, the device is removed (`deviceGone`).
// - Answers carry only a failure code (`{"error": "<PushFailure>"}`); the log only route, status,
//   the push service's status and the duration: never an address, key, token or payload.

import {
  ALLOWED_ORIGINS,
  FAILURE_STATUS,
  isPushEndpoint,
  isVapidPrivateKey,
  isVapidPublicKey,
  keyIdOf,
  type PushFailure,
  raisedPushFailure,
  TEST_PAYLOAD,
  TEST_TTL_SECONDS,
} from "./rules.ts";

export interface PushConfig {
  readonly publicKey: string;
  readonly privateKey: string;
  readonly subject: string;
}

/** The secrets of the function, or `null` if one is missing or malformed. */
export function pushConfig(env: (name: string) => string | undefined): PushConfig | null {
  const publicKey = env("VAPID_PUBLIC_KEY")?.trim() ?? "";
  const privateKey = env("VAPID_PRIVATE_KEY")?.trim() ?? "";
  const subject = env("VAPID_SUBJECT")?.trim() ?? "";
  if (
    !isVapidPublicKey(publicKey) ||
    !isVapidPrivateKey(privateKey) ||
    !/^(mailto:\S+@\S+|https:\/\/\S+)$/.test(subject)
  ) {
    return null;
  }
  return { publicKey, privateKey, subject };
}

/** A device's push address as the database hands it out for a test. */
export interface TestTarget {
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
  readonly keyId: string;
}

/** A refusal of the database; `message` is what it raised (e.g. "push_test_wait"). */
export class BackendRefusal extends Error {}

/** The database, always as the person of `token` (`index.ts`: supabase-js with their sign-in). */
export interface PushBackend {
  /** The account of a token, `null` if the sign-in is not valid. */
  userOf(token: string): Promise<string | null>;
  /** `request_test_push`: throws `BackendRefusal` with the database's message. */
  requestTest(token: string, deviceId: string): Promise<TestTarget>;
  /** `unregister_push_device`. */
  forget(token: string, deviceId: string): Promise<void>;
}

/** What the encryption library makes of a message (`buildPushPayload`). */
export interface EncryptedPush {
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly method: string;
  readonly body: Uint8Array<ArrayBuffer>;
}

export type Encrypt = (
  message: {
    data: { readonly v: number; readonly k: string };
    options: { ttl: number; topic: string; urgency: "normal" };
  },
  subscription: {
    endpoint: string;
    expirationTime: null;
    keys: { p256dh: string; auth: string };
  },
  vapid: { subject: string; publicKey: string; privateKey: string },
) => Promise<EncryptedPush>;

/** One line of the log: nothing personal, nothing secret. */
export interface LogEntry {
  readonly route: string;
  readonly status: number;
  /** The push service's answer, if it was asked. */
  readonly push?: number;
  readonly ms: number;
}

export interface PushDeps {
  /** `null`: the secrets are missing (answer `notConfigured`). */
  readonly config: PushConfig | null;
  readonly backend: PushBackend;
  readonly encrypt: Encrypt;
  readonly fetch: typeof fetch;
  readonly log: (entry: LogEntry) => void;
  readonly now?: () => number;
  /** How long the push service may take (default 10 s). */
  readonly timeoutMs?: number;
}

/** The CORS headers for a page of the app; none for any other origin. */
function corsHeaders(origin: string | null): Record<string, string> {
  if (origin === null || !ALLOWED_ORIGINS.includes(origin)) {
    return { Vary: "Origin" };
  }
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-region",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "3600",
    Vary: "Origin",
  };
}

function answer(origin: string | null, status: number, body: object): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

/** The route after `…/push/`: "test" for "/push/test" or "/functions/v1/push/test". */
export function routeOf(pathname: string): string | undefined {
  return /(?:^|\/)push\/([a-z-]+)\/?$/.exec(pathname)?.[1];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function deviceIdOf(request: Request): Promise<string | undefined> {
  try {
    const body = (await request.json()) as { deviceId?: unknown } | null;
    const id = body?.deviceId;
    return typeof id === "string" && UUID.test(id) ? id : undefined;
  } catch {
    return undefined;
  }
}

/** The failure for a refusal of the database. */
function refusalOf(error: unknown): PushFailure {
  return error instanceof BackendRefusal
    ? (raisedPushFailure(error.message) ?? "unknown")
    : "unknown";
}

/** Answers one request to the function. */
export async function handlePush(request: Request, deps: PushDeps): Promise<Response> {
  const now = deps.now ?? Date.now;
  const started = now();
  const origin = request.headers.get("Origin");
  const route = routeOf(new URL(request.url).pathname) ?? "";
  let pushStatus: number | undefined;

  const finish = (status: number, body: object): Response => {
    deps.log({
      route: route === "test" ? route : "other",
      status,
      ...(pushStatus === undefined ? {} : { push: pushStatus }),
      ms: now() - started,
    });
    return answer(origin, status, body);
  };
  const fail = (failure: PushFailure) => finish(FAILURE_STATUS[failure], { error: failure });

  if (request.method === "OPTIONS") {
    return origin !== null && ALLOWED_ORIGINS.includes(origin)
      ? new Response(null, { status: 204, headers: corsHeaders(origin) })
      : new Response(null, { status: 403, headers: corsHeaders(origin) });
  }
  if (request.method !== "POST" || route !== "test") {
    return fail("notFound");
  }

  const token = /^Bearer (\S+)$/.exec(request.headers.get("Authorization") ?? "")?.[1];
  if (token === undefined) {
    return fail("notSignedIn");
  }
  let userId: string | null;
  try {
    userId = await deps.backend.userOf(token);
  } catch {
    userId = null;
  }
  if (userId === null) {
    return fail("notSignedIn");
  }
  const config = deps.config;
  if (config === null) {
    return fail("notConfigured");
  }
  const deviceId = await deviceIdOf(request);
  if (deviceId === undefined) {
    return fail("badRequest");
  }

  let target: TestTarget;
  try {
    target = await deps.backend.requestTest(token, deviceId);
  } catch (error) {
    return fail(refusalOf(error));
  }
  if (target.keyId !== (await keyIdOf(config.publicKey))) {
    return fail("keyChanged");
  }
  if (!isPushEndpoint(target.endpoint)) {
    return fail("endpointInvalid");
  }

  let push: EncryptedPush;
  try {
    push = await deps.encrypt(
      {
        data: TEST_PAYLOAD,
        options: { ttl: TEST_TTL_SECONDS, topic: "test", urgency: "normal" },
      },
      {
        endpoint: target.endpoint,
        expirationTime: null,
        keys: { p256dh: target.p256dh, auth: target.auth },
      },
      config,
    );
  } catch {
    // A key that looks right but is not one (the library's message may quote it): not logged.
    return fail("notConfigured");
  }

  let response: Response;
  try {
    const headers: Record<string, string> = {};
    for (const [name, value] of Object.entries(push.headers)) {
      if (value !== undefined) {
        headers[name] = value;
      }
    }
    response = await deps.fetch(target.endpoint, {
      method: "POST",
      headers,
      body: push.body,
      redirect: "error",
      signal: AbortSignal.timeout(deps.timeoutMs ?? 10_000),
    });
  } catch {
    return fail("pushFailed");
  }
  pushStatus = response.status;
  await response.body?.cancel();
  if (response.status === 404 || response.status === 410) {
    try {
      await deps.backend.forget(token, deviceId);
    } catch {
      // Removed with the next try then; the person sees "deviceGone" either way.
    }
    return fail("deviceGone");
  }
  if (!response.ok) {
    return fail("pushFailed");
  }
  return finish(200, { sent: true });
}
