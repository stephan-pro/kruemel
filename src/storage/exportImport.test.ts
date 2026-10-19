// biome-ignore-all lint/suspicious/noExplicitAny: the tests change parsed JSON of any shape on purpose
import { describe, expect, it } from "vitest";
import { d } from "../domain/task.fixtures";
import { emptyAppData, SCHEMA_VERSION } from "./appData";
import { exportData, exportFileName, importData, rawDataFileName } from "./exportImport";
import { sampleData } from "./storage.fixtures";

/** Runs the sample export through a change and imports the result. */
function importChanged(change: (file: any) => void) {
  const file = JSON.parse(exportData(sampleData()));
  change(file);
  return importData(JSON.stringify(file));
}

function errorsOf(result: ReturnType<typeof importData>): readonly string[] {
  expect(result.ok).toBe(false);
  return result.ok ? [] : result.errors;
}

describe("F7 Export", () => {
  it("F7 Der Export enthält alle Daten und die schemaVersion", () => {
    const data = sampleData();

    const file = JSON.parse(exportData(data));

    expect(file.schemaVersion).toBe(SCHEMA_VERSION);
    expect(file.settings).toEqual(data.settings);
    expect(file.tasks).toEqual(data.tasks);
    expect(file.completions).toEqual(data.completions);
  });

  it("F7 Der Export ist lesbar eingerückt und endet mit einem Zeilenumbruch", () => {
    const text = exportData(emptyAppData());

    expect(text).toBe(
      '{\n  "schemaVersion": 1,\n  "settings": {},\n  "tasks": [],\n  "completions": []\n}\n',
    );
  });

  it("F7 Die Sicherungsdatei heißt nach dem Tag des Exports", () => {
    expect(exportFileName(d("2026-10-19"))).toBe("putzplan-2026-10-19.json");
  });

  it("Die Datei mit unlesbaren Rohdaten ist am Namen von einer Sicherung zu unterscheiden", () => {
    expect(rawDataFileName(d("2026-10-19"))).toBe("putzplan-rohdaten-2026-10-19.json");
  });
});

describe("F7 Import", () => {
  it("F7 Import aus einer Exportdatei stellt genau die exportierten Daten wieder her", () => {
    const data = sampleData();

    const result = importData(exportData(data));

    expect(result).toEqual({ ok: true, data });
  });

  it("F7 Auch leere Daten lassen sich exportieren und wieder importieren", () => {
    const result = importData(exportData(emptyAppData()));

    expect(result).toEqual({ ok: true, data: emptyAppData() });
  });

  it("F7 Unbekannte Felder in der Datei werden nicht übernommen", () => {
    const result = importChanged((file) => {
      file.extra = 1;
      file.tasks[0].secret = "x";
      file.completions[0].secret = "x";
      file.settings.other = true;
    });

    expect(result).toEqual({ ok: true, data: sampleData() });
  });

  it("F7 Namen der Personen werden ohne Leerzeichen am Rand übernommen", () => {
    const result = importChanged((file) => {
      file.settings.personNames = { personA: "  Alex ", personB: "Robin  " };
    });

    expect(result.ok && result.data.settings.personNames).toEqual({
      personA: "Alex",
      personB: "Robin",
    });
  });

  it("F7 Fehlen die Namen noch (vor der Ersteinrichtung), ist der Import trotzdem gültig", () => {
    const result = importChanged((file) => {
      file.settings = {};
    });

    expect(result.ok && result.data.settings).toEqual({});
  });
});

describe("F7 Import prüft die Datei", () => {
  it("F7 Text, der kein JSON ist, wird abgelehnt", () => {
    expect(errorsOf(importData("das ist kein json"))).toEqual([
      "Die Datei ist kein gültiges JSON.",
    ]);
  });

  it.each([
    ["null", "null"],
    ["eine Zahl", "42"],
    ["eine Liste", "[]"],
  ])("F7 %s statt einer Sicherung wird abgelehnt", (_name, text) => {
    expect(errorsOf(importData(text))).toEqual(["Datei: erwartet ein Objekt"]);
  });

  it.each([
    ["fehlt", undefined],
    ["ist ein Text", "1"],
    ["ist 0", 0],
    ["ist negativ", -1],
    ["ist keine ganze Zahl", 1.5],
  ])("F7 Eine schemaVersion, die %s, wird abgelehnt", (_name, version) => {
    const result = importChanged((file) => {
      file.schemaVersion = version;
    });

    expect(errorsOf(result)[0]).toContain("schemaVersion fehlt oder ist ungültig");
  });

  it("F7 Eine Datei aus einer neueren App-Version wird mit klarer Meldung abgelehnt", () => {
    const result = importChanged((file) => {
      file.schemaVersion = SCHEMA_VERSION + 1;
    });

    expect(errorsOf(result)[0]).toContain("neueren Version");
  });

  it.each([
    ["settings", "settings: erwartet ein Objekt"],
    ["tasks", "tasks: erwartet eine Liste"],
    ["completions", "completions: erwartet eine Liste"],
  ])("F7 Ein fehlender Bereich „%s“ wird abgelehnt", (key, message) => {
    const result = importChanged((file) => {
      delete file[key];
    });

    expect(errorsOf(result)).toEqual([message]);
  });

  it("F7 Ungültige Namen in den Einstellungen werden abgelehnt", () => {
    const result = importChanged((file) => {
      file.settings.personNames = { personA: "Alex", personB: "  " };
    });

    expect(errorsOf(result)).toEqual([
      "settings.personNames.personB: ungültig, erwartet einen Namen",
    ]);
  });

  it("F7 Namen, die kein Objekt sind, werden abgelehnt", () => {
    const result = importChanged((file) => {
      file.settings.personNames = "Alex";
    });

    expect(errorsOf(result)).toEqual(["settings.personNames: erwartet ein Objekt"]);
  });

  it.each([
    [
      "ein leerer Titel",
      (task: any) => (task.title = "  "),
      "tasks[0].title: ungültig, erwartet einen Titel",
    ],
    ["fehlende Kennung", (task: any) => delete task.id, "tasks[0].id: fehlt"],
    [
      "eine unbekannte Zuständigkeit",
      (task: any) => (task.assignee = "personC"),
      "tasks[0].assignee: ungültig, erwartet personA, personB oder both",
    ],
    [
      "ein Datum, das es nicht gibt",
      (task: any) => (task.dueDate = "2026-02-30"),
      "tasks[0].dueDate: ungültig, erwartet ein Datum JJJJ-MM-TT",
    ],
    [
      "ein Datum in falscher Schreibweise",
      (task: any) => (task.dueDate = "19.10.2026"),
      "tasks[0].dueDate: ungültig, erwartet ein Datum JJJJ-MM-TT",
    ],
    [
      "eine Notiz, die kein Text ist",
      (task: any) => (task.note = 5),
      "tasks[0].note: ungültig, erwartet einen Text",
    ],
    [
      "eine fehlende Checkliste",
      (task: any) => delete task.checklist,
      "tasks[0].checklist: erwartet eine Liste",
    ],
    [
      "eine Checkliste, die keine Liste ist",
      (task: any) => (task.checklist = {}),
      "tasks[0].checklist: erwartet eine Liste",
    ],
    [
      "eine unbekannte Art",
      (task: any) => (task.kind = "weekly"),
      "tasks[0].kind: erwartet recurring oder oneOff",
    ],
    [
      "ein Rhythmus mit Intervall 0",
      (task: any) => (task.recurrence.interval = 0),
      "tasks[0].recurrence: ungültig, erwartet unit und interval",
    ],
    [
      "ein Rhythmus mit unbekannter Einheit",
      (task: any) => (task.recurrence.unit = "year"),
      "tasks[0].recurrence: ungültig, erwartet unit und interval",
    ],
    ["ein fehlender Rhythmus", (task: any) => delete task.recurrence, "tasks[0].recurrence: fehlt"],
    [
      "eine Übernahme durch „beide“",
      (task: any) => (task.takenOverBy = "both"),
      "tasks[0].takenOverBy: ungültig, erwartet personA oder personB",
    ],
  ])("F7 Eine wiederkehrende Aufgabe mit %s wird abgelehnt", (_name, change, message) => {
    const result = importChanged((file) => change(file.tasks[0]));

    expect(errorsOf(result)).toEqual([message]);
  });

  it("F7 Eine einmalige Aufgabe ohne Angabe „done“ wird abgelehnt", () => {
    const result = importChanged((file) => {
      delete file.tasks[2].done;
    });

    expect(errorsOf(result)).toEqual(["tasks[2].done: fehlt"]);
  });

  it("F7 Eine Aufgabe, die kein Objekt ist, wird abgelehnt", () => {
    const result = importChanged((file) => {
      file.tasks[1] = "Fenster";
    });

    expect(errorsOf(result)).toEqual(["tasks[1]: erwartet ein Objekt"]);
  });

  it.each([
    [
      "ein Eintrag ohne Text",
      (item: any) => (item.text = ""),
      "tasks[0].checklist[1].text: ungültig, erwartet einen Text",
    ],
    [
      "ein Eintrag ohne Häkchen-Angabe",
      (item: any) => delete item.checked,
      "tasks[0].checklist[1].checked: fehlt",
    ],
    [
      "ein Eintrag mit Zahl als Kennung",
      (item: any) => (item.id = 7),
      "tasks[0].checklist[1].id: ungültig, erwartet eine Kennung",
    ],
  ])("F7 Eine Checkliste mit %s wird abgelehnt", (_name, change, message) => {
    const result = importChanged((file) => change(file.tasks[0].checklist[1]));

    expect(errorsOf(result)).toEqual([message]);
  });

  it("F7 Ein Eintrag in der Checkliste, der kein Objekt ist, wird abgelehnt", () => {
    const result = importChanged((file) => {
      file.tasks[0].checklist[0] = null;
    });

    expect(errorsOf(result)).toEqual(["tasks[0].checklist[0]: erwartet ein Objekt"]);
  });

  it.each([
    [
      "ein fehlender Tag des Abhakens",
      (c: any) => delete c.completedOn,
      "completions[0].completedOn: fehlt",
    ],
    [
      "eine unbekannte Person",
      (c: any) => (c.completedBy = "both"),
      "completions[0].completedBy: ungültig, erwartet personA oder personB",
    ],
    [
      "ein ungültiger vorheriger Termin",
      (c: any) => (c.previousDueDate = "gestern"),
      "completions[0].previousDueDate: ungültig, erwartet ein Datum JJJJ-MM-TT",
    ],
    [
      "ein ungültiger nächster Termin",
      (c: any) => (c.nextDueDate = "2026-13-01"),
      "completions[0].nextDueDate: ungültig, erwartet ein Datum JJJJ-MM-TT",
    ],
    [
      "Häkchen-Kennungen, die keine Liste sind",
      (c: any) => (c.checkedItemIds = "i-1"),
      "completions[0].checkedItemIds: ungültig, erwartet eine Liste von Kennungen",
    ],
    [
      "eine Liste mit einer Zahl bei den Häkchen",
      (c: any) => (c.checkedItemIds = ["i-1", 2]),
      "completions[0].checkedItemIds: ungültig, erwartet eine Liste von Kennungen",
    ],
    [
      "eine ungültige frühere Übernahme",
      (c: any) => (c.previousTakenOverBy = "x"),
      "completions[0].previousTakenOverBy: ungültig, erwartet personA oder personB",
    ],
  ])("F7 Eine Erledigung mit %s wird abgelehnt", (_name, change, message) => {
    const result = importChanged((file) => change(file.completions[0]));

    expect(errorsOf(result)).toEqual([message]);
  });

  it("F7 Eine Erledigung, die kein Objekt ist, wird abgelehnt", () => {
    const result = importChanged((file) => {
      file.completions[0] = 1;
    });

    expect(errorsOf(result)).toEqual(["completions[0]: erwartet ein Objekt"]);
  });

  it("F7 Doppelte Kennungen bei Aufgaben werden abgelehnt", () => {
    const result = importChanged((file) => {
      file.tasks[1].id = file.tasks[0].id;
    });

    expect(errorsOf(result)).toEqual(["tasks: die Kennung „t-bad“ kommt mehrfach vor"]);
  });

  it("F7 Doppelte Kennungen bei Erledigungen werden abgelehnt", () => {
    const result = importChanged((file) => {
      file.completions[1].id = file.completions[0].id;
    });

    expect(errorsOf(result)).toEqual(["completions: die Kennung „c-1“ kommt mehrfach vor"]);
  });

  it("F7 Doppelte Kennungen in einer Checkliste werden abgelehnt", () => {
    const result = importChanged((file) => {
      file.tasks[0].checklist[1].id = "i-1";
    });

    expect(errorsOf(result)).toEqual(["tasks[0].checklist: die Kennung „i-1“ kommt mehrfach vor"]);
  });

  it("F7 Eine Erledigung zu einer Aufgabe, die es nicht gibt, wird abgelehnt", () => {
    const result = importChanged((file) => {
      file.completions[0].taskId = "weg";
    });

    expect(errorsOf(result)).toEqual(["completions[0].taskId: es gibt keine Aufgabe „weg“"]);
  });

  it("F7 Bei vielen Fehlern werden nur die ersten zehn gemeldet", () => {
    const result = importChanged((file) => {
      file.tasks = Array.from({ length: 30 }, () => 1);
    });

    expect(errorsOf(result)).toHaveLength(10);
  });
});
