// Rules of the notifications (NT-a) shared by the Edge Function `push`, the app and the fake server
// of the end-to-end tests. Plain TypeScript without imports, so Deno (Edge Function), Vite (app)
// and Vitest read the same file. The database checks the same rules in SQL
// (`supabase/migrations/…_push_devices.sql`); `rules.cases.ts` holds the cases both are tested with.

/**
 * The push services of the browsers (docs/BENACHRICHTIGUNGEN.md, 6.3). Only these may be stored as
 * a push address and receive a request from the Edge Function, so nobody can make it call another
 * address (SSRF). `.push.apple.com` and `.notify.windows.com` stand for every address below them.
 */
export const PUSH_HOSTS: readonly string[] = [
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
  ".push.apple.com",
  ".notify.windows.com",
];

/** The longest push address that is stored (the services use well under 300 characters). */
export const MAX_ENDPOINT_LENGTH = 1024;

/** Whether a push address may be stored and used: `https`, a service of `PUSH_HOSTS`, no tricks. */
export function isPushEndpoint(endpoint: string): boolean {
  if (
    endpoint.length > MAX_ENDPOINT_LENGTH ||
    !/^https:\/\/[a-z0-9.-]+(:443)?\/\S*$/.test(endpoint)
  ) {
    return false;
  }
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  const host = url.hostname;
  return (
    url.username === "" &&
    url.password === "" &&
    PUSH_HOSTS.some((allowed) =>
      allowed.startsWith(".")
        ? host.endsWith(allowed) &&
          /^[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(host.slice(0, -allowed.length))
        : host === allowed,
    )
  );
}

/** The browser's public key of a push address (`p256dh`): 65 bytes as base64url, 87 characters. */
export function isP256dh(key: string): boolean {
  return /^[A-Za-z0-9_-]{87}$/.test(key);
}

/** The browser's secret of a push address (`auth`): 16 bytes as base64url, 22 characters. */
export function isAuthSecret(key: string): boolean {
  return /^[A-Za-z0-9_-]{22}$/.test(key);
}

/** A public VAPID key: an uncompressed P-256 point (65 bytes, first byte 4) as base64url. */
export function isVapidPublicKey(key: string): boolean {
  return /^B[A-Za-z0-9_-]{86}$/.test(key);
}

/** A private VAPID key: 32 bytes as base64url, 43 characters. */
export function isVapidPrivateKey(key: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(key);
}

/**
 * The short name of a public VAPID key (`key_id` of a device): the first 16 characters of its
 * SHA-256 in base64url. A push address belongs to the key it was made with; when the key changes,
 * the stored `key_id` no longer matches and the device has to be switched on again.
 */
export async function keyIdOf(publicKey: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(publicKey)),
  );
  return base64Url(digest).slice(0, 16);
}

/** Bytes as base64url without padding. */
export function base64Url(bytes: Uint8Array): string {
  let text = "";
  for (const byte of bytes) {
    text += String.fromCharCode(byte);
  }
  return btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** base64url (with or without padding) as bytes. */
export function fromBase64Url(text: string): Uint8Array {
  const plain = atob(text.replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, ""));
  return Uint8Array.from(plain, (char) => char.charCodeAt(0));
}

/**
 * What a push carries (encrypted, small, without texts; the device writes the text). NT-a has only
 * the test notification.
 */
export const TEST_PAYLOAD = { v: 1, k: "test" } as const;

/** How long the push service keeps a test notification for a device that is off: 5 minutes. */
export const TEST_TTL_SECONDS = 300;

/**
 * Why a step of the notifications failed, as the Edge Function and the fake server answer
 * (`{"error": "<failure>"}`) and the app shows it (`NOTIFICATION_TEXTS.failures`).
 *
 * - `notSignedIn`: no or no valid sign-in.
 * - `notConfigured`: the server lacks its keys (secrets `VAPID_*`).
 * - `badRequest`: the request was malformed.
 * - `deviceUnknown`: this device is not switched on for this account.
 * - `deviceGone`: the push service no longer knows the address; the device was removed.
 * - `testWait`: one test per minute and device.
 * - `testToday`: ten tests a day per account.
 * - `keyChanged`: the device was switched on with another key; switch it off and on again.
 * - `endpointInvalid`: the address is not one of `PUSH_HOSTS` (this browser is not supported).
 * - `pushFailed`: the push service refused or did not answer.
 * - `notFound`: no such route.
 * - `offline`: the server could not be reached (the app's own failure).
 * - `noWorker`: the app's service worker is not ready (the app's own failure).
 * - `unknown`: anything else.
 */
export const PUSH_FAILURES = [
  "notSignedIn",
  "notConfigured",
  "badRequest",
  "deviceUnknown",
  "deviceGone",
  "testWait",
  "testToday",
  "keyChanged",
  "endpointInvalid",
  "pushFailed",
  "notFound",
  "offline",
  "noWorker",
  "unknown",
] as const;

export type PushFailure = (typeof PUSH_FAILURES)[number];

/** The HTTP status the Edge Function (and the fake server) answers a failure with. */
export const FAILURE_STATUS: Readonly<Record<PushFailure, number>> = {
  notSignedIn: 401,
  notConfigured: 503,
  badRequest: 400,
  deviceUnknown: 404,
  deviceGone: 410,
  testWait: 429,
  testToday: 429,
  keyChanged: 409,
  endpointInvalid: 422,
  pushFailed: 502,
  notFound: 404,
  offline: 503,
  noWorker: 500,
  unknown: 500,
};

export function isPushFailure(value: unknown): value is PushFailure {
  return typeof value === "string" && (PUSH_FAILURES as readonly string[]).includes(value);
}

/**
 * The messages the database functions raise and what they mean (as `RAISED` in
 * `src/auth/supabaseHousehold.ts`).
 */
export const RAISED_PUSH_FAILURES: Readonly<Record<string, PushFailure>> = {
  not_signed_in: "notSignedIn",
  push_endpoint_invalid: "endpointInvalid",
  push_keys_invalid: "badRequest",
  push_device_unknown: "deviceUnknown",
  push_test_wait: "testWait",
  push_test_today: "testToday",
};

/** The failure a database message stands for, or `undefined`. */
export function raisedPushFailure(message: string): PushFailure | undefined {
  return Object.entries(RAISED_PUSH_FAILURES).find(([raised]) => message.includes(raised))?.[1];
}

/** The limits (also in the migration and the fake server). */
export const PUSH_LIMITS = {
  devicesPerAccount: 10,
  testsPerDay: 10,
  testIntervalMs: 60_000,
} as const;

/** The pages that may call the Edge Function from the browser (CORS). */
export const ALLOWED_ORIGINS: readonly string[] = [
  "https://stephan-pro.github.io",
  "http://localhost:5173",
];
