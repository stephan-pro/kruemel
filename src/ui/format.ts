// Texts for showing domain values in the chosen language (EN-a). The sentences and patterns are in
// `src/i18n/`; the names of weekdays and months and the time of day come from `Intl`. Without a
// choice (and in tests) the language is German. Pure functions apart from reading the language.

import type { TakeOverMode } from "../domain/assignment";
import type { ChecklistItem } from "../domain/checklist";
import { addDays, type CalendarDay, isoWeek, weekdayOf } from "../domain/date";
import type { DayRange, StatisticsPeriod } from "../domain/statistics";
import type { Assignee, Completion, Person, Recurrence, Task } from "../domain/task";
import type { WeekDayView } from "../domain/week";
import { t } from "../i18n";
import type { SummaryParts } from "../i18n/de";
import { monthLong, timeOfDay, weekdayLong } from "../i18n/intl";
import { getLanguage } from "../i18n/language";
import type { PersonNames } from "../storage/appData";

export type { SummaryParts } from "../i18n/de";

const monthOf = (day: CalendarDay) => Number(day.slice(5, 7));

/** The name of a month in the chosen language: "Oktober" / "October". */
function monthName(month: number): string {
  return monthLong(getLanguage(), month);
}

/** "Mo, 19.10.2026" */
export function formatDay(day: CalendarDay): string {
  return t().format.day(
    weekdayShort(day),
    Number(day.slice(8, 10)),
    monthOf(day),
    Number(day.slice(0, 4)),
  );
}

/** "Mo, 19.10." – for places where the week already says which year it is. */
export function formatShortDay(day: CalendarDay): string {
  return t().format.shortDay(weekdayShort(day), Number(day.slice(8, 10)), monthOf(day));
}

/** "Mo" */
export function weekdayShort(day: CalendarDay): string {
  return t().format.weekdaysShort[weekdayOf(day)] as string;
}

/** "Montag" */
export function weekdayName(day: CalendarDay): string {
  return weekdayLong(getLanguage(), day);
}

/** The day of the month without a leading zero: "5" */
export function dayOfMonth(day: CalendarDay): string {
  return String(Number(day.slice(8, 10)));
}

/** "Okt" – the month of a bar of a year's chart. */
export function monthShort(day: CalendarDay): string {
  return t().format.monthsShort[monthOf(day) - 1] as string;
}

/** What the total is "of": "Gemeinsam erledigt · KW 43", "… · Oktober 2026", "… · 2026". */
export function describePeriod(period: StatisticsPeriod, range: DayRange): string {
  if (period === "week") {
    return formatWeekNumber(range.start);
  }
  const year = range.start.slice(0, 4);
  return period === "year" ? year : `${monthName(monthOf(range.start))} ${year}`;
}

/**
 * The comparison with the period before, without a verdict: "6 mehr als in der Vorwoche",
 * "3 weniger als im Vormonat", "so viele wie im Vorjahr".
 */
export function describeComparison(
  period: StatisticsPeriod,
  total: number,
  previousTotal: number,
): string {
  const { statistics } = t();
  const before = statistics.before[period];
  const difference = total - previousTotal;
  if (difference === 0) {
    return statistics.same(before);
  }
  return difference > 0
    ? statistics.more(difference, before)
    : statistics.fewer(-difference, before);
}

/** "4 Wochen in Folge" for the row of weeks with everything done; `undefined` if there is none. */
export function describeStreak(weeks: number): string | undefined {
  if (weeks === 0) {
    return undefined;
  }
  return weeks === 1 ? t().statistics.streakOne : t().statistics.streak(weeks);
}

/** "5-mal habt ihr füreinander übernommen." */
export function describeTakenOver(count: number): string {
  const { statistics } = t();
  return count === 0 ? statistics.takenOverNone : statistics.takenOver(count);
}

/** The label of a bar: "Mo" in a week, "5." in a month, "Okt" in a year. */
export function barLabel(start: CalendarDay, period: StatisticsPeriod): string {
  if (period === "year") {
    return monthShort(start);
  }
  return period === "week"
    ? weekdayShort(start)
    : t().format.dayOfMonthLabel(Number(start.slice(8, 10)));
}

/** The chart as a sentence, for screen readers: "Erledigt pro Tag: Montag 7, Dienstag 5, …". */
export function describeBars(
  bars: readonly { readonly start: CalendarDay; readonly count: number }[],
  period: StatisticsPeriod,
): string {
  const name = (start: CalendarDay) =>
    period === "week"
      ? weekdayName(start)
      : period === "month"
        ? t().format.dayOfMonthLabel(Number(start.slice(8, 10)))
        : monthName(monthOf(start));
  const parts = bars.map((bar) => `${name(bar.start)} ${bar.count}`).join(", ");
  return t().statistics.chart(period === "year" ? "month" : "day", parts);
}

/** The split of the team: "Alex 21 Aufgaben, Robin 17 Aufgaben". */
export function describeTeamwork(
  counts: { readonly personA: number; readonly personB: number },
  names: PersonNames,
): string {
  const part = (person: "personA" | "personB") =>
    t().statistics.teamworkPart(names[person], counts[person]);
  return `${part("personA")}, ${part("personB")}`;
}

/** "Dienstag, 20. Oktober" – the date line of "Heute". */
export function formatLongDay(day: CalendarDay): string {
  return t().format.longDay(weekdayName(day), Number(day.slice(8, 10)), monthName(monthOf(day)));
}

/** "KW 43" */
export function formatWeekNumber(monday: CalendarDay): string {
  return t().format.weekNumber(isoWeek(monday));
}

/**
 * The greeting of "Heute" by the hour of the day (0–23): "Guten Morgen, Alex!" from 5 to 10,
 * "Guten Abend" from 18 to 23, otherwise "Hallo".
 */
export function greeting(hour: number, name: string): string {
  const { greeting: words } = t().today;
  if (hour >= 18) {
    return words.evening(name);
  }
  return hour >= 11 || hour < 5 ? words.hello(name) : words.morning(name);
}

/**
 * What stands on today for the person: `open` tasks of which `overdue` are overdue, `done` ticked
 * off today. "Heute stehen 3 Aufgaben für dich an. Eine davon ist überfällig."
 */
export function todaySummary(open: number, overdue: number, done: number): SummaryParts {
  const { summary } = t().today;
  if (open === 0) {
    return done === 0 ? summary.nothing : summary.allDone;
  }
  return summary.open(open, overdue);
}

/** "08:12" – the local time of day of an ISO moment, or `undefined` if there is none. */
export function formatTime(moment: string | undefined): string | undefined {
  const date = moment === undefined ? undefined : new Date(moment);
  if (date === undefined || Number.isNaN(date.getTime())) {
    return undefined;
  }
  return timeOfDay(getLanguage(), date);
}

/** "erledigt um 08:12", for the person themselves; "erledigt von Robin um 08:12" otherwise. */
export function describeDoneAt(
  completion: Completion,
  names: PersonNames,
  currentPerson: Person,
): string {
  const by = completion.completedBy === currentPerson ? undefined : names[completion.completedBy];
  return t().format.doneAt(by, formatTime(completion.completedAt));
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
  const words = t().today;
  const name = weekdayName(day.day);
  const { dueCount, doneCount } = day;
  const open = dueCount - doneCount;
  if (dueCount === 0) {
    return {
      state: day.isToday ? "today" : "free",
      mark: "–",
      label: words.dayFree(name, day.isToday),
    };
  }
  if (day.isToday) {
    return {
      state: "today",
      mark: `${doneCount}/${dueCount}`,
      label: words.dayToday(name, doneCount, dueCount),
    };
  }
  if (open === 0) {
    return { state: "done", mark: "", label: words.dayAllDone(name) };
  }
  return { state: "open", mark: String(open), label: words.dayOpen(name, open, doneCount) };
}

/** "Diese Woche", "Nächste Woche", "Vor 3 Wochen" … for a week `offset` weeks from the current. */
export function weekTitle(offset: number): string {
  return t().format.weekTitle(offset);
}

/**
 * The calendar week and its days: "KW 43 · 19.–25. Oktober", "KW 44 · 26. Oktober – 1. November".
 * The year is added when it is not the year of `today` or the week spans two years.
 */
export function formatWeekLabel(monday: CalendarDay, today: CalendarDay): string {
  const sunday = addDays(monday, 6);
  const [startYear, endYear] = [monday.slice(0, 4), sunday.slice(0, 4)];
  const sameMonth = monthOf(monday) === monthOf(sunday);
  const showYear = startYear !== endYear || startYear !== today.slice(0, 4);
  const range = t().format.weekRange(
    {
      date: Number(monday.slice(8, 10)),
      ...(sameMonth && startYear === endYear ? {} : { month: monthName(monthOf(monday)) }),
      ...(startYear === endYear ? {} : { year: startYear }),
    },
    {
      date: Number(sunday.slice(8, 10)),
      month: monthName(monthOf(sunday)),
      ...(showYear ? { year: endYear } : {}),
    },
  );
  return `${formatWeekNumber(monday)} · ${range}`;
}

/** "keine Aufgaben", "1 Aufgabe", "3 Aufgaben" */
export function countTasks(count: number): string {
  return t().format.countTasks(count);
}

/** "keine Erledigungen", "1 Erledigung", "3 Erledigungen" */
export function countCompletions(count: number): string {
  return t().format.countCompletions(count);
}

/** "1 Eintrag", "3 Einträge" – the length of the "Erledigt" list. */
export function countEntries(count: number): string {
  return t().format.countEntries(count);
}

/** What a set of data holds: "4 Aufgaben und 12 Erledigungen". */
export function describeContents(taskCount: number, completionCount: number): string {
  return t().format.contents(countTasks(taskCount), countCompletions(completionCount));
}

/** "3 von 5 abgehakt" for a checklist. */
export function describeChecklist(items: readonly ChecklistItem[]): string {
  return t().format.checklistProgress(items.filter((item) => item.checked).length, items.length);
}

/** "täglich", "wöchentlich", "monatlich", or "alle 2 Wochen". */
export function describeRecurrence({ unit, interval }: Recurrence): string {
  const { format } = t();
  return interval === 1 ? format.recurrenceSingle[unit] : format.recurrenceEvery(interval, unit);
}

/** "1 Tag überfällig", "3 Tage überfällig". */
export function describeOverdue(days: number): string {
  return t().format.overdue(days);
}

/** "Erledigt von Alex am Mi, 14.10.2026" */
export function describeCompletedBy(completion: Completion, names: PersonNames): string {
  return t().format.completedBy(names[completion.completedBy], formatDay(completion.completedOn));
}

/** What the page says after a task was ticked off: where the task went next. */
export function completionNotice(title: string, completion: Completion): string {
  const { notices } = t();
  return completion.nextDueDate === undefined
    ? notices.completed(title)
    : notices.completedNext(title, formatDay(completion.nextDueDate));
}

/** What the page says after a completion was taken back. */
export function undoNotice(title: string, dueDate: CalendarDay): string {
  return t().notices.undone(title, formatDay(dueDate));
}

/** What the settings say after the backup file was downloaded (F7). */
export function exportNotice(fileName: string): string {
  return t().backup.exported(fileName);
}

/** What the settings say after a backup was put in place (F7): what it holds and where the old data is. */
export function importNotice(contents: string, autoBackupName: string): string {
  return t().backup.imported(contents, autoBackupName);
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
  const { notices } = t();
  const name = names[person];
  if (kind === "oneOff") {
    return notices.takenOverOneOff(title, name);
  }
  return mode === "once"
    ? notices.takenOverOnce(title, name)
    : notices.takenOverForGood(title, name);
}

/** The name of a person, or "beide". */
export function assigneeLabel(assignee: Assignee, names: PersonNames): string {
  return assignee === "both" ? t().common.both : names[assignee];
}

/** Who has the task this time, noting a one-time takeover ("Robin (übernommen; sonst Alex)"). */
export function describeResponsibility(
  assignee: Assignee,
  takenOverBy: Person | undefined,
  names: PersonNames,
): string {
  return takenOverBy === undefined
    ? assigneeLabel(assignee, names)
    : t().format.takenOver(names[takenOverBy], assigneeLabel(assignee, names));
}
