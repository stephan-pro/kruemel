// The task form (F1, F3): checks what the user typed and turns it into a new or changed task.
// The fields arrive as plain text, exactly as a form delivers them; every message is meant to be
// shown right next to its field.

import { reassign } from "./assignment";
import type { ChecklistItem } from "./checklist";
import { type CalendarDay, isCalendarDay } from "./date";
import {
  type Assignee,
  createOneOffTask,
  createRecurringTask,
  isAssignee,
  type OneOffTask,
  type Recurrence,
  type RecurrenceUnit,
  type RecurringTask,
  type Task,
} from "./task";
import { isTaskSymbolId, type TaskSymbolId } from "./taskSymbols";

export const MAX_TITLE_LENGTH = 80;
export const MAX_NOTE_LENGTH = 500;
/** Longest text of one checklist item, and most items a task can carry (F4). */
export const MAX_CHECKLIST_ITEM_LENGTH = 80;
export const MAX_CHECKLIST_ITEMS = 50;
/** Highest "every N" accepted; far more than anyone needs, but keeps dates inside the calendar. */
export const MAX_RECURRENCE_INTERVAL = 365;
/** Due dates outside these years are almost surely typos (and would break the date arithmetic). */
export const MIN_DUE_DATE = "2000-01-01";
export const MAX_DUE_DATE = "2100-12-31";

export type TaskKind = Task["kind"];

/** What the form holds; all fields are text (`assignee` is empty while nothing is chosen). */
export interface TaskFormInput {
  readonly title: string;
  /** Id of the chosen symbol (F8); the form starts with the default symbol. */
  readonly symbol: string;
  readonly dueDate: string;
  readonly assignee: string;
  readonly note: string;
  /** Only used for recurring tasks. */
  readonly interval: string;
  readonly unit: string;
  /**
   * The items of the checklist as the form holds them (F4), ticks included. Missing = the form has
   * no checklist field and the task keeps the one it has.
   */
  readonly checklist?: readonly ChecklistItem[];
}

export type TaskFormField =
  | "title"
  | "symbol"
  | "interval"
  | "unit"
  | "dueDate"
  | "assignee"
  | "note"
  | "checklist";

/** The fields in the order the form shows them; the first one with an error gets the focus. */
export const TASK_FORM_FIELD_ORDER: readonly TaskFormField[] = [
  "title",
  "symbol",
  "interval",
  "unit",
  "dueDate",
  "assignee",
  "note",
  "checklist",
];

/**
 * What is wrong with a field, as a code the page puts into words (in the language set when it
 * shows them): `limit` is the number the message speaks of (a longest length, a highest number).
 */
export interface TaskFormError {
  readonly code:
    | "titleEmpty"
    | "titleTooLong"
    | "dateEmpty"
    | "dateInvalid"
    | "dateOutOfRange"
    | "symbolMissing"
    | "assigneeMissing"
    | "noteTooLong"
    | "checklistTooMany"
    | "checklistItemInvalid"
    | "checklistTextEmpty"
    | "checklistTextTooLong"
    | "intervalEmpty"
    | "intervalInvalid"
    | "intervalTooBig"
    | "unitMissing";
  readonly limit?: number;
}

/** One error per field that is wrong; fields that are fine are missing. */
export type TaskFormErrors = Partial<Record<TaskFormField, TaskFormError>>;

/** The checked and cleaned-up values. */
export interface TaskFormValues {
  readonly title: string;
  readonly symbol: TaskSymbolId;
  readonly dueDate: CalendarDay;
  readonly assignee: Assignee;
  readonly note?: string;
  /** Present for recurring tasks only. */
  readonly recurrence?: Recurrence;
  /** The checklist to keep; missing = a new task has none, a changed task keeps its own. */
  readonly checklist?: readonly ChecklistItem[];
}

export type TaskFormResult =
  | { readonly ok: true; readonly values: TaskFormValues }
  | { readonly ok: false; readonly errors: TaskFormErrors };

function isUnit(value: string): value is RecurrenceUnit {
  return value === "day" || value === "week" || value === "month";
}

function titleError(title: string): TaskFormError | undefined {
  if (title === "") {
    return { code: "titleEmpty" };
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return { code: "titleTooLong", limit: MAX_TITLE_LENGTH };
  }
  return undefined;
}

function dueDateError(dueDate: string): TaskFormError | undefined {
  if (dueDate === "") {
    return { code: "dateEmpty" };
  }
  if (!isCalendarDay(dueDate)) {
    return { code: "dateInvalid" };
  }
  if (dueDate < MIN_DUE_DATE || dueDate > MAX_DUE_DATE) {
    return { code: "dateOutOfRange" };
  }
  return undefined;
}

/** What is wrong with the text of a new checklist item, if anything. The text is trimmed first. */
export function checklistItemError(text: string): TaskFormError | undefined {
  const trimmed = text.trim();
  if (trimmed === "") {
    return { code: "checklistTextEmpty" };
  }
  if (trimmed.length > MAX_CHECKLIST_ITEM_LENGTH) {
    return { code: "checklistTextTooLong", limit: MAX_CHECKLIST_ITEM_LENGTH };
  }
  return undefined;
}

function checklistError(items: readonly ChecklistItem[]): TaskFormError | undefined {
  if (items.length > MAX_CHECKLIST_ITEMS) {
    return { code: "checklistTooMany", limit: MAX_CHECKLIST_ITEMS };
  }
  return items.some((item) => checklistItemError(item.text) !== undefined)
    ? { code: "checklistItemInvalid", limit: MAX_CHECKLIST_ITEM_LENGTH }
    : undefined;
}

function intervalError(interval: string): TaskFormError | undefined {
  if (interval === "") {
    return { code: "intervalEmpty" };
  }
  if (!/^\d+$/.test(interval) || Number(interval) < 1) {
    return { code: "intervalInvalid" };
  }
  if (Number(interval) > MAX_RECURRENCE_INTERVAL) {
    return { code: "intervalTooBig", limit: MAX_RECURRENCE_INTERVAL };
  }
  return undefined;
}

/**
 * Checks the form of a new or changed task of the given kind. Texts are trimmed; an empty note is
 * left out. A one-off task ignores the rhythm fields.
 */
export function checkTaskForm(kind: TaskKind, input: TaskFormInput): TaskFormResult {
  const title = input.title.trim();
  const dueDate = input.dueDate.trim();
  const interval = input.interval.trim();
  const note = input.note.trim();
  const errors: TaskFormErrors = {};

  const found: [TaskFormField, TaskFormError | undefined][] = [
    ["title", titleError(title)],
    ["symbol", isTaskSymbolId(input.symbol) ? undefined : { code: "symbolMissing" }],
    ["dueDate", dueDateError(dueDate)],
    ["assignee", isAssignee(input.assignee) ? undefined : { code: "assigneeMissing" }],
    [
      "note",
      note.length > MAX_NOTE_LENGTH ? { code: "noteTooLong", limit: MAX_NOTE_LENGTH } : undefined,
    ],
    ["checklist", input.checklist === undefined ? undefined : checklistError(input.checklist)],
  ];
  if (kind === "recurring") {
    found.push(
      ["interval", intervalError(interval)],
      ["unit", isUnit(input.unit) ? undefined : { code: "unitMissing" }],
    );
  }
  for (const [field, message] of found) {
    if (message !== undefined) {
      errors[field] = message;
    }
  }
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const values = {
    title,
    symbol: input.symbol as TaskSymbolId,
    dueDate: dueDate as CalendarDay,
    assignee: input.assignee as Assignee,
    ...(note === "" ? {} : { note }),
    ...(kind === "recurring"
      ? { recurrence: { unit: input.unit as RecurrenceUnit, interval: Number(interval) } }
      : {}),
    ...(input.checklist === undefined
      ? {}
      : { checklist: input.checklist.map((item) => ({ ...item, text: item.text.trim() })) }),
  };
  return { ok: true, values };
}

/** The field that comes first in the form among those with an error, if any. */
export function firstTaskFormError(errors: TaskFormErrors): TaskFormField | undefined {
  return TASK_FORM_FIELD_ORDER.find((field) => errors[field] !== undefined);
}

/** A new task from checked values; `id` is created by the caller (the domain has no id source). */
export function taskFromForm(kind: TaskKind, id: string, values: TaskFormValues): Task {
  const common = {
    id,
    title: values.title,
    symbol: values.symbol,
    assignee: values.assignee,
    dueDate: values.dueDate,
    ...(values.note === undefined ? {} : { note: values.note }),
  };
  const checklist = values.checklist ?? [];
  if (kind === "oneOff") {
    return { ...createOneOffTask(common), checklist };
  }
  if (values.recurrence === undefined) {
    throw new RangeError("Eine wiederkehrende Aufgabe braucht einen Rhythmus");
  }
  return { ...createRecurringTask({ ...common, recurrence: values.recurrence }), checklist };
}

/**
 * The task with the checked values applied; its kind and (for a one-off task) done state stay, and
 * so does its checklist unless the values carry a new one (F4). A new fixed assignee ends a
 * one-time takeover (F5); if the assignee is the same, the takeover stays.
 */
export function updateTask(task: Task, values: TaskFormValues): Task {
  const changed = task.assignee === values.assignee ? task : reassign(task, values.assignee);
  const { note: _note, ...withoutNote } = changed;
  const base = {
    ...withoutNote,
    title: values.title,
    symbol: values.symbol,
    dueDate: values.dueDate,
    ...(values.note === undefined ? {} : { note: values.note }),
    ...(values.checklist === undefined ? {} : { checklist: values.checklist }),
  };
  if (task.kind === "oneOff") {
    return base as OneOffTask;
  }
  const recurrence = values.recurrence ?? task.recurrence;
  return { ...base, recurrence } as RecurringTask;
}
