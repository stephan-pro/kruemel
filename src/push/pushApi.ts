// The server's side of the notifications (NT-a) as the app sees it: switch a device on or off and
// ask for a test notification. `SupabasePushApi` talks to the database functions and the Edge
// Function `push`; `FakeHttpPushApi` to the fake server of the end-to-end tests. Both follow the
// rules of `supabase/functions/push/rules.ts`.

import type { PushFailure, PushSettings } from "../../supabase/functions/push/rules";

/** What a device registers (`register_push_device`). */
export interface DeviceRegistration {
  readonly deviceId: string;
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
  readonly keyId: string;
  readonly timeZone: string;
  readonly locale: string;
}

export interface PushApi {
  /** Switches the device on for the signed-in person, or brings it up to date. */
  register(device: DeviceRegistration): Promise<void>;
  /** Switches the device off; a device that is not on changes nothing. */
  unregister(deviceId: string): Promise<void>;
  /** A test notification to this device, at once. */
  sendTest(deviceId: string): Promise<void>;
  /** The settings of the device, or `null` when the server does not know the device (any more). */
  settings(deviceId: string): Promise<PushSettings | null>;
  /**
   * Saves the settings of the device, and tells the server the device's language along with them
   * (EN-c). Throws `settingsInvalid` for settings that break the rules.
   */
  updateSettings(deviceId: string, settings: PushSettings, locale: string): Promise<void>;
}

/** A step of the notifications that failed, with the reason (`NOTIFICATION_TEXTS` has the words). */
export class PushError extends Error {
  constructor(readonly failure: PushFailure) {
    super(failure);
    this.name = "PushError";
  }
}
