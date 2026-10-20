// The unit of the sync (stage 2): a change of the shared data. `diffData` derives the changes from
// two states of `AppData` (the storage gets whole data from the app and works out what happened),
// `applyChange` carries one out. Both the device (to show its own changes at once, before the
// server has seen them) and the fake server use `applyChange`, so they follow the same rules:
//
// - Editing sends only the fields that changed, so editing different fields of a task on two
//   devices keeps both; for the same field the change that reaches the server last wins. The
//   checklist counts as one field.
// - Ticking off the same pass of a task twice counts once (the second one is rejected).
// - Undo only works for the last completion of a task.
// - Deleting wins against editing: a deleted task is not brought back by an edit.
//
// Pure: no storage, no network, no clock.

import type { Completion, Person, Task } from "../domain/task";
import type { AppData, PersonNames } from "../storage/appData";
import type { ConflictReason } from "../storage/storage";

/** The fields of a task to set and to remove (optional fields that were cleared). */
export interface TaskPatch {
  readonly set: Readonly<Record<string, unknown>>;
  readonly unset: readonly string[];
}

export type ChangeBody =
  | { readonly type: "setNames"; readonly names: PersonNames }
  /** Edits a task; `create` is the whole task when it is new (an edit alone never creates one). */
  | {
      readonly type: "saveTask";
      readonly taskId: string;
      readonly patch: TaskPatch;
      readonly create?: Task;
    }
  | { readonly type: "deleteTask"; readonly taskId: string }
  /** Ticks off: the new completion and what happens to the task (next due date, checklist, …). */
  | { readonly type: "complete"; readonly completion: Completion; readonly patch: TaskPatch }
  /** Takes back a completion and gives the task its earlier state back. */
  | { readonly type: "undo"; readonly completionId: string; readonly patch: TaskPatch }
  /** Replaces everything (restoring a backup); only works online. */
  | { readonly type: "replaceAll"; readonly data: AppData };

/** A change with the id the server uses to recognise a repeated delivery. */
export type Change = ChangeBody & { readonly id: string };

export type PushResult =
  | { readonly status: "applied" }
  | { readonly status: "rejected"; readonly reason: "alreadyDone"; readonly by: Person }
  | {
      readonly status: "rejected";
      readonly reason: Exclude<ConflictReason, "alreadyDone">;
    };

const APPLIED: PushResult = { status: "applied" };

function rejected(reason: Exclude<ConflictReason, "alreadyDone">): PushResult {
  return { status: "rejected", reason };
}

const NO_PATCH: TaskPatch = { set: {}, unset: [] };

export function isEmptyPatch(patch: TaskPatch): boolean {
  return Object.keys(patch.set).length === 0 && patch.unset.length === 0;
}

/** Structural equality of plain data (objects, lists, text, numbers, truth values). */
export function isDeepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
    return false;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((item, index) => isDeepEqual(item, b[index]))
    );
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return (
    keys.length === Object.keys(right).length &&
    keys.every((key) => key in right && isDeepEqual(left[key], right[key]))
  );
}

/** What turns `before` into `after`: changed or new fields are set, vanished ones are unset. */
export function taskPatch(before: Task, after: Task): TaskPatch {
  const old = before as unknown as Record<string, unknown>;
  const next = after as unknown as Record<string, unknown>;
  const set: Record<string, unknown> = {};
  const unset: string[] = [];
  for (const key of new Set([...Object.keys(old), ...Object.keys(next)])) {
    if (!(key in next)) {
      unset.push(key);
    } else if (!(key in old) || !isDeepEqual(old[key], next[key])) {
      set[key] = next[key];
    }
  }
  return { set, unset };
}

/** The patch of a new task: all fields. */
function fullPatch(task: Task): TaskPatch {
  return { set: { ...(task as unknown as Record<string, unknown>) }, unset: [] };
}

export function applyPatch(task: Task, patch: TaskPatch): Task {
  const fields: Record<string, unknown> = { ...(task as unknown as Record<string, unknown>) };
  Object.assign(fields, patch.set);
  for (const key of patch.unset) {
    delete fields[key];
  }
  return fields as unknown as Task;
}

/**
 * What the app did, as changes in a sensible order: names, deletions, then per task (in the order
 * of `after`) its new state, completions and undos. A completion or an undo carries the change of
 * its task with it, so the server does both in one step. Completions whose task is gone, and
 * completions that were only edited, produce nothing.
 */
export function diffData(before: AppData, after: AppData): ChangeBody[] {
  const changes: ChangeBody[] = [];
  const names = after.settings.personNames;
  if (names !== undefined && !isDeepEqual(before.settings.personNames, names)) {
    changes.push({ type: "setNames", names });
  }

  const afterTaskIds = new Set(after.tasks.map((task) => task.id));
  const beforeTasks = new Map(before.tasks.map((task) => [task.id, task]));
  for (const task of before.tasks) {
    if (!afterTaskIds.has(task.id)) {
      changes.push({ type: "deleteTask", taskId: task.id });
    }
  }

  const beforeCompletionIds = new Set(before.completions.map((completion) => completion.id));
  const afterCompletionIds = new Set(after.completions.map((completion) => completion.id));
  // Latest first, so each undo is the last completion of its task at the moment it is sent.
  const removed = before.completions
    .filter((completion) => !afterCompletionIds.has(completion.id))
    .reverse();
  const added = after.completions.filter((completion) => !beforeCompletionIds.has(completion.id));

  for (const task of after.tasks) {
    const old = beforeTasks.get(task.id);
    const isNew = old === undefined;
    if (isNew) {
      changes.push({ type: "saveTask", taskId: task.id, patch: fullPatch(task), create: task });
    }
    const steps: ChangeBody[] = [
      ...(isNew ? [] : removed.filter((c) => c.taskId === task.id)).map(
        (completion): ChangeBody => ({
          type: "undo",
          completionId: completion.id,
          patch: NO_PATCH,
        }),
      ),
      ...added
        .filter((c) => c.taskId === task.id)
        .map((completion): ChangeBody => ({ type: "complete", completion, patch: NO_PATCH })),
    ];
    const patch = old === undefined ? NO_PATCH : taskPatch(old, task);
    const last = steps[steps.length - 1];
    if (last !== undefined && (last.type === "undo" || last.type === "complete")) {
      // The task's own change travels with the last step; the earlier steps only do their part.
      steps[steps.length - 1] = { ...last, patch };
    } else if (!isEmptyPatch(patch)) {
      steps.push({ type: "saveTask", taskId: task.id, patch });
    }
    changes.push(...steps);
  }
  return changes;
}

/** The most recent completion of the task (the list is oldest first). */
function lastCompletionOf(
  completions: readonly Completion[],
  taskId: string,
): Completion | undefined {
  for (let index = completions.length - 1; index >= 0; index--) {
    const completion = completions[index] as Completion;
    if (completion.taskId === taskId) {
      return completion;
    }
  }
  return undefined;
}

function replaceTask(tasks: readonly Task[], task: Task): Task[] {
  return tasks.map((candidate) => (candidate.id === task.id ? task : candidate));
}

/**
 * Carries a change out on `data`. If the other side would not take it over, the data stay as they
 * are and the result says why. `deletedTaskIds` are tasks that were deleted before (only the
 * server knows them): an edit never brings them back.
 */
export function applyChange(
  data: AppData,
  change: ChangeBody,
  deletedTaskIds: ReadonlySet<string> = new Set(),
): { readonly data: AppData; readonly result: PushResult } {
  const keep = (result: PushResult) => ({ data, result });
  switch (change.type) {
    case "setNames":
      return {
        data: { ...data, settings: { ...data.settings, personNames: change.names } },
        result: APPLIED,
      };

    case "saveTask": {
      const task = data.tasks.find((candidate) => candidate.id === change.taskId);
      if (task === undefined) {
        if (change.create === undefined || deletedTaskIds.has(change.taskId)) {
          return keep(rejected("taskGone"));
        }
        return { data: { ...data, tasks: [...data.tasks, change.create] }, result: APPLIED };
      }
      return {
        data: { ...data, tasks: replaceTask(data.tasks, applyPatch(task, change.patch)) },
        result: APPLIED,
      };
    }

    case "deleteTask":
      return {
        data: {
          ...data,
          tasks: data.tasks.filter((task) => task.id !== change.taskId),
          completions: data.completions.filter((completion) => completion.taskId !== change.taskId),
        },
        result: APPLIED,
      };

    case "complete": {
      const { completion } = change;
      const task = data.tasks.find((candidate) => candidate.id === completion.taskId);
      if (task === undefined) {
        return keep(rejected("taskGone"));
      }
      if (data.completions.some((candidate) => candidate.id === completion.id)) {
        return keep(APPLIED); // the same change delivered again
      }
      const sameRound = data.completions.find(
        (candidate) =>
          candidate.taskId === completion.taskId &&
          candidate.previousDueDate === completion.previousDueDate,
      );
      if (sameRound !== undefined) {
        return keep({ status: "rejected", reason: "alreadyDone", by: sameRound.completedBy });
      }
      return {
        data: {
          ...data,
          tasks: replaceTask(data.tasks, applyPatch(task, change.patch)),
          completions: [...data.completions, completion],
        },
        result: APPLIED,
      };
    }

    case "undo": {
      const completion = data.completions.find((candidate) => candidate.id === change.completionId);
      if (completion === undefined) {
        return keep(rejected("completionGone"));
      }
      if (lastCompletionOf(data.completions, completion.taskId)?.id !== completion.id) {
        return keep(rejected("notLast"));
      }
      const task = data.tasks.find((candidate) => candidate.id === completion.taskId);
      return {
        data: {
          ...data,
          tasks:
            task === undefined
              ? data.tasks
              : replaceTask(data.tasks, applyPatch(task, change.patch)),
          completions: data.completions.filter((candidate) => candidate.id !== completion.id),
        },
        result: APPLIED,
      };
    }

    case "replaceAll":
      return { data: change.data, result: APPLIED };
  }
}
