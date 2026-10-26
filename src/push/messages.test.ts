import { describe, expect, it } from "vitest";
import { type AppWindows, notificationFor, openApp, openPageOf, payloadOf } from "./messages";

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
      open: "#/heute",
    });
  });

  it("NT-d Meldung über die andere Person: Name und Zahl, Einzahl und Mehrzahl, beides in einem Satz; Tippen öffnet „Erledigt“ bzw. die Woche", () => {
    const partner = (done: number, took: number, name: string | null = "Robin") =>
      notificationFor({ v: 1, k: "partner", ...(name === null ? {} : { name }), done, took });
    expect(partner(2, 0)).toEqual({
      title: "Krümel",
      body: "Robin hat 2 Aufgaben für dich erledigt.",
      tag: "partner",
      open: "#/erledigt",
    });
    expect(partner(0, 1)).toMatchObject({
      body: "Robin hat eine Aufgabe von dir übernommen.",
      open: "#/woche",
    });
    expect(
      [
        partner(1, 0),
        partner(0, 3),
        partner(1, 1),
        partner(2, 1),
        partner(1, 2),
        partner(3, 4),
        partner(1, 0, null),
        // A name that cannot be one is left out.
        partner(1, 0, "x".repeat(31)),
        partner(1, 0, " "),
      ].map((shown) => shown.body),
    ).toEqual([
      "Robin hat eine Aufgabe für dich erledigt.",
      "Robin hat 3 Aufgaben von dir übernommen.",
      "Robin hat eine Aufgabe für dich erledigt und eine übernommen.",
      "Robin hat 2 Aufgaben für dich erledigt und eine übernommen.",
      "Robin hat eine Aufgabe für dich erledigt und 2 übernommen.",
      "Robin hat 3 Aufgaben für dich erledigt und 4 übernommen.",
      "Die andere Person hat eine Aufgabe für dich erledigt.",
      "Die andere Person hat eine Aufgabe für dich erledigt.",
      "Die andere Person hat eine Aufgabe für dich erledigt.",
    ]);
  });

  it("NT-d Beitritt: mit Namen aus dem Haushalt oder ohne; Tippen öffnet „Konto und Haushalt“", () => {
    expect(notificationFor({ v: 1, k: "joined", name: "Robin" })).toEqual({
      title: "Krümel",
      body: "Robin ist jetzt im Haushalt dabei.",
      tag: "joined",
      open: "#/einstellungen/konto",
    });
    expect(notificationFor({ v: 1, k: "joined" }).body).toBe(
      "Jemand ist jetzt in deinem Haushalt dabei.",
    );
  });

  it("NT-c Tagesüberblick: nur Zahlen, Einzahl und Mehrzahl, überfällige eigens genannt", () => {
    const daily = (due: number, overdue: number) =>
      notificationFor({ v: 1, k: "daily", due, overdue });
    expect(daily(3, 1)).toEqual({
      title: "Krümel",
      body: "Heute 3 Aufgaben für dich, davon 1 überfällig.",
      tag: "daily",
      open: "#/heute",
    });
    expect(
      [daily(1, 0), daily(2, 0), daily(1, 1), daily(2, 2), daily(5, 3)].map((shown) => shown.body),
    ).toEqual([
      "Heute 1 Aufgabe für dich.",
      "Heute 2 Aufgaben für dich.",
      "1 überfällige Aufgabe wartet auf dich.",
      "2 überfällige Aufgaben warten auf dich.",
      "Heute 5 Aufgaben für dich, davon 3 überfällig.",
    ]);
  });

  it("NT-a Unbekannte oder kaputte Nutzlast: trotzdem eine allgemeine Meldung", () => {
    for (const payload of [
      undefined,
      null,
      "Text",
      { v: 2, k: "test" },
      { v: 1, k: "neu" },
      // NT-c: a daily overview without anything to do, or with numbers that cannot be.
      { v: 1, k: "daily", due: 0, overdue: 0 },
      { v: 1, k: "daily", due: 1, overdue: 2 },
      { v: 1, k: "daily", due: 1.5, overdue: 0 },
      { v: 1, k: "daily", due: 1000, overdue: 0 },
      { v: 1, k: "daily", due: "3", overdue: 0 },
      { v: 1, k: "daily", due: 3 },
      // NT-d: nothing to tell, or numbers that cannot be.
      { v: 1, k: "partner", name: "Robin", done: 0, took: 0 },
      { v: 1, k: "partner", done: -1, took: 2 },
      { v: 1, k: "partner", done: 1 },
    ]) {
      expect(notificationFor(payload)).toEqual({
        title: "Krümel",
        body: "Neues in Krümel.",
        tag: "kruemel",
        open: "#/heute",
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

  it("NT-d Tippen öffnet die passende Seite: neues Fenster dort, offenes Fenster wechselt hin, außer mitten im Formular", async () => {
    const none = windows([]);
    await openApp(none.all, SCOPE, "#/erledigt");
    expect(none.done).toEqual([`open ${SCOPE}#/erledigt`]);

    const visited: string[] = [];
    const window = (url: string, fails = false) => ({
      url,
      focus: async () => {
        visited.push(`focus ${url}`);
      },
      navigate: async (to: string) => {
        if (fails) {
          throw new TypeError("nicht kontrolliert");
        }
        visited.push(`navigate ${to}`);
      },
    });
    const one = (url: string, fails = false): AppWindows => ({
      matchAll: async () => [window(url, fails)],
      openWindow: async () => {},
    });
    await openApp(one(`${SCOPE}#/heute`), SCOPE, "#/erledigt");
    await openApp(one(`${SCOPE}#/aufgaben/neu`), SCOPE, "#/erledigt");
    await openApp(one(`${SCOPE}#/einstellungen`), SCOPE, "#/einstellungen");
    await openApp(one(`${SCOPE}#/woche`, true), SCOPE, "#/erledigt");
    expect(visited).toEqual([
      `focus ${SCOPE}#/heute`,
      `navigate ${SCOPE}#/erledigt`,
      `focus ${SCOPE}#/aufgaben/neu`,
      `focus ${SCOPE}#/einstellungen`,
      `focus ${SCOPE}#/woche`,
    ]);

    expect(openPageOf({ open: "#/woche" })).toBe("#/woche");
    // UX-a: messages shown before keep their page, the new group page is allowed too.
    expect(openPageOf({ open: "#/einstellungen" })).toBe("#/einstellungen");
    expect(openPageOf({ open: "#/einstellungen/konto" })).toBe("#/einstellungen/konto");
    expect([openPageOf({ open: "https://example.org" }), openPageOf(null)]).toEqual([
      "#/heute",
      "#/heute",
    ]);
  });
});
