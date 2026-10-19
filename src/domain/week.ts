// The week view (F6): what is due on which day of a Monday-to-Sunday week, what is overdue, and
// what was done in weeks that are over. Pure functions; "today" and the shown week come in as
// parameters.

import { isMine, type TaskFilter } from "./assignment";
import { type CalendarDay, compareDays, daysBetween, startOfWeek, weekDays } from "./date";
import { type Completion, isOpen, type Person, type Task } from "./task";

/** A task that still has to be done. `daysOverdue` is 0 unless its due date is before today. */
export interface OpenWeekEntry {
  readonly kind: "open";
  readonly task: Task;
  readonly daysOverdue: number;
}

/** A task that was ticked off; only shown in weeks that are over (greyed out in the UI). */
export interface DoneWeekEntry {
  readonly kind: "done";
  readonly task: Task;
  readonly completion: Completion;
}

export type WeekEntry = OpenWeekEntry | DoneWeekEntry;

/** The shown week lies before, contains, or lies after today. */
export type WeekPosition = "past" | "current" | "future";

export interface WeekDayView {
  readonly day: CalendarDay;
  readonly isToday: boolean;
  /** Open entries first, then done ones, each by title. */
  readonly entries: readonly WeekEntry[];
}

/**
 * How far the week is ("Stand"): `due` counts every round of a task with its due date in the week,
 * the ticked-off ones included; `done` counts those ticked off.
 */
export interface WeekProgress {
  readonly done: number;
  readonly due: number;
}

export interface WeekView {
  readonly position: WeekPosition;
  /** Monday to Sunday. */
  readonly days: readonly WeekDayView[];
  /** Open tasks whose due date has passed, oldest first; only in the current week (see below). */
  readonly overdue: readonly OpenWeekEntry[];
  readonly progress: WeekProgress;
}

export interface WeekViewInput {
  readonly tasks: readonly Task[];
  /** Completions of any tasks, oldest first. */
  readonly completions: readonly Completion[];
  /** Any day of the week to show. */
  readonly shownDay: CalendarDay;
  readonly today: CalendarDay;
  readonly filter: TaskFilter;
  /** "Ich bin"; decides what "only mine" keeps. */
  readonly person: Person;
}

function byTitle(a: Task, b: Task): number {
  return a.title.localeCompare(b.title, "de");
}

/** Open entries before done ones. */
function rank(entry: WeekEntry): number {
  return entry.kind === "open" ? 0 : 1;
}

function byKindThenTitle(a: WeekEntry, b: WeekEntry): number {
  return rank(a) - rank(b) || byTitle(a.task, b.task);
}

function positionOf(shownDay: CalendarDay, today: CalendarDay): WeekPosition {
  const order = compareDays(startOfWeek(shownDay), startOfWeek(today));
  return order < 0 ? "past" : order > 0 ? "future" : "current";
}

/**
 * The tasks of one week.
 * - A task stands on its due date. A recurring task has only one due date, its next real one, so
 *   there is no preview of later dates.
 * - Overdue tasks (due before today) stand at the top of the current week instead of on their old
 *   day. Other weeks show them only where they belong by date: a week that is over keeps its
 *   unfinished tasks on their day (marked overdue); future weeks have none.
 * - Weeks that are over also show what was ticked off, on the day it was due. The current and
 *   future weeks do not: a ticked-off task is gone from the plan (F3).
 * - "Only mine" keeps what the person is responsible for, "both" included.
 * - The progress counts the rounds due in the week, in every week, whether they are shown or not
 *   (overdue tasks from earlier weeks do not count; ticked-off ones do).
 */
export function weekView(input: WeekViewInput): WeekView {
  const { completions, shownDay, today, filter, person } = input;
  const position = positionOf(shownDay, today);
  const visibleTasks = input.tasks.filter((task) => filter === "all" || isMine(task, person));
  const entriesByDay = new Map<CalendarDay, WeekEntry[]>(
    weekDays(shownDay).map((day) => [day, []]),
  );
  const overdue: OpenWeekEntry[] = [];
  let openDue = 0;
  let done = 0;

  for (const task of visibleTasks.filter(isOpen)) {
    const daysOverdue = Math.max(0, daysBetween(task.dueDate, today));
    const entry: OpenWeekEntry = { kind: "open", task, daysOverdue };
    if (entriesByDay.has(task.dueDate)) {
      openDue += 1;
    }
    if (position === "current" && daysOverdue > 0) {
      overdue.push(entry);
    } else {
      entriesByDay.get(task.dueDate)?.push(entry);
    }
  }

  const taskById = new Map(visibleTasks.map((task) => [task.id, task]));
  for (const completion of completions) {
    const task = taskById.get(completion.taskId);
    const day = entriesByDay.get(completion.previousDueDate);
    if (task === undefined || day === undefined) {
      continue;
    }
    done += 1;
    if (position === "past") {
      day.push({ kind: "done", task, completion });
    }
  }

  return {
    progress: { done, due: done + openDue },
    position,
    days: [...entriesByDay].map(([day, entries]) => ({
      day,
      isToday: day === today,
      entries: entries.sort(byKindThenTitle),
    })),
    overdue: overdue.sort(
      (a, b) => a.task.dueDate.localeCompare(b.task.dueDate) || byTitle(a.task, b.task),
    ),
  };
}
