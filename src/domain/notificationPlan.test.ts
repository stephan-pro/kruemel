import { describe, expect, it } from "vitest";
import { calendarDay } from "./date";
import {
  dailyOverviewDay,
  isPartnerCompletion,
  isQuietTime,
  isTakeOver,
  localMoment,
  myDueCounts,
  type PartnerEvent,
  partnerMessages,
  quietEnd,
} from "./notificationPlan";
import {
  COUNT_CASES,
  DAILY_CASES,
  PARTNER_COMPLETION_CASES,
  QUIET_CASES,
  QUIET_END_CASES,
  TAKE_OVER_CASES,
} from "./notificationPlan.cases";

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

// NT-d: the messages about the other person. The cases of what counts and of the quiet hours run
// against the SQL as well (supabase/tests/partner.test.ts); bundling is checked here with a fixed
// clock and in the database with its own scenarios.

describe("NT-d Meldungen über die andere Person: was zählt", () => {
  it("NT-d Erledigt: nur von der anderen Person, für mich oder beide, höchstens 24 Stunden alt (gemeinsame Fälle)", () => {
    for (const example of PARTNER_COMPLETION_CASES) {
      expect(
        isPartnerCompletion(
          example.completion,
          example.actor,
          example.recipient,
          Date.parse(example.arrivedAt),
        ),
        example.name,
      ).toBe(example.expected);
    }
  });

  it("NT-d Übernommen: nur dieses Mal oder dauerhaft, von mir oder von beiden, nur durch die andere Person (gemeinsame Fälle)", () => {
    for (const example of TAKE_OVER_CASES) {
      expect(
        isTakeOver(example.before, example.after, example.actor, example.recipient),
        example.name,
      ).toBe(example.expected);
    }
  });
});

describe("NT-d Ruhezeit hält Meldungen zurück", () => {
  it("NT-d Ende der Ruhezeit nach Ortszeit, über Mitternacht und Zeitumstellung (gemeinsame Fälle)", () => {
    for (const example of QUIET_END_CASES) {
      const end = quietEnd(Date.parse(example.now), example.timeZone, example);
      expect(end === null ? null : new Date(end).toISOString(), example.name).toBe(
        example.expected === null ? null : new Date(example.expected).toISOString(),
      );
    }
  });
});

describe("NT-d Bündeln nach 5 Minuten", () => {
  const BERLIN = "Europe/Berlin";
  const QUIET = { quietEnabled: true, quietFrom: "21:00", quietTo: "07:00" };
  /** Wednesday 13 January 2027, Berlin (UTC+1): `minute` minutes after 10:00 local time. */
  const at = (minute: number) => Date.parse("2027-01-13T09:00:00Z") + minute * 60_000;
  const done = (id: string, minute: number, goneMinute?: number): PartnerEvent => ({
    kind: "done",
    id,
    at: at(minute),
    ...(goneMinute === undefined ? {} : { goneAt: at(goneMinute) }),
  });
  const took = (id: string, minute: number): PartnerEvent => ({
    kind: "tookOver",
    id,
    at: at(minute),
  });

  it("NT-d Mehrere Ereignisse innerhalb von 5 Minuten werden eine Meldung, danach beginnt eine neue", () => {
    expect(
      partnerMessages(
        [done("e1", 0), done("e2", 2), took("t1", 4), done("e3", 5), done("e4", 6)],
        BERLIN,
        QUIET,
      ),
    ).toEqual([
      { at: at(5), done: 3, took: 1 },
      { at: at(11), done: 1, took: 0 },
    ]);
    expect(partnerMessages([done("e1", 3)], BERLIN, QUIET)).toEqual([
      { at: at(8), done: 1, took: 0 },
    ]);
    expect(partnerMessages([], BERLIN, QUIET)).toEqual([]);
  });

  it("NT-d Rückgängig innerhalb der Frist: das Ereignis zählt nicht, ohne anderes keine Meldung", () => {
    expect(partnerMessages([done("e1", 0, 3)], BERLIN, QUIET)).toEqual([]);
    expect(partnerMessages([done("e1", 0, 3), done("e2", 1)], BERLIN, QUIET)).toEqual([
      { at: at(5), done: 1, took: 0 },
    ]);
    // Undone after the message went: it was sent, there is no correction.
    expect(partnerMessages([done("e1", 0, 9)], BERLIN, QUIET)).toEqual([
      { at: at(5), done: 1, took: 0 },
    ]);
  });

  it("NT-d Doppelte: dieselbe Erledigung oder Aufgabe zählt einmal", () => {
    expect(
      partnerMessages([done("e1", 0), done("e1", 1), took("t1", 1), took("t1", 2)], BERLIN, QUIET),
    ).toEqual([{ at: at(5), done: 1, took: 1 }]);
  });

  it("NT-d Ruhezeit: zurückgehalten und am Ende einmal gesammelt gesendet", () => {
    // 20:58 local; the message would go at 21:03, in the quiet hours: all of the night at 07:00.
    const evening = 10 * 60 + 58;
    const night = [done("e1", evening), done("e2", evening + 30), took("t1", evening + 600)];
    expect(partnerMessages(night, BERLIN, QUIET)).toEqual([
      { at: Date.parse("2027-01-14T06:00:00Z"), done: 2, took: 1 },
    ]);
    // Without quiet hours, three messages.
    expect(partnerMessages(night, BERLIN, { ...QUIET, quietEnabled: false })).toHaveLength(3);
  });
});
