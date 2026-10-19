import { describe, expect, it } from "vitest";
import { addChecklistItem } from "./checklist";
import { d, oneOffTask, recurringTask } from "./task.fixtures";
import {
  checkTaskForm,
  firstTaskFormError,
  MAX_NOTE_LENGTH,
  MAX_RECURRENCE_INTERVAL,
  MAX_TITLE_LENGTH,
  type TaskFormInput,
  taskFromForm,
  updateTask,
} from "./taskForm";

const valid: TaskFormInput = {
  title: "Bad putzen",
  symbol: "standard",
  dueDate: "2026-10-19",
  assignee: "personA",
  note: "",
  interval: "2",
  unit: "week",
};

function errorsOf(kind: "recurring" | "oneOff", input: Partial<TaskFormInput>) {
  const result = checkTaskForm(kind, { ...valid, ...input });
  return result.ok ? undefined : result.errors;
}

describe("F1 Wiederkehrende Aufgaben: Formular prüfen", () => {
  it("F1 Titel, Rhythmus, Zuständigkeit, erster Termin und Notiz ergeben die Werte der Aufgabe", () => {
    const result = checkTaskForm("recurring", { ...valid, note: "Mit Essigreiniger" });

    expect(result).toEqual({
      ok: true,
      values: {
        title: "Bad putzen",
        symbol: "standard",
        dueDate: "2026-10-19",
        assignee: "personA",
        note: "Mit Essigreiniger",
        recurrence: { unit: "week", interval: 2 },
      },
    });
  });

  it("F1 Die Notiz ist optional; Leerzeichen am Rand werden entfernt", () => {
    const result = checkTaskForm("recurring", {
      ...valid,
      title: "  Bad putzen ",
      interval: " 3 ",
      note: "   ",
    });

    expect(result).toEqual({
      ok: true,
      values: {
        title: "Bad putzen",
        symbol: "standard",
        dueDate: "2026-10-19",
        assignee: "personA",
        recurrence: { unit: "week", interval: 3 },
      },
    });
  });

  it("F1 Jede Zuständigkeit ist erlaubt: Person A, Person B oder beide", () => {
    for (const assignee of ["personA", "personB", "both"]) {
      expect(checkTaskForm("recurring", { ...valid, assignee }).ok).toBe(true);
    }
  });

  it("F1 Ein leerer Titel wird beim Titel gemeldet", () => {
    expect(errorsOf("recurring", { title: "   " })).toEqual({
      title: "Bitte einen Titel eingeben.",
    });
  });

  it("F1 Ein zu langer Titel wird abgelehnt, die Höchstlänge selbst ist erlaubt", () => {
    const longest = "x".repeat(MAX_TITLE_LENGTH);

    expect(checkTaskForm("recurring", { ...valid, title: longest }).ok).toBe(true);
    expect(errorsOf("recurring", { title: `${longest}x` })).toEqual({
      title: `Der Titel darf höchstens ${MAX_TITLE_LENGTH} Zeichen lang sein.`,
    });
  });

  it("F1 Eine zu lange Notiz wird abgelehnt, die Höchstlänge selbst ist erlaubt", () => {
    const longest = "x".repeat(MAX_NOTE_LENGTH);

    expect(checkTaskForm("recurring", { ...valid, note: longest }).ok).toBe(true);
    expect(errorsOf("recurring", { note: `${longest}x` })).toEqual({
      note: `Die Notiz darf höchstens ${MAX_NOTE_LENGTH} Zeichen lang sein.`,
    });
  });

  it("F1 Ohne Zuständigkeit wird beim Feld „assignee“ gemeldet", () => {
    expect(errorsOf("recurring", { assignee: "" })).toEqual({
      assignee: "Bitte auswählen, wer zuständig ist.",
    });
    expect(errorsOf("recurring", { assignee: "niemand" })).toEqual({
      assignee: "Bitte auswählen, wer zuständig ist.",
    });
  });

  it("F1 Der Rhythmus braucht eine ganze Zahl ab 1", () => {
    expect(errorsOf("recurring", { interval: "" })).toEqual({
      interval: "Bitte eine Zahl eingeben.",
    });
    for (const interval of ["0", "-1", "1,5", "1.5", "zwei", "2 Wochen"]) {
      expect(errorsOf("recurring", { interval })).toEqual({
        interval: "Bitte eine ganze Zahl ab 1 eingeben.",
      });
    }
  });

  it("F1 Der Rhythmus hat eine Obergrenze, die Obergrenze selbst ist erlaubt", () => {
    expect(
      checkTaskForm("recurring", { ...valid, interval: String(MAX_RECURRENCE_INTERVAL) }).ok,
    ).toBe(true);
    expect(errorsOf("recurring", { interval: String(MAX_RECURRENCE_INTERVAL + 1) })).toEqual({
      interval: `Bitte höchstens ${MAX_RECURRENCE_INTERVAL} eingeben.`,
    });
  });

  it("F1 Täglich, wöchentlich und monatlich sind möglich, jeweils auch „alle N“", () => {
    for (const unit of ["day", "week", "month"]) {
      const result = checkTaskForm("recurring", { ...valid, unit, interval: "4" });
      expect(result.ok && result.values.recurrence).toEqual({ unit, interval: 4 });
    }
    expect(errorsOf("recurring", { unit: "year" })).toEqual({
      unit: "Bitte Tage, Wochen oder Monate auswählen.",
    });
  });

  it("F1 Das Datum des ersten Termins muss angegeben und echt sein", () => {
    expect(errorsOf("recurring", { dueDate: "" })).toEqual({ dueDate: "Bitte ein Datum angeben." });
    for (const dueDate of ["2026-02-30", "19.10.2026", "morgen", "275760-09-13"]) {
      expect(errorsOf("recurring", { dueDate })).toEqual({
        dueDate: "Bitte ein gültiges Datum angeben.",
      });
    }
  });

  it("F1 Ein Datum weit außerhalb des Kalenders wird abgelehnt, die Grenzen selbst sind erlaubt", () => {
    expect(checkTaskForm("recurring", { ...valid, dueDate: "2000-01-01" }).ok).toBe(true);
    expect(checkTaskForm("recurring", { ...valid, dueDate: "2100-12-31" }).ok).toBe(true);
    for (const dueDate of ["1999-12-31", "2101-01-01"]) {
      expect(errorsOf("recurring", { dueDate })).toEqual({
        dueDate: "Bitte ein Datum zwischen 2000 und 2100 wählen.",
      });
    }
  });

  it("F1 Fehlt mehr als ein Feld, werden alle gemeldet, jeweils bei ihrem Feld", () => {
    expect(errorsOf("recurring", { title: "", interval: "", dueDate: "", assignee: "" })).toEqual({
      title: "Bitte einen Titel eingeben.",
      interval: "Bitte eine Zahl eingeben.",
      dueDate: "Bitte ein Datum angeben.",
      assignee: "Bitte auswählen, wer zuständig ist.",
    });
  });
});

describe("F3 Einmalige Aufgaben: Formular prüfen", () => {
  it("F3 Titel, Fälligkeitsdatum, Zuständigkeit und Notiz genügen; der Rhythmus entfällt", () => {
    const result = checkTaskForm("oneOff", { ...valid, interval: "", unit: "", note: "Ausweis" });

    expect(result).toEqual({
      ok: true,
      values: {
        title: "Bad putzen",
        symbol: "standard",
        dueDate: "2026-10-19",
        assignee: "personA",
        note: "Ausweis",
      },
    });
  });

  it("F3 Das Fälligkeitsdatum ist Pflicht", () => {
    expect(errorsOf("oneOff", { dueDate: "" })).toEqual({ dueDate: "Bitte ein Datum angeben." });
  });
});

describe("F8 Symbol im Formular", () => {
  it("F8 Das gewählte Symbol gehört zu den Werten der Aufgabe, bei beiden Arten", () => {
    for (const kind of ["recurring", "oneOff"] as const) {
      const result = checkTaskForm(kind, { ...valid, symbol: "bath" });
      expect(result.ok && result.values.symbol).toBe("bath");
    }
  });

  it("F8 Ein unbekanntes oder fehlendes Symbol wird beim Feld „symbol“ gemeldet", () => {
    for (const symbol of ["", "rocket"]) {
      expect(errorsOf("recurring", { symbol })).toEqual({
        symbol: "Bitte ein Symbol auswählen.",
      });
    }
  });
});

describe("Formular: Fokus auf das erste fehlerhafte Feld", () => {
  it("Der Fokus gehört dem Feld, das im Formular zuerst kommt", () => {
    expect(firstTaskFormError({ note: "x", assignee: "x", interval: "x" })).toBe("interval");
    expect(firstTaskFormError({ dueDate: "x", assignee: "x" })).toBe("dueDate");
    expect(firstTaskFormError({ assignee: "x", title: "x" })).toBe("title");
    expect(firstTaskFormError({ note: "x" })).toBe("note");
    expect(firstTaskFormError({ interval: "x", symbol: "x" })).toBe("symbol");
  });

  it("Ohne Fehler gibt es kein Feld, das den Fokus bekommt", () => {
    expect(firstTaskFormError({})).toBeUndefined();
  });
});

describe("F1 Aufgaben anlegen", () => {
  it("F1 Aus den Werten wird eine wiederkehrende Aufgabe mit dem gewählten ersten Termin", () => {
    const checked = checkTaskForm("recurring", { ...valid, note: "Mit Essigreiniger" });
    if (!checked.ok) {
      throw new Error("Formular sollte gültig sein");
    }

    expect(taskFromForm("recurring", "t-1", checked.values)).toEqual({
      kind: "recurring",
      id: "t-1",
      title: "Bad putzen",
      symbol: "standard",
      recurrence: { unit: "week", interval: 2 },
      assignee: "personA",
      dueDate: "2026-10-19",
      note: "Mit Essigreiniger",
      checklist: [],
    });
  });

  it("F3 Aus den Werten wird eine offene einmalige Aufgabe", () => {
    expect(
      taskFromForm("oneOff", "t-2", {
        title: "Paket abholen",
        symbol: "parcel",
        dueDate: d("2026-10-22"),
        assignee: "personB",
      }),
    ).toEqual({
      kind: "oneOff",
      id: "t-2",
      title: "Paket abholen",
      symbol: "parcel",
      dueDate: "2026-10-22",
      assignee: "personB",
      done: false,
      checklist: [],
    });
  });

  it("F1 Eine wiederkehrende Aufgabe ohne Rhythmus lässt sich nicht anlegen", () => {
    expect(() =>
      taskFromForm("recurring", "t-1", {
        title: "Bad putzen",
        symbol: "standard",
        dueDate: d("2026-10-19"),
        assignee: "personA",
      }),
    ).toThrow(RangeError);
  });
});

describe("F1 Aufgaben bearbeiten", () => {
  const edited = {
    title: "Bad gründlich putzen",
    symbol: "standard" as const,
    dueDate: d("2026-10-25"),
    assignee: "personA" as const,
    recurrence: { unit: "month" as const, interval: 1 },
  };

  it("F1 Titel, Rhythmus, Termin und Notiz einer wiederkehrenden Aufgabe lassen sich ändern", () => {
    const task = recurringTask({ note: "alt" });

    expect(updateTask(task, { ...edited, note: "neu" })).toEqual({
      ...task,
      title: "Bad gründlich putzen",
      dueDate: "2026-10-25",
      recurrence: { unit: "month", interval: 1 },
      note: "neu",
    });
  });

  it("F1 Wird die Notiz geleert, verschwindet sie aus der Aufgabe", () => {
    const updated = updateTask(recurringTask({ note: "alt" }), edited);

    expect("note" in updated).toBe(false);
  });

  it("F3 Titel, Termin, Zuständigkeit und Notiz einer einmaligen Aufgabe lassen sich ändern", () => {
    const task = oneOffTask();

    expect(
      updateTask(task, {
        title: "Paket in der Filiale abholen",
        symbol: "standard",
        dueDate: d("2026-10-23"),
        assignee: "both",
        note: "Ausweis",
      }),
    ).toEqual({
      ...task,
      title: "Paket in der Filiale abholen",
      dueDate: "2026-10-23",
      assignee: "both",
      note: "Ausweis",
    });
  });

  it("F1 Checkliste und Art der Aufgabe bleiben beim Bearbeiten erhalten", () => {
    const withItem = addChecklistItem(recurringTask(), { id: "i-1", text: "Dusche" });

    const updated = updateTask(withItem, edited);

    expect(updated.kind).toBe("recurring");
    expect(updated.checklist).toEqual(withItem.checklist);
  });

  it("F1 Ohne neuen Rhythmus bleibt der Rhythmus der wiederkehrenden Aufgabe", () => {
    const task = recurringTask();
    const { recurrence: _recurrence, ...withoutRecurrence } = edited;

    const updated = updateTask(task, withoutRecurrence);

    expect(updated.kind === "recurring" && updated.recurrence).toEqual(task.recurrence);
  });

  it("F5 Eine neue feste Zuständigkeit beendet die Übernahme „nur dieses Mal“", () => {
    const task = recurringTask({ assignee: "personA", takenOverBy: "personB" });

    const updated = updateTask(task, { ...edited, assignee: "both" });

    expect(updated).toMatchObject({ assignee: "both" });
    expect("takenOverBy" in updated).toBe(false);
  });

  it("F5 Bleibt die Zuständigkeit gleich, bleibt auch die Übernahme „nur dieses Mal“", () => {
    const task = recurringTask({ assignee: "personA", takenOverBy: "personB" });

    const updated = updateTask(task, edited);

    expect(updated).toMatchObject({ takenOverBy: "personB" });
  });

  it("F3 Eine erledigte einmalige Aufgabe bleibt erledigt", () => {
    const updated = updateTask(oneOffTask({ done: true }), {
      title: "Paket abholen",
      symbol: "standard",
      dueDate: d("2026-10-22"),
      assignee: "personB",
    });

    expect(updated).toMatchObject({ kind: "oneOff", done: true });
  });

  it("F8 Beim Bearbeiten lässt sich das Symbol ändern, bei beiden Arten", () => {
    expect(updateTask(recurringTask(), { ...edited, symbol: "shower" }).symbol).toBe("shower");
    expect(
      updateTask(oneOffTask(), {
        title: "Paket abholen",
        symbol: "parcel",
        dueDate: d("2026-10-22"),
        assignee: "personB",
      }).symbol,
    ).toBe("parcel");
  });
});
