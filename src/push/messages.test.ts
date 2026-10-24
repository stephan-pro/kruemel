import { describe, expect, it } from "vitest";
import { type AppWindows, notificationFor, openApp, payloadOf } from "./messages";

const SCOPE = "https://stephan-pro.github.io/kruemel/";

/** The windows of the app as the service worker would see them; records what happened. */
function windows(urls: string[]) {
  const done: string[] = [];
  const all: AppWindows = {
    matchAll: async () =>
      urls.map((url) => ({
        url,
        focus: async () => {
          done.push(`focus ${url}`);
        },
      })),
    openWindow: async (url) => {
      done.push(`open ${url}`);
    },
  };
  return { all, done };
}

describe("NT-a Meldungen des Service Workers", () => {
  it("NT-a Testbenachrichtigung: nur „Testbenachrichtigung von Krümel“, kein Inhalt aus dem Haushalt", () => {
    expect(notificationFor({ v: 1, k: "test" })).toEqual({
      title: "Krümel",
      body: "Testbenachrichtigung von Krümel",
      tag: "test",
    });
  });

  it("NT-a Unbekannte oder kaputte Nutzlast: trotzdem eine allgemeine Meldung", () => {
    for (const payload of [undefined, null, "Text", { v: 2, k: "test" }, { v: 1, k: "neu" }]) {
      expect(notificationFor(payload)).toEqual({
        title: "Krümel",
        body: "Neues in Krümel.",
        tag: "kruemel",
      });
    }
    expect(payloadOf(null)).toBeUndefined();
    expect(
      payloadOf({
        json: () => {
          throw new SyntaxError("kein JSON");
        },
      }),
    ).toBeUndefined();
    expect(payloadOf({ json: () => ({ v: 1, k: "test" }) })).toEqual({ v: 1, k: "test" });
  });

  it("NT-a Tippen auf die Meldung holt ein offenes Fenster der App nach vorn, sonst öffnet es „Heute“", async () => {
    const open = windows(["https://example.org/", `${SCOPE}#/woche`]);
    await openApp(open.all, SCOPE);
    expect(open.done).toEqual([`focus ${SCOPE}#/woche`]);

    const none = windows(["https://example.org/"]);
    await openApp(none.all, SCOPE);
    expect(none.done).toEqual([`open ${SCOPE}#/heute`]);
  });
});
