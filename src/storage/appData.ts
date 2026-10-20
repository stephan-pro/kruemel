// The data the app keeps (and exports): settings, tasks and completions, tagged with a schema version.
// Plain data only; the rules about it live in `src/domain/`.

import type { Completion, Task } from "../domain/task";

/**
 * Bumped whenever the stored shape changes in a way old files cannot be read as-is; `migrate.ts`
 * brings older data up to this version. Version 2 (F8): every task has a `symbol`. Version 3
 * (stage 2): a completion may have `completedAt` and `assigneeAtCompletion` (for the statistics).
 */
export const SCHEMA_VERSION = 3;

/** The names of the two people, chosen once on first start (F5). */
export interface PersonNames {
  readonly personA: string;
  readonly personB: string;
}

export interface Settings {
  /** Missing until the first-time setup has been done. */
  readonly personNames?: PersonNames;
}

export interface AppData {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly settings: Settings;
  readonly tasks: readonly Task[];
  /** Completions of all tasks, oldest first. */
  readonly completions: readonly Completion[];
}

/** What the app starts with when nothing has been stored yet. */
export function emptyAppData(): AppData {
  return { schemaVersion: SCHEMA_VERSION, settings: {}, tasks: [], completions: [] };
}
