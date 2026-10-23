// `Remote` for Supabase (E2-3): every change is one database function of `supabase/migrations/`,
// the pull is `pull_changes`, and Realtime only gives hints (the data always come from the pull).
// The client is the app's signed-in one (`createSupabaseClient`); Realtime takes its session on its
// own.
//
// Errors: no connection, a timeout, an expired session (401), a server failure (5xx) or a function
// the server does not have yet (not updated) can be tried again later (`RemoteError`). Everything
// else is the server refusing the call itself (`RemoteError` with `permanent`).

import type { SupabaseClient } from "@supabase/supabase-js";
import { SCHEMA_VERSION } from "../storage/appData";
import type { Change, PushResult } from "./changes";
import { isTemporaryStatus, type PullResult, type Remote, RemoteError } from "./remote";

export interface SupabaseRemoteOptions {
  /** The app's `schemaVersion`; default `SCHEMA_VERSION` (tests play other versions). */
  readonly schemaVersion?: number;
  /** How long a call may take before it counts as failed; default 20 s. */
  readonly timeoutMs?: number;
}

/** The tables whose changes concern the data (names and version, tasks, completions). */
const WATCHED_TABLES = ["households", "tasks", "completions"] as const;

/** The database function and its arguments for a change. */
export function rpcFor(
  change: Change,
  schemaVersion: number,
): { readonly name: string; readonly args: Record<string, unknown> } {
  const base = { p_change_id: change.id, p_schema_version: schemaVersion };
  switch (change.type) {
    case "setNames":
      return { name: "set_names", args: { ...base, p_names: change.names } };
    case "saveTask":
      return {
        name: "save_task",
        args: {
          ...base,
          p_task_id: change.taskId,
          p_set: change.patch.set,
          p_unset: change.patch.unset,
          p_create: change.create ?? null,
        },
      };
    case "deleteTask":
      return { name: "delete_task", args: { ...base, p_task_id: change.taskId } };
    case "complete":
      return {
        name: "complete_task",
        args: {
          ...base,
          p_completion: change.completion,
          p_set: change.patch.set,
          p_unset: change.patch.unset,
        },
      };
    case "undo":
      return {
        name: "undo_completion",
        args: {
          ...base,
          p_completion_id: change.completionId,
          p_set: change.patch.set,
          p_unset: change.patch.unset,
        },
      };
    case "replaceAll":
      // The version is that of the data (a backup the app brought up to date).
      return {
        name: "replace_household_data",
        args: { p_change_id: change.id, p_data: change.data },
      };
    case "addAll":
      return {
        name: "add_household_data",
        args: { ...base, p_data: { tasks: change.tasks, completions: change.completions } },
      };
  }
}

/** Whether a failed call may work later (HTTP status of the answer; 0 = no answer). */
export function isTemporary(status: number, code: string | undefined): boolean {
  return isTemporaryStatus(status) || (status === 404 && code === "PGRST202");
}

interface RpcAnswer {
  readonly data: unknown;
  readonly error: { readonly message: string; readonly code?: string } | null;
  readonly status: number;
}

export class SupabaseRemote implements Remote {
  private readonly schemaVersion: number;
  private readonly timeoutMs: number;

  constructor(
    private readonly client: SupabaseClient,
    options: SupabaseRemoteOptions = {},
  ) {
    this.schemaVersion = options.schemaVersion ?? SCHEMA_VERSION;
    this.timeoutMs = options.timeoutMs ?? 20_000;
  }

  async pull(cursor: string | null): Promise<PullResult> {
    const data = await this.call("pull_changes", { p_cursor: cursor });
    if (typeof (data as Partial<PullResult> | null)?.cursor !== "string") {
      throw new RemoteError("Unlesbare Antwort des Servers auf den Abruf.");
    }
    return data as PullResult;
  }

  async push(change: Change): Promise<PushResult> {
    const { name, args } = rpcFor(change, this.schemaVersion);
    const data = await this.call(name, args);
    if (typeof (data as Partial<PushResult> | null)?.status !== "string") {
      throw new RemoteError("Unlesbare Antwort des Servers auf eine Änderung.");
    }
    return data as PushResult;
  }

  /**
   * Hints at every change of the household's data, and once more whenever the connection to
   * Realtime is (again) ready: changes made while it was not are only found by a pull.
   */
  subscribe(hint: () => void): () => void {
    let stopped = false;
    // Leaving the channel takes a moment; nothing is reported once the caller stopped.
    const report = () => {
      if (!stopped) {
        hint();
      }
    };
    const channel = this.client.channel(`kruemel-${crypto.randomUUID()}`);
    for (const table of WATCHED_TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table }, report);
    }
    channel.on("system", {}, (message: { extension?: string; status?: string }) => {
      if (message.extension === "postgres_changes" && message.status === "ok") {
        report();
      }
    });
    channel.subscribe();
    return () => {
      stopped = true;
      void this.client.removeChannel(channel);
    };
  }

  private async call(name: string, args: Record<string, unknown>): Promise<unknown> {
    let answer: RpcAnswer;
    try {
      answer = await this.client.rpc(name, args).abortSignal(AbortSignal.timeout(this.timeoutMs));
    } catch (error) {
      throw new RemoteError(`Keine Verbindung zum Server: ${String(error)}`);
    }
    const { data, error, status } = answer;
    if (error !== null) {
      throw new RemoteError(
        `${name}: ${error.message} (${status})`,
        !isTemporary(status, error.code),
      );
    }
    return data;
  }
}
