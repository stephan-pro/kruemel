import { describe, expect, it } from "vitest";
import { emptyAppData, SCHEMA_VERSION } from "./appData";
import { migrateAppData } from "./migrate";
import { asVersion1, sampleData } from "./storage.fixtures";

function migrated(raw: unknown) {
  const result = migrateAppData(raw);
  if (!result.ok) {
    throw new Error(`Migration sollte gelingen: ${result.errors.join(", ")}`);
  }
  return result.value;
}

function errorsOf(raw: unknown): readonly string[] {
  const result = migrateAppData(raw);
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.errors;
}

describe("F8 Migration von schemaVersion 1 auf 2", () => {
  it("F8 Die aktuelle Version ist 2", () => {
    expect(SCHEMA_VERSION).toBe(2);
  });

  it("F8 Migration 1 → 2 gibt jeder Aufgabe das Standardsymbol", () => {
    const result = migrated(asVersion1(sampleData()));

    expect(result.schemaVersion).toBe(2);
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
      schemaVersion: 2,
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

  it("F8 Daten der Version 2 bleiben unverändert", () => {
    const current = JSON.parse(JSON.stringify(sampleData()));

    expect(migrated(current)).toBe(current);
  });

  it("F8 Auch leere Daten der Version 1 werden zu Version 2", () => {
    expect(migrated({ ...emptyAppData(), schemaVersion: 1 })).toEqual(emptyAppData());
  });

  it("F8 Was in Version 1 keine Aufgabe ist, bleibt für die Prüfung danach stehen", () => {
    expect(migrated({ schemaVersion: 1, tasks: [5, null] }).tasks).toEqual([5, null]);
    expect(migrated({ schemaVersion: 1, tasks: "keine Liste" }).tasks).toBe("keine Liste");
  });
});

describe("F8 Migration lehnt unbekannte Versionen ab", () => {
  it("F8 Eine neuere Version wird mit klarer Meldung abgelehnt", () => {
    expect(errorsOf({ ...sampleData(), schemaVersion: 3 })).toEqual([
      "Die Datei stammt aus einer neueren Version der App (schemaVersion 3). Diese App kennt bis Version 2.",
    ]);
  });

  it.each([
    ["fehlt", undefined],
    ["ist ein Text", "1"],
    ["ist 0", 0],
    ["ist keine ganze Zahl", 1.5],
  ])("F8 Eine schemaVersion, die %s, wird abgelehnt", (_name, schemaVersion) => {
    expect(errorsOf({ ...sampleData(), schemaVersion })).toEqual([
      "schemaVersion fehlt oder ist ungültig – das ist keine Putzplan-Sicherung.",
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
