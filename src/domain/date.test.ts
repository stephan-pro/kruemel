import { describe, expect, it } from "vitest";
import {
  addDays,
  addMonths,
  addWeeks,
  calendarDay,
  compareDays,
  dayFromDate,
  daysBetween,
  isCalendarDay,
  isoWeek,
  startOfWeek,
  weekDays,
  weekdayOf,
} from "./date";

const d = calendarDay;

describe("Kalendertag prüfen und erzeugen", () => {
  it("erkennt gültige Tage", () => {
    expect(isCalendarDay("2026-10-19")).toBe(true);
    expect(isCalendarDay("2024-02-29")).toBe(true);
    expect(isCalendarDay("0001-01-01")).toBe(true);
    expect(isCalendarDay("9999-12-31")).toBe(true);
  });

  it("lehnt nicht existierende Tage ab", () => {
    expect(isCalendarDay("2026-02-29")).toBe(false);
    expect(isCalendarDay("2026-02-30")).toBe(false);
    expect(isCalendarDay("2026-04-31")).toBe(false);
    expect(isCalendarDay("2026-13-01")).toBe(false);
    expect(isCalendarDay("2026-00-10")).toBe(false);
    expect(isCalendarDay("2026-10-00")).toBe(false);
    expect(isCalendarDay("0000-01-01")).toBe(false);
  });

  it("lehnt falsche Schreibweisen und Nicht-Texte ab", () => {
    expect(isCalendarDay("2026-1-5")).toBe(false);
    expect(isCalendarDay("19.10.2026")).toBe(false);
    expect(isCalendarDay("2026-10-19T00:00")).toBe(false);
    expect(isCalendarDay("")).toBe(false);
    expect(isCalendarDay(null)).toBe(false);
    expect(isCalendarDay(20261019)).toBe(false);
  });

  it("calendarDay gibt gültige Tage zurück und wirft bei ungültigen", () => {
    expect(calendarDay("2026-10-19")).toBe("2026-10-19");
    expect(() => calendarDay("2026-02-30")).toThrow(RangeError);
  });

  it("dayFromDate nimmt den lokalen Kalendertag", () => {
    expect(dayFromDate(new Date(2026, 9, 19, 23, 59))).toBe("2026-10-19");
    expect(dayFromDate(new Date(2026, 0, 1, 0, 0))).toBe("2026-01-01");
    expect(dayFromDate(new Date(2024, 1, 29, 12, 0))).toBe("2024-02-29");
  });
});

describe("Tage vergleichen", () => {
  it("compareDays ordnet chronologisch", () => {
    expect(compareDays(d("2026-10-19"), d("2026-10-20"))).toBe(-1);
    expect(compareDays(d("2026-10-20"), d("2026-10-19"))).toBe(1);
    expect(compareDays(d("2026-10-19"), d("2026-10-19"))).toBe(0);
    expect(compareDays(d("2025-12-31"), d("2026-01-01"))).toBe(-1);
  });

  it("daysBetween zählt die Tage dazwischen", () => {
    expect(daysBetween(d("2026-10-19"), d("2026-10-19"))).toBe(0);
    expect(daysBetween(d("2026-10-19"), d("2026-10-28"))).toBe(9);
    expect(daysBetween(d("2026-10-28"), d("2026-10-19"))).toBe(-9);
    expect(daysBetween(d("2024-02-28"), d("2024-03-01"))).toBe(2);
    expect(daysBetween(d("2026-03-28"), d("2026-03-30"))).toBe(2); // Zeitumstellung
  });
});

describe("Tage addieren", () => {
  it("addDays über Monats- und Jahresgrenzen", () => {
    expect(addDays(d("2026-10-21"), 1)).toBe("2026-10-22");
    expect(addDays(d("2026-10-31"), 1)).toBe("2026-11-01");
    expect(addDays(d("2026-12-31"), 1)).toBe("2027-01-01");
    expect(addDays(d("2026-01-01"), -1)).toBe("2025-12-31");
    expect(addDays(d("2026-10-19"), 0)).toBe("2026-10-19");
  });

  it("addDays kennt Schaltjahre", () => {
    expect(addDays(d("2024-02-28"), 1)).toBe("2024-02-29");
    expect(addDays(d("2024-02-29"), 1)).toBe("2024-03-01");
    expect(addDays(d("2026-02-28"), 1)).toBe("2026-03-01");
    expect(addDays(d("2100-02-28"), 1)).toBe("2100-03-01");
    expect(addDays(d("2000-02-28"), 1)).toBe("2000-02-29");
  });

  it("addDays ändert sich nicht bei der Zeitumstellung", () => {
    expect(addDays(d("2026-03-28"), 1)).toBe("2026-03-29");
    expect(addDays(d("2026-03-29"), 1)).toBe("2026-03-30");
    expect(addDays(d("2026-10-24"), 2)).toBe("2026-10-26");
  });

  it("addDays wirft außerhalb des Jahresbereichs 1 bis 9999", () => {
    expect(() => addDays(d("9999-12-31"), 1)).toThrow(RangeError);
    expect(() => addDays(d("0001-01-01"), -1)).toThrow(RangeError);
  });

  it("addDays funktioniert für Jahre vor 100", () => {
    expect(addDays(d("0050-12-31"), 1)).toBe("0051-01-01");
  });

  it("addWeeks addiert Vielfache von sieben Tagen", () => {
    expect(addWeeks(d("2026-10-19"), 1)).toBe("2026-10-26");
    expect(addWeeks(d("2026-10-21"), 1)).toBe("2026-10-28");
    expect(addWeeks(d("2026-10-21"), 2)).toBe("2026-11-04");
    expect(addWeeks(d("2026-10-19"), -1)).toBe("2026-10-12");
    expect(addWeeks(d("2026-12-28"), 1)).toBe("2027-01-04");
  });
});

describe("Monate addieren (Monatsende-Regel)", () => {
  it("addMonths behält den Tag im Monat", () => {
    expect(addMonths(d("2026-10-15"), 1)).toBe("2026-11-15");
    expect(addMonths(d("2026-10-15"), 3)).toBe("2027-01-15");
    expect(addMonths(d("2026-10-15"), 12)).toBe("2027-10-15");
    expect(addMonths(d("2026-10-15"), 0)).toBe("2026-10-15");
  });

  it("addMonths kürzt auf den letzten Tag kürzerer Monate (31. Januar + 1 Monat = letzter Februartag)", () => {
    expect(addMonths(d("2026-01-31"), 1)).toBe("2026-02-28");
    expect(addMonths(d("2024-01-31"), 1)).toBe("2024-02-29");
    expect(addMonths(d("2026-03-31"), 1)).toBe("2026-04-30");
    expect(addMonths(d("2026-01-30"), 1)).toBe("2026-02-28");
    expect(addMonths(d("2026-01-29"), 1)).toBe("2026-02-28");
    expect(addMonths(d("2024-01-29"), 1)).toBe("2024-02-29");
    expect(addMonths(d("2024-02-29"), 12)).toBe("2025-02-28");
    expect(addMonths(d("2024-02-29"), 48)).toBe("2028-02-29");
  });

  it("addMonths über die Jahresgrenze und rückwärts", () => {
    expect(addMonths(d("2026-12-15"), 1)).toBe("2027-01-15");
    expect(addMonths(d("2026-01-15"), -1)).toBe("2025-12-15");
    expect(addMonths(d("2026-03-31"), -1)).toBe("2026-02-28");
    expect(addMonths(d("2026-01-31"), -13)).toBe("2024-12-31");
  });

  it("addMonths wirft außerhalb des Jahresbereichs", () => {
    expect(() => addMonths(d("9999-12-01"), 1)).toThrow(RangeError);
  });
});

describe("Wochen: Beginn am Montag", () => {
  it("weekdayOf zählt Montag = 0 bis Sonntag = 6", () => {
    expect(weekdayOf(d("2026-10-19"))).toBe(0); // Montag
    expect(weekdayOf(d("2026-10-20"))).toBe(1);
    expect(weekdayOf(d("2026-10-21"))).toBe(2);
    expect(weekdayOf(d("2026-10-22"))).toBe(3);
    expect(weekdayOf(d("2026-10-23"))).toBe(4);
    expect(weekdayOf(d("2026-10-24"))).toBe(5);
    expect(weekdayOf(d("2026-10-25"))).toBe(6); // Sonntag
  });

  it("startOfWeek liefert den Montag der Woche", () => {
    expect(startOfWeek(d("2026-10-19"))).toBe("2026-10-19");
    expect(startOfWeek(d("2026-10-21"))).toBe("2026-10-19");
    expect(startOfWeek(d("2026-10-25"))).toBe("2026-10-19");
    expect(startOfWeek(d("2026-10-26"))).toBe("2026-10-26");
  });

  it("startOfWeek und weekDays über Monats- und Jahresgrenzen", () => {
    expect(startOfWeek(d("2027-01-01"))).toBe("2026-12-28");
    expect(startOfWeek(d("2026-11-01"))).toBe("2026-10-26");
    const days = weekDays(d("2026-12-31"));
    expect(days[0]).toBe("2026-12-28");
    expect(days[6]).toBe("2027-01-03");
  });

  it("weekDays liefert Montag bis Sonntag", () => {
    expect(weekDays(d("2026-10-21"))).toEqual([
      "2026-10-19",
      "2026-10-20",
      "2026-10-21",
      "2026-10-22",
      "2026-10-23",
      "2026-10-24",
      "2026-10-25",
    ]);
  });

  it("isoWeek liefert die Kalenderwoche wie im deutschen Kalender", () => {
    expect(isoWeek(d("2026-10-19"))).toBe(43);
    expect(isoWeek(d("2026-10-25"))).toBe(43);
    expect(isoWeek(d("2026-10-26"))).toBe(44);
    expect(isoWeek(d("2026-01-01"))).toBe(1);
  });

  it("isoWeek über den Jahreswechsel: KW 53 und KW 1 im Nachbarjahr", () => {
    expect(isoWeek(d("2026-12-28"))).toBe(53);
    expect(isoWeek(d("2027-01-03"))).toBe(53);
    expect(isoWeek(d("2027-01-04"))).toBe(1);
    expect(isoWeek(d("2024-12-30"))).toBe(1);
    expect(isoWeek(d("2021-01-03"))).toBe(53);
  });
});
