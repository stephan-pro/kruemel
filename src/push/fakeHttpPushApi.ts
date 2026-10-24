// `PushApi` against the fake server of the end-to-end tests (`/push/*`, `FakePushService`), with
// the secret of the session `FakeHttpAuth` keeps in the device's storage. Test-only.

import { isPushFailure } from "../../supabase/functions/push/rules";
import { fakeAuthToken } from "../auth/fakeHttpAuth";
import type { KeyValueStore } from "../storage/localStorage";
import { type DeviceRegistration, type PushApi, PushError } from "./pushApi";

/**
 * The public key of the test build: it only has to look like one (nothing is encrypted against
 * the fake server). Not a key of the real project.
 */
export const FAKE_VAPID_PUBLIC_KEY = `B${"Kruemel-Testschluessel-".repeat(4).slice(0, 86)}`;

/** A test puts another key here ("" = none) to see the tile of a build without one. */
export const FAKE_VAPID_KEY_OVERRIDE = "kruemel-fake:vapid-key";

/** The public key the test build uses. */
export function fakeVapidPublicKey(store: KeyValueStore): string {
  return store.getItem(FAKE_VAPID_KEY_OVERRIDE) ?? FAKE_VAPID_PUBLIC_KEY;
}

export interface FakeHttpPushApiOptions {
  /** e.g. "http://localhost:4180" */
  readonly baseUrl: string;
  readonly store: KeyValueStore;
  /** Default: the browser's `fetch`. */
  readonly fetch?: typeof fetch;
}

export class FakeHttpPushApi implements PushApi {
  private readonly send: typeof fetch;

  constructor(private readonly options: FakeHttpPushApiOptions) {
    this.send = options.fetch ?? ((input, init) => fetch(input, init));
  }

  async register(device: DeviceRegistration): Promise<void> {
    await this.call("/push/register", device);
  }

  async unregister(deviceId: string): Promise<void> {
    await this.call("/push/unregister", { deviceId });
  }

  async sendTest(deviceId: string): Promise<void> {
    await this.call("/push/test", { deviceId });
  }

  private async call(path: string, body: object): Promise<void> {
    const token = fakeAuthToken(this.options.store);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token !== undefined) {
      headers.Authorization = `Bearer ${token}`;
    }
    let response: Response;
    try {
      response = await this.send(`${this.options.baseUrl}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    } catch {
      throw new PushError("offline");
    }
    if (!response.ok) {
      const answer = (await response.json().catch(() => null)) as { error?: unknown } | null;
      throw new PushError(isPushFailure(answer?.error) ? answer.error : "unknown");
    }
  }
}
