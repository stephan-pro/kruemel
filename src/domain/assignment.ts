// Responsibility (F5): fixed assignment, taking over (once / permanently) and the "only mine" filter.

import {
  type Assignee,
  isAssignee,
  isPerson,
  type Person,
  type Task,
  withoutTakeOver,
} from "./task";

/** Whether a takeover applies to this cycle only or replaces the fixed assignment. */
export type TakeOverMode = "once" | "permanently";

/** "Nur dieses Mal" is the default answer of the takeover question. */
export const DEFAULT_TAKE_OVER_MODE: TakeOverMode = "once";

export type TaskFilter = "all" | "mine";

/** Who has to do the task right now: a one-time takeover wins over the fixed assignment. */
export function effectiveAssignee(task: Task): Assignee {
  return task.kind === "recurring" && task.takenOverBy !== undefined
    ? task.takenOverBy
    : task.assignee;
}

/** "Both" counts as mine for each of the two people. */
export function isMine(task: Task, person: Person): boolean {
  const assignee = effectiveAssignee(task);
  return assignee === "both" || assignee === person;
}

/** "All" keeps every task; "mine" keeps those the person is responsible for (incl. "both"). */
export function filterTasks(
  tasks: readonly Task[],
  filter: TaskFilter,
  currentPerson: Person,
): Task[] {
  return filter === "all" ? [...tasks] : tasks.filter((task) => isMine(task, currentPerson));
}

/** Changes the fixed assignment at any time. A pending one-time takeover ends with it. */
export function reassign(task: Task, assignee: Assignee): Task {
  if (!isAssignee(assignee)) {
    throw new RangeError("Ungültige Zuständigkeit: Person A, Person B oder beide");
  }
  return task.kind === "recurring" ? { ...withoutTakeOver(task), assignee } : { ...task, assignee };
}

/** Only recurring tasks ask "nur dieses Mal oder dauerhaft"; a one-off task is simply handed over. */
export function needsTakeOverChoice(task: Task): boolean {
  return task.kind === "recurring";
}

/**
 * "Übernehmen": the person takes the task over.
 * - Recurring, once (default): only this cycle; the next cycle has the fixed assignee again.
 * - Recurring, permanently: the person becomes the fixed assignee.
 * - One-off: handed over directly, `mode` is not needed.
 */
export function takeOver(
  task: Task,
  person: Person,
  mode: TakeOverMode = DEFAULT_TAKE_OVER_MODE,
): Task {
  if (!isPerson(person)) {
    throw new RangeError("Übernehmen kann nur Person A oder Person B");
  }
  if (task.kind === "oneOff" || mode === "permanently") {
    return reassign(task, person);
  }
  // Taking over "once" for the person who is assigned anyway just ends an earlier takeover.
  return person === task.assignee ? withoutTakeOver(task) : { ...task, takenOverBy: person };
}
