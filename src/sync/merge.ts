// Puts the server's state and the changes still waiting together (stage 2). A device keeps
// the last state it got from the server (`base`) and the changes the server has not confirmed yet
// (the outbox). What the app shows is the base with the outbox carried out on top, so the person
// sees their own changes at once, also offline, and a new state of the server never throws them
// away. Both steps are idempotent: getting a row twice, or an overlapping stretch of changes,
// changes nothing.

import type { Completion, Task } from "../domain/task";
import type { AppData } from "../storage/appData";
import { checkCompletion, checkSettings, checkTask } from "../storage/validate";
import { applyChange, type Change } from "./changes";
import type { PullResult } from "./remote";

/**
 * Takes the rows the server sent over into the base: new and changed ones replace, deleted go.
 * Every row is checked like a backup first (K2b): the server keeps what a member sends without
 * looking inside, and one unreadable row must not make the whole copy unreadable. Such a row stays
 * out (the device keeps what it had), and so does a completion whose task is not there.
 */
export function mergeDelta(base: AppData, delta: PullResult): AppData {
  const tasks = new Map<string, Task>(base.tasks.map((task) => [task.id, task]));
  for (const row of delta.tasks) {
    if (row.deleted || row.task === undefined) {
      tasks.delete(row.id);
      continue;
    }
    const task = checkTask(row.task);
    if (task?.id === row.id) {
      tasks.set(row.id, task); // a Map keeps the place of a task that was there already
    }
  }

  const completions = new Map<string, Completion>(
    base.completions.map((completion) => [completion.id, completion]),
  );
  for (const row of delta.completions) {
    if (row.deleted || row.completion === undefined) {
      completions.delete(row.id);
      continue;
    }
    const completion = checkCompletion(row.completion);
    if (completion?.id === row.id) {
      completions.set(row.id, completion);
    }
  }

  const settings = delta.settings === undefined ? undefined : checkSettings(delta.settings);
  return {
    ...base,
    settings: settings ?? base.settings,
    tasks: [...tasks.values()],
    completions: [...completions.values()].filter((completion) => tasks.has(completion.taskId)),
  };
}

/** What the app shows: the base with every waiting change carried out on top. */
export function viewOf(base: AppData, outbox: readonly Change[]): AppData {
  return outbox.reduce((data, change) => applyChange(data, change).data, base);
}
