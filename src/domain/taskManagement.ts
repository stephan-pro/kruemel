// Managing tasks (F1, F3): the list of open tasks and deleting a task together with its history.

import type { Completion, OneOffTask, RecurringTask, Task } from "./task";
import { isOpen } from "./task";

/** The open tasks, split by kind. Within a group: earliest due date first, then by title. */
export interface TaskGroups {
  readonly recurring: readonly RecurringTask[];
  readonly oneOff: readonly OneOffTask[];
}

function byDueDateThenTitle(a: Task, b: Task): number {
  return a.dueDate.localeCompare(b.dueDate) || a.title.localeCompare(b.title, "de");
}

/** What the "Aufgaben" page lists. Done one-off tasks are not listed; they live in "Erledigt". */
export function groupOpenTasks(tasks: readonly Task[]): TaskGroups {
  const open = tasks.filter(isOpen).sort(byDueDateThenTitle);
  return {
    recurring: open.filter((task): task is RecurringTask => task.kind === "recurring"),
    oneOff: open.filter((task): task is OneOffTask => task.kind === "oneOff"),
  };
}

/** How many completions (entries in "Erledigt") belong to the task. */
export function completionCount(completions: readonly Completion[], taskId: string): number {
  return completions.filter((completion) => completion.taskId === taskId).length;
}

export interface TasksAndCompletions {
  readonly tasks: readonly Task[];
  readonly completions: readonly Completion[];
}

/**
 * Removes the task and all of its completions. The history goes with it (decision of F3): without
 * its task an entry in "Erledigt" could neither be shown nor taken back.
 */
export function deleteTask<T extends TasksAndCompletions>(data: T, taskId: string): T {
  if (!data.tasks.some((task) => task.id === taskId)) {
    throw new RangeError(`Aufgabe nicht gefunden: ${taskId}`);
  }
  return {
    ...data,
    tasks: data.tasks.filter((task) => task.id !== taskId),
    completions: data.completions.filter((completion) => completion.taskId !== taskId),
  };
}
