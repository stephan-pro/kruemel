// Shared building blocks for the domain tests (not part of the app, excluded from coverage).

import { calendarDay } from "./date";
import {
  completeTask,
  type OneOffTask,
  type Person,
  type RecurringTask,
  type TaskState,
} from "./task";

export const d = calendarDay;

export function recurringTask(overrides: Partial<RecurringTask> = {}): RecurringTask {
  return {
    kind: "recurring",
    id: "task-1",
    title: "Bad putzen",
    recurrence: { unit: "week", interval: 1 },
    assignee: "personA",
    dueDate: d("2026-10-19"),
    checklist: [],
    ...overrides,
  };
}

export function oneOffTask(overrides: Partial<OneOffTask> = {}): OneOffTask {
  return {
    kind: "oneOff",
    id: "task-2",
    title: "Paket abholen",
    assignee: "personB",
    dueDate: d("2026-10-22"),
    done: false,
    checklist: [],
    ...overrides,
  };
}

export function stateOf(task: TaskState["task"]): TaskState {
  return { task, completions: [] };
}

export function tickOff(
  state: TaskState,
  completedOn: string,
  completionId = "c-1",
  completedBy: Person = "personA",
): TaskState {
  return completeTask(state, { completionId, completedOn: d(completedOn), completedBy });
}
