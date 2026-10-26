import { afterEach, describe, expect, it, vi } from "vitest";
import { calendarDay } from "../domain/date";
import type { KeyValueStore } from "../storage/localStorage";
import { de } from "./de";
import { en } from "./en";
import { DICTIONARIES, t } from "./index";
import { formatNumber, monthLong, plural, timeOfDay, weekdayLong } from "./intl";
import {
  getLanguage,
  initLanguage,
  isLanguage,
  LANGUAGE_KEY,
  LANGUAGES,
  languageFromBrowser,
  resetLanguage,
  setLanguage,
  storedLanguage,
  subscribeLanguage,
} from "./language";

/** A store in memory; `broken` makes every access throw, like blocked site data. */
function memoryStore(initial: Record<string, string> = {}, broken = false): KeyValueStore {
  const items = new Map(Object.entries(initial));
  const fail = () => {
    if (broken) {
      throw new Error("blocked");
    }
  };
  return {
    getItem: (key) => {
      fail();
      return items.get(key) ?? null;
    },
    setItem: (key, value) => {
      fail();
      items.set(key, value);
    },
    removeItem: (key) => {
      fail();
      items.delete(key);
    },
  };
}

afterEach(() => resetLanguage());

/** The form of a text tree: the same keys, kinds and (for functions) numbers of parameters. */
function shape(value: unknown): unknown {
  if (typeof value === "function") {
    return `function/${value.length}`;
  }
  if (Array.isArray(value)) {
    return value.map(shape);
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, shape(inner)]));
  }
  return typeof value;
}

function texts(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") {
    return [[path, value]];
  }
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, inner]) => texts(inner, `${path}.${key}`));
  }
  return [];
}

describe("EN-a Sprachdateien", () => {
  it("Jede Sprache hat dieselben Schlüssel, Arten und Parameterzahlen wie die deutsche Vorlage", () => {
    for (const language of LANGUAGES) {
      expect(shape(DICTIONARIES[language])).toEqual(shape(de));
    }
    expect(shape(en)).toEqual(shape(de));
  });

  it("Kein Text ist leer; Wochentage und Monate sind vollständig", () => {
    for (const language of LANGUAGES) {
      const dictionary = DICTIONARIES[language];
      const empty = texts(dictionary).filter(([, text]) => text.trim() === "");
      expect(empty).toEqual([]);
      expect(dictionary.format.weekdaysShort).toHaveLength(7);
      expect(dictionary.format.monthsShort).toHaveLength(12);
    }
  });

  it("t() liefert die Texte der eingestellten Sprache", () => {
    expect(t()).toBe(de);
    setLanguage("en");
    expect(t()).toBe(en);
    expect(t().routes.week.title).toBe("Week overview");
  });

  it("Texte mit Platzhaltern und Mehrzahl sind ganze Sätze in beiden Sprachen", () => {
    expect(de.format.countTasks(0)).toBe("keine Aufgaben");
    expect(de.format.countTasks(1)).toBe("1 Aufgabe");
    expect(de.format.countTasks(3)).toBe("3 Aufgaben");
    expect(en.format.countTasks(0)).toBe("no tasks");
    expect(en.format.countTasks(1)).toBe("1 task");
    expect(en.format.countTasks(3)).toBe("3 tasks");
    expect(de.deleteTask.consequence(2)).toBe("Auch ihre 2 Einträge in „Erledigt“ verschwinden.");
    expect(en.deleteTask.consequence(2)).toBe("Its 2 entries in “Done” go too.");
    expect(en.settings.status.household(null, 1)).toBe("Household, 1 person");
    expect(en.settings.status.household("Home", 2)).toBe("Home, 2 people");
  });
});

describe("EN-a Sprache wählen und merken", () => {
  it("Standard: die Browsersprache; de und en zählen, alles andere ist Deutsch", () => {
    expect(languageFromBrowser(["de-DE"])).toBe("de");
    expect(languageFromBrowser(["en-US", "de"])).toBe("en");
    expect(languageFromBrowser(["EN"])).toBe("en");
    expect(languageFromBrowser(["fr-FR", "en"])).toBe("de");
    expect(languageFromBrowser([])).toBe("de");
    expect(getLanguage()).toBe("de");
  });

  it("Eine bewusste Wahl überschreibt den Standard und bleibt auf dem Gerät", () => {
    const store = memoryStore();
    expect(initLanguage(store, ["en-GB"])).toBe("en");
    // Initialising writes nothing: only a choice is kept.
    expect(store.getItem(LANGUAGE_KEY)).toBeNull();

    setLanguage("de");
    expect(getLanguage()).toBe("de");
    expect(store.getItem(LANGUAGE_KEY)).toBe("de");
    expect(storedLanguage(store)).toBe("de");

    // The next start: the choice wins over the browser.
    expect(initLanguage(store, ["en-GB"])).toBe("de");
    setLanguage("en");
    expect(initLanguage(store, ["de-DE"])).toBe("en");
  });

  it("Ein unbekannter oder nicht lesbarer Eintrag zählt nicht; ein gesperrter Speicher stört nicht", () => {
    expect(isLanguage("en")).toBe(true);
    expect(isLanguage("fr")).toBe(false);
    expect(initLanguage(memoryStore({ [LANGUAGE_KEY]: "fr" }), ["en"])).toBe("en");

    const blocked = memoryStore({}, true);
    expect(storedLanguage(blocked)).toBeUndefined();
    expect(initLanguage(blocked, ["en"])).toBe("en");
    setLanguage("de");
    expect(getLanguage()).toBe("de");
  });

  it("Ein Wechsel sagt es den Zuhörern, danach nicht mehr, wenn sie abbestellt sind", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeLanguage(listener);
    setLanguage("en");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    setLanguage("de");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("Die Seite erfährt die Sprache (lang-Attribut)", () => {
    const root = { lang: "" };
    vi.stubGlobal("document", { documentElement: root });
    try {
      initLanguage(memoryStore(), ["en"]);
      expect(root.lang).toBe("en");
      setLanguage("de");
      expect(root.lang).toBe("de");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("EN-a Datum, Zahl und Mehrzahl über Intl", () => {
  it("Wochentage und Monate in der gewählten Sprache", () => {
    const monday = calendarDay("2026-10-19");
    expect(weekdayLong("de", monday)).toBe("Montag");
    expect(weekdayLong("en", monday)).toBe("Monday");
    expect(monthLong("de", 3)).toBe("März");
    expect(monthLong("en", 3)).toBe("March");
  });

  it("Zahlen mit Tausendertrennung der Sprache", () => {
    expect(formatNumber("de", 1234)).toBe("1.234");
    expect(formatNumber("en", 1234)).toBe("1,234");
  });

  it("Uhrzeit mit zwei Stellen, 24 Stunden", () => {
    const morning = new Date(2026, 9, 21, 8, 12);
    expect(timeOfDay("de", morning)).toBe("08:12");
    expect(timeOfDay("en", morning)).toBe("08:12");
    expect(timeOfDay("en", new Date(2026, 9, 21, 20, 5))).toBe("20:05");
  });

  it("Mehrzahl nach den Regeln der Sprache; Null kann einen eigenen Text haben", () => {
    const forms = { zero: "none", one: "{n} cat", other: "{n} cats" };
    expect(plural("en", 0, forms)).toBe("none");
    expect(plural("en", 1, forms)).toBe("1 cat");
    expect(plural("en", 2, forms)).toBe("2 cats");
    expect(plural("de", 0, { one: "{n} Katze", other: "{n} Katzen" })).toBe("0 Katzen");
    expect(plural("de", 1500, { one: "{n} Katze", other: "{n} Katzen" })).toBe("1.500 Katzen");
  });
});
