// Cases of the daily overview (NT-c). Pure data: Vitest checks them against `notificationPlan.ts`
// (notificationPlan.test.ts), the job `db` against the SQL of the schedule
// (supabase/tests/schedule.test.ts), so the rules on device and server cannot drift apart.
//
// Daylight saving time 2027: Berlin from Sunday 28 March 01:00 UTC to Sunday 31 October 01:00 UTC
// (UTC+2, else UTC+1); New York from 14 March to 7 November (UTC−4, else UTC−5); Tokyo always
// UTC+9. 13 January 2027 is a Wednesday.

import { calendarDay } from "./date";
import type { Assignee, OneOffTask, Person, RecurringTask, Task } from "./task";

/** Monday (1) to Sunday (64): all seven bits of `dailyDays`. */
const ALL_DAYS = 127;

export interface DailyCase {
  readonly name: string;
  /** The moment, in UTC. */
  readonly now: string;
  readonly timeZone: string;
  readonly dailyEnabled: boolean;
  readonly dailyTime: string;
  readonly dailyDays: number;
  readonly lastDailyOn: string | null;
  /** The local day the overview is due for, or `null`. */
  readonly expected: string | null;
}

const daily = (
  name: string,
  now: string,
  expected: string | null,
  overrides: Partial<Omit<DailyCase, "name" | "now" | "expected">> = {},
): DailyCase => ({
  name,
  now,
  timeZone: "Europe/Berlin",
  dailyEnabled: true,
  dailyTime: "07:30",
  dailyDays: ALL_DAYS,
  lastDailyOn: null,
  expected,
  ...overrides,
});

const NEW_YORK = { timeZone: "America/New_York" } as const;
const TOKYO = { timeZone: "Asia/Tokyo" } as const;

export const DAILY_CASES: readonly DailyCase[] = [
  daily("Winterzeit: 07:30 in Berlin ist 06:30 UTC", "2027-01-13T06:30:00Z", "2027-01-13"),
  daily("Eine Minute vor der Uhrzeit noch nicht", "2027-01-13T06:29:00Z", null),
  daily("Sekunden zählen nicht: 07:30:59 ist 07:30", "2027-01-13T06:30:59Z", "2027-01-13"),
  daily("Sekunden zählen nicht: 07:29:59 ist 07:29", "2027-01-13T06:29:59Z", null),
  daily("Sommerzeit: 07:30 in Berlin ist 05:30 UTC", "2027-06-16T05:30:00Z", "2027-06-16"),
  daily("Sommerzeit: um 04:30 UTC ist es in Berlin erst 06:30", "2027-06-16T04:30:00Z", null),
  daily("Am selben Ortstag nur einmal", "2027-06-16T05:31:00Z", null, {
    lastDailyOn: "2027-06-16",
  }),
  daily("Am nächsten Ortstag wieder", "2027-06-17T05:30:00Z", "2027-06-17", {
    lastDailyOn: "2027-06-16",
  }),
  daily("Bis knapp zwei Stunden später nachgeholt", "2027-06-16T07:29:00Z", "2027-06-16"),
  daily("Zwei Stunden später nicht mehr", "2027-06-16T07:30:00Z", null),
  daily("Wochentage: nur Montag gewählt, heute ist Mittwoch", "2027-01-13T06:30:00Z", null, {
    dailyDays: 1,
  }),
  daily("Wochentage: nur Montag gewählt, heute ist Montag", "2027-01-11T06:30:00Z", "2027-01-11", {
    dailyDays: 1,
  }),
  daily("Wochentage: Sonntag ist das letzte Bit (64)", "2027-01-17T06:30:00Z", "2027-01-17", {
    dailyDays: 64,
  }),
  daily(
    "Wochentag nach Ortszeit: in Tokio ist schon Montag, in UTC noch Sonntag",
    "2027-01-10T22:30:00Z",
    "2027-01-11",
    { ...TOKYO, dailyDays: 1 },
  ),
  daily("New York: 07:30 Winterzeit ist 12:30 UTC", "2027-01-13T12:30:00Z", "2027-01-13", NEW_YORK),
  daily("New York: um 06:30 UTC ist dort Nacht", "2027-01-13T06:30:00Z", null, NEW_YORK),
  daily("Zeitumstellung vor: 01:59, die Uhrzeit 02:30 kommt noch", "2027-03-28T00:59:00Z", null, {
    dailyTime: "02:30",
  }),
  daily(
    "Zeitumstellung vor: 02:30 gibt es nicht, der Überblick kommt um 03:00",
    "2027-03-28T01:00:00Z",
    "2027-03-28",
    { dailyTime: "02:30" },
  ),
  daily(
    "Zeitumstellung zurück: das erste 02:30 bringt den Überblick",
    "2027-10-31T00:30:00Z",
    "2027-10-31",
    { dailyTime: "02:30" },
  ),
  daily("Zeitumstellung zurück: das zweite 02:30 nicht noch einmal", "2027-10-31T01:30:00Z", null, {
    dailyTime: "02:30",
    lastDailyOn: "2027-10-31",
  }),
  daily(
    "Tag der Zeitumstellung zurück: 07:30 ist schon Winterzeit (06:30 UTC)",
    "2027-10-31T06:30:00Z",
    "2027-10-31",
    { lastDailyOn: "2027-10-30" },
  ),
  daily(
    "Tag der Zeitumstellung zurück: um 05:30 UTC ist es erst 06:30",
    "2027-10-31T05:30:00Z",
    null,
    { lastDailyOn: "2027-10-30" },
  ),
  daily("Ausgeschaltet: nie", "2027-01-13T06:30:00Z", null, { dailyEnabled: false }),
  daily("Unbekannte Zeitzone zählt als Berlin", "2027-01-13T06:30:00Z", "2027-01-13", {
    timeZone: "Mars/Olymp",
  }),
  daily(
    "Reise nach Osten: in Tokio ist schon der nächste Ortstag",
    "2027-01-13T22:30:00Z",
    "2027-01-14",
    { ...TOKYO, lastDailyOn: "2027-01-13" },
  ),
  daily(
    "Reise nach Westen: in New York derselbe Ortstag, kein zweites Mal",
    "2027-01-13T12:30:00Z",
    null,
    { ...NEW_YORK, lastDailyOn: "2027-01-13" },
  ),
  daily("Uhrzeit 00:00", "2027-01-12T23:00:00Z", "2027-01-13", { dailyTime: "00:00" }),
  daily("Uhrzeit 23:59", "2027-01-13T22:59:00Z", "2027-01-13", { dailyTime: "23:59" }),
];

export interface QuietCase {
  readonly time: string;
  readonly from: string;
  readonly to: string;
  readonly quiet: boolean;
}

const quiet = (from: string, to: string, times: Record<string, boolean>): QuietCase[] =>
  Object.entries(times).map(([time, isQuiet]) => ({ time, from, to, quiet: isQuiet }));

export const QUIET_CASES: readonly QuietCase[] = [
  // The default, over midnight.
  ...quiet("21:00", "07:00", {
    "20:59": false,
    "21:00": true,
    "23:59": true,
    "00:00": true,
    "06:59": true,
    "07:00": false,
    "12:00": false,
  }),
  // Within one day.
  ...quiet("13:00", "15:00", { "12:59": false, "13:00": true, "14:59": true, "15:00": false }),
  // One minute before midnight to midnight.
  ...quiet("23:59", "00:00", { "23:58": false, "23:59": true, "00:00": false }),
  // Equal ends are no quiet hours.
  ...quiet("08:00", "08:00", { "08:00": false, "12:00": false }),
];

let taskNumber = 0;

function recurring(dueDate: string, assignee: Assignee, takenOverBy?: Person): RecurringTask {
  taskNumber++;
  return {
    kind: "recurring",
    id: `fall-${taskNumber}`,
    title: `Aufgabe ${taskNumber}`,
    symbol: "standard",
    recurrence: { unit: "week", interval: 1 },
    assignee,
    dueDate: calendarDay(dueDate),
    checklist: [],
    ...(takenOverBy === undefined ? {} : { takenOverBy }),
  };
}

function oneOff(dueDate: string, assignee: Assignee, done: boolean): OneOffTask {
  taskNumber++;
  return {
    kind: "oneOff",
    id: `fall-${taskNumber}`,
    title: `Aufgabe ${taskNumber}`,
    symbol: "standard",
    assignee,
    dueDate: calendarDay(dueDate),
    done,
    checklist: [],
  };
}

export interface CountCase {
  readonly name: string;
  readonly tasks: readonly Task[];
  readonly person: Person;
  readonly today: string;
  readonly due: number;
  readonly overdue: number;
}

const TODAY = "2027-01-13";
const YESTERDAY = "2027-01-12";
const TOMORROW = "2027-01-14";

const count = (
  name: string,
  tasks: readonly Task[],
  person: Person,
  due: number,
  overdue: number,
): CountCase => ({ name, tasks, person, today: TODAY, due, overdue });

export const COUNT_CASES: readonly CountCase[] = [
  count("Heute fällig zählt", [recurring(TODAY, "personA")], "personA", 1, 0),
  count("Gestern fällig zählt als überfällig", [recurring(YESTERDAY, "personA")], "personA", 1, 1),
  count("Morgen fällig zählt nicht", [recurring(TOMORROW, "personA")], "personA", 0, 0),
  count("Aufgabe der anderen Person zählt nicht", [recurring(TODAY, "personB")], "personA", 0, 0),
  count("„Beide“ zählt für Person A", [recurring(TODAY, "both")], "personA", 1, 0),
  count("„Beide“ zählt für Person B", [recurring(YESTERDAY, "both")], "personB", 1, 1),
  count(
    "Übernommen (nur dieses Mal) zählt für die übernehmende Person",
    [recurring(TODAY, "personB", "personA")],
    "personA",
    1,
    0,
  ),
  count(
    "Übernommen zählt nicht mehr für die fest zuständige Person",
    [recurring(TODAY, "personB", "personA")],
    "personB",
    0,
    0,
  ),
  count(
    "Eine von „beide“ übernommene Aufgabe zählt nur für die übernehmende Person",
    [recurring(TODAY, "both", "personB")],
    "personA",
    0,
    0,
  ),
  count(
    "Einmalig, offen und überfällig zählt",
    [oneOff(YESTERDAY, "personA", false)],
    "personA",
    1,
    1,
  ),
  count("Einmalig und erledigt zählt nicht", [oneOff(YESTERDAY, "personA", true)], "personA", 0, 0),
  count(
    "Alles zusammen",
    [
      recurring(TODAY, "personA"),
      recurring("2026-12-01", "both"),
      recurring(YESTERDAY, "personB", "personA"),
      recurring(TODAY, "personB"),
      recurring(TOMORROW, "personA"),
      oneOff(TODAY, "both", false),
      oneOff("2027-01-01", "personA", true),
    ],
    "personA",
    4,
    2,
  ),
  count("Keine Aufgaben", [], "personA", 0, 0),
];

// Messages about the other person (NT-d) ----------------------------------------------------------

export interface PartnerCompletionCase {
  readonly name: string;
  readonly completion: {
    readonly completedBy: Person;
    readonly assigneeAtCompletion?: Assignee;
    readonly completedAt?: string;
  };
  /** Whose device ticked it off (the signed-in person of the change). */
  readonly actor: Person;
  readonly recipient: Person;
  /** When it reached the server. */
  readonly arrivedAt: string;
  readonly expected: boolean;
}

const ARRIVED = "2027-01-13T10:00:00.000Z";

/** `undefined` leaves the field out (old data). */
type CompletionChange = {
  readonly [Key in keyof PartnerCompletionCase["completion"]]?:
    | PartnerCompletionCase["completion"][Key]
    | undefined;
};

const completed = (
  name: string,
  expected: boolean,
  completion: CompletionChange = {},
  overrides: Partial<Omit<PartnerCompletionCase, "name" | "completion" | "expected">> = {},
): PartnerCompletionCase => ({
  name,
  completion: Object.fromEntries(
    Object.entries({
      completedBy: "personB",
      assigneeAtCompletion: "personA",
      completedAt: "2027-01-13T09:58:00.000Z",
      ...completion,
    }).filter(([, value]) => value !== undefined),
  ) as PartnerCompletionCase["completion"],
  actor: "personB",
  recipient: "personA",
  arrivedAt: ARRIVED,
  expected,
  ...overrides,
});

export const PARTNER_COMPLETION_CASES: readonly PartnerCompletionCase[] = [
  completed("B erledigt eine Aufgabe von A: Meldung an A", true),
  completed("B erledigt eine gemeinsame Aufgabe: Meldung an A", true, {
    assigneeAtCompletion: "both",
  }),
  completed("B erledigt die eigene Aufgabe: keine Meldung", false, {
    assigneeAtCompletion: "personB",
  }),
  completed(
    "A erledigt die eigene Aufgabe: keine Meldung an sich selbst",
    false,
    {
      completedBy: "personA",
    },
    { actor: "personA" },
  ),
  completed(
    "Nie an sich selbst, auch bei „beide“",
    false,
    {
      completedBy: "personA",
      assigneeAtCompletion: "both",
    },
    { actor: "personA", recipient: "personA" },
  ),
  completed("Abgehakt im Namen der anderen Person (anderes Gerät): keine Meldung", false, {
    completedBy: "personA",
  }),
  completed("Ohne Zuständigkeit (alte Daten): keine Meldung", false, {
    assigneeAtCompletion: undefined,
  }),
  completed("Ohne Zeitpunkt: keine Meldung", false, { completedAt: undefined }),
  completed("Unlesbarer Zeitpunkt: keine Meldung", false, { completedAt: "gestern" }),
  completed("Nach dem Abgleich: vor 23 Stunden abgehakt zählt noch", true, {
    completedAt: "2027-01-12T11:00:00.000Z",
  }),
  completed("Genau 24 Stunden alt zählt noch", true, { completedAt: "2027-01-12T10:00:00.000Z" }),
  completed("Älter als 24 Stunden: keine Meldung (nach dem Urlaub keine Flut)", false, {
    completedAt: "2027-01-12T09:59:00.000Z",
  }),
];

export interface TakeOverCase {
  readonly name: string;
  readonly before: Task;
  readonly after: Task;
  readonly actor: Person;
  readonly recipient: Person;
  readonly expected: boolean;
}

const takeOver = (
  name: string,
  before: Task,
  after: Task,
  expected: boolean,
  actor: Person = "personB",
): TakeOverCase => ({ name, before, after, actor, recipient: "personA", expected });

const weekly = recurring(TODAY, "personA");

export const TAKE_OVER_CASES: readonly TakeOverCase[] = [
  takeOver(
    "B übernimmt nur dieses Mal: Meldung an A",
    weekly,
    { ...weekly, takenOverBy: "personB" },
    true,
  ),
  takeOver("B übernimmt dauerhaft: Meldung an A", weekly, { ...weekly, assignee: "personB" }, true),
  takeOver(
    "B übernimmt eine gemeinsame Aufgabe: Meldung an A",
    recurring(TODAY, "both"),
    { ...recurring(TODAY, "both"), takenOverBy: "personB" },
    true,
  ),
  takeOver(
    "B übernimmt eine einmalige Aufgabe von A: Meldung an A",
    oneOff(TODAY, "personA", false),
    { ...oneOff(TODAY, "personA", false), assignee: "personB" },
    true,
  ),
  takeOver(
    "A gibt die eigene Aufgabe an B ab: keine Meldung (A hat es selbst getan)",
    weekly,
    { ...weekly, assignee: "personB" },
    false,
    "personA",
  ),
  takeOver("B ändert nur den Titel: keine Meldung", weekly, { ...weekly, title: "Neu" }, false),
  takeOver(
    "B gibt eine übernommene Aufgabe zurück: keine Meldung",
    { ...weekly, takenOverBy: "personB" },
    weekly,
    false,
  ),
  takeOver(
    "Aufgabe gehörte schon B: keine Meldung",
    recurring(TODAY, "personB"),
    { ...recurring(TODAY, "personB"), title: "Neu" },
    false,
  ),
  takeOver(
    "B macht eine Aufgabe von A zu „beide“: keine Meldung",
    weekly,
    { ...weekly, assignee: "both" },
    false,
  ),
];

export interface QuietEndCase {
  readonly name: string;
  readonly now: string;
  readonly timeZone: string;
  readonly quietEnabled: boolean;
  readonly quietFrom: string;
  readonly quietTo: string;
  /** When the quiet hours end, in UTC, or `null` if `now` is not in them. */
  readonly expected: string | null;
}

const quietEnd = (
  name: string,
  now: string,
  expected: string | null,
  overrides: Partial<Omit<QuietEndCase, "name" | "now" | "expected">> = {},
): QuietEndCase => ({
  name,
  now,
  timeZone: "Europe/Berlin",
  quietEnabled: true,
  quietFrom: "21:00",
  quietTo: "07:00",
  expected,
  ...overrides,
});

export const QUIET_END_CASES: readonly QuietEndCase[] = [
  quietEnd("Tagsüber keine Ruhezeit", "2027-01-13T11:00:00Z", null),
  quietEnd("22 Uhr: bis 7 Uhr am nächsten Morgen", "2027-01-13T21:00:00Z", "2027-01-14T06:00:00Z"),
  quietEnd("3 Uhr nachts: bis 7 Uhr am selben Tag", "2027-01-14T02:00:00Z", "2027-01-14T06:00:00Z"),
  quietEnd("Beginn zählt dazu: genau 21 Uhr", "2027-01-13T20:00:00Z", "2027-01-14T06:00:00Z"),
  quietEnd("Ende zählt nicht dazu: genau 7 Uhr", "2027-01-14T06:00:00Z", null),
  quietEnd("Sommerzeit: 7 Uhr ist 05:00 UTC", "2027-06-16T21:00:00Z", "2027-06-17T05:00:00Z"),
  quietEnd(
    "Über die Zeitumstellung: Ende nach Ortszeit (Winterzeit beginnt in der Nacht)",
    "2027-10-30T21:00:00Z",
    "2027-10-31T06:00:00Z",
  ),
  quietEnd("Ruhezeit ausgeschaltet", "2027-01-13T21:00:00Z", null, { quietEnabled: false }),
  quietEnd("Ruhezeit am Tag", "2027-01-13T12:30:00Z", "2027-01-13T14:00:00Z", {
    quietFrom: "13:00",
    quietTo: "15:00",
  }),
  quietEnd("New York: 7 Uhr dort", "2027-01-14T03:00:00Z", "2027-01-14T12:00:00Z", {
    timeZone: "America/New_York",
  }),
  quietEnd("Unbekannte Zeitzone zählt als Berlin", "2027-01-13T21:00:00Z", "2027-01-14T06:00:00Z", {
    timeZone: "Mars/Olymp",
  }),
];
