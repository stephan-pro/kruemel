import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROUTE,
  editTaskHash,
  friendInviteHash,
  friendInviteTokenFrom,
  inviteHash,
  inviteTokenFrom,
  NAVIGATION,
  navigationRoute,
  newTaskHash,
  parseLocation,
  parseRoute,
  ROUTES,
  routeHash,
  routeInfo,
  routeLabel,
} from "./route";

describe("Navigation (Hash-Router)", () => {
  it("Jede Seite hat eine eigene Adresse, die wieder zur selben Seite führt", () => {
    for (const { route } of ROUTES) {
      expect(parseRoute(routeHash(route))).toBe(route);
    }
  });

  it("Die Adressen sind deutsch und folgen dem Muster #/name", () => {
    expect(ROUTES.map(({ route }) => routeHash(route))).toEqual([
      "#/heute",
      "#/woche",
      "#/aufgaben",
      "#/erledigt",
      "#/statistik",
      "#/einstellungen",
      "#/impressum",
      "#/datenschutz",
    ]);
    expect(navigationRoute("imprint")).toBe("settings");
    expect(navigationRoute("privacy")).toBe("settings");
  });

  it("Die Navigation zeigt Heute, Woche, Statistik und Einstellungen; Aufgaben und Erledigt liegen dahinter", () => {
    expect(NAVIGATION.map(routeLabel)).toEqual(["Heute", "Woche", "Statistik", "Einstellungen"]);
    expect(NAVIGATION).not.toContain("tasks");
    expect(NAVIGATION).not.toContain("done");
  });

  it("Ohne Adresse oder bei unbekannter Adresse startet „Heute“", () => {
    expect(DEFAULT_ROUTE).toBe("today");
    expect(parseRoute("")).toBe("today");
    expect(parseRoute("#")).toBe("today");
    expect(parseRoute("#/gibt-es-nicht")).toBe("today");
  });

  it("Auch eine Adresse ohne Schrägstrich wird erkannt", () => {
    expect(parseRoute("#erledigt")).toBe("done");
  });

  it("Jede Seite hat einen Titel für Überschrift und Browser-Tab", () => {
    expect(routeInfo("week").title).toBe("Wochenübersicht");
    expect(routeInfo("statistics").title).toBe("Statistik");
    expect(ROUTES.every(({ title, label }) => title !== "" && label !== "")).toBe(true);
  });
});

describe("Navigation zu den Aufgabenformularen (F1, F3)", () => {
  it("Das Formular für eine neue Aufgabe hat die Adresse #/aufgaben/neu", () => {
    expect(newTaskHash()).toBe("#/aufgaben/neu");
    expect(parseLocation("#/aufgaben/neu")).toEqual({ route: "taskNew" });
  });

  it("Das Formular zum Bearbeiten nennt die Aufgabe in der Adresse", () => {
    expect(editTaskHash("demo-bad")).toBe("#/aufgaben/bearbeiten/demo-bad");
    expect(parseLocation("#/aufgaben/bearbeiten/demo-bad")).toEqual({
      route: "taskEdit",
      taskId: "demo-bad",
    });
  });

  it("Besondere Zeichen in der Kennung überstehen den Weg durch die Adresse", () => {
    const id = "a/b c#d?é";

    expect(parseLocation(editTaskHash(id))).toEqual({ route: "taskEdit", taskId: id });
  });

  it("Eine Bearbeiten-Adresse ohne oder mit kaputter Kennung startet „Heute“", () => {
    expect(parseRoute("#/aufgaben/bearbeiten/")).toBe("today");
    expect(parseRoute("#/aufgaben/bearbeiten/%E0%A4%A")).toBe("today");
  });

  it("Die Formulare haben eigene Titel; sie und die Listen gehören in der Navigation zu „Woche“", () => {
    expect(routeInfo("taskNew").title).toBe("Neue Aufgabe");
    expect(routeInfo("taskEdit").title).toBe("Aufgabe bearbeiten");
    expect(navigationRoute("taskNew")).toBe("week");
    expect(navigationRoute("taskEdit")).toBe("week");
    expect(navigationRoute("tasks")).toBe("week");
    expect(navigationRoute("done")).toBe("week");
    expect(navigationRoute("settings")).toBe("settings");
  });

  it("Die Aufgabenliste behält ihre eigene Adresse", () => {
    expect(parseRoute("#/aufgaben")).toBe("tasks");
    expect(parseRoute("#/aufgaben/unbekannt")).toBe("today");
  });
});

describe("Einladungslink (E2-2d)", () => {
  const token = "Ab3_-xYz0123456789abcdefGHIJKLMN";

  it("Der Schlüssel steckt im Link, im Adressteil, in eingefügtem Text oder steht allein", () => {
    expect(inviteHash(token)).toBe(`#/einladung/${token}`);
    expect(inviteTokenFrom(inviteHash(token))).toBe(token);
    expect(inviteTokenFrom(`https://beispiel.de/kruemel/#/einladung/${token}`)).toBe(token);
    expect(inviteTokenFrom(`Komm in unseren Haushalt: https://x.de/#/einladung/${token}.`)).toBe(
      token,
    );
    expect(inviteTokenFrom(`  ${token}\n`)).toBe(token);
  });

  it("Anderer Text ist kein Einladungslink", () => {
    expect(inviteTokenFrom("")).toBeUndefined();
    expect(inviteTokenFrom("https://beispiel.de/kruemel/")).toBeUndefined();
    expect(inviteTokenFrom("#/einladung/")).toBeUndefined();
    expect(inviteTokenFrom("kurz")).toBeUndefined();
    expect(inviteTokenFrom("mit Leerzeichen dazwischen 1234")).toBeUndefined();
  });
});

describe("Einladungslink für Freunde (E2-5b)", () => {
  const token = "Ab3_-xYz0123456789abcdefGHIJKLMN";

  it("Der Schlüssel steckt im Adressteil; ein Haushalts-Link ist keiner und umgekehrt", () => {
    expect(friendInviteHash(token)).toBe(`#/freunde/${token}`);
    expect(friendInviteTokenFrom(`https://x.de/kruemel/${friendInviteHash(token)}`)).toBe(token);
    expect(friendInviteTokenFrom(inviteHash(token))).toBeUndefined();
    expect(friendInviteTokenFrom("#/freunde/kurz")).toBeUndefined();
    expect(inviteTokenFrom(`https://x.de/kruemel/${friendInviteHash(token)}`)).toBeUndefined();
    expect(parseRoute(friendInviteHash(token))).toBe("today");
  });
});
