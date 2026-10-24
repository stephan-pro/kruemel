// The Edge Function `push` without Deno: what it answers to a request. Route `test` (NT-a): the
// test notification for one device of the signed-in person. Route `flush` (NT-c): the schedule of
// the database calls it when messages are due; it fetches them in batches, sends them and reports
// back. `index.ts` hands in the real parts (sign-in check and database calls through supabase-js,
// encryption by `@block65/webcrypto-web-push`, `fetch`, the log); the tests (`core.test.ts`) hand
// in a mock push service and a fake database.
//
// Rules (docs/BENACHRICHTIGUNGEN.md, 5 and 6.3):
// - Only `POST …/push/test`, `POST …/push/flush` (and the CORS preflight); everything else is 404.
// - `test`: the sign-in is checked here and again by the database (`request_test_push` runs with
//   the person's token), so a test goes only to a device of that person, within the database's
//   limits.
// - `flush`: only with the token of the schedule in the header `x-kruemel-cron`, compared in
//   constant time with the secret `PUSH_CRON_TOKEN`; without it, or with another, 401 and nothing
//   else. The messages come from `claim_push_jobs` (secret key, `service_role` only), which counted
//   them just now for the device's own household; what became of each goes back through
//   `finish_push_jobs`. At most `FLUSH_LIMITS.perRun` per run, in batches, no new batch after the
//   deadline.
// - The keys come only from the secrets (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`);
//   without them the answer is `notConfigured`, without saying which one is missing.
// - The push address is checked against the allow list before every request (SSRF).
// - The push service's answer means what `pushAnswerFailure` says: 404/410 the address is dead, the
//   device is removed (`deviceGone`); 429, 5xx, no answer in time or no connection `pushFailed`
//   (try again later, `Retry-After` is passed on); any other refusal `pushRejected`.
// - Answers carry only a failure code (`{"error": "<PushFailure>"}`) or counts; the log only route,
//   status, failure, the push service's host (one of `PUSH_HOSTS`) and status, why it gave no
//   answer, the body's size, counts and the duration: never an address, key, token or payload.

import {
  ALLOWED_ORIGINS,
  CRON_HEADER,
  DAILY_TTL_SECONDS,
  type DailyPayload,
  dailyPayload,
  FAILURE_STATUS,
  FLUSH_LIMITS,
  isPushEndpoint,
  isVapidPrivateKey,
  isVapidPublicKey,
  JOINED_TTL_SECONDS,
  type JobOutcome,
  type JoinedPayload,
  jobOutcome,
  joinedPayload,
  keyIdOf,
  MAX_PUSH_BODY_BYTES,
  MIN_CRON_TOKEN_LENGTH,
  PARTNER_TTL_SECONDS,
  type PartnerPayload,
  PUSH_URGENCY,
  type PushFailure,
  partnerPayload,
  pushAnswerFailure,
  raisedPushFailure,
  retryAfterSeconds,
  sameSecret,
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

/** The token of the schedule (secret `PUSH_CRON_TOKEN`), or `null` if it is missing or too short. */
export function cronTokenOf(env: (name: string) => string | undefined): string | null {
  const token = env("PUSH_CRON_TOKEN")?.trim() ?? "";
  return token.length >= MIN_CRON_TOKEN_LENGTH ? token : null;
}

/** A device's push address as the database hands it out. */
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

/** A due message as `claim_push_jobs` hands it out: the address and what to tell (NT-c, NT-d). */
export type PushJob = TestTarget & { readonly id: number } & (
    | { readonly kind: "daily"; readonly due: number; readonly overdue: number }
    | {
        readonly kind: "partner";
        readonly name?: string;
        readonly done: number;
        readonly took: number;
      }
    | { readonly kind: "joined"; readonly name?: string }
  );

/** What `claim_push_jobs` answers: the messages to send, and how many it left out. */
export interface ClaimedJobs {
  readonly jobs: readonly PushJob[];
  /**
   * Messages with nothing to tell (nothing to do, undone, switched off, no household): none sent.
   */
  readonly empty: number;
  /** Over the limit of messages a day for the device. */
  readonly dropped: number;
}

/** What became of one message, for `finish_push_jobs`. */
export interface JobResult {
  readonly id: number;
  readonly outcome: JobOutcome;
  /** For `retry`: the seconds the push service asked to wait (`Retry-After`). */
  readonly retryAfter?: number;
}

/** The database with the function's secret key (`service_role`), only for the route `flush`. */
export interface JobsBackend {
  claim(limit: number): Promise<ClaimedJobs>;
  finish(results: readonly JobResult[]): Promise<void>;
}

/** What the encryption library makes of a message (`buildPushPayload`). */
export interface EncryptedPush {
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly method: string;
  readonly body: Uint8Array<ArrayBuffer>;
}

export type Encrypt = (
  message: {
    data: typeof TEST_PAYLOAD | DailyPayload | PartnerPayload | JoinedPayload;
    options: { ttl: number; topic: string; urgency: typeof PUSH_URGENCY };
  },
  subscription: {
    endpoint: string;
    expirationTime: null;
    keys: { p256dh: string; auth: string };
  },
  vapid: { subject: string; publicKey: string; privateKey: string },
) => Promise<EncryptedPush>;

/** Why the push service gave no answer: "timeout", "network" (incl. a redirect) or "tooLarge". */
type Cause = "timeout" | "network" | "tooLarge";

/** One line of the log of the route `test` (and of unknown routes): nothing personal or secret. */
export interface LogEntry {
  readonly route: string;
  readonly status: number;
  /** The failure code of the answer, if it is one. */
  readonly error?: PushFailure;
  /** The push service's host (e.g. "updates.push.services.mozilla.com"), once it is chosen. */
  readonly host?: string;
  /** The size of the encrypted body in bytes, once it is made. */
  readonly bytes?: number;
  /** The push service's answer, if it gave one. */
  readonly push?: number;
  readonly cause?: Cause;
  readonly ms: number;
}

/** The failures of one run of `flush`, counted by failure, push service, its answer and cause. */
export interface FlushProblem {
  readonly error: PushFailure;
  readonly host?: string;
  readonly push?: number;
  readonly cause?: Cause;
  readonly count: number;
}

/** One line of the log of a run of `flush`: counts only. */
export interface FlushLogEntry {
  readonly route: "flush";
  readonly status: number;
  readonly error?: PushFailure;
  readonly jobs: number;
  readonly sent: number;
  readonly retry: number;
  readonly gone: number;
  readonly dropped: number;
  readonly empty: number;
  readonly problems?: readonly FlushProblem[];
  readonly ms: number;
}

export interface PushDeps {
  /** `null`: the secrets are missing (answer `notConfigured`). */
  readonly config: PushConfig | null;
  readonly backend: PushBackend;
  /** The token of the schedule (`cronTokenOf`); missing or `null`: `flush` answers 401. */
  readonly cronToken?: string | null;
  /** The database with the secret key; missing or `null`: `flush` answers `notConfigured`. */
  readonly jobs?: JobsBackend | null;
  readonly encrypt: Encrypt;
  readonly fetch: typeof fetch;
  readonly log: (entry: LogEntry | FlushLogEntry) => void;
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

/** What happened with one push, as far as it got (the log may say all of it but `retryAfter`). */
interface Delivery {
  readonly failure?: PushFailure;
  readonly host?: string;
  readonly bytes?: number;
  readonly push?: number;
  readonly cause?: Cause;
  readonly retryAfter?: number;
}

/**
 * Sends one message to one device: checks its key and address, encrypts, asks the push service
 * (at most `timeoutMs`, no redirects) and says what came of it.
 */
async function deliver(
  target: TestTarget,
  message: Parameters<Encrypt>[0],
  config: PushConfig,
  keyId: string,
  deps: PushDeps,
): Promise<Delivery> {
  if (target.keyId !== keyId) {
    return { failure: "keyChanged" };
  }
  if (!isPushEndpoint(target.endpoint)) {
    return { failure: "endpointInvalid" };
  }
  // One of PUSH_HOSTS (checked just above): names the service, not the device.
  const host = new URL(target.endpoint).hostname;

  let push: EncryptedPush;
  try {
    push = await deps.encrypt(
      message,
      {
        endpoint: target.endpoint,
        expirationTime: null,
        keys: { p256dh: target.p256dh, auth: target.auth },
      },
      config,
    );
  } catch {
    // A key that looks right but is not one (the library's message may quote it): not logged.
    return { failure: "notConfigured", host };
  }
  const bytes = push.body.byteLength;
  if (bytes > MAX_PUSH_BODY_BYTES) {
    // The push service would answer 413; not sent at all.
    return { failure: "pushRejected", host, bytes, cause: "tooLarge" };
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
  } catch (error) {
    // `AbortSignal.timeout` fails with a "TimeoutError"; anything else is the connection (or a
    // redirect, which a push service never sends).
    const cause = error instanceof Error && error.name === "TimeoutError" ? "timeout" : "network";
    return { failure: "pushFailed", host, bytes, cause };
  }
  try {
    await response.body?.cancel();
  } catch {
    // The answer is known from its status; what it says beyond that is not used.
  }
  const failure = pushAnswerFailure(response.status);
  const retryAfter =
    failure === "pushFailed" ? retryAfterSeconds(response.headers.get("Retry-After")) : undefined;
  return {
    host,
    bytes,
    push: response.status,
    ...(failure === undefined ? {} : { failure }),
    ...(retryAfter === undefined ? {} : { retryAfter }),
  };
}

/** Answers one request to the function. */
export async function handlePush(request: Request, deps: PushDeps): Promise<Response> {
  const now = deps.now ?? Date.now;
  const started = now();
  const origin = request.headers.get("Origin");
  const route = routeOf(new URL(request.url).pathname) ?? "";
  // What the log may say about the push service (LogEntry), filled in as far as it got.
  let sending: Omit<Delivery, "failure" | "retryAfter"> = {};

  const finish = (status: number, body: object, failure?: PushFailure): Response => {
    deps.log({
      route: route === "test" ? route : "other",
      status,
      ...(failure === undefined ? {} : { error: failure }),
      ...sending,
      ms: now() - started,
    });
    return answer(origin, status, body);
  };
  const fail = (failure: PushFailure) =>
    finish(FAILURE_STATUS[failure], { error: failure }, failure);

  if (request.method === "OPTIONS") {
    return origin !== null && ALLOWED_ORIGINS.includes(origin)
      ? new Response(null, { status: 204, headers: corsHeaders(origin) })
      : new Response(null, { status: 403, headers: corsHeaders(origin) });
  }
  if (request.method === "POST" && route === "flush") {
    return flush(request, deps, origin, now, started);
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
  const {
    failure,
    retryAfter: _retryAfter,
    ...seen
  } = await deliver(
    target,
    {
      data: TEST_PAYLOAD,
      options: { ttl: TEST_TTL_SECONDS, topic: "test", urgency: PUSH_URGENCY },
    },
    config,
    await keyIdOf(config.publicKey),
    deps,
  );
  sending = seen;
  if (failure === "deviceGone") {
    try {
      await deps.backend.forget(token, deviceId);
    } catch {
      // Removed with the next try then; the person sees "deviceGone" either way.
    }
  }
  return failure === undefined ? finish(200, { sent: true }) : fail(failure);
}

/** The message of a due job; a newer one of the same kind replaces it at the push service. */
export function messageOf(job: PushJob): Parameters<Encrypt>[0] {
  const urgency = PUSH_URGENCY;
  switch (job.kind) {
    case "daily":
      return {
        data: dailyPayload(job.due, job.overdue),
        options: { ttl: DAILY_TTL_SECONDS, topic: "daily", urgency },
      };
    case "partner":
      return {
        data: partnerPayload(job.name, job.done, job.took),
        options: { ttl: PARTNER_TTL_SECONDS, topic: "partner", urgency },
      };
    case "joined":
      return {
        data: joinedPayload(job.name),
        options: { ttl: JOINED_TTL_SECONDS, topic: "joined", urgency },
      };
  }
}

/** The route `flush`: sends what the database has due, in batches, and reports back. */
async function flush(
  request: Request,
  deps: PushDeps,
  origin: string | null,
  now: () => number,
  started: number,
): Promise<Response> {
  const counts = { jobs: 0, sent: 0, retry: 0, gone: 0, dropped: 0, empty: 0 };
  const problems = new Map<string, FlushProblem>();

  const done = (status: number, failure?: PushFailure): Response => {
    deps.log({
      route: "flush",
      status,
      ...(failure === undefined ? {} : { error: failure }),
      ...counts,
      ...(problems.size === 0 ? {} : { problems: [...problems.values()] }),
      ms: now() - started,
    });
    const { jobs: _jobs, ...outcomes } = counts;
    return answer(origin, status, failure === undefined ? outcomes : { error: failure });
  };

  const given = request.headers.get(CRON_HEADER);
  const expected = deps.cronToken ?? null;
  // Missing token, no token set, another token: the same answer, nothing more.
  if (given === null || expected === null || !(await sameSecret(given.trim(), expected))) {
    return done(FAILURE_STATUS.notSignedIn, "notSignedIn");
  }
  const config = deps.config;
  const jobs = deps.jobs ?? null;
  if (config === null || jobs === null) {
    return done(FAILURE_STATUS.notConfigured, "notConfigured");
  }
  const keyId = await keyIdOf(config.publicKey);

  const send = async (job: PushJob): Promise<JobResult> => {
    const delivery = await deliver(job, messageOf(job), config, keyId, deps);
    const outcome = jobOutcome(delivery.failure);
    counts[outcome]++;
    if (delivery.failure !== undefined) {
      const { failure, retryAfter: _retryAfter, bytes: _bytes, ...seen } = delivery;
      const key = JSON.stringify([failure, seen.host, seen.push, seen.cause]);
      problems.set(key, { error: failure, ...seen, count: (problems.get(key)?.count ?? 0) + 1 });
    }
    return {
      id: job.id,
      outcome,
      ...(delivery.retryAfter === undefined ? {} : { retryAfter: delivery.retryAfter }),
    };
  };

  try {
    while (counts.jobs < FLUSH_LIMITS.perRun && now() - started < FLUSH_LIMITS.deadlineMs) {
      const wanted = Math.min(FLUSH_LIMITS.batch, FLUSH_LIMITS.perRun - counts.jobs);
      const claimed = await jobs.claim(wanted);
      counts.empty += claimed.empty;
      counts.dropped += claimed.dropped;
      if (claimed.jobs.length === 0) {
        break;
      }
      counts.jobs += claimed.jobs.length;
      const results: JobResult[] = [];
      for (let start = 0; start < claimed.jobs.length; start += FLUSH_LIMITS.parallel) {
        const group = claimed.jobs.slice(start, start + FLUSH_LIMITS.parallel);
        results.push(...(await Promise.all(group.map(send))));
      }
      await jobs.finish(results);
      if (claimed.jobs.length < wanted) {
        break;
      }
    }
  } catch {
    // The database did not answer: the messages it handed out come again once their claim ends
    // (3 minutes); a device may then get one twice, which replaces the first (same `tag`).
    return done(FAILURE_STATUS.unknown, "unknown");
  }
  return done(200);
}
