// `PushPort` over the browser's Push API (NT-a). Only connects `notifications.ts` to the browser;
// the end-to-end tests run it against a mocked Push API (tests/e2e/pushMock.ts).

import {
  addressFrom,
  type Permission,
  type PushAddress,
  type PushPort,
  pushSupport,
} from "./notifications";
import { PushError } from "./pushApi";

/** How long "Aktivieren" waits for the service worker (it is installed after the page loaded). */
const WORKER_WAIT_MS = 10_000;

function standalone(): boolean {
  return (
    matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

function addressOf(subscription: PushSubscription): PushAddress {
  return addressFrom(subscription.toJSON(), subscription.options?.applicationServerKey);
}

async function registration(): Promise<ServiceWorkerRegistration | undefined> {
  return navigator.serviceWorker.getRegistration();
}

async function readyRegistration(): Promise<ServiceWorkerRegistration> {
  const ready = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), WORKER_WAIT_MS)),
  ]);
  if (ready === undefined) {
    throw new PushError("noWorker");
  }
  return ready;
}

export function browserPushPort(): PushPort {
  return {
    support: () =>
      pushSupport({
        hasPush:
          "PushManager" in window && "Notification" in window && "serviceWorker" in navigator,
        userAgent: navigator.userAgent,
        maxTouchPoints: navigator.maxTouchPoints,
        standalone: standalone(),
      }),
    permission: () => Notification.permission as Permission,
    requestPermission: async () => (await Notification.requestPermission()) as Permission,
    subscription: async () => {
      const subscription = await (await registration())?.pushManager.getSubscription();
      return subscription ? addressOf(subscription) : null;
    },
    subscribe: async (serverKey) => {
      const ready = await readyRegistration();
      try {
        return addressOf(
          await ready.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: serverKey,
          }),
        );
      } catch {
        // Refused by the browser or its push service (message in English, often empty).
        throw new PushError(Notification.permission === "denied" ? "unknown" : "pushFailed");
      }
    },
    unsubscribe: async () => {
      await (await (await registration())?.pushManager.getSubscription())?.unsubscribe();
    },
  };
}
