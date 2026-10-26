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
 * The languages of the messages (EN-c). Each device has one (`push_devices.locale`, told by the app
 * when it registers, saves its settings and changes its language); a value the server does not know
 * counts as German, in the database (`private.push_language`) as here.
 */
export const PUSH_LANGUAGES = ["de", "en"] as const;

export type PushLanguage = (typeof PUSH_LANGUAGES)[number];

/** The language for what a device (or an old row) says: "en" or else German. */
export function pushLanguageOf(value: unknown): PushLanguage {
  return value === "en" ? "en" : "de";
}

/**
 * How a payload names its language: `l: "en"` for English, nothing for German. The device writes
 * the text (the service worker knows both languages, `src/push/messageTexts.ts`); a payload
 * without `l` is German, so devices and servers of before EN-c still understand each other.
 */
export type LanguageField = { readonly l?: "en" };

function languageField(language: PushLanguage): LanguageField {
  return language === "en" ? { l: "en" } : {};
}

/**
 * What a push carries (encrypted, small, without texts; the device writes the text): the test
 * notification (NT-a) and the daily overview (`DailyPayload`, NT-c).
 */
export type TestPayload = { readonly v: 1; readonly k: "test" } & LanguageField;

export function testPayload(language: PushLanguage = "de"): TestPayload {
  return { v: 1, k: "test", ...languageField(language) };
}

/** How long the push service keeps a test notification for a device that is off: 5 minutes. */
export const TEST_TTL_SECONDS = 300;

/**
 * The daily overview (NT-c): only how many tasks are the person's today or earlier (`due`) and how
 * many of them are overdue. No titles, no names: the device shows it on the lock screen. A type, not
 * an interface, so it counts as JSON for the encryption library.
 */
export type DailyPayload = {
  readonly v: 1;
  readonly k: "daily";
  readonly due: number;
  readonly overdue: number;
} & LanguageField;

export function dailyPayload(
  due: number,
  overdue: number,
  language: PushLanguage = "de",
): DailyPayload {
  return { v: 1, k: "daily", due, overdue, ...languageField(language) };
}

/** How long the push service keeps a daily overview for a device that is off: 6 hours. */
export const DAILY_TTL_SECONDS = 6 * 60 * 60;

/**
 * The message about the other person (NT-d): their name in the household (at most 30 characters;
 * missing if the household has no names) and how many tasks they did for the person (`done`) and
 * took over from them (`took`). Never a task.
 */
export type PartnerPayload = {
  readonly v: 1;
  readonly k: "partner";
  readonly name?: string;
  readonly done: number;
  readonly took: number;
} & LanguageField;

export function partnerPayload(
  name: string | undefined,
  done: number,
  took: number,
  language: PushLanguage = "de",
): PartnerPayload {
  return {
    v: 1,
    k: "partner",
    ...(name === undefined ? {} : { name }),
    done,
    took,
    ...languageField(language),
  };
}

/** How long the push service keeps a message about the other person: 12 hours. */
export const PARTNER_TTL_SECONDS = 12 * 60 * 60;

/** Somebody joined the household (NT-d): only their name in it, if the household has names. */
export type JoinedPayload = {
  readonly v: 1;
  readonly k: "joined";
  readonly name?: string;
} & LanguageField;

export function joinedPayload(
  name: string | undefined,
  language: PushLanguage = "de",
): JoinedPayload {
  return { v: 1, k: "joined", ...(name === undefined ? {} : { name }), ...languageField(language) };
}

/** How long the push service keeps a message about joining: 24 hours. */
export const JOINED_TTL_SECONDS = 24 * 60 * 60;

/**
 * The `Urgency` of every push (RFC 8030, 5.3): "high". Without the header a push counts as
 * "normal", which a device should get "on neither power nor Wi-Fi"; "high" also on low battery
 * ("time-sensitive alert"). On Android, Google's FCM delivers high priority at once, also in Doze,
 * normal priority may wait (Firebase, "Set the priority of a message"); whether Mozilla passes the
 * header on to FCM for Firefox on Android, its documentation does not say (device test NT-e).
 * Krümel sends few pushes, each a visible message the person asked for (the daily
 * overview at its time, a message about the other person, the test), so "high" is the right
 * value and no misuse of it (docs/BENACHRICHTIGUNGEN.md, 10.4).
 */
export const PUSH_URGENCY = "high";

/**
 * The header with which the schedule of the database (`private.push_tick`) calls the route `flush`;
 * its value is the token `PUSH_CRON_TOKEN` (docs/BENACHRICHTIGUNGEN.md, 7.4).
 */
export const CRON_HEADER = "x-kruemel-cron";

/** The shortest token the function accepts (the PO's token has 44 characters). */
export const MIN_CRON_TOKEN_LENGTH = 32;

/**
 * Limits of one run of the route `flush`: messages fetched at a time (`claim_push_jobs` keeps them
 * for 3 minutes), sent at the same time, at most per run, and no new batch after `deadlineMs`. With
 * 10 s per push service at most, a run ends within about a minute.
 */
export const FLUSH_LIMITS = {
  batch: 25,
  parallel: 10,
  perRun: 100,
  deadlineMs: 30_000,
} as const;

/** The longest wait a push service may ask for with `Retry-After` (and the database accepts). */
export const MAX_RETRY_AFTER_SECONDS = 3600;

/**
 * What became of a message, as the Edge Function tells `finish_push_jobs`: `sent`; `retry` later
 * (push service busy or not reachable, or the keys of the function did not work: the PO may fix
 * them meanwhile); `gone` (404/410: the address is dead, the device is removed); `dropped`
 * (refused, the device has another key, address not allowed: another try does not help).
 */
export type JobOutcome = "sent" | "retry" | "gone" | "dropped";

/** The outcome of a failure (`undefined` = sent). */
export function jobOutcome(failure: PushFailure | undefined): JobOutcome {
  if (failure === undefined) {
    return "sent";
  }
  if (failure === "deviceGone") {
    return "gone";
  }
  return failure === "pushFailed" || failure === "notConfigured" ? "retry" : "dropped";
}

/** The seconds of a `Retry-After` header (only the form in seconds), at most an hour. */
export function retryAfterSeconds(header: string | null): number | undefined {
  if (header === null || !/^\d{1,9}$/.test(header.trim())) {
    return undefined;
  }
  return Math.min(Number(header.trim()), MAX_RETRY_AFTER_SECONDS);
}

/**
 * Whether two secrets are equal, in a time that does not depend on where they differ: both are
 * hashed (SHA-256, same length) and every byte is compared.
 */
export async function sameSecret(given: string, expected: string): Promise<boolean> {
  const digest = async (value: string) =>
    new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  const [a, b] = await Promise.all([digest(given), digest(expected)]);
  let difference = 0;
  for (let index = 0; index < a.length; index++) {
    difference |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return difference === 0;
}

/**
 * The largest encrypted push body that is sent. Mozilla's push service accepts only 2744 bytes for
 * devices it reaches through FCM (Firefox on Android) and answers 413 above that
 * (docs/BENACHRICHTIGUNGEN.md, 6.3); the others accept 4096. So the body is not padded up.
 */
export const MAX_PUSH_BODY_BYTES = 2744;

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
 * - `settingsInvalid`: the settings of the device break `pushSettingsProblems` (NT-b).
 * - `pushFailed`: the push service did not answer in time, was not reachable, was busy (429) or
 *   failed itself (5xx); worth another try later.
 * - `pushRejected`: the push service refused the message (400, 401, 403, 413 …): the server's setup
 *   or message is wrong, another try does not help.
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
  "settingsInvalid",
  "pushFailed",
  "pushRejected",
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
  settingsInvalid: 422,
  pushFailed: 502,
  pushRejected: 502,
  notFound: 404,
  offline: 503,
  noWorker: 500,
  unknown: 500,
};

/**
 * What an answer of the push service means (RFC 8030; Mozilla answers 201, older services 200 or
 * 202, none with a body that matters): `undefined` for sent, else the failure.
 */
export function pushAnswerFailure(status: number): PushFailure | undefined {
  if (status >= 200 && status < 300) {
    return undefined;
  }
  if (status === 404 || status === 410) {
    return "deviceGone";
  }
  return status === 429 || status >= 500 ? "pushFailed" : "pushRejected";
}

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
  push_settings_invalid: "settingsInvalid",
  push_test_wait: "testWait",
  push_test_today: "testToday",
};

/** The failure a database message stands for, or `undefined`. */
export function raisedPushFailure(message: string): PushFailure | undefined {
  return Object.entries(RAISED_PUSH_FAILURES).find(([raised]) => message.includes(raised))?.[1];
}

// Settings per device (NT-b) -------------------------------------------------------------------

/**
 * What a device chooses (docs/BENACHRICHTIGUNGEN.md, 1.2): which kinds of notifications it gets,
 * when the daily overview comes and its quiet hours. `dailyDays` is a bit mask of the weekdays
 * (Monday = 1, Tuesday = 2 … Sunday = 64). Times are "HH:MM" local to the device. The database
 * keeps the same rules (`…_push_settings.sql`); `rules.cases.ts` holds the cases both are tested
 * with.
 */
export interface PushSettings {
  readonly dailyEnabled: boolean;
  readonly dailyTime: string;
  readonly dailyDays: number;
  readonly partnerEnabled: boolean;
  readonly householdEnabled: boolean;
  readonly quietEnabled: boolean;
  readonly quietFrom: string;
  readonly quietTo: string;
}

/** Monday to Sunday: all seven bits. */
export const ALL_WEEKDAYS = 127;

/** What a device has until it chooses otherwise. */
export const DEFAULT_PUSH_SETTINGS: PushSettings = {
  dailyEnabled: true,
  dailyTime: "07:30",
  dailyDays: ALL_WEEKDAYS,
  partnerEnabled: true,
  householdEnabled: true,
  quietEnabled: true,
  quietFrom: "21:00",
  quietTo: "07:00",
};

/** A time of day as "HH:MM" (24 hours, to the minute). */
export function isClockTime(text: unknown): boolean {
  return typeof text === "string" && /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(text);
}

/** Which setting is wrong, named after the field it belongs to. */
export type PushSettingsProblem = "dailyTime" | "dailyDays" | "quietFrom" | "quietTo" | "quietSame";

/**
 * What is wrong with the settings, empty when they are fine: times that are none, a daily overview
 * on no weekday at all, quiet hours that start and end at the same time.
 */
export function pushSettingsProblems(settings: PushSettings): PushSettingsProblem[] {
  const problems: PushSettingsProblem[] = [];
  if (!isClockTime(settings.dailyTime)) {
    problems.push("dailyTime");
  }
  const days = settings.dailyDays;
  const noDay = settings.dailyEnabled && days === 0;
  if (!Number.isInteger(days) || days < 0 || days > ALL_WEEKDAYS || noDay) {
    problems.push("dailyDays");
  }
  if (!isClockTime(settings.quietFrom)) {
    problems.push("quietFrom");
  }
  if (!isClockTime(settings.quietTo)) {
    problems.push("quietTo");
  } else if (settings.quietEnabled && settings.quietFrom === settings.quietTo) {
    problems.push("quietSame");
  }
  return problems;
}

/** The settings as the database functions take them (`update_push_settings`). */
export function settingsArguments(settings: PushSettings) {
  return {
    p_daily_enabled: settings.dailyEnabled,
    p_daily_time: settings.dailyTime,
    p_daily_days: settings.dailyDays,
    p_partner_enabled: settings.partnerEnabled,
    p_household_enabled: settings.householdEnabled,
    p_quiet_enabled: settings.quietEnabled,
    p_quiet_from: settings.quietFrom,
    p_quiet_to: settings.quietTo,
  };
}

/** The columns of `push_devices` that hold the settings, as the app reads them. */
export interface SettingsRow {
  readonly daily_enabled: boolean;
  readonly daily_time: string;
  readonly daily_days: number;
  readonly partner_enabled: boolean;
  readonly household_enabled: boolean;
  readonly quiet_enabled: boolean;
  readonly quiet_from: string;
  readonly quiet_to: string;
}

/** `SETTINGS_COLUMNS` as one `select` list. */
export const SETTINGS_COLUMNS =
  "daily_enabled, daily_time, daily_days, partner_enabled, household_enabled, quiet_enabled, quiet_from, quiet_to";

/** A row of `push_devices` as settings (the database writes times as "HH:MM:SS"). */
export function settingsFromRow(row: SettingsRow): PushSettings {
  return {
    dailyEnabled: row.daily_enabled,
    dailyTime: row.daily_time.slice(0, 5),
    dailyDays: row.daily_days,
    partnerEnabled: row.partner_enabled,
    householdEnabled: row.household_enabled,
    quietEnabled: row.quiet_enabled,
    quietFrom: row.quiet_from.slice(0, 5),
    quietTo: row.quiet_to.slice(0, 5),
  };
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
