// Tasks (recurring and one-off), the next-due-date rule (F2), completing and undoing.
// The cycle of a recurring task starts on the day it is completed, not on the old due date.
// All functions are pure; "today" and ids come in as parameters.

import {
  type ChecklistItem,
  checkedItemIds,
  resetChecklistChecks,
  restoreChecklistChecks,
} from "./checklist";
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

interface TaskBase {
  readonly id: string;
  readonly title: string;
  /** The fixed assignment; it is what applies again in every new cycle. */
  readonly assignee: Assignee;
  readonly note?: string;
  readonly dueDate: CalendarDay;
  readonly checklist: readonly ChecklistItem[];
}

export interface RecurringTask extends TaskBase {
  readonly kind: "recurring";
  readonly recurrence: Recurrence;
  /** Someone took the task over for this cycle only; cleared when the task is completed (F5). */
  readonly takenOverBy?: Person;
}

/** A task that is done once; after completing it lives in the "Erledigt" list (F3). */
export interface OneOffTask extends TaskBase {
  readonly kind: "oneOff";
  readonly done: boolean;
}

export type Task = RecurringTask | OneOffTask;

/** One completion of a task. Keeps what is needed so that undo can restore the earlier state. */
export interface Completion {
  readonly id: string;
  readonly taskId: string;
  readonly completedOn: CalendarDay;
  readonly completedBy: Person;
  /** The due date the task had before it was completed. */
  readonly previousDueDate: CalendarDay;
  /** The due date the completion produced; only recurring tasks get one. */
  readonly nextDueDate?: CalendarDay;
  /** Checklist items that were ticked when the task was completed (restored by undo). */
  readonly checkedItemIds: readonly string[];
  /** The one-time takeover that was active when the task was completed (restored by undo). */
  readonly previousTakenOverBy?: Person;
}

export interface CompleteInput {
  /** Id of the new completion; created by the caller (the domain has no id source). */
  readonly completionId: string;
  readonly completedOn: CalendarDay;
  readonly completedBy: Person;
}

export interface TaskState {
  readonly task: Task;
  /** Completions of any tasks, oldest first; functions only look at those of `task`. */
  readonly completions: readonly Completion[];
}

export interface NewRecurringTask {
  readonly id: string;
  readonly title: string;
  readonly recurrence: Recurrence;
  readonly assignee: Assignee;
  /** The first due date, chosen by the user (the form pre-fills today). */
  readonly dueDate: CalendarDay;
  readonly note?: string;
}

export interface NewOneOffTask {
  readonly id: string;
  readonly title: string;
  readonly assignee: Assignee;
  readonly dueDate: CalendarDay;
  readonly note?: string;
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

export function isPerson(value: unknown): value is Person {
  return value === "personA" || value === "personB";
}

export function isAssignee(value: unknown): value is Assignee {
  return isPerson(value) || value === "both";
}

function newTaskBase(input: {
  id: string;
  title: string;
  assignee: Assignee;
  dueDate: CalendarDay;
  note?: string | undefined;
}): TaskBase {
  const title = input.title.trim();
  if (title === "") {
    throw new RangeError("Eine Aufgabe braucht einen Titel");
  }
  if (!isAssignee(input.assignee)) {
    throw new RangeError("Ungültige Zuständigkeit: Person A, Person B oder beide");
  }
  const note = input.note?.trim();
  return {
    id: input.id,
    title,
    assignee: input.assignee,
    dueDate: input.dueDate,
    checklist: [],
    ...(note ? { note } : {}),
  };
}

/** A new recurring task (F1); its first due date is the one the user chose. */
export function createRecurringTask(input: NewRecurringTask): RecurringTask {
  if (!isRecurrence(input.recurrence)) {
    throw new RangeError("Ungültiger Rhythmus: Einheit und ganze Zahl ab 1 erforderlich");
  }
  return { ...newTaskBase(input), kind: "recurring", recurrence: input.recurrence };
}

/** A new one-off task (F3): title, due date, assignee and an optional note. */
export function createOneOffTask(input: NewOneOffTask): OneOffTask {
  return { ...newTaskBase(input), kind: "oneOff", done: false };
}

/** A one-off task that is done is no longer open; recurring tasks are always open. */
export function isOpen(task: Task): boolean {
  return task.kind === "recurring" || !task.done;
}

/** The tasks that still show up in the week view, i.e. without done one-off tasks (F3). */
export function openTasks(tasks: readonly Task[]): Task[] {
  return tasks.filter(isOpen);
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

/** The task without a one-time takeover, so its fixed assignee applies again. */
export function withoutTakeOver(task: RecurringTask): RecurringTask {
  const { takenOverBy: _takenOverBy, ...rest } = task;
  return rest;
}

/**
 * Ticks a task off and records a new completion (newest last).
 * - Recurring: it gets its next due date, a one-time takeover ends and all checklist ticks are
 *   reset (the items stay).
 * - One-off: it is marked done and moves to "Erledigt"; its checklist stays as it was.
 */
export function completeTask(state: TaskState, input: CompleteInput): TaskState {
  const { task } = state;
  const base = {
    id: input.completionId,
    taskId: task.id,
    completedOn: input.completedOn,
    completedBy: input.completedBy,
    previousDueDate: task.dueDate,
    checkedItemIds: checkedItemIds(task),
  };
  if (task.kind === "oneOff") {
    if (task.done) {
      throw new RangeError("Die Aufgabe ist bereits erledigt");
    }
    return { task: { ...task, done: true }, completions: [...state.completions, base] };
  }
  const due = nextDueDate(task.recurrence, input.completedOn);
  const completion: Completion = {
    ...base,
    nextDueDate: due,
    ...(task.takenOverBy === undefined ? {} : { previousTakenOverBy: task.takenOverBy }),
  };
  return {
    task: resetChecklistChecks({ ...withoutTakeOver(task), dueDate: due }),
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

/**
 * Takes back the last completion and removes it. A recurring task gets its previous due date,
 * its ticks and its one-time takeover back; a one-off task is open again.
 */
export function undoCompletion(state: TaskState, completionId: string): TaskState {
  const last = lastCompletion(state);
  if (last === undefined || last.id !== completionId) {
    throw new RangeError("Nur das letzte Abhaken einer Aufgabe lässt sich rückgängig machen");
  }
  const { task } = state;
  const restored: Task =
    task.kind === "oneOff"
      ? { ...task, done: false }
      : restoreChecklistChecks(
          {
            ...withoutTakeOver(task),
            dueDate: last.previousDueDate,
            ...(last.previousTakenOverBy === undefined
              ? {}
              : { takenOverBy: last.previousTakenOverBy }),
          },
          last.checkedItemIds,
        );
  return {
    task: restored,
    completions: state.completions.filter((completion) => completion.id !== completionId),
  };
}
