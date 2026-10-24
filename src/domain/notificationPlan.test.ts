import { describe, expect, it } from "vitest";
import { calendarDay } from "./date";
import { dailyOverviewDay, isQuietTime, localMoment, myDueCounts } from "./notificationPlan";
import { COUNT_CASES, DAILY_CASES, QUIET_CASES } from "./notificationPlan.cases";

// NT-c: the rules of the daily overview with a fixed clock (every moment is a parameter). The same
// cases run against the SQL of the schedule in the job `db` (supabase/tests/schedule.test.ts).

describe("NT-c Tagesüberblick: wann ist ein Gerät dran", () => {
  it("NT-c Uhrzeit minutengenau in der Zeitzone des Geräts, Wochentage, Zeitumstellung, Reisen (gemeinsame Fälle)", () => {
    for (const example of DAILY_CASES) {
      const lastDailyOn = example.lastDailyOn === null ? null : calendarDay(example.lastDailyOn);
      expect(
        dailyOverviewDay(Date.parse(example.now), example.timeZone, example, lastDailyOn),
        example.name,
      ).toBe(example.expected);
    }
  });

  it("NT-c Ortszeit: Tag, Uhrzeit und Wochentag nach der Uhr der Zeitzone, unbekannte Zone wie Berlin", () => {
    const moment = Date.parse("2027-01-10T22:30:00Z");
    expect(localMoment(moment, "Asia/Tokyo")).toEqual({
      day: "2027-01-11",
      time: "07:30",
      weekday: 0,
    });
    expect(localMoment(moment, "America/New_York")).toEqual({
      day: "2027-01-10",
      time: "17:30",
      weekday: 6,
    });
    expect(localMoment(moment, "")).toEqual(localMoment(moment, "Europe/Berlin"));
    expect(localMoment(Date.parse("2027-01-12T23:00:00Z"), "Europe/Berlin").time).toBe("00:00");
  });
});

describe("NT-c Ruhezeit", () => {
  it("NT-c Ruhezeit mit Beginn und Ende, auch über Mitternacht (gemeinsame Fälle)", () => {
    for (const example of QUIET_CASES) {
      expect(
        isQuietTime(example.time, example.from, example.to),
        `${example.time} in ${example.from}–${example.to}`,
      ).toBe(example.quiet);
    }
  });
});

describe("NT-c Tagesüberblick: was gezählt wird", () => {
  it("NT-c Heute fällig und überfällig, nur eigene und gemeinsame Aufgaben, Übernahme, erledigte zählen nicht (gemeinsame Fälle)", () => {
    for (const example of COUNT_CASES) {
      expect(
        myDueCounts(example.tasks, example.person, calendarDay(example.today)),
        example.name,
      ).toEqual({ due: example.due, overdue: example.overdue });
    }
  });
});
