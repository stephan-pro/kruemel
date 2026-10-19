import { describe, expect, it } from "vitest";
import {
  DEFAULT_ROUTE,
  editTaskHash,
  navigationRoute,
  newTaskHash,
  parseLocation,
  parseRoute,
  ROUTES,
  routeHash,
  routeInfo,
} from "./route";

describe("Navigation (Hash-Router)", () => {
  it("Jede Seite hat eine eigene Adresse, die wieder zur selben Seite führt", () => {
    for (const { route } of ROUTES) {
      expect(parseRoute(routeHash(route))).toBe(route);
    }
  });

  it("Die Adressen sind deutsch und folgen dem Muster #/name", () => {
    expect(ROUTES.map(({ route }) => routeHash(route))).toEqual([
      "#/woche",
      "#/aufgaben",
      "#/erledigt",
      "#/einstellungen",
    ]);
  });

  it("Ohne Adresse oder bei unbekannter Adresse startet die Wochenübersicht", () => {
    expect(DEFAULT_ROUTE).toBe("week");
    expect(parseRoute("")).toBe("week");
    expect(parseRoute("#")).toBe("week");
    expect(parseRoute("#/gibt-es-nicht")).toBe("week");
  });

  it("Auch eine Adresse ohne Schrägstrich wird erkannt", () => {
    expect(parseRoute("#erledigt")).toBe("done");
  });

  it("Jede Seite hat einen Titel für Überschrift und Browser-Tab", () => {
    expect(routeInfo("week").title).toBe("Wochenübersicht");
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

  it("Eine Bearbeiten-Adresse ohne oder mit kaputter Kennung startet die Wochenübersicht", () => {
    expect(parseRoute("#/aufgaben/bearbeiten/")).toBe("week");
    expect(parseRoute("#/aufgaben/bearbeiten/%E0%A4%A")).toBe("week");
  });

  it("Die Formulare haben eigene Titel und gehören in der Navigation zu „Aufgaben“", () => {
    expect(routeInfo("taskNew").title).toBe("Neue Aufgabe");
    expect(routeInfo("taskEdit").title).toBe("Aufgabe bearbeiten");
    expect(navigationRoute("taskNew")).toBe("tasks");
    expect(navigationRoute("taskEdit")).toBe("tasks");
    expect(navigationRoute("done")).toBe("done");
  });

  it("Die Aufgabenliste behält ihre eigene Adresse", () => {
    expect(parseRoute("#/aufgaben")).toBe("tasks");
    expect(parseRoute("#/aufgaben/unbekannt")).toBe("week");
  });
});
