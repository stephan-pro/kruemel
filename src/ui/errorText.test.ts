import { afterEach, describe, expect, it } from "vitest";
import { AuthError } from "../auth/auth";
import { resetLanguage, setLanguage } from "../i18n/language";
import { StorageError, StorageUnavailableError } from "../storage/storage";
import { errorText, failureOf, unexpectedErrorText } from "./errorText";

afterEach(() => resetLanguage());

describe("EN-b Fehlertexte für Personen", () => {
  it("Eigene Fehler werden zu ihrem Satz in der eingestellten Sprache", () => {
    const stored = new StorageError("full", ["x"]);
    const code = new AuthError("wrongCode");

    expect(errorText(stored)).toContain("Speichern nicht möglich");
    expect(errorText(code)).toBe("Der Code stimmt nicht. Bitte prüfen und erneut eingeben.");

    // The same errors, shown after a switch of the language.
    setLanguage("en");
    expect(errorText(stored)).toContain("Saving is not possible");
    expect(errorText(code)).toBe("The code is wrong. Please check it and try again.");
    expect(errorText(new StorageUnavailableError())).toContain("not on this device yet");
  });

  it("Der Satz im Fehler selbst ist der der Sprache zur Zeit des Fehlers", () => {
    expect(new StorageError("damaged").message).toBe("Die gespeicherten Daten sind beschädigt.");
    setLanguage("en");
    expect(new StorageError("damaged").message).toBe("The stored data is damaged.");
    expect(new StorageError("damaged").failure).toBe("damaged");
  });

  it("EN-c Ein im Zustand gehaltener Fehler wird erst beim Zeichnen zum Satz, also in der Sprache zu diesem Zeitpunkt", () => {
    const kept = failureOf(new StorageError("full", ["x"]));

    expect(errorText(kept.cause)).toContain("Speichern nicht möglich");
    setLanguage("en");
    expect(errorText(kept.cause)).toContain("Saving is not possible");
    // Whatever the cause is, also nothing, it counts as a failure.
    expect(failureOf(undefined)).toEqual({ cause: undefined });
    expect(errorText(failureOf(undefined).cause)).toBe(unexpectedErrorText());
  });

  it("Unbekannte Fehler fallen auf einen allgemeinen Satz zurück, nie auf den rohen Text", () => {
    const raw = new Error("Failed to fetch: ECONNRESET at 10.0.0.1");

    expect(errorText(raw)).toBe(unexpectedErrorText());
    expect(errorText("text")).toBe(unexpectedErrorText());
    expect(errorText(undefined)).toBe(unexpectedErrorText());
    expect(errorText(raw)).not.toContain("ECONNRESET");
    expect(unexpectedErrorText()).toBe(
      "Das hat nicht geklappt. Versuch es noch einmal. Hilft das nicht, lade die App neu.",
    );
    setLanguage("en");
    expect(errorText(raw)).toBe(
      "That did not work. Try again. If that does not help, reload the app.",
    );
  });
});
