// Calendar days as "YYYY-MM-DD" strings. No time of day, no time zones: all arithmetic runs on
// UTC midnight internally, so daylight saving time can never shift a day.

declare const calendarDayBrand: unique symbol;

/** A valid calendar day, written "YYYY-MM-DD" (years 0001–9999). */
export type CalendarDay = string & { readonly [calendarDayBrand]: true };

/** Weekday number with Monday = 0 … Sunday = 6. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 86_400_000;
const MIN_YEAR = 1;
const MAX_YEAR = 9999;

function toUtcMs(year: number, month: number, day: number): number {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getTime();
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, "0");
}

function fromUtcMs(ms: number): CalendarDay {
  const date = new Date(ms);
  const year = date.getUTCFullYear();
  if (year < MIN_YEAR || year > MAX_YEAR) {
    throw new RangeError("Datum außerhalb des unterstützten Bereichs (Jahr 1 bis 9999)");
  }
  return `${pad(year, 4)}-${pad(date.getUTCMonth() + 1, 2)}-${pad(date.getUTCDate(), 2)}` as CalendarDay;
}

function toMs(day: CalendarDay): number {
  const match = DAY_PATTERN.exec(day);
  // A CalendarDay is always valid, so the pattern always matches.
  const [, year, month, date] = match as RegExpExecArray;
  return toUtcMs(Number(year), Number(month), Number(date));
}

/** True if the text is a real calendar day in the form "YYYY-MM-DD" (e.g. not "2026-02-30"). */
export function isCalendarDay(value: unknown): value is CalendarDay {
  if (typeof value !== "string") {
    return false;
  }
  const match = DAY_PATTERN.exec(value);
  if (!match) {
    return false;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < MIN_YEAR) {
    return false;
  }
  const date = new Date(toUtcMs(year, month, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** Turns a "YYYY-MM-DD" text into a CalendarDay; throws if it is not a real day. */
export function calendarDay(value: string): CalendarDay {
  if (!isCalendarDay(value)) {
    throw new RangeError(`Kein gültiger Kalendertag: ${value}`);
  }
  return value;
}

/** The calendar day a local Date falls on (uses the local time zone, like a wall calendar). */
export function dayFromDate(date: Date): CalendarDay {
  return calendarDay(
    `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1, 2)}-${pad(date.getDate(), 2)}`,
  );
}

/** Orders days chronologically: negative if a is before b, 0 if equal, positive if after. */
export function compareDays(a: CalendarDay, b: CalendarDay): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Number of days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: CalendarDay, to: CalendarDay): number {
  return Math.round((toMs(to) - toMs(from)) / MS_PER_DAY);
}

export function addDays(day: CalendarDay, count: number): CalendarDay {
  return fromUtcMs(toMs(day) + count * MS_PER_DAY);
}

/** Also used to browse weeks: `addWeeks(shownDay, -1)` is the same weekday one week earlier. */
export function addWeeks(day: CalendarDay, count: number): CalendarDay {
  return addDays(day, count * 7);
}

/**
 * Adds calendar months. If the target month is shorter, the result is its last day
 * (31 Jan + 1 month = 28/29 Feb).
 */
export function addMonths(day: CalendarDay, count: number): CalendarDay {
  const date = new Date(toMs(day));
  const monthIndex = date.getUTCFullYear() * 12 + date.getUTCMonth() + count;
  const year = Math.floor(monthIndex / 12);
  const month = monthIndex - year * 12 + 1;
  const lastDayOfMonth = new Date(toUtcMs(year, month + 1, 0)).getUTCDate();
  return fromUtcMs(toUtcMs(year, month, Math.min(date.getUTCDate(), lastDayOfMonth)));
}

/** Monday = 0 … Sunday = 6. */
export function weekdayOf(day: CalendarDay): Weekday {
  const sundayBased = new Date(toMs(day)).getUTCDay();
  return ((sundayBased + 6) % 7) as Weekday;
}

/** The Monday of the week the day belongs to. */
export function startOfWeek(day: CalendarDay): CalendarDay {
  return addDays(day, -weekdayOf(day));
}

/** The seven days Monday to Sunday of the week the day belongs to. */
export function weekDays(day: CalendarDay): CalendarDay[] {
  const monday = startOfWeek(day);
  return Array.from({ length: 7 }, (_, offset) => addDays(monday, offset));
}
