import { afterEach, describe, expect, it } from "vitest";
import { resetLanguage, setLanguage } from "../i18n/language";
import { emptyAppData, SCHEMA_VERSION } from "./appData";
import { importData } from "./exportImport";
import { migrateAppData } from "./migrate";
import { asVersion1, asVersion2, sampleData } from "./storage.fixtures";
import { parseAppData } from "./validate";

function migrated(raw: unknown) {
  const result = migrateAppData(raw);
  if (!result.ok) {
    throw new Error(`Migration sollte gelingen: ${result.errors.join(", ")}`);
  }
  return result.value;
}

describe("EN-c Fundstellen in der Sprache der Anzeige", () => {
  afterEach(() => resetLanguage());

  it("Fehler in einer Sicherung, den Daten oder der Kopie nennen die Stelle in der eingestellten Sprache", () => {
    const broken = { schemaVersion: SCHEMA_VERSION, settings: {}, tasks: "x", completions: [{}] };

    const german = parseAppData(broken);
    const germanErrors = german.ok ? [] : german.errors;
    expect(germanErrors).toContain("tasks: erwartet eine Liste");

    setLanguage("en");
    const english = parseAppData(broken);
    const englishErrors = english.ok ? [] : english.errors;
    expect(englishErrors).toContain("tasks: expected a list");
    expect(englishErrors.some((line) => /completions\[0\]\.id: missing/.test(line))).toBe(true);
    expect(parseAppData({ ...broken, tasks: [{ id: 3 }] }).ok).toBe(false);
    expect(errorsOf(5)).toEqual(["File: expected an object"]);
    expect(errorsOf({})).toEqual(["The file is not a Krümel backup (the version is missing)."]);
    expect(errorsOf({ schemaVersion: SCHEMA_VERSION + 1 })).toEqual([
      "This data comes from a newer version of Krümel. Reload the app and try again.",
    ]);
    expect(importData("kein JSON")).toEqual({
      ok: false,
      errors: ["The file is not a Krümel backup."],
    });
    // The wrong value of a field says what it should have been.
    const wrongDate = parseAppData({
      ...emptyAppData(),
      tasks: [{ id: "t", kind: "oneOff", title: "x", dueDate: "morgen", assignee: "both" }],
    });
    expect(wrongDate.ok ? [] : wrongDate.errors).toContain(
      "tasks[0].dueDate: invalid, expected a date YYYY-MM-DD",
    );
  });
});

function errorsOf(raw: unknown): readonly string[] {
  const result = migrateAppData(raw);
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.errors;
}

describe("F8 Migration von schemaVersion 1 auf 2", () => {
  it("F8 Die aktuelle Version ist 3", () => {
    expect(SCHEMA_VERSION).toBe(3);
  });

  it("F8 Migration 1 → 2 gibt jeder Aufgabe das Standardsymbol", () => {
    const result = migrated(asVersion1(sampleData()));

    expect(result.schemaVersion).toBe(SCHEMA_VERSION);
    expect((result.tasks as { symbol: string }[]).map((task) => task.symbol)).toEqual([
      "standard",
      "standard",
      "standard",
      "standard",
    ]);
  });

  it("F8 Migration 1 → 2 ändert sonst nichts", () => {
    const old = asVersion1(sampleData());

    const result = migrated(old);

    const expected = {
      ...old,
      schemaVersion: SCHEMA_VERSION,
      tasks: old.tasks.map((task: object) => ({ ...task, symbol: "standard" })),
    };
    expect(result).toEqual(expected);
    expect(result.settings).toEqual(old.settings);
    expect(result.completions).toEqual(old.completions);
  });

  it("F8 Die Migration verändert die übergebenen Daten nicht", () => {
    const old = asVersion1(sampleData());
    const copy = structuredClone(old);

    migrated(old);

    expect(old).toEqual(copy);
  });

  it("F8 Zweimal migrieren ändert nichts", () => {
    const once = migrated(asVersion1(sampleData()));

    expect(migrated(once)).toEqual(once);
  });

  it("F8 Daten der aktuellen Version bleiben unverändert", () => {
    const current = JSON.parse(JSON.stringify(sampleData()));

    expect(migrated(current)).toBe(current);
  });

  it("F8 Auch leere Daten der Version 1 werden zur aktuellen Version", () => {
    expect(migrated({ ...emptyAppData(), schemaVersion: 1 })).toEqual(emptyAppData());
  });

  it("F8 Was in Version 1 keine Aufgabe ist, bleibt für die Prüfung danach stehen", () => {
    expect(migrated({ schemaVersion: 1, tasks: [5, null] }).tasks).toEqual([5, null]);
    expect(migrated({ schemaVersion: 1, tasks: "keine Liste" }).tasks).toBe("keine Liste");
  });
});

describe("Datenmodell v3: Migration von schemaVersion 2 auf 3", () => {
  it("Migration 2 → 3 hebt nur die Version an; die neuen Felder der Erledigung bleiben weg", () => {
    const old = asVersion2(sampleData());

    const result = migrated(old);

    expect(result).toEqual({ ...old, schemaVersion: 3 });
    for (const completion of result.completions as object[]) {
      expect(completion).not.toHaveProperty("completedAt");
      expect(completion).not.toHaveProperty("assigneeAtCompletion");
    }
  });

  it("Migration 2 → 3 verändert die übergebenen Daten nicht", () => {
    const old = asVersion2(sampleData());
    const copy = structuredClone(old);

    migrated(old);

    expect(old).toEqual(copy);
  });

  it("Daten der Version 2 lassen sich laden: ohne Uhrzeit und ohne Zuständigkeit, 'unbekannt'", () => {
    const result = parseAppData(asVersion2(sampleData()));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.schemaVersion).toBe(3);
      expect(result.data.completions.length).toBeGreaterThan(0);
      for (const completion of result.data.completions) {
        expect(completion.completedAt).toBeUndefined();
        expect(completion.assigneeAtCompletion).toBeUndefined();
      }
    }
  });

  it("Auch Daten der Version 1 gehen durch beide Schritte bis Version 3", () => {
    const result = parseAppData(asVersion1(sampleData()));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.schemaVersion).toBe(3);
      expect(result.data.tasks.every((task) => task.symbol === "standard")).toBe(true);
    }
  });

  it("Daten der Version 3 behalten Uhrzeit und Zuständigkeit der Erledigung", () => {
    const current = sampleData();

    const result = parseAppData(JSON.parse(JSON.stringify(current)));

    expect(result).toEqual({ ok: true, data: current });
    expect(current.completions[0]?.completedAt).toBe("2026-10-21T08:30:00.000Z");
    expect(current.completions[0]?.assigneeAtCompletion).toBeDefined();
  });

  it.each([
    ["completedAt ist kein Zeitpunkt", { completedAt: "gestern" }, "completedAt"],
    ["completedAt ist keine Zeichenkette", { completedAt: 5 }, "completedAt"],
    [
      "assigneeAtCompletion ist unbekannt",
      { assigneeAtCompletion: "alle" },
      "assigneeAtCompletion",
    ],
  ])(
    "Daten der Version 3 mit fehlerhaften Feldern werden mit Fundstelle abgelehnt: %s",
    (_n, fields, key) => {
      const raw = JSON.parse(JSON.stringify(sampleData()));
      raw.completions[0] = { ...raw.completions[0], ...fields };

      const result = parseAppData(raw);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors[0]).toContain(`completions[0].${key}`);
      }
    },
  );
});

describe("F8 Migration lehnt unbekannte Versionen ab", () => {
  it("F8 Eine neuere Version wird mit klarer Meldung abgelehnt", () => {
    expect(errorsOf({ ...sampleData(), schemaVersion: 4 })).toEqual([
      "Die Daten stammen aus einer neueren Version von Krümel. Lade die App neu und versuch es dann noch einmal.",
    ]);
  });

  it.each([
    ["fehlt", undefined],
    ["ist ein Text", "1"],
    ["ist 0", 0],
    ["ist keine ganze Zahl", 1.5],
  ])("F8 Eine schemaVersion, die %s, wird abgelehnt", (_name, schemaVersion) => {
    expect(errorsOf({ ...sampleData(), schemaVersion })).toEqual([
      "Die Datei ist keine Krümel-Sicherung (die Angabe der Version fehlt).",
    ]);
  });

  it.each([
    ["null", null],
    ["eine Liste", []],
    ["ein Text", "putzplan"],
  ])("F8 %s statt Daten wird abgelehnt", (_name, raw) => {
    expect(errorsOf(raw)).toEqual(["Datei: erwartet ein Objekt"]);
  });
});
