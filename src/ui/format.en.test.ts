import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { calendarDay } from "../domain/date";
import type { Completion } from "../domain/task";
import { resetLanguage, setLanguage } from "../i18n/language";
import {
  barLabel,
  completionNotice,
  countCompletions,
  countEntries,
  countTasks,
  dayField,
  describeBars,
  describeChecklist,
  describeComparison,
  describeContents,
  describeDoneAt,
  describeOverdue,
  describePeriod,
  describeRecurrence,
  describeResponsibility,
  describeStreak,
  describeTakenOver,
  describeTeamwork,
  formatDay,
  formatLongDay,
  formatShortDay,
  formatTime,
  formatWeekLabel,
  formatWeekNumber,
  greeting,
  takeOverNotice,
  todaySummary,
  undoNotice,
  weekdayName,
  weekTitle,
} from "./format";

// EN-a: the same functions as in format.test.ts, in English. The German is the default there.

beforeEach(() => setLanguage("en"));
afterEach(() => resetLanguage());

const names = { personA: "Alex", personB: "Robin" };
const day = calendarDay;

describe("EN-a Datum und Woche auf Englisch", () => {
  it("Tage, Wochentage und Kalenderwochen", () => {
    expect(formatDay(day("2026-10-19"))).toBe("Mon, 19 Oct 2026");
    expect(formatShortDay(day("2026-10-19"))).toBe("Mon, 19 Oct");
    expect(formatLongDay(day("2026-10-20"))).toBe("Tuesday, 20 October");
    expect(weekdayName(day("2026-10-21"))).toBe("Wednesday");
    expect(formatWeekNumber(day("2026-10-19"))).toBe("Week 43");
    expect(barLabel(day("2026-10-05"), "month")).toBe("5");
    expect(barLabel(day("2026-10-05"), "week")).toBe("Mon");
    expect(barLabel(day("2026-10-01"), "year")).toBe("Oct");
  });

  it("Der Wochenbereich nennt Monat und Jahr nur, wo nötig", () => {
    const today = day("2026-10-21");
    expect(formatWeekLabel(day("2026-10-19"), today)).toBe("Week 43 · 19–25 October");
    expect(formatWeekLabel(day("2026-10-26"), today)).toBe("Week 44 · 26 October – 1 November");
    expect(formatWeekLabel(day("2026-12-28"), today)).toBe(
      "Week 53 · 28 December 2026 – 3 January 2027",
    );
    expect(formatWeekLabel(day("2027-01-04"), today)).toBe("Week 1 · 4–10 January 2027");
  });

  it("Wochentitel mit Mehrzahl", () => {
    expect(weekTitle(0)).toBe("This week");
    expect(weekTitle(1)).toBe("Next week");
    expect(weekTitle(-1)).toBe("Last week");
    expect(weekTitle(1 + 1)).toBe("In 2 weeks");
    expect(weekTitle(-3)).toBe("3 weeks ago");
  });

  it("Uhrzeit und „erledigt von“", () => {
    const moment = new Date(2026, 9, 21, 8, 12).toISOString();
    expect(formatTime(moment)).toBe("08:12");
    expect(formatTime(undefined)).toBeUndefined();
    const completion: Completion = {
      id: "c",
      taskId: "t",
      completedOn: day("2026-10-21"),
      completedAt: moment,
      completedBy: "personB",
      previousDueDate: day("2026-10-21"),
      checkedItemIds: [],
    };
    expect(describeDoneAt(completion, names, "personB")).toBe("done at 08:12");
    expect(describeDoneAt(completion, names, "personA")).toBe("done by Robin at 08:12");
    expect(completionNotice("Bath", completion)).toBe(
      "“Bath” is done and now listed under “Done”.",
    );
    expect(completionNotice("Bath", { ...completion, nextDueDate: day("2026-10-28") })).toBe(
      "“Bath” is done. Next due: Wed, 28 Oct 2026.",
    );
    expect(undoNotice("Bath", day("2026-10-21"))).toBe(
      "Undone: “Bath” is open again, due Wed, 21 Oct 2026.",
    );
  });
});

describe("EN-a Zählungen, Rhythmus und Zuständigkeit auf Englisch", () => {
  it("Mehrzahlformen", () => {
    expect(countTasks(0)).toBe("no tasks");
    expect(countTasks(1)).toBe("1 task");
    expect(countTasks(2)).toBe("2 tasks");
    expect(countCompletions(1)).toBe("1 completion");
    expect(countEntries(3)).toBe("3 entries");
    expect(describeContents(4, 12)).toBe("4 tasks and 12 completions");
    expect(describeOverdue(1)).toBe("1 day overdue");
    expect(describeOverdue(3)).toBe("3 days overdue");
    expect(describeChecklist([{ id: "a", text: "x", checked: true }])).toBe("1 of 1 ticked");
  });

  it("Rhythmus", () => {
    expect(describeRecurrence({ unit: "day", interval: 1 })).toBe("daily");
    expect(describeRecurrence({ unit: "week", interval: 1 })).toBe("weekly");
    expect(describeRecurrence({ unit: "month", interval: 2 })).toBe("every 2 months");
  });

  it("Zuständigkeit und Übernehmen", () => {
    expect(describeResponsibility("both", undefined, names)).toBe("Both");
    expect(describeResponsibility("personA", "personB", names)).toBe(
      "Robin (taken over this time only; usually Alex)",
    );
    expect(takeOverNotice("Bath", "oneOff", "personB", names, "once")).toBe(
      "“Bath” now belongs to Robin.",
    );
    expect(takeOverNotice("Bath", "recurring", "personB", names, "once")).toBe(
      "“Bath” now belongs to Robin, this time only.",
    );
    expect(takeOverNotice("Bath", "recurring", "personB", names, "permanently")).toBe(
      "“Bath” now belongs to Robin for good.",
    );
  });
});

describe("EN-a Heute und Statistik auf Englisch", () => {
  it("Begrüßung nach Tageszeit und der Satz darunter", () => {
    expect(greeting(8, "Alex")).toBe("Good morning, Alex!");
    expect(greeting(13, "Alex")).toBe("Hello, Alex!");
    expect(greeting(3, "Alex")).toBe("Hello, Alex!");
    expect(greeting(20, "Alex")).toBe("Good evening, Alex!");
    expect(todaySummary(0, 0, 0).join("")).toBe("There is nothing on for you today.");
    expect(todaySummary(0, 0, 2).join("")).toBe("Today, everything is done. Well done!");
    expect(todaySummary(1, 0, 0).join("")).toBe("There is 1 task on for you today.");
    expect(todaySummary(1, 1, 0).join("")).toBe("There is 1 task on for you today. It is overdue.");
    expect(todaySummary(3, 3, 0).join("")).toBe(
      "There are 3 tasks on for you today. All of them are overdue.",
    );
    expect(todaySummary(3, 1, 0).join("")).toBe(
      "There are 3 tasks on for you today. One of them is overdue.",
    );
    expect(todaySummary(4, 2, 0).join("")).toBe(
      "There are 4 tasks on for you today. 2 of them are overdue.",
    );
  });

  it("Tagesfelder für Screenreader", () => {
    const view = (dueCount: number, doneCount: number, isToday = false) => ({
      day: day("2026-10-20"),
      isToday,
      entries: [],
      dueCount,
      doneCount,
    });
    expect(dayField(view(0, 0)).label).toBe("Tuesday, free");
    expect(dayField(view(0, 0, true)).label).toBe("Tuesday, today, free");
    expect(dayField(view(3, 1, true)).label).toBe("Tuesday, today, 1 of 3 done");
    expect(dayField(view(2, 2)).label).toBe("Tuesday, all done");
    expect(dayField(view(3, 1)).label).toBe("Tuesday, 2 tasks open, 1 done");
    expect(dayField(view(1, 0)).label).toBe("Tuesday, 1 task");
  });

  it("Zeitraum, Vergleich, Serie, Teamwork und Diagramm", () => {
    expect(describePeriod("week", { start: day("2026-10-19"), end: day("2026-10-25") })).toBe(
      "Week 43",
    );
    expect(describePeriod("month", { start: day("2026-10-01"), end: day("2026-10-31") })).toBe(
      "October 2026",
    );
    expect(describeComparison("week", 9, 3)).toBe("6 more than the week before");
    expect(describeComparison("month", 1, 4)).toBe("3 fewer than the month before");
    expect(describeComparison("year", 5, 5)).toBe("the same as the year before");
    expect(describeStreak(0)).toBeUndefined();
    expect(describeStreak(1)).toBe("1 week all done");
    expect(describeStreak(4)).toBe("4 weeks in a row");
    expect(describeTakenOver(0)).toBe("So far nobody has taken over for the other person.");
    expect(describeTakenOver(1)).toBe("You took over for each other once.");
    expect(describeTakenOver(5)).toBe("You took over for each other 5 times.");
    expect(describeTeamwork({ personA: 21, personB: 1 }, names)).toBe(
      "Alex 21 tasks, Robin 1 task",
    );
    expect(
      describeBars(
        [
          { start: day("2026-10-19"), count: 7 },
          { start: day("2026-10-20"), count: 5 },
        ],
        "week",
      ),
    ).toBe("Done per day: Monday 7, Tuesday 5");
    expect(describeBars([{ start: day("2026-10-01"), count: 2 }], "year")).toBe(
      "Done per month: October 2",
    );
  });
});
