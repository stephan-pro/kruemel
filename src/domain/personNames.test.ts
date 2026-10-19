import { describe, expect, it } from "vitest";
import { checkPersonNames, MAX_NAME_LENGTH } from "./personNames";

describe("F5 Namen der beiden Personen (Ersteinrichtung)", () => {
  it("F5 Zwei verschiedene Namen sind gültig", () => {
    expect(checkPersonNames({ personA: "Alex", personB: "Robin" })).toEqual({
      ok: true,
      names: { personA: "Alex", personB: "Robin" },
    });
  });

  it("F5 Leerzeichen am Rand werden entfernt", () => {
    expect(checkPersonNames({ personA: "  Alex ", personB: "Robin  " })).toEqual({
      ok: true,
      names: { personA: "Alex", personB: "Robin" },
    });
  });

  it("F5 Ein leerer Name wird beim passenden Feld gemeldet", () => {
    const result = checkPersonNames({ personA: "Alex", personB: "   " });

    expect(result).toEqual({ ok: false, errors: { personB: "Bitte einen Namen eingeben." } });
  });

  it("F5 Fehlen beide Namen, werden beide Felder gemeldet", () => {
    const result = checkPersonNames({ personA: "", personB: "" });

    expect(result).toEqual({
      ok: false,
      errors: { personA: "Bitte einen Namen eingeben.", personB: "Bitte einen Namen eingeben." },
    });
  });

  it("F5 Gleiche Namen werden abgelehnt, auch bei anderer Groß-/Kleinschreibung", () => {
    const result = checkPersonNames({ personA: "Alex", personB: " alex" });

    expect(result).toEqual({
      ok: false,
      errors: { personB: "Die beiden Namen müssen sich unterscheiden." },
    });
  });

  it("F5 Ein zu langer Name wird abgelehnt, die Höchstlänge selbst ist erlaubt", () => {
    const longest = "x".repeat(MAX_NAME_LENGTH);

    expect(checkPersonNames({ personA: longest, personB: "Robin" }).ok).toBe(true);
    expect(checkPersonNames({ personA: `${longest}x`, personB: "Robin" })).toEqual({
      ok: false,
      errors: { personA: `Der Name darf höchstens ${MAX_NAME_LENGTH} Zeichen lang sein.` },
    });
  });
});
