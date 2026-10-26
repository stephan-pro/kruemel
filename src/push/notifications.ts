// Notifications on this device (NT-a, NT-b): where they stand, switching them on (only from a tap
// on "Aktivieren"), the test notification, switching them off and the settings of the device. The
// browser is behind `PushPort` (`browserPush.ts`; in the end-to-end tests the same code against a
// mocked Push API), the server behind `PushApi`. What this device switched on, for which account
// and with which key, is kept under `kruemel:push-device`; the device id stays when switched off.
// The settings the device chose are kept under `kruemel:push-settings`, so a change made without
// internet is not lost: it waits there ("noch nicht übertragen") until the server can be reached.

import {
  fromBase64Url,
  isPushEndpoint,
  isVapidPublicKey,
  keyIdOf,
  type PushSettings,
  pushSettingsProblems,
} from "../../supabase/functions/push/rules";
import type { KeyValueStore } from "../storage/localStorage";
import { type BrowserTraits, isIos } from "../ui/install";
import type { NotificationWay } from "../ui/notificationTexts";
import { type DeviceRegistration, type PushApi, PushError } from "./pushApi";

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
 * - `lost`: was on, but the server or the browser ended it ("Gerät abgemeldet"); switch on again.
 * - `active`: switched on; a test notification can be sent.
 */
export type NotificationStatus =
  | "notConfigured"
  | Exclude<PushSupport, "supported">
  | "blocked"
  | "off"
  | "lost"
  | "active";

/** Where this device keeps what it switched on. */
export const PUSH_DEVICE_KEY = "kruemel:push-device";

/** Where this device keeps the settings it chose (and whether the server has them yet). */
export const PUSH_SETTINGS_KEY = "kruemel:push-settings";

interface Memory {
  readonly deviceId: string;
  /** Set while switched on: for whom, with which key, at which address. */
  readonly userId?: string;
  readonly keyId?: string;
  readonly endpoint?: string;
  /** The time zone the server was told last. */
  readonly timeZone?: string;
  /** The server or the browser ended it while it was on: "Gerät abgemeldet". */
  readonly lost?: boolean;
  /** Signing out could not tell the server: whose address it still has to remove. */
  readonly unregisterFor?: string;
}

/** The settings of this device: as the server has them, or as chosen and not yet sent. */
export interface SettingsState {
  readonly settings: PushSettings;
  /** Chosen on this device, the server does not have them yet ("noch nicht übertragen"). */
  readonly pending: boolean;
}

interface SettingsMemory extends SettingsState {
  readonly userId: string;
  readonly deviceId: string;
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
  /**
   * The language of the device, read whenever the server is told (it writes the messages in it,
   * EN-c). Default: "de".
   */
  readonly locale?: () => string;
}

/** `sync` called again within this time (the app and the tile both start it) does nothing. */
const SYNC_PAUSE_MS = 60_000;

/** How long signing out waits for the server to hear that this device is off. */
const RELEASE_WAIT_MS = 4_000;

/** Failures after which the device is no longer on for the server. */
const GONE: readonly string[] = ["deviceGone", "deviceUnknown", "keyChanged"];

export class Notifications {
  private keyIdPromise: Promise<string> | undefined;
  private syncing: Promise<void> | undefined;
  private lastSync = Number.NEGATIVE_INFINITY;

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
    // What the browser holds is looked at by `sync` (which mends it); asking it here would call a
    // device "lost" for a moment that the app just has not reached the server yet.
    return memory.lost === true ? "lost" : "active";
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
    const { port, api } = this.options;
    // The question first, nothing awaited before: Safari asks only during the tap.
    const permission = port.permission() === "granted" ? "granted" : await port.requestPermission();
    if (permission !== "granted") {
      return permission === "denied" ? "blocked" : "off";
    }
    const address = await this.addressForKey();
    const keyId = await this.keyId();
    const { deviceId } = this.memory();
    const timeZone = this.timeZone();
    await api.register(this.registration(deviceId, address, keyId, timeZone));
    this.remember({
      deviceId,
      userId: this.options.userId,
      keyId,
      endpoint: address.endpoint,
      timeZone,
    });
    // What the server held for this device before (it keeps the settings) is read anew.
    this.forgetSettings();
    return "active";
  }

  /** "Testbenachrichtigung senden". Throws `PushError`; a dead device is "lost" from here on. */
  async sendTest(): Promise<void> {
    const memory = this.memory();
    if (memory.userId !== this.options.userId) {
      throw new PushError("deviceUnknown");
    }
    try {
      await this.options.api.sendTest(memory.deviceId);
    } catch (error) {
      if (error instanceof PushError && GONE.includes(error.failure)) {
        this.markLost(memory);
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
    this.forgetSettings();
    return this.status();
  }

  /**
   * Before signing out: the notifications of this account go off on this device. The browser's
   * address always goes; if the server cannot be told (no internet, session over), the next start
   * of the same account does it (`unregisterFor`). Never throws, signing out must not fail here.
   */
  async release(): Promise<void> {
    const memory = this.memory();
    if (memory.userId !== this.options.userId) {
      return;
    }
    // Not longer than a moment: a network that hangs must not keep the person from signing out.
    const told = await Promise.race([
      this.options.api.unregister(memory.deviceId).then(
        () => true,
        () => false,
      ),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), RELEASE_WAIT_MS)),
    ]);
    await this.options.port.unsubscribe().catch(() => undefined);
    this.remember(
      told
        ? { deviceId: memory.deviceId }
        : { deviceId: memory.deviceId, unregisterFor: memory.userId },
    );
    this.forgetSettings();
  }

  /** The account is gone (and its devices with it): only the browser's address is left to end. */
  async forget(): Promise<void> {
    const memory = this.memory();
    if (memory.userId !== this.options.userId) {
      return;
    }
    await this.options.port.unsubscribe().catch(() => undefined);
    this.remember({ deviceId: memory.deviceId });
    this.forgetSettings();
  }

  /**
   * At every start of the app, and when the internet is back: brings the server up to date with
   * this device. It tells the server the device is still in use and what time zone it is in (a
   * trip changes it), registers a new push address if the browser replaced it, gets a new one if
   * the browser lost it, finishes a sign-out that could not tell the server, and sends settings
   * that waited. It tells the server the device's language too (EN-c); the app calls it again
   * with `force` when the language is switched. If the server no longer knows the device (not
   * used for 90 days), the status becomes `lost`. Never throws: without internet nothing changes
   * and it tries again later.
   */
  sync(force = false): Promise<void> {
    if (this.syncing === undefined && !force && Date.now() - this.lastSync < SYNC_PAUSE_MS) {
      // Asked again at once (the app and the tile both start it): nothing new to tell.
      return Promise.resolve();
    }
    this.syncing ??= this.runSync()
      .catch(() => undefined)
      .finally(() => {
        this.syncing = undefined;
        this.lastSync = Date.now();
      });
    return this.syncing;
  }

  private async runSync(): Promise<void> {
    if (this.preconditions() !== undefined) {
      return;
    }
    const { api, port, userId } = this.options;
    const memory = this.memory();
    if (memory.unregisterFor === userId) {
      await api.unregister(memory.deviceId);
      this.remember({ deviceId: memory.deviceId });
      return;
    }
    if (
      memory.userId !== userId ||
      memory.keyId !== (await this.keyId()) ||
      memory.lost === true ||
      port.permission() !== "granted"
    ) {
      return;
    }
    const keyId = await this.keyId();
    const known = await api.settings(memory.deviceId);
    if (known === null) {
      this.markLost(memory);
      return;
    }
    const waiting = this.settingsMemory();
    if (waiting?.pending !== true) {
      this.rememberSettings({ settings: known, pending: false });
    }
    let address: PushAddress;
    try {
      address = await this.addressForKey();
    } catch {
      // The browser lost the address and cannot make a new one without a question to the person.
      this.markLost(memory);
      return;
    }
    const timeZone = this.timeZone();
    await api.register(this.registration(memory.deviceId, address, keyId, timeZone));
    this.remember({ ...memory, endpoint: address.endpoint, timeZone });
    await this.sendWaitingSettings();
  }

  // Settings of the device ---------------------------------------------------------------------

  /**
   * The settings of this device, for the form: from the server; what was chosen and has not been
   * sent comes first (and is sent now, if it can be). Without internet the last known settings
   * are shown. Throws `PushError` (`offline` when there is nothing to show yet; `deviceUnknown`
   * when the server forgot the device, which makes the status `lost`).
   */
  async loadSettings(): Promise<SettingsState> {
    const memory = this.memory();
    if (memory.userId !== this.options.userId) {
      throw new PushError("deviceUnknown");
    }
    const known = this.settingsMemory();
    if (known?.pending === true) {
      await this.sendWaitingSettings();
      const now = this.settingsMemory();
      return { settings: now?.settings ?? known.settings, pending: now?.pending ?? false };
    }
    try {
      const settings = await this.options.api.settings(memory.deviceId);
      if (settings === null) {
        this.markLost(memory);
        throw new PushError("deviceUnknown");
      }
      this.rememberSettings({ settings, pending: false });
      return { settings, pending: false };
    } catch (error) {
      if (known !== undefined && error instanceof PushError && error.failure === "offline") {
        return { settings: known.settings, pending: false };
      }
      throw error;
    }
  }

  /**
   * "Speichern": checks the settings, keeps them on the device and sends them. Without internet
   * they stay "pending" and go out when the server can be reached again. Throws `PushError`
   * (`settingsInvalid` for settings that break the rules; the others as the server says them).
   */
  async saveSettings(settings: PushSettings): Promise<"saved" | "pending"> {
    if (pushSettingsProblems(settings).length > 0) {
      throw new PushError("settingsInvalid");
    }
    const memory = this.memory();
    if (memory.userId !== this.options.userId || memory.lost === true) {
      throw new PushError("deviceUnknown");
    }
    const before = this.settingsMemory();
    this.rememberSettings({ settings, pending: true });
    try {
      await this.options.api.updateSettings(memory.deviceId, settings, this.locale());
    } catch (error) {
      if (error instanceof PushError && error.failure === "offline") {
        return "pending";
      }
      // The server will not take them: what was there before stays.
      if (before === undefined) {
        this.forgetSettings();
      } else {
        this.rememberSettings(before);
      }
      if (error instanceof PushError && GONE.includes(error.failure)) {
        this.markLost(memory);
      }
      throw error;
    }
    this.rememberSettings({ settings, pending: false });
    return "saved";
  }

  /** Sends settings that waited for the internet; says whether they are still waiting. */
  async sendWaitingSettings(): Promise<boolean> {
    const waiting = this.settingsMemory();
    if (waiting?.pending !== true) {
      return false;
    }
    try {
      await this.options.api.updateSettings(waiting.deviceId, waiting.settings, this.locale());
    } catch (error) {
      if (error instanceof PushError && error.failure === "offline") {
        return true;
      }
      // Refused for good (or the device is gone): they will not get through, so they do not stay.
      this.forgetSettings();
      if (error instanceof PushError && GONE.includes(error.failure)) {
        this.markLost(this.memory());
      }
      return false;
    }
    this.rememberSettings({ settings: waiting.settings, pending: false });
    return false;
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

  private timeZone(): string {
    return this.options.timeZone?.() ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  /**
   * The browser's push address for the public key of the build: the one it has, or a new one
   * (also when the one it has was made with another key). Throws `PushError`.
   */
  private async addressForKey(): Promise<PushAddress> {
    const { port, publicKey } = this.options;
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
    return address;
  }

  private registration(
    deviceId: string,
    address: PushAddress,
    keyId: string,
    timeZone: string,
  ): DeviceRegistration {
    return {
      deviceId,
      endpoint: address.endpoint,
      p256dh: address.p256dh,
      auth: address.auth,
      keyId,
      timeZone,
      locale: this.locale(),
    };
  }

  private locale(): string {
    return this.options.locale?.() ?? "de";
  }

  /** The server or the browser ended this device while it was on. */
  private markLost(memory: Memory): void {
    this.remember({ ...memory, lost: true });
    this.forgetSettings();
  }

  /** The settings kept for this device and account, if any. */
  private settingsMemory(): SettingsMemory | undefined {
    let stored: Partial<SettingsMemory> | null = null;
    try {
      stored = JSON.parse(this.options.store.getItem(PUSH_SETTINGS_KEY) ?? "null");
    } catch {
      stored = null;
    }
    const memory = this.memory();
    return stored?.userId === this.options.userId &&
      stored.deviceId === memory.deviceId &&
      stored.settings !== undefined &&
      pushSettingsProblems(stored.settings).length === 0
      ? (stored as SettingsMemory)
      : undefined;
  }

  private rememberSettings(state: SettingsState): void {
    const memory: SettingsMemory = {
      ...state,
      userId: this.options.userId,
      deviceId: this.memory().deviceId,
    };
    this.options.store.setItem(PUSH_SETTINGS_KEY, JSON.stringify(memory));
  }

  private forgetSettings(): void {
    this.options.store.removeItem(PUSH_SETTINGS_KEY);
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
