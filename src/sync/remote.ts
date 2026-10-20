// The server as the sync sees it. Implementations: `FakeRemote` (in memory, for unit tests),
// `FakeHttpRemote` (against the fake server of the end-to-end tests) and, from E2-3, the one for
// Supabase. They all follow the same rules (`changes.ts`), and one series of contract tests runs
// against each of them.

import type { Completion, Task } from "../domain/task";
import type { Settings } from "../storage/appData";
import type { Change, PushResult } from "./changes";

/** A task as the server keeps it. A deleted task stays as a "tombstone" so that devices that were
 * offline learn about it. */
export interface TaskRow {
  readonly id: string;
  /** The `schemaVersion` the row was written with. */
  readonly schemaVersion: number;
  readonly deleted: boolean;
  /** Missing when `deleted`. */
  readonly task?: Task;
}

export interface CompletionRow {
  readonly id: string;
  readonly taskId: string;
  readonly schemaVersion: number;
  readonly deleted: boolean;
  /** Missing when `deleted`. */
  readonly completion?: Completion;
}

/** What changed on the server since the cursor (everything when there was none). */
export interface PullResult {
  /** Opaque; pass it to the next `pull`. */
  readonly cursor: string;
  readonly tasks: readonly TaskRow[];
  /** Oldest first. */
  readonly completions: readonly CompletionRow[];
  /** Only when they changed. */
  readonly settings?: Settings;
}

/** The server could not be reached or failed; whatever was asked can be tried again later. */
export class RemoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RemoteError";
  }
}

export interface Remote {
  /** Throws `RemoteError` if the server cannot be reached. */
  pull(cursor: string | null): Promise<PullResult>;
  /**
   * Hands one change over. A change delivered twice (same `id`) counts once. Throws `RemoteError`
   * if the server cannot be reached; then it is unknown whether the change arrived.
   */
  push(change: Change): Promise<PushResult>;
  /** Calls `hint` when the server data changed (a hint only; the data come from `pull`). */
  subscribe(hint: () => void): () => void;
}
