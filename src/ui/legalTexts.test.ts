import { afterEach, describe, expect, it } from "vitest";
import { resetLanguage, setLanguage } from "../i18n/language";
import { LEGAL_CONTACT, LEGAL_CONTENT, LEGAL_TEXTS, legalContent } from "./legalTexts";

afterEach(() => resetLanguage());

describe("EN-c Rechtstexte in zwei Sprachen", () => {
  const { de, en } = LEGAL_CONTENT;

  it("Impressum und Datenschutzerklärung haben auf Englisch dieselben Abschnitte in derselben Reihenfolge, mit gleich vielen Absätzen und Punkten", () => {
    const shape = (sections: typeof de.privacy) =>
      sections.map((section) => ({
        id: section.id,
        blocks: section.blocks.map((block) =>
          block.kind === "list" ? `list:${block.items.length}` : "text",
        ),
      }));
    expect(shape(en.imprint)).toEqual(shape(de.imprint));
    expect(shape(en.privacy)).toEqual(shape(de.privacy));
    expect(en.mailProvider.id).toBe(de.mailProvider.id);
    for (const sections of [en.imprint, en.privacy, de.imprint, de.privacy]) {
      for (const section of sections) {
        expect(section.title.trim(), section.id).not.toBe("");
      }
    }
  });

  it("Nur die englische Fassung trägt den Übersetzungshinweis; das Datum nennt beide Male denselben Tag", () => {
    expect(en.words.translationNote).toBe(
      "This is a translation. The German version is authoritative.",
    );
    expect(de.words.translationNote).toBeUndefined();
    expect(de.date).toBe("24. Oktober 2026");
    expect(en.date).toBe("24 October 2026");
  });

  it("Name, Anschrift und E-Mail bleiben Platzhalter in eckigen Klammern, in beiden Sprachen", () => {
    const everything = (sections: typeof de.privacy) =>
      JSON.stringify(sections.map((section) => section.blocks));
    for (const sections of [de.imprint, de.privacy, en.imprint, en.privacy]) {
      const text = everything(sections);
      expect(text).toContain(LEGAL_CONTACT.name);
      expect(text).toContain(LEGAL_CONTACT.email);
    }
    expect(LEGAL_CONTACT.name).toMatch(/^\[.+\]$/);
    expect(LEGAL_CONTACT.email).toMatch(/^\[.+\]$/);
  });

  it("Die Wörter um die Abschnitte folgen der eingestellten Sprache, ohne Einstellung Deutsch", () => {
    expect(LEGAL_TEXTS.back).toBe("Zurück");
    expect(legalContent()).toBe(de);
    setLanguage("en");
    expect(LEGAL_TEXTS.back).toBe("Back");
    expect(LEGAL_TEXTS.stateLabel("24 October 2026")).toBe("As of: 24 October 2026");
    expect(legalContent()).toBe(en);
  });
});
