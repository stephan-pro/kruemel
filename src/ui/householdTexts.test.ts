import { describe, expect, it } from "vitest";
import { formatInviteEnd } from "./householdTexts";

describe("Texte zu Haushalt und Einladung", () => {
  it("Das Ende der Einladung steht mit Wochentag und Datum in der Zeitzone des Geräts", () => {
    expect(formatInviteEnd("2026-10-30T09:15:00Z", "Europe/Berlin")).toBe("Fr., 30.10.2026");
    // Kurz vor Mitternacht UTC ist in Berlin schon der nächste Tag.
    expect(formatInviteEnd("2026-10-30T23:30:00Z", "Europe/Berlin")).toBe("Sa., 31.10.2026");
  });
});
