// Managing tasks (F1, F3): the list of open tasks and deleting a task together with its history.

import {
  type CompleteInput,
  type Completion,
  completeTask,
  isOpen,
  type OneOffTask,
  type RecurringTask,
  type Task,
  undoCompletion,
} from "./task";

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

function findTask(tasks: readonly Task[], taskId: string): Task {
  const task = tasks.find((candidate) => candidate.id === taskId);
  if (task === undefined) {
    throw new RangeError(`Aufgabe nicht gefunden: ${taskId}`);
  }
  return task;
}

/** Ticks a task off in the data: the task changes and the new completion is appended (F2). */
export function completeInData<T extends TasksAndCompletions>(
  data: T,
  taskId: string,
  input: CompleteInput,
): { readonly data: T; readonly task: Task; readonly completion: Completion } {
  const state = completeTask(
    { task: findTask(data.tasks, taskId), completions: data.completions },
    input,
  );
  return {
    data: {
      ...data,
      tasks: data.tasks.map((task) => (task.id === taskId ? state.task : task)),
      completions: state.completions,
    },
    task: state.task,
    completion: state.completions[state.completions.length - 1] as Completion,
  };
}

/**
 * Takes back a completion in the data; only the last one of its task can be taken back (F2).
 * The task gets its earlier state back and the completion is removed.
 */
export function undoInData<T extends TasksAndCompletions>(
  data: T,
  completionId: string,
): { readonly data: T; readonly task: Task } {
  const completion = data.completions.find((candidate) => candidate.id === completionId);
  if (completion === undefined) {
    throw new RangeError(`Erledigung nicht gefunden: ${completionId}`);
  }
  const state = undoCompletion(
    { task: findTask(data.tasks, completion.taskId), completions: data.completions },
    completionId,
  );
  return {
    data: {
      ...data,
      tasks: data.tasks.map((task) => (task.id === state.task.id ? state.task : task)),
      completions: state.completions,
    },
    task: state.task,
  };
}

/**
 * Removes the task and all of its completions. The history goes with it (decision of F3): without
 * its task an entry in "Erledigt" could neither be shown nor taken back.
 */
export function deleteTask<T extends TasksAndCompletions>(data: T, taskId: string): T {
  findTask(data.tasks, taskId);
  return {
    ...data,
    tasks: data.tasks.filter((task) => task.id !== taskId),
    completions: data.completions.filter((completion) => completion.taskId !== taskId),
  };
}
