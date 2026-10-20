// "Heute" (DESIGN.md section 5): the tasks of one day for the person, overdue ones first, and what
// was ticked off that day. Pure functions; "today" comes in as a parameter.

import { isMine, type TaskFilter } from "./assignment";
import { type CalendarDay, daysBetween } from "./date";
import { type Completion, isOpen, type Person, type Task } from "./task";
import type { DoneWeekEntry, OpenWeekEntry } from "./week";

export interface DayListInput {
  readonly tasks: readonly Task[];
  /** Completions of any tasks, oldest first. */
  readonly completions: readonly Completion[];
  /** The day to list. */
  readonly day: CalendarDay;
  readonly today: CalendarDay;
  readonly filter: TaskFilter;
  /** "Ich bin"; decides what "Meine" keeps. */
  readonly person: Person;
}

export interface DayList {
  /** Open tasks: overdue ones first (oldest first), then the others by title. */
  readonly open: readonly OpenWeekEntry[];
  /** Ticked off on this day, in the order they were ticked off. */
  readonly done: readonly DoneWeekEntry[];
}

function byTitle(a: Task, b: Task): number {
  return a.title.localeCompare(b.title, "de");
}

/**
 * What stands on `day`.
 * - Open: the tasks due that day. On today the overdue tasks (due before today) come first, since
 *   nobody else shows them; on any other day an unfinished task of an earlier day stands there
 *   marked overdue.
 * - Done: the rounds ticked off on that day (`completedOn`), whenever they were due.
 */
export function dayList(input: DayListInput): DayList {
  const { completions, day, today, filter, person } = input;
  const visible = input.tasks.filter((task) => filter === "all" || isMine(task, person));

  const open: OpenWeekEntry[] = visible
    .filter(isOpen)
    .filter((task) => task.dueDate === day || (day === today && task.dueDate < today))
    .map((task) => ({
      kind: "open" as const,
      task,
      daysOverdue: Math.max(0, daysBetween(task.dueDate, today)),
    }))
    .sort(
      (a, b) =>
        b.daysOverdue - a.daysOverdue ||
        a.task.dueDate.localeCompare(b.task.dueDate) ||
        byTitle(a.task, b.task),
    );

  const taskById = new Map(visible.map((task) => [task.id, task]));
  const done: DoneWeekEntry[] = [];
  for (const completion of completions) {
    const task = taskById.get(completion.taskId);
    if (task !== undefined && completion.completedOn === day) {
      done.push({ kind: "done", task, completion });
    }
  }
  return { open, done };
}
