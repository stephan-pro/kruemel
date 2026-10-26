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
import { t } from "../i18n";
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

/**
 * The words of the places found wrong ("tasks[0].title: fehlt"): in the language set when the data
 * is checked, since they are shown to the person (folded, as details for troubleshooting).
 */
const words = () => t().validation;

/** What a field should have been, in words. */
const shape = () => t().validation.expected;

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

/** An ISO 8601 moment in UTC as `Date.prototype.toISOString` writes it ("2026-10-21T08:30:00.000Z"). */
function isTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function readRecord(
  value: unknown,
  path: string,
  context: Context,
): Record<string, unknown> | undefined {
  if (isRecord(value)) {
    return value;
  }
  fail(context, path, words().expectedObject);
  return undefined;
}

function readList(value: unknown, path: string, context: Context): unknown[] | undefined {
  if (Array.isArray(value)) {
    return value;
  }
  fail(context, path, words().expectedList);
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
  fail(
    context,
    `${path}.${key}`,
    value === undefined ? words().missing : words().invalid(expected),
  );
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
      fail(context, path, words().duplicate(id));
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
  const id = required(record, "id", path, context, isFilledText, shape().id);
  const text = required(record, "text", path, context, isFilledText, shape().text);
  const checked = required(record, "checked", path, context, isBoolean, shape().bool);
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
  const id = required(record, "id", path, context, isFilledText, shape().id);
  const title = required(record, "title", path, context, isFilledText, shape().title);
  const symbol = required(record, "symbol", path, context, isTaskSymbolId, shape().symbol);
  const assignee = required(record, "assignee", path, context, isAssignee, shape().assignee);
  const dueDate = required(record, "dueDate", path, context, isCalendarDay, shape().date);
  const note = optional(record, "note", path, context, isText, shape().text);
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
      shape().recurrence,
    );
    const takenOverBy = optional(record, "takenOverBy", path, context, isPerson, shape().person);
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
    const done = required(record, "done", path, context, isBoolean, shape().bool);
    return base === undefined || done === undefined ? undefined : { ...base, kind: "oneOff", done };
  }
  fail(context, `${path}.kind`, words().expectedKind);
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
  const id = required(record, "id", path, context, isFilledText, shape().id);
  const taskId = required(record, "taskId", path, context, isFilledText, shape().id);
  const completedOn = required(record, "completedOn", path, context, isCalendarDay, shape().date);
  const completedBy = required(record, "completedBy", path, context, isPerson, shape().person);
  const previousDueDate = required(
    record,
    "previousDueDate",
    path,
    context,
    isCalendarDay,
    shape().date,
  );
  const nextDueDate = optional(record, "nextDueDate", path, context, isCalendarDay, shape().date);
  const checkedItemIds = required(
    record,
    "checkedItemIds",
    path,
    context,
    isIdList,
    shape().idList,
  );
  const previousTakenOverBy = optional(
    record,
    "previousTakenOverBy",
    path,
    context,
    isPerson,
    shape().person,
  );
  const completedAt = optional(
    record,
    "completedAt",
    path,
    context,
    isTimestamp,
    shape().timestamp,
  );
  const assigneeAtCompletion = optional(
    record,
    "assigneeAtCompletion",
    path,
    context,
    isAssignee,
    shape().assignee,
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
    ...(completedAt === undefined ? {} : { completedAt }),
    ...(assigneeAtCompletion === undefined ? {} : { assigneeAtCompletion }),
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
  const personA = required(names, "personA", namesPath, context, isFilledText, shape().name);
  const personB = required(names, "personB", namesPath, context, isFilledText, shape().name);
  return personA === undefined || personB === undefined
    ? undefined
    : { personNames: { personA: personA.trim(), personB: personB.trim() } satisfies PersonNames };
}

/** One value checked on its own; `undefined` if anything about it is wrong, also an optional field. */
function checked<T>(
  parse: (value: unknown, path: string, context: Context) => T | undefined,
  value: unknown,
): T | undefined {
  const context: Context = { errors: [] };
  const result = parse(value, "", context);
  return context.errors.length === 0 ? result : undefined;
}

/**
 * A task, a completion or the settings as the server sends them (stage 2, K2b), checked like those
 * of a backup: the server stores what a member sends without looking inside.
 */
export function checkTask(value: unknown): Task | undefined {
  return checked(parseTask, value);
}

export function checkCompletion(value: unknown): Completion | undefined {
  return checked(parseCompletion, value);
}

export function checkSettings(value: unknown): Settings | undefined {
  return checked(parseSettings, value);
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
      fail(context, `completions[${index}].taskId`, words().noTask(completion.taskId));
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
