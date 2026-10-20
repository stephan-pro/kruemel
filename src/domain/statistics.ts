// "Statistik" (DESIGN.md section 6): what the two people did together in a week, a month or a year.
// Cooperative by design: shares and counts, never a ranking. Pure functions; "today" is a parameter.

import { addDays, addMonths, type CalendarDay, calendarDay, startOfWeek } from "./date";
import type { Completion, Person, Task } from "./task";
import { weekView } from "./week";

export type StatisticsPeriod = "week" | "month" | "year";

export const STATISTICS_PERIODS: readonly StatisticsPeriod[] = ["week", "month", "year"];

/** First and last day, both included. */
export interface DayRange {
  readonly start: CalendarDay;
  readonly end: CalendarDay;
}

/** One bar of the chart: a day (week, month) or a month (year) with what was done in it. */
export interface StatisticsBar {
  /** The first day of the bar's day or month. */
  readonly start: CalendarDay;
  readonly count: number;
}

export interface TopTask {
  readonly task: Task;
  readonly count: number;
}

export interface Statistics {
  readonly period: StatisticsPeriod;
  readonly range: DayRange;
  /** The period right before, as long as this one: last week, last month, last year. */
  readonly previousRange: DayRange;
  /** Everything ticked off in the period, by both. */
  readonly total: number;
  readonly previousTotal: number;
  /**
   * Weeks in a row in which everything that was due was done (counted like "Stand" of the week
   * view), up to now. A week without anything due neither counts nor breaks the row; the current
   * week does not break it before it is over.
   */
  readonly streakWeeks: number;
  readonly barUnit: "day" | "month";
  readonly bars: readonly StatisticsBar[];
  /** Ticked off per person; the ones that were done "for both" count for whoever did them. */
  readonly byPerson: Readonly<Record<Person, number>>;
  /** Times somebody did what was somebody else's task (`completedBy` ≠ the one responsible). */
  readonly takenOver: number;
  /** The three tasks done most often, by task (not by title), then by title. */
  readonly top: readonly TopTask[];
}

export interface StatisticsInput {
  readonly tasks: readonly Task[];
  /** Completions of any tasks, oldest first. */
  readonly completions: readonly Completion[];
  readonly today: CalendarDay;
  readonly period: StatisticsPeriod;
}

/** The week, month or year `today` falls in. */
export function rangeOf(period: StatisticsPeriod, day: CalendarDay): DayRange {
  if (period === "week") {
    const monday = startOfWeek(day);
    return { start: monday, end: addDays(monday, 6) };
  }
  if (period === "month") {
    const start = calendarDay(`${day.slice(0, 7)}-01`);
    return { start, end: addDays(addMonths(start, 1), -1) };
  }
  const year = day.slice(0, 4);
  return { start: calendarDay(`${year}-01-01`), end: calendarDay(`${year}-12-31`) };
}

/** The period of the same kind right before the one `range` is. */
export function previousRangeOf(period: StatisticsPeriod, range: DayRange): DayRange {
  return rangeOf(period, addDays(range.start, -1));
}

function within(day: CalendarDay, range: DayRange): boolean {
  return day >= range.start && day <= range.end;
}

/** Bars of a week or month: one per day; of a year: one per month. */
function barsOf(
  period: StatisticsPeriod,
  range: DayRange,
  done: readonly Completion[],
): readonly StatisticsBar[] {
  if (period === "year") {
    return Array.from({ length: 12 }, (_, index) => {
      const start = calendarDay(
        `${range.start.slice(0, 4)}-${String(index + 1).padStart(2, "0")}-01`,
      );
      const month = start.slice(0, 7);
      return { start, count: done.filter((item) => item.completedOn.startsWith(month)).length };
    });
  }
  const days: CalendarDay[] = [];
  for (let day = range.start; day <= range.end; day = addDays(day, 1)) {
    days.push(day);
  }
  return days.map((day) => ({
    start: day,
    count: done.filter((item) => item.completedOn === day).length,
  }));
}

/**
 * The row of weeks in which everything due was done (see `Statistics.streakWeeks`). The week view's
 * own counting decides whether a week is complete, so this and "Stand" never disagree.
 */
export function streakWeeks(
  tasks: readonly Task[],
  completions: readonly Completion[],
  today: CalendarDay,
): number {
  // Nothing happened before the oldest due date or tick-off; going further back changes nothing.
  const oldest = [
    ...tasks.map((task) => task.dueDate),
    ...completions.map((completion) => completion.previousDueDate),
  ].reduce<CalendarDay | undefined>(
    (min, day) => (min === undefined || day < min ? day : min),
    undefined,
  );
  if (oldest === undefined) {
    return 0;
  }
  const thisMonday = startOfWeek(today);
  const oldestMonday = startOfWeek(oldest);
  let streak = 0;
  for (let monday = thisMonday; monday >= oldestMonday; monday = addDays(monday, -7)) {
    const { progress } = weekView({
      tasks,
      completions,
      shownDay: monday,
      today,
      filter: "all",
      person: "personA",
    });
    if (progress.due === 0) {
      continue;
    }
    if (progress.done === progress.due) {
      streak += 1;
    } else if (monday !== thisMonday) {
      break;
    }
  }
  return streak;
}

function byTitle(a: Task, b: Task): number {
  return a.title.localeCompare(b.title, "de");
}

export function statistics(input: StatisticsInput): Statistics {
  const { tasks, completions, today, period } = input;
  const range = rangeOf(period, today);
  const previousRange = previousRangeOf(period, range);
  const done = completions.filter((completion) => within(completion.completedOn, range));
  const taskById = new Map(tasks.map((task) => [task.id, task]));

  const counts = new Map<string, number>();
  for (const completion of done) {
    counts.set(completion.taskId, (counts.get(completion.taskId) ?? 0) + 1);
  }
  const top = [...counts]
    .flatMap(([taskId, count]) => {
      const task = taskById.get(taskId);
      return task === undefined ? [] : [{ task, count }];
    })
    .sort((a, b) => b.count - a.count || byTitle(a.task, b.task))
    .slice(0, 3);

  return {
    period,
    range,
    previousRange,
    total: done.length,
    previousTotal: completions.filter((completion) => within(completion.completedOn, previousRange))
      .length,
    streakWeeks: streakWeeks(tasks, completions, today),
    barUnit: period === "year" ? "month" : "day",
    bars: barsOf(period, range, done),
    byPerson: {
      personA: done.filter((completion) => completion.completedBy === "personA").length,
      personB: done.filter((completion) => completion.completedBy === "personB").length,
    },
    takenOver: done.filter(
      (completion) =>
        completion.assigneeAtCompletion !== undefined &&
        completion.assigneeAtCompletion !== "both" &&
        completion.assigneeAtCompletion !== completion.completedBy,
    ).length,
    top,
  };
}
