// The server side of the notifications in the fake server of the end-to-end tests (NT-a): the
// devices of the accounts and the test notification, with the rules of the database
// (`…_push_devices.sql`) and the Edge Function (`supabase/functions/push/core.ts`). Instead of a
// push service it records what would have been sent; `answer` plays the push service's reply.
// Test-only.

import {
  isAuthSecret,
  isP256dh,
  isPushEndpoint,
  PUSH_LIMITS,
  type PushFailure,
  TEST_PAYLOAD,
} from "../../supabase/functions/push/rules";
import type { DeviceRegistration } from "./pushApi";
import { PushError } from "./pushApi";

interface Device extends DeviceRegistration {
  readonly userId: string;
  readonly seen: number;
}

export interface RecordedPush {
  readonly deviceId: string;
  readonly payload: typeof TEST_PAYLOAD;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_MS = 24 * 60 * 60_000;

function text(body: unknown, field: string): string {
  const value = (body as Record<string, unknown> | undefined)?.[field];
  return typeof value === "string" ? value : "";
}

function knownTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat("de", { timeZone: zone });
    return zone.length <= 64;
  } catch {
    return false;
  }
}

export class FakePushService {
  private devices: Device[] = [];
  private tests: { readonly userId: string; readonly deviceId: string; readonly at: number }[] = [];
  private readonly pushes = new Map<string, RecordedPush[]>();
  /**
   * How the "push service" answers the next tests of an account (`POST /test/push-answer`, per
   * account so tests running at the same time do not meet): 201 delivers, 404 and 410 mean the
   * address is dead, 503 plays a server without its keys, anything else a refusal.
   */
  private readonly answers = new Map<string, number>();

  constructor(private readonly now: () => number = Date.now) {}

  setAnswer(userId: string, status: number): void {
    this.answers.set(userId, status);
  }

  /** `register_push_device`. Throws `PushError`. */
  register(userId: string, body: unknown): void {
    const deviceId = text(body, "deviceId");
    const endpoint = text(body, "endpoint");
    if (!UUID.test(deviceId) || !isPushEndpoint(endpoint)) {
      throw new PushError("endpointInvalid");
    }
    const keyId = text(body, "keyId");
    if (
      !isP256dh(text(body, "p256dh")) ||
      !isAuthSecret(text(body, "auth")) ||
      !/^[A-Za-z0-9_-]{1,32}$/.test(keyId)
    ) {
      throw new PushError("badRequest");
    }
    const zone = text(body, "timeZone");
    const locale = text(body, "locale");
    const device: Device = {
      userId,
      deviceId,
      endpoint,
      p256dh: text(body, "p256dh"),
      auth: text(body, "auth"),
      keyId,
      timeZone: knownTimeZone(zone) ? zone : "Europe/Berlin",
      locale: /^[a-z]{2}$/.test(locale) ? locale : "de",
      seen: this.now(),
    };
    const others = this.devices.filter(
      (other) =>
        other.endpoint !== endpoint && !(other.userId === userId && other.deviceId === deviceId),
    );
    const mine = [device, ...others.filter((other) => other.userId === userId)]
      .sort((a, b) => b.seen - a.seen)
      .slice(0, PUSH_LIMITS.devicesPerAccount);
    this.devices = [...others.filter((other) => other.userId !== userId), ...mine];
  }

  /** `unregister_push_device`. */
  unregister(userId: string, deviceId: string): void {
    this.devices = this.devices.filter(
      (device) => !(device.userId === userId && device.deviceId === deviceId),
    );
  }

  /** The route `test` of the Edge Function with `request_test_push`. Throws `PushError`. */
  test(userId: string, deviceId: string): void {
    const answer = this.answers.get(userId) ?? 201;
    if (answer === 503) {
      throw new PushError("notConfigured");
    }
    const device = this.devices.find(
      (candidate) => candidate.userId === userId && candidate.deviceId === deviceId,
    );
    if (device === undefined) {
      throw new PushError("deviceUnknown");
    }
    const now = this.now();
    this.tests = this.tests.filter((test) => test.at > now - DAY_MS);
    const failure: PushFailure | undefined = this.tests.some(
      (test) =>
        test.userId === userId &&
        test.deviceId === deviceId &&
        test.at > now - PUSH_LIMITS.testIntervalMs,
    )
      ? "testWait"
      : this.tests.filter((test) => test.userId === userId).length >= PUSH_LIMITS.testsPerDay
        ? "testToday"
        : undefined;
    if (failure !== undefined) {
      throw new PushError(failure);
    }
    this.tests.push({ userId, deviceId, at: now });
    if (answer === 404 || answer === 410) {
      this.unregister(userId, deviceId);
      throw new PushError("deviceGone");
    }
    if (answer >= 400) {
      throw new PushError("pushFailed");
    }
    this.pushes.set(userId, [...this.pushesOf(userId), { deviceId, payload: TEST_PAYLOAD }]);
  }

  /** The devices of an account (for the tests), without their keys. */
  devicesOf(userId: string): readonly { deviceId: string; endpoint: string; timeZone: string }[] {
    return this.devices
      .filter((device) => device.userId === userId)
      .map(({ deviceId, endpoint, timeZone }) => ({ deviceId, endpoint, timeZone }));
  }

  /** What "reached" the devices of an account. */
  pushesOf(userId: string): readonly RecordedPush[] {
    return this.pushes.get(userId) ?? [];
  }
}
