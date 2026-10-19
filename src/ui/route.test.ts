import { describe, expect, it } from "vitest";
import { DEFAULT_ROUTE, parseRoute, ROUTES, routeHash, routeInfo } from "./route";

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
