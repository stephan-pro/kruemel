// What the service worker shows for a push (NT-a): the server sends only codes and numbers
// (`{"v":1,"k":"test"}`, NT-c `{"v":1,"k":"daily","due":3,"overdue":1}`, NT-d
// `{"v":1,"k":"partner","name":"Robin","done":2,"took":1}` and `{"v":1,"k":"joined","name":"Robin"}`),
// the device writes the text. For a device whose language is English the server adds `"l":"en"` (EN-c);
// without it the text is German. Pure, so it is tested without a worker.

import { type MessageLanguage, messageLanguageOf, messageTextsFor } from "./messageTexts";

/**
 * The pages a tap on a message may open. "#/einstellungen" stays for messages shown before UX-a
 * (their stored page); new ones point to the group page they are about.
 */
export const OPEN_PAGES = [
  "#/heute",
  "#/erledigt",
  "#/woche",
  "#/einstellungen",
  "#/einstellungen/konto",
] as const;

export type OpenPage = (typeof OPEN_PAGES)[number];

export interface ShownNotification {
  readonly title: string;
  readonly body: string;
  /** A newer message of the same kind replaces an older one on the device. */
  readonly tag: string;
  /** The page a tap opens. */
  readonly open: OpenPage;
}

/** A count the server may send: a whole number from 0 to 999. */
function isCount(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 999;
}

/** A name of the household as the server sends it (1 to 30 characters), else none. */
function nameOf(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 30
    ? value
    : undefined;
}

/** The language a payload names (`l`, EN-c); German if it names none or cannot be read. */
export function languageOf(payload: unknown): MessageLanguage {
  const named = (payload as { l?: unknown } | null | undefined)?.l;
  return messageLanguageOf(named);
}

/**
 * The message for a push's payload, in the language the payload names; anything unreadable gets
 * the general one.
 */
export function notificationFor(payload: unknown): ShownNotification {
  const kind =
    (payload as
      | {
          v?: unknown;
          k?: unknown;
          due?: unknown;
          overdue?: unknown;
          name?: unknown;
          done?: unknown;
          took?: unknown;
        }
      | null
      | undefined) ?? {};
  const texts = messageTextsFor(languageOf(payload));
  const title = texts.title;
  if (kind.v === 1 && kind.k === "test") {
    return { title, body: texts.test, tag: "test", open: "#/heute" };
  }
  const { due, overdue, done, took } = kind;
  if (
    kind.v === 1 &&
    kind.k === "daily" &&
    isCount(due) &&
    isCount(overdue) &&
    due > 0 &&
    overdue <= due
  ) {
    return { title, body: texts.daily(due, overdue), tag: "daily", open: "#/heute" };
  }
  if (kind.v === 1 && kind.k === "partner" && isCount(done) && isCount(took) && done + took > 0) {
    return {
      title,
      body: texts.partner(nameOf(kind.name), done, took),
      tag: "partner",
      // What was done is in "Erledigt"; what was only taken over, in the week.
      open: done > 0 ? "#/erledigt" : "#/woche",
    };
  }
  if (kind.v === 1 && kind.k === "joined") {
    return {
      title,
      body: texts.joined(nameOf(kind.name)),
      tag: "joined",
      // Who joined is seen under "Konto und Haushalt".
      open: "#/einstellungen/konto",
    };
  }
  return { title, body: texts.fallback, tag: "kruemel", open: "#/heute" };
}

/** The payload of a push event: its JSON, or `undefined` if there is none or it is not JSON. */
export function payloadOf(data: { json(): unknown } | null): unknown {
  try {
    return data?.json();
  } catch {
    return undefined;
  }
}

/** The page stored with a shown message (`data.open`), or "Heute". */
export function openPageOf(data: unknown): OpenPage {
  const open = (data as { open?: unknown } | null | undefined)?.open;
  return (OPEN_PAGES as readonly unknown[]).includes(open) ? (open as OpenPage) : "#/heute";
}

/** A window of the app as the service worker sees it (`WindowClient`, reduced to what is used). */
export interface AppWindow {
  readonly url: string;
  focus(): Promise<unknown>;
  navigate?(url: string): Promise<unknown>;
}

/** The windows of the app as the service worker sees them (`Clients`, reduced to what is used). */
export interface AppWindows {
  matchAll(options: {
    type: "window";
    includeUncontrolled: boolean;
  }): Promise<readonly AppWindow[]>;
  openWindow(url: string): Promise<unknown>;
}

/** A form being filled in: a tap on a message does not take the window away from it. */
function isForm(url: string): boolean {
  return /#\/aufgaben\/(neu|bearbeiten\/)/.test(url);
}

/**
 * A tap on a notification: brings an open window of the app to the front and shows the message's
 * page there (not while a form is being filled in), else opens the app on that page.
 */
export async function openApp(
  windows: AppWindows,
  scope: string,
  page: OpenPage = "#/heute",
): Promise<void> {
  const target = `${scope}${page}`;
  const open = (await windows.matchAll({ type: "window", includeUncontrolled: true })).find(
    (client) => client.url.startsWith(scope),
  );
  if (open === undefined) {
    await windows.openWindow(target);
    return;
  }
  await open.focus();
  if (open.url !== target && !isForm(open.url) && open.navigate !== undefined) {
    try {
      await open.navigate(target);
    } catch {
      // A window the worker does not control yet cannot be sent elsewhere; it stays in front.
    }
  }
}
