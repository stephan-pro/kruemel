// The server as the sync sees it. Implementations: `FakeRemote` (in memory, for unit tests),
// `FakeHttpRemote` (against the fake server of the end-to-end tests) and `SupabaseRemote` (E2-3).
// They all follow the same rules (`changes.ts`), and one series of contract tests runs against
// each of them. Each sends the `schemaVersion` of the app it runs in (version protection).

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
  /** The newest `schemaVersion` that wrote to the household; newer than the app's = app is behind. */
  readonly schemaVersion: number;
  readonly tasks: readonly TaskRow[];
  /** Oldest first. */
  readonly completions: readonly CompletionRow[];
  /** Only when they changed. */
  readonly settings?: Settings;
}

/**
 * The server could not be reached or failed; whatever was asked can be tried again later. With
 * `permanent` the server refused the call itself (invalid data, not allowed): trying the same again
 * will not help (from E2-3c such a change is moved aside).
 */
export class RemoteError extends Error {
  constructor(
    message: string,
    readonly permanent = false,
  ) {
    super(message);
    this.name = "RemoteError";
  }
}

/**
 * Whether a failed call may work later, by the HTTP status of the answer (0 = no answer): no
 * connection, a timeout, an expired session, too many calls or a server failure.
 */
export function isTemporaryStatus(status: number): boolean {
  return status === 0 || status === 401 || status === 408 || status === 429 || status >= 500;
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
