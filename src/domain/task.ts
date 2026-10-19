// Recurring tasks and the next-due-date rule (F2): the cycle starts on the day a task is
// completed, not on the old due date. All functions are pure; "today" and ids come in as parameters.

import { addDays, addMonths, addWeeks, type CalendarDay } from "./date";

export type Person = "personA" | "personB";

/** Who is responsible for a task. */
export type Assignee = Person | "both";

export type RecurrenceUnit = "day" | "week" | "month";

/** "Every `interval` days/weeks/months", e.g. { unit: "week", interval: 2 } = every 2 weeks. */
export interface Recurrence {
  readonly unit: RecurrenceUnit;
  /** Positive whole number. */
  readonly interval: number;
}

export interface RecurringTask {
  readonly id: string;
  readonly title: string;
  readonly recurrence: Recurrence;
  readonly assignee: Assignee;
  readonly note?: string;
  readonly dueDate: CalendarDay;
}

/** One completion of a task. Keeps both dates so that undo can restore the previous one. */
export interface Completion {
  readonly id: string;
  readonly taskId: string;
  readonly completedOn: CalendarDay;
  readonly completedBy: Person;
  /** The due date the task had before it was completed. */
  readonly previousDueDate: CalendarDay;
  /** The due date the completion produced. */
  readonly nextDueDate: CalendarDay;
}

export interface CompleteInput {
  /** Id of the new completion; created by the caller (the domain has no id source). */
  readonly completionId: string;
  readonly completedOn: CalendarDay;
  readonly completedBy: Person;
}

export interface TaskState {
  readonly task: RecurringTask;
  readonly completions: readonly Completion[];
}

/** True for a whole number of at least 1 with a known unit. */
export function isRecurrence(value: unknown): value is Recurrence {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { unit, interval } = value as { unit?: unknown; interval?: unknown };
  return (
    (unit === "day" || unit === "week" || unit === "month") &&
    typeof interval === "number" &&
    Number.isInteger(interval) &&
    interval >= 1
  );
}

/**
 * The next due date, counted from the day the task was completed.
 * Monthly rhythms keep the day of the month; in a shorter month they land on its last day.
 */
export function nextDueDate(recurrence: Recurrence, completedOn: CalendarDay): CalendarDay {
  if (!isRecurrence(recurrence)) {
    throw new RangeError("Ungültiger Rhythmus: Einheit und ganze Zahl ab 1 erforderlich");
  }
  switch (recurrence.unit) {
    case "day":
      return addDays(completedOn, recurrence.interval);
    case "week":
      return addWeeks(completedOn, recurrence.interval);
    case "month":
      return addMonths(completedOn, recurrence.interval);
  }
}

/** Ticks a task off: it gets its next due date and a new completion is recorded (newest last). */
export function completeTask(state: TaskState, input: CompleteInput): TaskState {
  const due = nextDueDate(state.task.recurrence, input.completedOn);
  const completion: Completion = {
    id: input.completionId,
    taskId: state.task.id,
    completedOn: input.completedOn,
    completedBy: input.completedBy,
    previousDueDate: state.task.dueDate,
    nextDueDate: due,
  };
  return {
    task: { ...state.task, dueDate: due },
    completions: [...state.completions, completion],
  };
}

/** The most recent completion of the task, if any. */
export function lastCompletion(state: TaskState): Completion | undefined {
  for (let index = state.completions.length - 1; index >= 0; index--) {
    const completion = state.completions[index] as Completion;
    if (completion.taskId === state.task.id) {
      return completion;
    }
  }
  return undefined;
}

/** Undo is only allowed for the last completion of a task. */
export function canUndoCompletion(state: TaskState, completionId: string): boolean {
  return lastCompletion(state)?.id === completionId;
}

/** Takes back the last completion: the previous due date returns and the completion is removed. */
export function undoCompletion(state: TaskState, completionId: string): TaskState {
  const last = lastCompletion(state);
  if (last === undefined || last.id !== completionId) {
    throw new RangeError("Nur das letzte Abhaken einer Aufgabe lässt sich rückgängig machen");
  }
  return {
    task: { ...state.task, dueDate: last.previousDueDate },
    completions: state.completions.filter((completion) => completion.id !== completionId),
  };
}
