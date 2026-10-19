// Checks untrusted data (an import file or whatever is in the browser storage) and turns it into
// `AppData`. Older versions are migrated first (`migrate.ts`). Nothing is taken over unchecked:
// every field is validated and only known fields are copied, so unknown extras in a file are
// dropped.

import type { ChecklistItem } from "../domain/checklist";
import { isCalendarDay } from "../domain/date";
import {
  type Completion,
  isAssignee,
  isPerson,
  isRecurrence,
  type Recurrence,
  type Task,
} from "../domain/task";
import { isTaskSymbolId } from "../domain/taskSymbols";
import { type AppData, type PersonNames, SCHEMA_VERSION, type Settings } from "./appData";
import { migrateAppData } from "./migrate";

export type ParseResult =
  | { readonly ok: true; readonly data: AppData }
  | { readonly ok: false; readonly errors: readonly string[] };

/** More errors than this are cut off; a broken file would otherwise drown the message. */
const MAX_ERRORS = 10;

interface Context {
  readonly errors: string[];
}

type Guard<T> = (value: unknown) => value is T;

function fail(context: Context, path: string, message: string): void {
  if (context.errors.length < MAX_ERRORS) {
    context.errors.push(`${path}: ${message}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string";
}

function isFilledText(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function readRecord(
  value: unknown,
  path: string,
  context: Context,
): Record<string, unknown> | undefined {
  if (isRecord(value)) {
    return value;
  }
  fail(context, path, "erwartet ein Objekt");
  return undefined;
}

function readList(value: unknown, path: string, context: Context): unknown[] | undefined {
  if (Array.isArray(value)) {
    return value;
  }
  fail(context, path, "erwartet eine Liste");
  return undefined;
}

/** A field that must be there and pass the guard. */
function required<T>(
  record: Record<string, unknown>,
  key: string,
  path: string,
  context: Context,
  guard: Guard<T>,
  expected: string,
): T | undefined {
  const value = record[key];
  if (guard(value)) {
    return value;
  }
  fail(context, `${path}.${key}`, value === undefined ? "fehlt" : `ungültig, erwartet ${expected}`);
  return undefined;
}

/** A field that may be missing; if it is there it must pass the guard. */
function optional<T>(
  record: Record<string, unknown>,
  key: string,
  path: string,
  context: Context,
  guard: Guard<T>,
  expected: string,
): T | undefined {
  return record[key] === undefined
    ? undefined
    : required(record, key, path, context, guard, expected);
}

function noDuplicateIds(ids: readonly string[], path: string, context: Context): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      fail(context, path, `die Kennung „${id}“ kommt mehrfach vor`);
    }
    seen.add(id);
  }
}

function parseChecklistItem(
  value: unknown,
  path: string,
  context: Context,
): ChecklistItem | undefined {
  const record = readRecord(value, path, context);
  if (record === undefined) {
    return undefined;
  }
  const id = required(record, "id", path, context, isFilledText, "eine Kennung");
  const text = required(record, "text", path, context, isFilledText, "einen Text");
  const checked = required(record, "checked", path, context, isBoolean, "wahr oder falsch");
  return id === undefined || text === undefined || checked === undefined
    ? undefined
    : { id, text, checked };
}

function parseChecklist(
  value: unknown,
  path: string,
  context: Context,
): ChecklistItem[] | undefined {
  const list = readList(value, path, context);
  if (list === undefined) {
    return undefined;
  }
  const items = list.map((entry, index) => parseChecklistItem(entry, `${path}[${index}]`, context));
  noDuplicateIds(
    items.flatMap((item) => (item === undefined ? [] : [item.id])),
    path,
    context,
  );
  return items.every((item) => item !== undefined) ? (items as ChecklistItem[]) : undefined;
}

function isRecurrenceValue(value: unknown): value is Recurrence {
  return isRecurrence(value);
}

function parseTask(value: unknown, path: string, context: Context): Task | undefined {
  const record = readRecord(value, path, context);
  if (record === undefined) {
    return undefined;
  }
  const id = required(record, "id", path, context, isFilledText, "eine Kennung");
  const title = required(record, "title", path, context, isFilledText, "einen Titel");
  const symbol = required(
    record,
    "symbol",
    path,
    context,
    isTaskSymbolId,
    "ein Symbol aus der Liste",
  );
  const assignee = required(
    record,
    "assignee",
    path,
    context,
    isAssignee,
    "personA, personB oder both",
  );
  const dueDate = required(record, "dueDate", path, context, isCalendarDay, "ein Datum JJJJ-MM-TT");
  const note = optional(record, "note", path, context, isText, "einen Text");
  const checklist = parseChecklist(record.checklist, `${path}.checklist`, context);

  const base =
    id === undefined ||
    title === undefined ||
    symbol === undefined ||
    assignee === undefined ||
    dueDate === undefined ||
    checklist === undefined
      ? undefined
      : {
          id,
          title,
          symbol,
          assignee,
          dueDate,
          checklist,
          ...(note === undefined ? {} : { note }),
        };

  if (record.kind === "recurring") {
    const recurrence = required(
      record,
      "recurrence",
      path,
      context,
      isRecurrenceValue,
      "unit und interval",
    );
    const takenOverBy = optional(
      record,
      "takenOverBy",
      path,
      context,
      isPerson,
      "personA oder personB",
    );
    return base === undefined || recurrence === undefined
      ? undefined
      : {
          ...base,
          kind: "recurring",
          recurrence: { unit: recurrence.unit, interval: recurrence.interval },
          ...(takenOverBy === undefined ? {} : { takenOverBy }),
        };
  }
  if (record.kind === "oneOff") {
    const done = required(record, "done", path, context, isBoolean, "wahr oder falsch");
    return base === undefined || done === undefined ? undefined : { ...base, kind: "oneOff", done };
  }
  fail(context, `${path}.kind`, "erwartet recurring oder oneOff");
  return undefined;
}

function isIdList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isFilledText);
}

function parseCompletion(value: unknown, path: string, context: Context): Completion | undefined {
  const record = readRecord(value, path, context);
  if (record === undefined) {
    return undefined;
  }
  const id = required(record, "id", path, context, isFilledText, "eine Kennung");
  const taskId = required(record, "taskId", path, context, isFilledText, "eine Kennung");
  const completedOn = required(
    record,
    "completedOn",
    path,
    context,
    isCalendarDay,
    "ein Datum JJJJ-MM-TT",
  );
  const completedBy = required(
    record,
    "completedBy",
    path,
    context,
    isPerson,
    "personA oder personB",
  );
  const previousDueDate = required(
    record,
    "previousDueDate",
    path,
    context,
    isCalendarDay,
    "ein Datum JJJJ-MM-TT",
  );
  const nextDueDate = optional(
    record,
    "nextDueDate",
    path,
    context,
    isCalendarDay,
    "ein Datum JJJJ-MM-TT",
  );
  const checkedItemIds = required(
    record,
    "checkedItemIds",
    path,
    context,
    isIdList,
    "eine Liste von Kennungen",
  );
  const previousTakenOverBy = optional(
    record,
    "previousTakenOverBy",
    path,
    context,
    isPerson,
    "personA oder personB",
  );
  if (
    id === undefined ||
    taskId === undefined ||
    completedOn === undefined ||
    completedBy === undefined ||
    previousDueDate === undefined ||
    checkedItemIds === undefined
  ) {
    return undefined;
  }
  return {
    id,
    taskId,
    completedOn,
    completedBy,
    previousDueDate,
    checkedItemIds: [...checkedItemIds],
    ...(nextDueDate === undefined ? {} : { nextDueDate }),
    ...(previousTakenOverBy === undefined ? {} : { previousTakenOverBy }),
  };
}

function parseSettings(value: unknown, path: string, context: Context): Settings | undefined {
  const record = readRecord(value, path, context);
  if (record === undefined) {
    return undefined;
  }
  if (record.personNames === undefined) {
    return {};
  }
  const namesPath = `${path}.personNames`;
  const names = readRecord(record.personNames, namesPath, context);
  if (names === undefined) {
    return undefined;
  }
  const personA = required(names, "personA", namesPath, context, isFilledText, "einen Namen");
  const personB = required(names, "personB", namesPath, context, isFilledText, "einen Namen");
  return personA === undefined || personB === undefined
    ? undefined
    : { personNames: { personA: personA.trim(), personB: personB.trim() } satisfies PersonNames };
}

/**
 * Checks the whole structure and the references between tasks and completions. Data of an older
 * version is migrated first; the result is always in the current version.
 */
export function parseAppData(value: unknown): ParseResult {
  const migrated = migrateAppData(value);
  if (!migrated.ok) {
    return migrated;
  }
  const context: Context = { errors: [] };
  const root = migrated.value;

  const settings = parseSettings(root.settings, "settings", context);
  const taskList = readList(root.tasks, "tasks", context);
  const completionList = readList(root.completions, "completions", context);
  const tasks = taskList?.map((entry, index) => parseTask(entry, `tasks[${index}]`, context));
  const completions = completionList?.map((entry, index) =>
    parseCompletion(entry, `completions[${index}]`, context),
  );

  const taskIds = (tasks ?? []).flatMap((task) => (task === undefined ? [] : [task.id]));
  noDuplicateIds(taskIds, "tasks", context);
  const completionIds = (completions ?? []).flatMap((completion) =>
    completion === undefined ? [] : [completion.id],
  );
  noDuplicateIds(completionIds, "completions", context);
  const knownTaskIds = new Set(taskIds);
  // Only when every task could be read; otherwise each unreadable task would also be reported as
  // a "missing task" for its completions.
  const allTasksRead = tasks?.every((task) => task !== undefined) ?? false;
  completions?.forEach((completion, index) => {
    if (allTasksRead && completion !== undefined && !knownTaskIds.has(completion.taskId)) {
      fail(context, `completions[${index}].taskId`, `es gibt keine Aufgabe „${completion.taskId}“`);
    }
  });

  if (
    context.errors.length > 0 ||
    settings === undefined ||
    tasks === undefined ||
    completions === undefined
  ) {
    return { ok: false, errors: context.errors };
  }
  return {
    ok: true,
    data: {
      schemaVersion: SCHEMA_VERSION,
      settings,
      tasks: tasks as Task[],
      completions: completions as Completion[],
    },
  };
}
