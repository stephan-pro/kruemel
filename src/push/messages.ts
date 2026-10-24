// What the service worker shows for a push (NT-a): the server sends only codes and numbers
// (`{"v":1,"k":"test"}`), the device writes the text. Pure, so it is tested without a worker.

import { PUSH_MESSAGE_TEXTS } from "./messageTexts";

export interface ShownNotification {
  readonly title: string;
  readonly body: string;
  /** A newer message of the same kind replaces an older one on the device. */
  readonly tag: string;
}

/** The message for a push's payload; anything unreadable gets the general one. */
export function notificationFor(payload: unknown): ShownNotification {
  const kind = (payload as { v?: unknown; k?: unknown } | null | undefined) ?? {};
  if (kind.v === 1 && kind.k === "test") {
    return { title: PUSH_MESSAGE_TEXTS.title, body: PUSH_MESSAGE_TEXTS.test, tag: "test" };
  }
  return { title: PUSH_MESSAGE_TEXTS.title, body: PUSH_MESSAGE_TEXTS.fallback, tag: "kruemel" };
}

/** The payload of a push event: its JSON, or `undefined` if there is none or it is not JSON. */
export function payloadOf(data: { json(): unknown } | null): unknown {
  try {
    return data?.json();
  } catch {
    return undefined;
  }
}

/** The windows of the app as the service worker sees them (`Clients`, reduced to what is used). */
export interface AppWindows {
  matchAll(options: {
    type: "window";
    includeUncontrolled: boolean;
  }): Promise<readonly { readonly url: string; focus(): Promise<unknown> }[]>;
  openWindow(url: string): Promise<unknown>;
}

/**
 * A tap on a notification: brings an open window of the app to the front, else opens the app on
 * "Heute". An open window keeps its page (a form being filled in stays as it is).
 */
export async function openApp(windows: AppWindows, scope: string): Promise<void> {
  const open = (await windows.matchAll({ type: "window", includeUncontrolled: true })).find(
    (client) => client.url.startsWith(scope),
  );
  if (open !== undefined) {
    await open.focus();
    return;
  }
  await windows.openWindow(`${scope}#/heute`);
}
