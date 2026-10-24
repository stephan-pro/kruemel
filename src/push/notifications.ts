// Notifications on this device (NT-a): where they stand, switching them on (only from a tap on
// "Aktivieren"), the test notification and switching them off. The browser is behind `PushPort`
// (`browserPush.ts`; in the end-to-end tests the same code against a mocked Push API), the server
// behind `PushApi`. What this device switched on, for which account and with which key, is kept
// under `kruemel:push-device`; the device id stays when switched off.

import {
  fromBase64Url,
  isPushEndpoint,
  isVapidPublicKey,
  keyIdOf,
} from "../../supabase/functions/push/rules";
import type { KeyValueStore } from "../storage/localStorage";
import { type BrowserTraits, isIos } from "../ui/install";
import type { NotificationWay } from "../ui/notificationTexts";
import { type PushApi, PushError } from "./pushApi";

/** A push address of the browser and its keys (base64url without padding). */
export interface PushAddress {
  readonly endpoint: string;
  readonly p256dh: string;
  readonly auth: string;
  /** The public VAPID key the address was made with, if the browser tells it. */
  readonly serverKey?: string;
}

/**
 * - `supported`: Push API, notifications and service workers are there.
 * - `iosHomeScreen`: iPhone or iPad in Safari: only the app from the home screen can (iOS 16.4+).
 * - `unsupported`: anything else without the Push API.
 */
export type PushSupport = "supported" | "iosHomeScreen" | "unsupported";

export type Permission = "default" | "granted" | "denied";

/** The browser's Push API, reduced to what the app needs. */
export interface PushPort {
  support(): PushSupport;
  permission(): Permission;
  /** The browser's question; only from a tap, and before anything else is awaited. */
  requestPermission(): Promise<Permission>;
  /** The current push address of this browser for the app, or `null`. */
  subscription(): Promise<PushAddress | null>;
  /** A new push address for the public key. Throws `PushError`. */
  subscribe(serverKey: Uint8Array<ArrayBuffer>): Promise<PushAddress>;
  /** Ends the push address of this browser, if there is one. */
  unsubscribe(): Promise<void>;
}

export interface SupportTraits extends Pick<BrowserTraits, "userAgent" | "maxTouchPoints"> {
  /** `PushManager`, `Notification` and `navigator.serviceWorker` exist. */
  readonly hasPush: boolean;
  /** Running from the home screen. */
  readonly standalone: boolean;
}

export function pushSupport(traits: SupportTraits): PushSupport {
  if (traits.hasPush) {
    return "supported";
  }
  return isIos(traits) && !traits.standalone ? "iosHomeScreen" : "unsupported";
}

/** Which guide helps to allow notifications again in this browser. */
export function notificationWay(
  traits: Pick<BrowserTraits, "userAgent" | "maxTouchPoints">,
): NotificationWay {
  if (isIos(traits)) {
    return "ios";
  }
  return /Android/.test(traits.userAgent) && /Firefox\//.test(traits.userAgent)
    ? "firefoxAndroid"
    : "other";
}

/** `PushSubscription.toJSON()` (and its key) as a `PushAddress`; padding is dropped. */
export function addressFrom(
  json: { endpoint?: string; keys?: Record<string, string | undefined> },
  serverKey?: ArrayBuffer | null,
): PushAddress {
  const unpadded = (text: string | undefined) => (text ?? "").replace(/=+$/, "");
  const address = {
    endpoint: json.endpoint ?? "",
    p256dh: unpadded(json.keys?.p256dh),
    auth: unpadded(json.keys?.auth),
  };
  if (serverKey === undefined || serverKey === null) {
    return address;
  }
  const bytes = new Uint8Array(serverKey);
  let text = "";
  for (const byte of bytes) {
    text += String.fromCharCode(byte);
  }
  return {
    ...address,
    serverKey: btoa(text).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  };
}

/**
 * - `notConfigured`: the build has no public key (`VITE_VAPID_PUBLIC_KEY`).
 * - `blocked`: the browser refuses notifications for the app.
 * - `off`: not switched on on this device (for this account).
 * - `active`: switched on; a test notification can be sent.
 */
export type NotificationStatus =
  | "notConfigured"
  | Exclude<PushSupport, "supported">
  | "blocked"
  | "off"
  | "active";

/** Where this device keeps what it switched on. */
export const PUSH_DEVICE_KEY = "kruemel:push-device";

interface Memory {
  readonly deviceId: string;
  /** Set while switched on: for whom, with which key, at which address. */
  readonly userId?: string;
  readonly keyId?: string;
  readonly endpoint?: string;
}

export interface NotificationsOptions {
  readonly port: PushPort;
  readonly api: PushApi;
  readonly store: KeyValueStore;
  /** The public VAPID key of the build; "" when it has none. */
  readonly publicKey: string;
  /** The signed-in account. */
  readonly userId: string;
  /** Default: the device's (`Intl`). */
  readonly timeZone?: () => string;
  /** Default: "de". */
  readonly locale?: string;
}

/** Failures after which the device is no longer on for the server. */
const GONE: readonly string[] = ["deviceGone", "deviceUnknown", "keyChanged"];

export class Notifications {
  private keyIdPromise: Promise<string> | undefined;

  constructor(private readonly options: NotificationsOptions) {}

  async status(): Promise<NotificationStatus> {
    const first = this.preconditions();
    if (first !== undefined) {
      return first;
    }
    const permission = this.options.port.permission();
    if (permission !== "granted") {
      return permission === "denied" ? "blocked" : "off";
    }
    const memory = this.memory();
    if (memory.userId !== this.options.userId || memory.keyId !== (await this.keyId())) {
      return "off";
    }
    const address = await this.options.port.subscription().catch(() => null);
    return address !== null && address.endpoint === memory.endpoint ? "active" : "off";
  }

  /**
   * "Aktivieren": asks the browser (only now), makes a push address and registers it. Returns the
   * new status: `off` when the question was closed without an answer. Throws `PushError`.
   */
  async enable(): Promise<NotificationStatus> {
    const first = this.preconditions();
    if (first !== undefined) {
      return first;
    }
    const { port, api, publicKey } = this.options;
    // The question first, nothing awaited before: Safari asks only during the tap.
    const permission = port.permission() === "granted" ? "granted" : await port.requestPermission();
    if (permission !== "granted") {
      return permission === "denied" ? "blocked" : "off";
    }
    let address = await port.subscription().catch(() => null);
    if (address?.serverKey !== undefined && address.serverKey !== publicKey) {
      // Made with another key (a new key of the server): it cannot receive anything any more.
      await port.unsubscribe();
      address = null;
    }
    address ??= await port.subscribe(fromBase64Url(publicKey) as Uint8Array<ArrayBuffer>);
    if (!isPushEndpoint(address.endpoint)) {
      await port.unsubscribe().catch(() => undefined);
      throw new PushError("endpointInvalid");
    }
    const keyId = await this.keyId();
    const { deviceId } = this.memory();
    await api.register({
      deviceId,
      endpoint: address.endpoint,
      p256dh: address.p256dh,
      auth: address.auth,
      keyId,
      timeZone: this.options.timeZone?.() ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: this.options.locale ?? "de",
    });
    this.remember({ deviceId, userId: this.options.userId, keyId, endpoint: address.endpoint });
    return "active";
  }

  /** "Testbenachrichtigung senden". Throws `PushError`; a dead device is switched off here too. */
  async sendTest(): Promise<void> {
    const memory = this.memory();
    if (memory.userId !== this.options.userId) {
      throw new PushError("deviceUnknown");
    }
    try {
      await this.options.api.sendTest(memory.deviceId);
    } catch (error) {
      if (error instanceof PushError && GONE.includes(error.failure)) {
        this.remember({ deviceId: memory.deviceId });
      }
      throw error;
    }
  }

  /**
   * "Auf diesem Gerät ausschalten": the server first (without it nothing changes), then the
   * browser's push address. Throws `PushError`.
   */
  async disable(): Promise<NotificationStatus> {
    const { deviceId } = this.memory();
    await this.options.api.unregister(deviceId);
    await this.options.port.unsubscribe().catch(() => undefined);
    this.remember({ deviceId });
    return this.status();
  }

  /** What rules out notifications before the browser is even asked. */
  private preconditions(): NotificationStatus | undefined {
    if (!isVapidPublicKey(this.options.publicKey)) {
      return "notConfigured";
    }
    const support = this.options.port.support();
    return support === "supported" ? undefined : support;
  }

  private keyId(): Promise<string> {
    this.keyIdPromise ??= keyIdOf(this.options.publicKey);
    return this.keyIdPromise;
  }

  private memory(): Memory {
    let stored: Partial<Memory> | null = null;
    try {
      stored = JSON.parse(this.options.store.getItem(PUSH_DEVICE_KEY) ?? "null");
    } catch {
      stored = null;
    }
    if (typeof stored?.deviceId === "string") {
      return stored as Memory;
    }
    const fresh = { deviceId: crypto.randomUUID() };
    this.remember(fresh);
    return fresh;
  }

  private remember(memory: Memory): void {
    this.options.store.setItem(PUSH_DEVICE_KEY, JSON.stringify(memory));
  }
}
