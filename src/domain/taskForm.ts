// The task form (F1, F3): checks what the user typed and turns it into a new or changed task.
// The fields arrive as plain text, exactly as a form delivers them; every message is meant to be
// shown right next to its field.

import { reassign } from "./assignment";
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
}

export type TaskFormField =
  | "title"
  | "symbol"
  | "interval"
  | "unit"
  | "dueDate"
  | "assignee"
  | "note";

/** The fields in the order the form shows them; the first one with an error gets the focus. */
export const TASK_FORM_FIELD_ORDER: readonly TaskFormField[] = [
  "title",
  "symbol",
  "interval",
  "unit",
  "dueDate",
  "assignee",
  "note",
];

/** One message per field that is wrong; fields that are fine are missing. */
export type TaskFormErrors = Partial<Record<TaskFormField, string>>;

/** The checked and cleaned-up values. */
export interface TaskFormValues {
  readonly title: string;
  readonly symbol: TaskSymbolId;
  readonly dueDate: CalendarDay;
  readonly assignee: Assignee;
  readonly note?: string;
  /** Present for recurring tasks only. */
  readonly recurrence?: Recurrence;
}

export type TaskFormResult =
  | { readonly ok: true; readonly values: TaskFormValues }
  | { readonly ok: false; readonly errors: TaskFormErrors };

function isUnit(value: string): value is RecurrenceUnit {
  return value === "day" || value === "week" || value === "month";
}

function titleError(title: string): string | undefined {
  if (title === "") {
    return "Bitte einen Titel eingeben.";
  }
  if (title.length > MAX_TITLE_LENGTH) {
    return `Der Titel darf höchstens ${MAX_TITLE_LENGTH} Zeichen lang sein.`;
  }
  return undefined;
}

function dueDateError(dueDate: string): string | undefined {
  if (dueDate === "") {
    return "Bitte ein Datum angeben.";
  }
  if (!isCalendarDay(dueDate)) {
    return "Bitte ein gültiges Datum angeben.";
  }
  if (dueDate < MIN_DUE_DATE || dueDate > MAX_DUE_DATE) {
    return `Bitte ein Datum zwischen ${MIN_DUE_DATE.slice(0, 4)} und ${MAX_DUE_DATE.slice(0, 4)} wählen.`;
  }
  return undefined;
}

function intervalError(interval: string): string | undefined {
  if (interval === "") {
    return "Bitte eine Zahl eingeben.";
  }
  if (!/^\d+$/.test(interval) || Number(interval) < 1) {
    return "Bitte eine ganze Zahl ab 1 eingeben.";
  }
  if (Number(interval) > MAX_RECURRENCE_INTERVAL) {
    return `Bitte höchstens ${MAX_RECURRENCE_INTERVAL} eingeben.`;
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

  const found: [TaskFormField, string | undefined][] = [
    ["title", titleError(title)],
    ["symbol", isTaskSymbolId(input.symbol) ? undefined : "Bitte ein Symbol auswählen."],
    ["dueDate", dueDateError(dueDate)],
    ["assignee", isAssignee(input.assignee) ? undefined : "Bitte auswählen, wer zuständig ist."],
    [
      "note",
      note.length > MAX_NOTE_LENGTH
        ? `Die Notiz darf höchstens ${MAX_NOTE_LENGTH} Zeichen lang sein.`
        : undefined,
    ],
  ];
  if (kind === "recurring") {
    found.push(
      ["interval", intervalError(interval)],
      ["unit", isUnit(input.unit) ? undefined : "Bitte Tage, Wochen oder Monate auswählen."],
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
  if (kind === "oneOff") {
    return createOneOffTask(common);
  }
  if (values.recurrence === undefined) {
    throw new RangeError("Eine wiederkehrende Aufgabe braucht einen Rhythmus");
  }
  return createRecurringTask({ ...common, recurrence: values.recurrence });
}

/**
 * The task with the checked values applied; its kind, checklist and (for a one-off task) done
 * state stay. A new fixed assignee ends a one-time takeover (F5); if the assignee is the same, the
 * takeover stays.
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
  };
  if (task.kind === "oneOff") {
    return base as OneOffTask;
  }
  const recurrence = values.recurrence ?? task.recurrence;
  return { ...base, recurrence } as RecurringTask;
}
