// Texts for showing domain values in German. Pure functions, independent of the browser's locale
// data so that they read the same everywhere (and in tests).

import { type CalendarDay, weekdayOf } from "../domain/date";
import type { Assignee, Person, Recurrence, RecurrenceUnit } from "../domain/task";
import type { PersonNames } from "../storage/appData";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

/** "Mo, 19.10.2026" */
export function formatDay(day: CalendarDay): string {
  const [year, month, date] = day.split("-");
  return `${WEEKDAYS[weekdayOf(day)]}, ${date}.${month}.${year}`;
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
