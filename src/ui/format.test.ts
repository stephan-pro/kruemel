import { describe, expect, it } from "vitest";
import { calendarDay } from "../domain/date";
import type { Completion } from "../domain/task";
import {
  assigneeLabel,
  barLabel,
  completionNotice,
  countCompletions,
  countEntries,
  countTasks,
  dayField,
  dayOfMonth,
  describeBars,
  describeChecklist,
  describeComparison,
  describeCompletedBy,
  describeContents,
  describeDoneAt,
  describeOverdue,
  describePeriod,
  describeRecurrence,
  describeResponsibility,
  describeStreak,
  describeTakenOver,
  describeTeamwork,
  exportNotice,
  formatDay,
  formatLongDay,
  formatShortDay,
  formatTime,
  formatWeekLabel,
  formatWeekNumber,
  greeting,
  importNotice,
  monthShort,
  PERIOD_LABELS,
  percentOf,
  takeOverNotice,
  todaySummary,
  undoNotice,
  weekdayName,
  weekdayShort,
  weekTitle,
} from "./format";

const names = { personA: "Alex", personB: "Robin" };

const completion: Completion = {
  id: "c-1",
  taskId: "task-1",
  completedOn: calendarDay("2026-10-14"),
  completedBy: "personB",
  previousDueDate: calendarDay("2026-10-12"),
  checkedItemIds: [],
};

describe("Anzeige der Wochenübersicht (F6)", () => {
  it("F6 Überfälliges nennt die Tage, im Singular und im Plural", () => {
    expect(describeOverdue(1)).toBe("1 Tag überfällig");
    expect(describeOverdue(2)).toBe("2 Tage überfällig");
  });

  it("F6 Erledigtes nennt, wer es wann erledigt hat", () => {
    expect(describeCompletedBy(completion, names)).toBe("Erledigt von Robin am Mi, 14.10.2026");
  });

  it("F2 Nach dem Abhaken einer wiederkehrenden Aufgabe steht der nächste Termin da", () => {
    expect(
      completionNotice("Bad putzen", { ...completion, nextDueDate: calendarDay("2026-10-21") }),
    ).toBe("„Bad putzen“ ist abgehakt. Nächster Termin: Mi, 21.10.2026.");
  });

  it("F3 Nach dem Abhaken einer einmaligen Aufgabe steht da, dass sie bei „Erledigt“ liegt", () => {
    expect(completionNotice("Paket abholen", completion)).toBe(
      "„Paket abholen“ ist abgehakt und steht jetzt unter „Erledigt“.",
    );
  });

  it("F2 Nach „Rückgängig“ steht der wiederhergestellte Termin da", () => {
    expect(undoNotice("Bad putzen", calendarDay("2026-10-19"))).toBe(
      "Rückgängig gemacht: „Bad putzen“ ist wieder offen, fällig am Mo, 19.10.2026.",
    );
  });
});

describe("Hinweis nach „Übernehmen“ (F5)", () => {
  it("F5 Eine wiederkehrende Aufgabe „nur dieses Mal“ sagt, dass es bei diesem Mal bleibt", () => {
    expect(takeOverNotice("Bad putzen", "recurring", "personB", names, "once")).toBe(
      "„Bad putzen“ ist jetzt bei Robin, nur dieses Mal.",
    );
  });

  it("F5 Dauerhaft übernommen heißt: gehört jetzt der Person", () => {
    expect(takeOverNotice("Bad putzen", "recurring", "personA", names, "permanently")).toBe(
      "„Bad putzen“ gehört jetzt dauerhaft Alex.",
    );
  });

  it("F5 Eine einmalige Aufgabe ist einfach umgewiesen, gleich welche Art gewählt ist", () => {
    for (const mode of ["once", "permanently"] as const) {
      expect(takeOverNotice("Paket abholen", "oneOff", "personA", names, mode)).toBe(
        "„Paket abholen“ ist jetzt bei Alex.",
      );
    }
  });
});

describe("Wochenkopf und Tage im neuen Design (F6)", () => {
  it("F6 Der Wochenkopf nennt Kalenderwoche und Tage, ohne Jahr im laufenden Jahr", () => {
    const today = calendarDay("2026-10-21");
    expect(formatWeekLabel(calendarDay("2026-10-19"), today)).toBe("KW 43 · 19.–25. Oktober");
    expect(formatWeekLabel(calendarDay("2026-10-26"), today)).toBe(
      "KW 44 · 26. Oktober – 1. November",
    );
  });

  it("F6 Der Wochenkopf nennt das Jahr bei einem anderen Jahr und über den Jahreswechsel", () => {
    const today = calendarDay("2026-10-21");
    expect(formatWeekLabel(calendarDay("2025-10-20"), today)).toBe("KW 43 · 20.–26. Oktober 2025");
    expect(formatWeekLabel(calendarDay("2026-12-28"), today)).toBe(
      "KW 53 · 28. Dezember 2026 – 3. Januar 2027",
    );
  });

  it("F6 Die Woche heißt nach ihrem Abstand zur laufenden", () => {
    expect(weekTitle(0)).toBe("Diese Woche");
    expect(weekTitle(1)).toBe("Nächste Woche");
    expect(weekTitle(-1)).toBe("Letzte Woche");
    expect(weekTitle(3)).toBe("In 3 Wochen");
    expect(weekTitle(-2)).toBe("Vor 2 Wochen");
  });

  it("F6 Tage gibt es kurz, mit Namen und als Tag im Monat", () => {
    const day = calendarDay("2026-11-05");
    expect(formatShortDay(day)).toBe("Do, 05.11.");
    expect(weekdayShort(day)).toBe("Do");
    expect(weekdayName(day)).toBe("Donnerstag");
    expect(dayOfMonth(day)).toBe("5");
  });

  it("F6 Die Zahl der Aufgaben eines Tages steht in Worten", () => {
    expect(countTasks(0)).toBe("keine Aufgaben");
    expect(countTasks(1)).toBe("1 Aufgabe");
    expect(countTasks(4)).toBe("4 Aufgaben");
  });

  it("F4 Eine Checkliste nennt, wie viele Einträge abgehakt sind", () => {
    expect(
      describeChecklist([
        { id: "1", text: "Milch", checked: true },
        { id: "2", text: "Brot", checked: false },
      ]),
    ).toBe("1 von 2 abgehakt");
  });
});

describe("Anzeige der Aufgabenliste (F1)", () => {
  it("F1 Ein Tag wird mit Wochentag im deutschen Format gezeigt", () => {
    expect(formatDay(calendarDay("2026-10-19"))).toBe("Mo, 19.10.2026");
    expect(formatDay(calendarDay("2026-10-25"))).toBe("So, 25.10.2026");
  });

  it("F1 Der Rhythmus wird in Worten gezeigt, auch „alle N“", () => {
    expect(describeRecurrence({ unit: "day", interval: 1 })).toBe("täglich");
    expect(describeRecurrence({ unit: "week", interval: 1 })).toBe("wöchentlich");
    expect(describeRecurrence({ unit: "month", interval: 1 })).toBe("monatlich");
    expect(describeRecurrence({ unit: "day", interval: 3 })).toBe("alle 3 Tage");
    expect(describeRecurrence({ unit: "week", interval: 2 })).toBe("alle 2 Wochen");
    expect(describeRecurrence({ unit: "month", interval: 6 })).toBe("alle 6 Monate");
  });

  it("F5 Die Zuständigkeit zeigt den Namen der Person oder „Beide“", () => {
    expect(assigneeLabel("personA", names)).toBe("Alex");
    expect(assigneeLabel("personB", names)).toBe("Robin");
    expect(assigneeLabel("both", names)).toBe("Beide");
  });

  it("F5 Eine Übernahme „nur dieses Mal“ nennt auch die feste Zuständigkeit", () => {
    expect(describeResponsibility("personB", undefined, names)).toBe("Robin");
    expect(describeResponsibility("personB", "personA", names)).toBe(
      "Alex (nur dieses Mal übernommen; sonst Robin)",
    );
  });
});

describe("Anzeige von „Erledigt“ und „Sicherung“ (F3, F7)", () => {
  it("F3 Die Länge der Erledigt-Liste steht im Singular und im Plural", () => {
    expect(countEntries(1)).toBe("1 Eintrag");
    expect(countEntries(0)).toBe("0 Einträge");
    expect(countEntries(10)).toBe("10 Einträge");
  });

  it("F7 Der Inhalt einer Sicherung nennt Aufgaben und Erledigungen, auch bei null und eins", () => {
    expect(countCompletions(0)).toBe("keine Erledigungen");
    expect(countCompletions(1)).toBe("1 Erledigung");
    expect(describeContents(4, 12)).toBe("4 Aufgaben und 12 Erledigungen");
    expect(describeContents(1, 1)).toBe("1 Aufgabe und 1 Erledigung");
    expect(describeContents(0, 0)).toBe("keine Aufgaben und keine Erledigungen");
  });

  it("F7 Nach dem Herunterladen steht der Dateiname da", () => {
    expect(exportNotice("kruemel-2026-10-21.json")).toBe(
      "Die Sicherung „kruemel-2026-10-21.json“ wurde heruntergeladen. Bewahre die Datei sicher auf.",
    );
  });

  it("F7 Nach dem Einspielen steht, was die Sicherung enthielt und wo die bisherigen Daten liegen", () => {
    expect(
      importNotice("2 Aufgaben und 3 Erledigungen", "kruemel-vor-import-2026-10-21.json"),
    ).toBe(
      "Sicherung eingespielt: 2 Aufgaben und 3 Erledigungen. Die bisherigen Daten wurden vorher als „kruemel-vor-import-2026-10-21.json“ heruntergeladen.",
    );
  });
});

describe("Anzeige von „Heute“", () => {
  it("Begrüßung: Der Gruß richtet sich nach der Tageszeit und nennt den Namen", () => {
    expect(greeting(5, "Alex")).toBe("Guten Morgen, Alex!");
    expect(greeting(10, "Alex")).toBe("Guten Morgen, Alex!");
    expect(greeting(11, "Alex")).toBe("Hallo, Alex!");
    expect(greeting(17, "Alex")).toBe("Hallo, Alex!");
    expect(greeting(18, "Alex")).toBe("Guten Abend, Alex!");
    expect(greeting(23, "Alex")).toBe("Guten Abend, Alex!");
    expect(greeting(3, "Alex")).toBe("Hallo, Alex!");
  });

  it("Zusammenfassung: Der Satz nennt Anzahl und Überfälliges in der richtigen Form", () => {
    const text = (open: number, overdue: number, done: number) =>
      todaySummary(open, overdue, done).join("");

    expect(text(3, 1, 0)).toBe("Heute stehen 3 Aufgaben für dich an. Eine davon ist überfällig.");
    expect(text(3, 2, 0)).toBe("Heute stehen 3 Aufgaben für dich an. 2 davon sind überfällig.");
    expect(text(3, 3, 0)).toBe("Heute stehen 3 Aufgaben für dich an. Alle sind überfällig.");
    expect(text(3, 0, 2)).toBe("Heute stehen 3 Aufgaben für dich an.");
    expect(text(1, 0, 0)).toBe("Heute steht 1 Aufgabe für dich an.");
    expect(text(1, 1, 0)).toBe("Heute steht 1 Aufgabe für dich an. Sie ist überfällig.");
    expect(text(0, 0, 0)).toBe("Heute steht nichts für dich an.");
    expect(text(0, 0, 4)).toBe("Heute ist alles erledigt. Gut gemacht!");
    // Die Zahl steht für sich, damit sie fett gesetzt werden kann.
    expect(todaySummary(3, 1, 0)[1]).toBe("3 Aufgaben");
  });

  it("Datum: Die Kopfzeile nennt Wochentag und Monat, die Wochenwahl die Kalenderwoche", () => {
    expect(formatLongDay(calendarDay("2026-10-20"))).toBe("Dienstag, 20. Oktober");
    expect(formatLongDay(calendarDay("2026-03-01"))).toBe("Sonntag, 1. März");
    expect(formatWeekNumber(calendarDay("2026-10-19"))).toBe("KW 43");
  });

  it("Uhrzeit: Erledigtes nennt die Uhrzeit, wenn sie bekannt ist, und wer es war, wenn es die andere Person ist", () => {
    const at = new Date(2026, 9, 21, 8, 5).toISOString();

    expect(formatTime(at)).toBe("08:05");
    expect(formatTime(undefined)).toBeUndefined();
    expect(formatTime("kein Datum")).toBeUndefined();
    expect(describeDoneAt({ ...completion, completedAt: at }, names, "personB")).toBe(
      "erledigt um 08:05",
    );
    expect(describeDoneAt({ ...completion, completedAt: at }, names, "personA")).toBe(
      "erledigt von Robin um 08:05",
    );
    expect(describeDoneAt(completion, names, "personB")).toBe("erledigt");
  });

  it("Ring: Der Prozentwert ist gerundet und 0, wenn nichts fällig ist", () => {
    expect(percentOf(9, 14)).toBe(64);
    expect(percentOf(0, 0)).toBe(0);
    expect(percentOf(3, 3)).toBe(100);
  });

  it("Deine Woche: Jedes Tagesfeld hat Zustand, Zeichen und vollständige Beschreibung", () => {
    const field = (dueCount: number, doneCount: number, isToday = false) =>
      dayField({ day: calendarDay("2026-10-21"), isToday, entries: [], dueCount, doneCount });

    expect(field(0, 0)).toEqual({ state: "free", mark: "–", label: "Mittwoch, frei" });
    expect(field(3, 3)).toEqual({ state: "done", mark: "", label: "Mittwoch, alles erledigt" });
    expect(field(2, 0)).toEqual({ state: "open", mark: "2", label: "Mittwoch, 2 Aufgaben" });
    expect(field(1, 0)).toEqual({ state: "open", mark: "1", label: "Mittwoch, 1 Aufgabe" });
    expect(field(3, 1)).toEqual({
      state: "open",
      mark: "2",
      label: "Mittwoch, 2 Aufgaben offen, 1 erledigt",
    });
    expect(field(3, 1, true)).toEqual({
      state: "today",
      mark: "1/3",
      label: "Mittwoch, heute, 1 von 3 erledigt",
    });
    expect(field(0, 0, true)).toEqual({
      state: "today",
      mark: "–",
      label: "Mittwoch, heute, frei",
    });
  });
});

describe("Anzeige der Statistik", () => {
  const week = { start: calendarDay("2026-10-19"), end: calendarDay("2026-10-25") };
  const month = { start: calendarDay("2026-10-01"), end: calendarDay("2026-10-31") };
  const year = { start: calendarDay("2026-01-01"), end: calendarDay("2026-12-31") };

  it("Statistik Die Zeiträume haben Namen für die Auswahl und eine Angabe, was gemeint ist", () => {
    expect(Object.values(PERIOD_LABELS)).toEqual(["Woche", "Monat", "Jahr"]);
    expect(describePeriod("week", week)).toBe("KW 43");
    expect(describePeriod("month", month)).toBe("Oktober 2026");
    expect(describePeriod("year", year)).toBe("2026");
  });

  it("Statistik Der Vergleich nennt den Unterschied ohne Urteil, für jeden Zeitraum in der richtigen Form", () => {
    expect(describeComparison("week", 38, 32)).toBe("6 mehr als in der Vorwoche");
    expect(describeComparison("month", 10, 13)).toBe("3 weniger als im Vormonat");
    expect(describeComparison("year", 5, 5)).toBe("so viele wie im Vorjahr");
    expect(describeComparison("week", 0, 0)).toBe("so viele wie in der Vorwoche");
  });

  it("Statistik Die Serie nennt die Wochen in Folge und fehlt ganz, solange es keine gibt", () => {
    expect(describeStreak(0)).toBeUndefined();
    expect(describeStreak(1)).toBe("1 Woche alles erledigt");
    expect(describeStreak(4)).toBe("4 Wochen in Folge");
  });

  it("Statistik „Füreinander übernommen“ klingt gemeinsam, auch bei null", () => {
    expect(describeTakenOver(5)).toBe("5-mal habt ihr füreinander übernommen.");
    expect(describeTakenOver(0)).toBe("Bisher hat niemand für die andere Person übernommen.");
  });

  it("Statistik Die Balken haben je Zeitraum eine kurze Beschriftung und eine ausgeschriebene für das Diagramm", () => {
    expect(barLabel(calendarDay("2026-10-19"), "week")).toBe("Mo");
    expect(barLabel(calendarDay("2026-10-05"), "month")).toBe("5.");
    expect(barLabel(calendarDay("2026-10-01"), "year")).toBe("Okt");
    expect(monthShort(calendarDay("2026-03-01"))).toBe("Mär");
    expect(
      describeBars(
        [
          { start: calendarDay("2026-10-19"), count: 7 },
          { start: calendarDay("2026-10-20"), count: 0 },
        ],
        "week",
      ),
    ).toBe("Erledigt pro Tag: Montag 7, Dienstag 0");
    expect(describeBars([{ start: calendarDay("2026-10-05"), count: 2 }], "month")).toBe(
      "Erledigt pro Tag: 5. 2",
    );
    expect(describeBars([{ start: calendarDay("2026-03-01"), count: 9 }], "year")).toBe(
      "Erledigt pro Monat: März 9",
    );
  });

  it("Statistik Das Teamwork nennt beide mit Namen und Anzahl, im Singular und im Plural", () => {
    expect(describeTeamwork({ personA: 21, personB: 1 }, names)).toBe(
      "Alex 21 Aufgaben, Robin 1 Aufgabe",
    );
  });
});
