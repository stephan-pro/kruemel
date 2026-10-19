import { describe, expect, it } from "vitest";
import { calendarDay } from "../domain/date";
import type { Completion } from "../domain/task";
import {
  assigneeLabel,
  completionNotice,
  countTasks,
  dayOfMonth,
  describeChecklist,
  describeCompletedBy,
  describeOverdue,
  describeRecurrence,
  describeResponsibility,
  formatDay,
  formatShortDay,
  formatWeekLabel,
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
