// A `Remote` over the database functions, only for the contract tests of E2-1: it shows that the
// SQL rules are the same as those of the fake (`src/sync/remote.contract.ts`). The `Remote` of the
// app (`src/sync/supabaseRemote.ts`, with realtime and error handling) follows in E2-3.

import type { SupabaseClient } from "@supabase/supabase-js";
import { SCHEMA_VERSION } from "../../src/storage/appData";
import type { Change, PushResult } from "../../src/sync/changes";
import { type PullResult, type Remote, RemoteError } from "../../src/sync/remote";

function call(name: string, args: Record<string, unknown>) {
  return { name, args };
}

/** The database function and its arguments for a change. */
function functionFor(change: Change) {
  const base = { p_change_id: change.id, p_schema_version: SCHEMA_VERSION };
  switch (change.type) {
    case "setNames":
      return call("set_names", { ...base, p_names: change.names });
    case "saveTask":
      return call("save_task", {
        ...base,
        p_task_id: change.taskId,
        p_set: change.patch.set,
        p_unset: change.patch.unset,
        p_create: change.create ?? null,
      });
    case "deleteTask":
      return call("delete_task", { ...base, p_task_id: change.taskId });
    case "complete":
      return call("complete_task", {
        ...base,
        p_completion: change.completion,
        p_set: change.patch.set,
        p_unset: change.patch.unset,
      });
    case "undo":
      return call("undo_completion", {
        ...base,
        p_completion_id: change.completionId,
        p_set: change.patch.set,
        p_unset: change.patch.unset,
      });
    case "replaceAll":
      return call("replace_household_data", { p_change_id: change.id, p_data: change.data });
  }
}

export function rpcRemote(client: SupabaseClient): Remote {
  return {
    async pull(cursor) {
      const { data, error } = await client.rpc("pull_changes", { p_cursor: cursor });
      if (error) {
        throw new RemoteError(error.message);
      }
      return data as PullResult;
    },
    async push(change) {
      const { name, args } = functionFor(change);
      const { data, error } = await client.rpc(name, args);
      if (error) {
        throw new RemoteError(error.message);
      }
      return data as PushResult;
    },
    subscribe() {
      return () => {};
    },
  };
}
