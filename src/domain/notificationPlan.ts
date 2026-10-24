// The daily overview (NT-c, docs/BENACHRICHTIGUNGEN.md 4.2 and 4.3): on which local day a device
// is due for it, what it counts, and the quiet hours (used from NT-d on). Pure functions; the
// moment comes in as a parameter. The server plans and counts with the same rules in SQL
// (supabase/migrations/…_push_schedule.sql); `notificationPlan.cases.ts` holds the cases Vitest
// checks here and the job `db` checks there, so the two cannot drift apart.

//
// From NT-d on also the messages about the other person (4.1, 4.3, 4.5): which completion or change
// of a task is one, how long they wait to be bundled, when quiet hours hold them back, and what one
// message then tells.

import { effectiveAssignee, isMine } from "./assignment";
import { type CalendarDay, calendarDay, type Weekday, weekdayOf } from "./date";
import { type Completion, isOpen, type Person, type Task } from "./task";

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

// Messages about the other person (NT-d) ----------------------------------------------------------

/** How long a message about the other person waits for more to bundle (4.3). */
export const PARTNER_WAIT_MINUTES = 5;

/** A completion older than this when it reaches the server tells nothing any more (4.5). */
export const PARTNER_MAX_AGE_HOURS = 24;

const MINUTE = 60_000;

/**
 * Whether a completion that reached the server at `arrivedAt` tells `recipient` that `actor` did
 * something for them: the actor ticked it off themself (`completedBy`), it was the recipient's or
 * both people's (`assigneeAtCompletion`), and it was ticked off at most a day before it arrived
 * (after a long time offline no flood). Nobody is told about their own doing.
 */
export function isPartnerCompletion(
  completion: Pick<Completion, "completedBy" | "assigneeAtCompletion" | "completedAt">,
  actor: Person,
  recipient: Person,
  arrivedAt: number,
): boolean {
  const at = completion.completedAt === undefined ? Number.NaN : Date.parse(completion.completedAt);
  return (
    actor !== recipient &&
    completion.completedBy === actor &&
    (completion.assigneeAtCompletion === recipient || completion.assigneeAtCompletion === "both") &&
    at >= arrivedAt - PARTNER_MAX_AGE_HOURS * 60 * MINUTE
  );
}

/**
 * Whether a change of a task is `actor` taking it over from `recipient`: before, it was the
 * recipient's or both people's to do (`effectiveAssignee`), afterwards it is the actor's, once
 * (`takenOverBy`) or for good (`assignee`).
 */
export function isTakeOver(before: Task, after: Task, actor: Person, recipient: Person): boolean {
  const owner = effectiveAssignee(before);
  return (
    actor !== recipient &&
    (owner === recipient || owner === "both") &&
    effectiveAssignee(after) === actor
  );
}

/** The quiet hours of a device (as `PushSettings` of the Edge Function's rules). */
export interface QuietChoice {
  readonly quietEnabled: boolean;
  /** "HH:MM", local to the device. */
  readonly quietFrom: string;
  readonly quietTo: string;
}

/** The offset of a time zone from UTC at a moment, in milliseconds. */
function offsetAt(instant: number, timeZone: string): number {
  const local = localMoment(instant, timeZone);
  const [hours, minutes] = local.time.split(":").map(Number);
  const [year, month, day] = local.day.split("-").map(Number);
  const wall = Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1, hours, minutes);
  return wall - Math.floor(instant / MINUTE) * MINUTE;
}

/** The moment a local day and time ("HH:MM") is in a time zone. */
function instantOf(day: CalendarDay, time: string, timeZone: string): number {
  const [year, month, date] = day.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const wall = Date.UTC(year ?? 0, (month ?? 1) - 1, date ?? 1, hours, minutes);
  const guess = wall - offsetAt(wall, timeZone);
  return wall - offsetAt(guess, timeZone);
}

/** The next day of a calendar day. */
function nextDay(day: CalendarDay): CalendarDay {
  const [year, month, date] = day.split("-").map(Number);
  return calendarDay(
    new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (date ?? 1) + 1)).toISOString().slice(0, 10),
  );
}

/**
 * When the quiet hours a moment lies in end (the next time the local clock shows `quietTo`), or
 * `null` if the moment is not in quiet hours (or they are switched off).
 */
export function quietEnd(now: number, timeZone: string, quiet: QuietChoice): number | null {
  const local = localMoment(now, timeZone);
  if (!quiet.quietEnabled || !isQuietTime(local.time, quiet.quietFrom, quiet.quietTo)) {
    return null;
  }
  const day = quiet.quietTo <= local.time ? nextDay(local.day) : local.day;
  let zone = timeZone;
  try {
    formatFor(timeZone);
  } catch {
    zone = FALLBACK_TIME_ZONE;
  }
  return instantOf(day, quiet.quietTo, zone);
}

/** One message about the other person that has arrived at the server (`push_events`). */
export interface PartnerEvent {
  readonly kind: "done" | "tookOver";
  /** The completion's id (`done`) or the task's id (`tookOver`): each counts once. */
  readonly id: string;
  /** When it reached the server. */
  readonly at: number;
  /** When it stopped counting (undone, task deleted, taken back), if it did. */
  readonly goneAt?: number;
}

/** A message about the other person: when it goes and what it tells. */
export interface PartnerMessage {
  readonly at: number;
  readonly done: number;
  readonly took: number;
}

/**
 * The messages a device gets for these events (4.3): the first event that waits starts the
 * message, which goes `PARTNER_WAIT_MINUTES` later, or at the end of the quiet hours that moment
 * falls in. Everything that arrives until then joins it (also during the quiet hours: one message
 * at their end). Counted is what still holds when it goes, each completion and task once; nothing
 * left, no message. The schedule of the server runs every minute, so `at` is the earliest moment.
 */
export function partnerMessages(
  events: readonly PartnerEvent[],
  timeZone: string,
  quiet: QuietChoice,
): PartnerMessage[] {
  const waiting = [...events].sort((one, two) => one.at - two.at);
  const messages: PartnerMessage[] = [];
  let index = 0;
  while (index < waiting.length) {
    const first = waiting[index] as PartnerEvent;
    const due = first.at + PARTNER_WAIT_MINUTES * MINUTE;
    const at = quietEnd(due, timeZone, quiet) ?? due;
    const done = new Set<string>();
    const took = new Set<string>();
    while (index < waiting.length && (waiting[index] as PartnerEvent).at <= at) {
      const event = waiting[index] as PartnerEvent;
      if (event.goneAt === undefined || event.goneAt > at) {
        (event.kind === "done" ? done : took).add(event.id);
      }
      index++;
    }
    if (done.size + took.size > 0) {
      messages.push({ at, done: done.size, took: took.size });
    }
  }
  return messages;
}
