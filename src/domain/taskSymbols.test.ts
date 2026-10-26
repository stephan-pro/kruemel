import { describe, expect, it } from "vitest";
import { DICTIONARIES } from "../i18n";
import { LANGUAGES } from "../i18n/language";
import {
  DEFAULT_TASK_SYMBOL,
  isTaskSymbolId,
  SYMBOL_TONES,
  TASK_SYMBOLS,
  taskSymbol,
} from "./taskSymbols";

describe("F8 Liste der Symbole", () => {
  it("F8 Die feste Liste hat etwa 20 Haushaltssymbole", () => {
    expect(TASK_SYMBOLS.length).toBeGreaterThanOrEqual(18);
    expect(TASK_SYMBOLS.length).toBeLessThanOrEqual(24);
  });

  it("F8 Jedes Symbol hat eine eindeutige Kennung und in jeder Sprache einen eigenen Namen", () => {
    const ids = TASK_SYMBOLS.map((symbol) => symbol.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const language of LANGUAGES) {
      const names = ids.map((id) => DICTIONARIES[language].symbols[id]);
      expect(new Set(names).size).toBe(names.length);
      for (const name of names) {
        expect(name.trim()).not.toBe("");
      }
    }
  });

  it("F8 Jedes Symbol hat einen der Farbtöne Blau, Grün oder Orange, und jeder Ton kommt vor", () => {
    for (const symbol of TASK_SYMBOLS) {
      expect(SYMBOL_TONES).toContain(symbol.tone);
    }
    expect(new Set(TASK_SYMBOLS.map((symbol) => symbol.tone))).toEqual(new Set(SYMBOL_TONES));
  });

  it("F8 Das Standardsymbol ist das Haus und steht in der Auswahl an erster Stelle", () => {
    expect(DEFAULT_TASK_SYMBOL).toBe("standard");
    expect(TASK_SYMBOLS[0].id).toBe(DEFAULT_TASK_SYMBOL);
    expect(taskSymbol(DEFAULT_TASK_SYMBOL)).toEqual({ id: "standard", tone: "blue" });
  });

  it("F8 Nur Kennungen aus der Liste sind gültige Symbole", () => {
    expect(isTaskSymbolId("bath")).toBe(true);
    expect(isTaskSymbolId("standard")).toBe(true);
    for (const value of ["Bath", "rocket", "", undefined, null, 3, {}]) {
      expect(isTaskSymbolId(value), String(value)).toBe(false);
    }
  });
});
