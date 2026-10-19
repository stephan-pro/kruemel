// Texts for showing domain values in German. Pure functions, independent of the browser's locale
// data so that they read the same everywhere (and in tests).

import type { TakeOverMode } from "../domain/assignment";
import type { ChecklistItem } from "../domain/checklist";
import { addDays, type CalendarDay, isoWeek, weekdayOf } from "../domain/date";
import type {
  Assignee,
  Completion,
  Person,
  Recurrence,
  RecurrenceUnit,
  Task,
} from "../domain/task";
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
