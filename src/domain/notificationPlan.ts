// The daily overview (NT-c, docs/BENACHRICHTIGUNGEN.md 4.2 and 4.3): on which local day a device
// is due for it, what it counts, and the quiet hours (used from NT-d on). Pure functions; the
// moment comes in as a parameter. The server plans and counts with the same rules in SQL
// (supabase/migrations/…_push_schedule.sql); `notificationPlan.cases.ts` holds the cases Vitest
// checks here and the job `db` checks there, so the two cannot drift apart.

import { isMine } from "./assignment";
import { type CalendarDay, calendarDay, type Weekday, weekdayOf } from "./date";
import { isOpen, type Person, type Task } from "./task";

/** A time zone the device does not know or did not send counts as Berlin (as on the server). */
export const FALLBACK_TIME_ZONE = "Europe/Berlin";

/**
 * How late a daily overview still comes when the schedule missed its minute (an outage): up to two
 * hours after the chosen time. A device switched on or set to an earlier time later that day gets
 * its first overview the next day.
 */
export const DAILY_CATCH_UP_MINUTES = 120;

/** A moment as the clock on the wall of a time zone shows it. */
export interface LocalMoment {
  readonly day: CalendarDay;
  /** "HH:MM", 24 hours. */
  readonly time: string;
  readonly weekday: Weekday;
}

const formats = new Map<string, Intl.DateTimeFormat>();

function formatFor(timeZone: string): Intl.DateTimeFormat {
  let format = formats.get(timeZone);
  if (format === undefined) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    formats.set(timeZone, format);
  }
  return format;
}

/** The local day, time and weekday of a moment (milliseconds since 1970) in a time zone. */
export function localMoment(instant: number, timeZone: string): LocalMoment {
  let format: Intl.DateTimeFormat;
  try {
    format = formatFor(timeZone);
  } catch {
    format = formatFor(FALLBACK_TIME_ZONE);
  }
  const parts = Object.fromEntries(
    format.formatToParts(instant).map((part) => [part.type, part.value]),
  );
  const day = calendarDay(`${parts.year}-${parts.month}-${parts.day}`);
  return { day, time: `${parts.hour}:${parts.minute}`, weekday: weekdayOf(day) };
}

function minutesOf(time: string): number {
  const [hours, minutes] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
}

/** What a device chose for its daily overview (as `PushSettings` of the Edge Function's rules). */
export interface DailyChoice {
  readonly dailyEnabled: boolean;
  /** "HH:MM", local to the device. */
  readonly dailyTime: string;
  /** Bit mask of the weekdays: Monday = 1, Tuesday = 2 … Sunday = 64. */
  readonly dailyDays: number;
}

/**
 * The local day a device is due for its daily overview at `now`, or `null`: switched on, one of its
 * weekdays, its time reached (at most `DAILY_CATCH_UP_MINUTES` ago) and none yet for this local day
 * (`lastDailyOn`). So a change of daylight saving time neither skips nor doubles it: when the clock
 * jumps forward over the chosen time it comes at the first minute after; when it goes back, the day
 * is already noted. A device that travelled gets it at the chosen time where it is now.
 */
export function dailyOverviewDay(
  now: number,
  timeZone: string,
  choice: DailyChoice,
  lastDailyOn: CalendarDay | null,
): CalendarDay | null {
  const local = localMoment(now, timeZone);
  const late = minutesOf(local.time) - minutesOf(choice.dailyTime);
  const onThisWeekday = (choice.dailyDays & (1 << local.weekday)) !== 0;
  const due =
    choice.dailyEnabled &&
    onThisWeekday &&
    late >= 0 &&
    late < DAILY_CATCH_UP_MINUTES &&
    (lastDailyOn === null || lastDailyOn < local.day);
  return due ? local.day : null;
}

/**
 * Whether a local time ("HH:MM") lies in the quiet hours from `from` (included) to `to` (not
 * included); quiet hours may go over midnight (`from` later than `to`). Equal ends are no quiet
 * hours (the settings refuse them).
 */
export function isQuietTime(time: string, from: string, to: string): boolean {
  if (from < to) {
    return time >= from && time < to;
  }
  return from > to && (time >= from || time < to);
}

/** What the daily overview tells: tasks for the person due today or earlier, and of them overdue. */
export interface DueCounts {
  readonly due: number;
  readonly overdue: number;
}

/**
 * The open tasks that are the person's (`isMine`: taken over by them, or without a takeover theirs
 * or both people's) and due `today` or earlier; overdue are those due before today. Done one-off
 * tasks do not count.
 */
export function myDueCounts(tasks: readonly Task[], person: Person, today: CalendarDay): DueCounts {
  const mine = tasks.filter(
    (task) => isOpen(task) && isMine(task, person) && task.dueDate <= today,
  );
  return { due: mine.length, overdue: mine.filter((task) => task.dueDate < today).length };
}
