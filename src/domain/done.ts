// The "Erledigt" list (F3): every completed one-off task and every completed pass of a recurring
// task, newest first, without any limit.

import type { Completion, Task } from "./task";

export interface DoneEntry {
  readonly completion: Completion;
  readonly task: Task;
  /** Only the last completion of a task can be taken back. */
  readonly canUndo: boolean;
}

/**
 * All completions as list entries, newest first (same day: the one ticked off later comes first).
 * `completions` are oldest first. Completions whose task no longer exists are left out.
 */
export function doneEntries(
  tasks: readonly Task[],
  completions: readonly Completion[],
): DoneEntry[] {
  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const lastIdByTask = new Map<string, string>();
  for (const completion of completions) {
    lastIdByTask.set(completion.taskId, completion.id);
  }
  const entries: { entry: DoneEntry; position: number }[] = [];
  completions.forEach((completion, position) => {
    const task = taskById.get(completion.taskId);
    if (task !== undefined) {
      const canUndo = lastIdByTask.get(completion.taskId) === completion.id;
      entries.push({ entry: { completion, task, canUndo }, position });
    }
  });
  entries.sort(
    (a, b) =>
      b.entry.completion.completedOn.localeCompare(a.entry.completion.completedOn) ||
      b.position - a.position,
  );
  return entries.map(({ entry }) => entry);
}
