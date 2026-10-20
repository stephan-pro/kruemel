// Texts for showing domain values in German. Pure functions, independent of the browser's locale
// data so that they read the same everywhere (and in tests).

import type { TakeOverMode } from "../domain/assignment";
import type { ChecklistItem } from "../domain/checklist";
import { addDays, type CalendarDay, isoWeek, weekdayOf } from "../domain/date";
import type { DayRange, StatisticsPeriod } from "../domain/statistics";
import type {
  Assignee,
  Completion,
  Person,
  Recurrence,
  RecurrenceUnit,
  Task,
} from "../domain/task";
import type { WeekDayView } from "../domain/week";
import type { PersonNames } from "../storage/appData";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

const WEEKDAY_NAMES = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
] as const;

const MONTHS = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
] as const;

/** "Mo, 19.10.2026" */
export function formatDay(day: CalendarDay): string {
  const [year, month, date] = day.split("-");
  return `${WEEKDAYS[weekdayOf(day)]}, ${date}.${month}.${year}`;
}

/** "Mo, 19.10." – for places where the week already says which year it is. */
export function formatShortDay(day: CalendarDay): string {
  const [, month, date] = day.split("-");
  return `${WEEKDAYS[weekdayOf(day)]}, ${date}.${month}.`;
}

/** "Mo" */
export function weekdayShort(day: CalendarDay): string {
  return WEEKDAYS[weekdayOf(day)];
}

/** "Montag" */
export function weekdayName(day: CalendarDay): string {
  return WEEKDAY_NAMES[weekdayOf(day)];
}

/** The day of the month without a leading zero: "5" */
export function dayOfMonth(day: CalendarDay): string {
  return String(Number(day.slice(8, 10)));
}

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
] as const;

/** "Okt" – the month of a bar of a year's chart. */
export function monthShort(day: CalendarDay): string {
  return MONTHS_SHORT[Number(day.slice(5, 7)) - 1] as string;
}

/** The label of a period button of the statistics. */
export const PERIOD_LABELS: Record<StatisticsPeriod, string> = {
  week: "Woche",
  month: "Monat",
  year: "Jahr",
};

/** What the total is "of": "Gemeinsam erledigt · KW 43", "… · Oktober 2026", "… · 2026". */
export function describePeriod(period: StatisticsPeriod, range: DayRange): string {
  if (period === "week") {
    return formatWeekNumber(range.start);
  }
  const year = range.start.slice(0, 4);
  return period === "year" ? year : `${MONTHS[Number(range.start.slice(5, 7)) - 1]} ${year}`;
}

const BEFORE: Record<StatisticsPeriod, string> = {
  week: "in der Vorwoche",
  month: "im Vormonat",
  year: "im Vorjahr",
};

/**
 * The comparison with the period before, without a verdict: "6 mehr als in der Vorwoche",
 * "3 weniger als im Vormonat", "so viele wie im Vorjahr".
 */
export function describeComparison(
  period: StatisticsPeriod,
  total: number,
  previousTotal: number,
): string {
  const difference = total - previousTotal;
  if (difference === 0) {
    return `so viele wie ${BEFORE[period]}`;
  }
  return `${Math.abs(difference)} ${difference > 0 ? "mehr" : "weniger"} als ${BEFORE[period]}`;
}

/** "4 Wochen in Folge" for the row of weeks with everything done; `undefined` if there is none. */
export function describeStreak(weeks: number): string | undefined {
  if (weeks === 0) {
    return undefined;
  }
  return weeks === 1 ? "1 Woche alles erledigt" : `${weeks} Wochen in Folge`;
}

/** "5-mal habt ihr füreinander übernommen." */
export function describeTakenOver(count: number): string {
  if (count === 0) {
    return "Bisher hat niemand für die andere Person übernommen.";
  }
  return `${count}-mal habt ihr füreinander übernommen.`;
}

/** The label of a bar: "Mo" in a week, "5." in a month, "Okt" in a year. */
export function barLabel(start: CalendarDay, period: StatisticsPeriod): string {
  if (period === "year") {
    return monthShort(start);
  }
  return period === "week" ? weekdayShort(start) : `${dayOfMonth(start)}.`;
}

/** The chart as a sentence, for screen readers: "Erledigt pro Tag: Montag 7, Dienstag 5, …". */
export function describeBars(
  bars: readonly { readonly start: CalendarDay; readonly count: number }[],
  period: StatisticsPeriod,
): string {
  const unit = period === "year" ? "Monat" : "Tag";
  const name = (start: CalendarDay) =>
    period === "week"
      ? weekdayName(start)
      : period === "month"
        ? `${dayOfMonth(start)}.`
        : (MONTHS[Number(start.slice(5, 7)) - 1] as string);
  return `Erledigt pro ${unit}: ${bars.map((bar) => `${name(bar.start)} ${bar.count}`).join(", ")}`;
}

/** The split of the team: "Alex 21 Aufgaben, Robin 17 Aufgaben". */
export function describeTeamwork(
  counts: { readonly personA: number; readonly personB: number },
  names: PersonNames,
): string {
  const part = (person: "personA" | "personB") =>
    `${names[person]} ${counts[person] === 1 ? "1 Aufgabe" : `${counts[person]} Aufgaben`}`;
  return `${part("personA")}, ${part("personB")}`;
}

/** "Dienstag, 20. Oktober" – the date line of "Heute". */
export function formatLongDay(day: CalendarDay): string {
  const month = MONTHS[Number(day.slice(5, 7)) - 1] as string;
  return `${weekdayName(day)}, ${dayOfMonth(day)}. ${month}`;
}

/** "KW 43" */
export function formatWeekNumber(monday: CalendarDay): string {
  return `KW ${isoWeek(monday)}`;
}

/**
 * The greeting of "Heute" by the hour of the day (0–23): "Guten Morgen, Alex!" from 5 to 10,
 * "Guten Abend" from 18 to 23, otherwise "Hallo".
 */
export function greeting(hour: number, name: string): string {
  const salutation =
    hour >= 18 ? "Guten Abend" : hour >= 11 ? "Hallo" : hour >= 5 ? "Guten Morgen" : "Hallo";
  return `${salutation}, ${name}!`;
}

/** The sentence under the greeting, in three parts so that the count can be set in bold. */
export type SummaryParts = readonly [before: string, emphasis: string, after: string];

/**
 * What stands on today for the person: `open` tasks of which `overdue` are overdue, `done` ticked
 * off today. "Heute stehen 3 Aufgaben für dich an. Eine davon ist überfällig."
 */
export function todaySummary(open: number, overdue: number, done: number): SummaryParts {
  if (open === 0) {
    return done === 0
      ? ["Heute steht ", "nichts", " für dich an."]
      : ["Heute ist ", "alles erledigt", ". Gut gemacht!"];
  }
  const lead: [string, string] =
    open === 1 ? ["Heute steht ", "1 Aufgabe"] : ["Heute stehen ", `${open} Aufgaben`];
  let rest = " für dich an.";
  if (overdue > 0) {
    if (open === 1) {
      rest += " Sie ist überfällig.";
    } else if (overdue === open) {
      rest += " Alle sind überfällig.";
    } else {
      rest += overdue === 1 ? " Eine davon ist überfällig." : ` ${overdue} davon sind überfällig.`;
    }
  }
  return [lead[0], lead[1], rest];
}

/** "08:12" – the local time of day of an ISO moment, or `undefined` if there is none. */
export function formatTime(moment: string | undefined): string | undefined {
  const date = moment === undefined ? undefined : new Date(moment);
  if (date === undefined || Number.isNaN(date.getTime())) {
    return undefined;
  }
  const two = (value: number) => String(value).padStart(2, "0");
  return `${two(date.getHours())}:${two(date.getMinutes())}`;
}

/** "erledigt um 08:12", for the person themselves; "erledigt von Robin um 08:12" otherwise. */
export function describeDoneAt(
  completion: Completion,
  names: PersonNames,
  currentPerson: Person,
): string {
  const by =
    completion.completedBy === currentPerson ? "" : ` von ${names[completion.completedBy]}`;
  const time = formatTime(completion.completedAt);
  return `erledigt${by}${time === undefined ? "" : ` um ${time}`}`;
}

/** A percentage of 0 to 100 for the rings; 0 if nothing is due. */
export function percentOf(done: number, due: number): number {
  return due === 0 ? 0 : Math.round((done / due) * 100);
}

/** How a day of "Deine Woche" looks and what a screen reader says about it. */
export interface DayField {
  /** `free`: nothing due; `today`: inverted with "done/due"; `done`: all done; `open`: dashed count. */
  readonly state: "free" | "today" | "done" | "open";
  /** The text in the circle: "–", "1/3" or the number of open tasks; empty for `done` (a tick). */
  readonly mark: string;
  /** "Dienstag, heute, 1 von 3 erledigt" */
  readonly label: string;
}

export function dayField(day: WeekDayView): DayField {
  const name = weekdayName(day.day);
  const { dueCount, doneCount } = day;
  const open = dueCount - doneCount;
  if (dueCount === 0) {
    return {
      state: day.isToday ? "today" : "free",
      mark: "–",
      label: `${name}${day.isToday ? ", heute" : ""}, frei`,
    };
  }
  if (day.isToday) {
    return {
      state: "today",
      mark: `${doneCount}/${dueCount}`,
      label: `${name}, heute, ${doneCount} von ${dueCount} erledigt`,
    };
  }
  if (open === 0) {
    return { state: "done", mark: "", label: `${name}, alles erledigt` };
  }
  return {
    state: "open",
    mark: String(open),
    label: `${name}, ${countTasks(open)}${doneCount > 0 ? ` offen, ${doneCount} erledigt` : ""}`,
  };
}

/** "Diese Woche", "Nächste Woche", "Vor 3 Wochen" … for a week `offset` weeks from the current. */
export function weekTitle(offset: number): string {
  if (offset === 0) {
    return "Diese Woche";
  }
  if (offset === 1) {
    return "Nächste Woche";
  }
  if (offset === -1) {
    return "Letzte Woche";
  }
  return offset > 0 ? `In ${offset} Wochen` : `Vor ${-offset} Wochen`;
}

/**
 * The calendar week and its days: "KW 43 · 19.–25. Oktober", "KW 44 · 26. Oktober – 1. November".
 * The year is added when it is not the year of `today` or the week spans two years.
 */
export function formatWeekLabel(monday: CalendarDay, today: CalendarDay): string {
  const sunday = addDays(monday, 6);
  const [startYear, startMonth] = [monday.slice(0, 4), Number(monday.slice(5, 7))];
  const [endYear, endMonth] = [sunday.slice(0, 4), Number(sunday.slice(5, 7))];
  const monthName = (month: number) => MONTHS[month - 1] as string;
  const showYear = startYear !== endYear || startYear !== today.slice(0, 4);
  const end = `${dayOfMonth(sunday)}. ${monthName(endMonth)}${showYear ? ` ${endYear}` : ""}`;
  let start: string;
  if (startYear !== endYear) {
    start = `${dayOfMonth(monday)}. ${monthName(startMonth)} ${startYear} – `;
  } else if (startMonth !== endMonth) {
    start = `${dayOfMonth(monday)}. ${monthName(startMonth)} – `;
  } else {
    start = `${dayOfMonth(monday)}.–`;
  }
  return `KW ${isoWeek(monday)} · ${start}${end}`;
}

/** "keine Aufgaben", "1 Aufgabe", "3 Aufgaben" */
export function countTasks(count: number): string {
  if (count === 0) {
    return "keine Aufgaben";
  }
  return count === 1 ? "1 Aufgabe" : `${count} Aufgaben`;
}

/** "keine Erledigungen", "1 Erledigung", "3 Erledigungen" */
export function countCompletions(count: number): string {
  if (count === 0) {
    return "keine Erledigungen";
  }
  return count === 1 ? "1 Erledigung" : `${count} Erledigungen`;
}

/** "1 Eintrag", "3 Einträge" – the length of the "Erledigt" list. */
export function countEntries(count: number): string {
  return count === 1 ? "1 Eintrag" : `${count} Einträge`;
}

/** What a set of data holds: "4 Aufgaben und 12 Erledigungen". */
export function describeContents(taskCount: number, completionCount: number): string {
  return `${countTasks(taskCount)} und ${countCompletions(completionCount)}`;
}

/** "3 von 5 abgehakt" for a checklist. */
export function describeChecklist(items: readonly ChecklistItem[]): string {
  return `${items.filter((item) => item.checked).length} von ${items.length} abgehakt`;
}

const SINGULAR: Record<RecurrenceUnit, string> = {
  day: "täglich",
  week: "wöchentlich",
  month: "monatlich",
};

const PLURAL: Record<RecurrenceUnit, string> = { day: "Tage", week: "Wochen", month: "Monate" };

/** "täglich", "wöchentlich", "monatlich", or "alle 2 Wochen". */
export function describeRecurrence({ unit, interval }: Recurrence): string {
  return interval === 1 ? SINGULAR[unit] : `alle ${interval} ${PLURAL[unit]}`;
}

/** "1 Tag überfällig", "3 Tage überfällig". */
export function describeOverdue(days: number): string {
  return `${days} ${days === 1 ? "Tag" : "Tage"} überfällig`;
}

/** "Erledigt von Alex am Mi, 14.10.2026" */
export function describeCompletedBy(completion: Completion, names: PersonNames): string {
  return `Erledigt von ${names[completion.completedBy]} am ${formatDay(completion.completedOn)}`;
}

/** What the page says after a task was ticked off: where the task went next. */
export function completionNotice(title: string, completion: Completion): string {
  return completion.nextDueDate === undefined
    ? `„${title}“ ist abgehakt und steht jetzt unter „Erledigt“.`
    : `„${title}“ ist abgehakt. Nächster Termin: ${formatDay(completion.nextDueDate)}.`;
}

/** What the page says after a completion was taken back. */
export function undoNotice(title: string, dueDate: CalendarDay): string {
  return `Rückgängig gemacht: „${title}“ ist wieder offen, fällig am ${formatDay(dueDate)}.`;
}

/** What the settings say after the backup file was downloaded (F7). */
export function exportNotice(fileName: string): string {
  return `Die Sicherung „${fileName}“ wurde heruntergeladen. Bewahren Sie die Datei sicher auf.`;
}

/** What the settings say after a backup was put in place (F7): what it holds and where the old data is. */
export function importNotice(contents: string, autoBackupName: string): string {
  return `Sicherung eingespielt: ${contents}. Die bisherigen Daten wurden vorher als „${autoBackupName}“ heruntergeladen.`;
}

/**
 * What the page says after "Übernehmen" (F5). A one-off task is simply handed over; a recurring
 * one is taken over for this time only or for good.
 */
export function takeOverNotice(
  title: string,
  kind: Task["kind"],
  person: Person,
  names: PersonNames,
  mode: TakeOverMode,
): string {
  const name = names[person];
  if (kind === "oneOff") {
    return `„${title}“ ist jetzt bei ${name}.`;
  }
  return mode === "once"
    ? `„${title}“ ist jetzt bei ${name}, nur dieses Mal.`
    : `„${title}“ gehört jetzt dauerhaft ${name}.`;
}

/** The name of a person, or "beide". */
export function assigneeLabel(assignee: Assignee, names: PersonNames): string {
  return assignee === "both" ? "Beide" : names[assignee];
}

/** Who has the task this time, noting a one-time takeover ("Robin (übernommen; sonst Alex)"). */
export function describeResponsibility(
  assignee: Assignee,
  takenOverBy: Person | undefined,
  names: PersonNames,
): string {
  return takenOverBy === undefined
    ? assigneeLabel(assignee, names)
    : `${names[takenOverBy]} (nur dieses Mal übernommen; sonst ${assigneeLabel(assignee, names)})`;
}
