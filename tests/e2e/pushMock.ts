import type { Page } from "@playwright/test";

// The browser's Push API, played in the page (NT-a): a real push service is out of reach in the
// tests. The app's own code (`src/push/browserPush.ts`) runs against it unchanged: `Notification`
// with its permission and question, `navigator.serviceWorker` with a registration whose
// `pushManager` makes push addresses. What happened is kept in the session storage (survives a
// reload) and readable as `window.__pushMock`.

export interface PushMock {
  /** `false`: no Push API at all (an old browser, Safari outside the home screen). */
  readonly supported?: boolean;
  /** The permission before the question. Default "default". */
  readonly permission?: "default" | "granted" | "denied";
  /** What the person answers to the question. Default "granted". */
  readonly answer?: "default" | "granted" | "denied";
}

export interface PushMockState {
  readonly permission: string;
  /** How often the browser's question was asked. */
  readonly asked: number;
  readonly subscription: { readonly endpoint: string } | null;
}

export async function mockPush(page: Page, mock: PushMock = {}): Promise<void> {
  await page.addInitScript((options: PushMock) => {
    const KEY = "e2e-push-mock";
    type Address = { endpoint: string; keys: { p256dh: string; auth: string } };
    const state = (JSON.parse(sessionStorage.getItem(KEY) ?? "null") as {
      permission: string;
      asked: number;
      subscription: Address | null;
    } | null) ?? { permission: options.permission ?? "default", asked: 0, subscription: null };
    const save = () => sessionStorage.setItem(KEY, JSON.stringify(state));
    const scope = window as unknown as Record<string, unknown>;
    scope.__pushMock = state;
    if (options.supported === false) {
      delete scope.PushManager;
      return;
    }
    const subscriptionOf = (address: Address) => ({
      endpoint: address.endpoint,
      options: { applicationServerKey: null },
      toJSON: () => ({ endpoint: address.endpoint, expirationTime: null, keys: address.keys }),
      unsubscribe: async () => {
        state.subscription = null;
        save();
        return true;
      },
    });
    const registration = {
      scope: location.href,
      pushManager: {
        getSubscription: async () =>
          state.subscription ? subscriptionOf(state.subscription) : null,
        subscribe: async () => {
          if (state.permission !== "granted") {
            throw new DOMException("Registration failed - permission denied", "NotAllowedError");
          }
          state.subscription = {
            endpoint: `https://fcm.googleapis.com/fcm/send/e2e-${crypto.randomUUID()}`,
            keys: { p256dh: `B${"e".repeat(86)}`, auth: "f".repeat(22) },
          };
          save();
          return subscriptionOf(state.subscription);
        },
      },
    };
    const FakeNotification = {
      get permission() {
        return state.permission;
      },
      requestPermission: async () => {
        state.asked++;
        state.permission = options.answer ?? "granted";
        save();
        return state.permission;
      },
    };
    Object.defineProperty(window, "Notification", {
      configurable: true,
      writable: true,
      value: FakeNotification,
    });
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: Promise.resolve(registration),
        getRegistration: async () => registration,
        register: async () => registration,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        controller: null,
      },
    });
    if (!("PushManager" in window)) {
      scope.PushManager = function PushManager() {};
    }
  }, mock);
}

/** What the mocked browser went through so far. */
export function pushMockState(page: Page): Promise<PushMockState> {
  return page.evaluate(() => (window as unknown as { __pushMock: PushMockState }).__pushMock);
}
