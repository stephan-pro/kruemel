import { afterEach, describe, expect, it } from "vitest";
import { AUTH_FAILURES } from "../auth/auth";
import { HOUSEHOLD_FAILURES } from "../auth/household";
import { STORAGE_FAILURES } from "../storage/storage";
import { DICTIONARIES, t } from "./index";
import { LANGUAGES, resetLanguage, setLanguage } from "./language";
import { liveObject, liveTexts } from "./live";

afterEach(() => resetLanguage());

describe("EN-b Texte, die beim Lesen die Sprache wählen", () => {
  it("liveObject liefert bei jedem Zugriff den Text der eingestellten Sprache", () => {
    const texts = liveObject(() => t().account);

    expect(texts.signInTitle).toBe("Anmelden");
    expect(texts.codeIntro("a@b.de")).toContain("Minuten");
    setLanguage("en");
    expect(texts.signInTitle).toBe("Sign in");
    expect(texts.codeIntro("a@b.de")).toContain("minutes");
  });

  it("liveObject lässt sich wie ein Objekt durchsuchen", () => {
    const texts = liveObject(() => t().backup);

    expect("title" in texts).toBe(true);
    expect("nope" in texts).toBe(false);
    expect(Object.keys(texts)).toEqual(Object.keys(t().backup));
    expect(Object.getOwnPropertyDescriptor(texts, "title")?.value).toBe("Sicherung");
    expect(Object.getOwnPropertyDescriptor(texts, "nope")).toBeUndefined();
  });

  it("liveTexts liefert pro Schlüssel den aktuellen Text und zählt ihn mit auf", () => {
    const texts = liveTexts(["a", "b"], (key) => `${t().common.cancel}-${key}`);

    expect(Object.keys(texts)).toEqual(["a", "b"]);
    expect(texts.a).toBe("Abbrechen-a");
    setLanguage("en");
    expect(texts.b).toBe("Cancel-b");
  });
});

describe("EN-b Jede Sprache hat zu jedem Fehlercode einen eigenen Text", () => {
  it("Anmeldung, Haushalt und Speicher: alle Codes, keine leeren Texte, Englisch ist nicht Deutsch", () => {
    const groups = [
      ["auth", AUTH_FAILURES],
      ["household", HOUSEHOLD_FAILURES],
      ["storage", STORAGE_FAILURES],
    ] as const;
    for (const [name, codes] of groups) {
      for (const language of LANGUAGES) {
        const texts = DICTIONARIES[language].errors[name] as Record<string, string>;
        expect(Object.keys(texts).sort(), `${language} ${name}`).toEqual([...codes].sort());
        for (const code of codes) {
          expect(texts[code]?.trim(), `${language} ${name} ${code}`).not.toBe("");
        }
      }
      const german = DICTIONARIES.de.errors[name] as Record<string, string>;
      const english = DICTIONARIES.en.errors[name] as Record<string, string>;
      for (const code of codes) {
        expect(english[code], `${name} ${code}`).not.toBe(german[code]);
      }
    }
  });
});
