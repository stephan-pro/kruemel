import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "../storage/appData";
import type { Change } from "./changes";
import { RemoteError } from "./remote";
import { isTemporary, rpcFor, SupabaseRemote } from "./supabaseRemote";
import { completion, dataWith, weekly } from "./sync.fixtures";

// The rules themselves run against the local database (`supabase/tests/contract.test.ts`, only in
// CI); here a stand-in for the client checks what `SupabaseRemote` sends and how it reads answers,
// failures and Realtime.

interface Answer {
  readonly data: unknown;
  readonly error: { readonly message: string; readonly code?: string } | null;
  readonly status: number;
}

type Listener = { type: string; filter: object; callback: (message: object) => void };

class FakeChannel {
  readonly listeners: Listener[] = [];
  subscribed = false;

  on(type: string, filter: object, callback: (message: object) => void): this {
    this.listeners.push({ type, filter, callback });
    return this;
  }

  subscribe(): this {
    this.subscribed = true;
    return this;
  }

  /** Calls the listeners of `type`; for "postgres_changes" those of the table in `message`. */
  emit(type: string, message: { table?: string; extension?: string; status?: string }): void {
    for (const listener of this.listeners) {
      const table = (listener.filter as { table?: string }).table;
      if (listener.type === type && (message.table === undefined || message.table === table)) {
        listener.callback(message);
      }
    }
  }
}

function fakeClient(answer: () => Answer | Error) {
  const calls: { name: string; args: Record<string, unknown>; signal?: AbortSignal }[] = [];
  const channels: FakeChannel[] = [];
  const removed: FakeChannel[] = [];
  const client = {
    rpc(name: string, args: Record<string, unknown>) {
      const call: (typeof calls)[number] = { name, args };
      calls.push(call);
      return {
        abortSignal(signal: AbortSignal) {
          call.signal = signal;
          const result = answer();
          return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
        },
      };
    },
    channel() {
      const channel = new FakeChannel();
      channels.push(channel);
      return channel;
    },
    async removeChannel(channel: FakeChannel) {
      removed.push(channel);
      return "ok";
    },
  };
  return { client: client as unknown as SupabaseClient, calls, channels, removed };
}

const ok = (data: unknown): Answer => ({ data, error: null, status: 200 });
const failed = (status: number, code?: string): Answer => ({
  data: null,
  error: { message: "Fehler", ...(code === undefined ? {} : { code }) },
  status,
});

describe("SupabaseRemote", () => {
  it("Jede Änderung geht an ihre Datenbankfunktion, mit der Version der App", async () => {
    const patch = { set: { title: "Bad" }, unset: ["note"] };
    const changes: [Change, string, Record<string, unknown>][] = [
      [
        { id: "1", type: "setNames", names: { personA: "A", personB: "B" } },
        "set_names",
        { p_names: { personA: "A", personB: "B" } },
      ],
      [
        { id: "2", type: "saveTask", taskId: "t-bad", patch },
        "save_task",
        { p_task_id: "t-bad", p_set: patch.set, p_unset: patch.unset, p_create: null },
      ],
      [{ id: "3", type: "deleteTask", taskId: "t-bad" }, "delete_task", { p_task_id: "t-bad" }],
      [
        { id: "4", type: "complete", completion: completion(), patch },
        "complete_task",
        { p_completion: completion(), p_set: patch.set, p_unset: patch.unset },
      ],
      [
        { id: "5", type: "undo", completionId: "c-1", patch },
        "undo_completion",
        { p_completion_id: "c-1", p_set: patch.set, p_unset: patch.unset },
      ],
      [
        { id: "7", type: "addAll", tasks: [weekly()], completions: [completion()] },
        "add_household_data",
        { p_data: { tasks: [weekly()], completions: [completion()] } },
      ],
    ];
    for (const [change, name, args] of changes) {
      expect(rpcFor(change, 4), change.type).toEqual({
        name,
        args: { p_change_id: change.id, p_schema_version: 4, ...args },
      });
    }
    // A backup carries its own version.
    expect(rpcFor({ id: "6", type: "replaceAll", data: dataWith([]) }, 4)).toEqual({
      name: "replace_household_data",
      args: { p_change_id: "6", p_data: dataWith([]) },
    });
    expect(
      rpcFor({ id: "8", type: "saveTask", taskId: "t", patch, create: weekly() }, 4).args.p_create,
    ).toEqual(weekly());

    const { client, calls } = fakeClient(() => ok({ status: "applied" }));
    const result = await new SupabaseRemote(client).push(changes[2]?.[0] as Change);
    expect(result).toEqual({ status: "applied" });
    expect(calls[0]?.args.p_schema_version).toBe(SCHEMA_VERSION);
    expect(calls[0]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("Der Abruf schickt den Stand mit; unlesbare Antworten sind ein RemoteError", async () => {
    const pulled = { cursor: "9", schemaVersion: 3, tasks: [], completions: [] };
    const { client, calls } = fakeClient(() => ok(pulled));

    expect(await new SupabaseRemote(client).pull("8")).toEqual(pulled);
    expect(calls[0]).toMatchObject({ name: "pull_changes", args: { p_cursor: "8" } });

    const garbled = new SupabaseRemote(fakeClient(() => ok(null)).client);
    await expect(garbled.pull(null)).rejects.toThrow("Unlesbare Antwort");
    await expect(garbled.push({ id: "x", type: "deleteTask", taskId: "t" })).rejects.toThrow(
      "Unlesbare Antwort",
    );
  });

  it("Fehler: ohne Verbindung, Zeitüberschreitung, abgelaufene Sitzung, Serverfehler und fehlende Funktion später erneut, alles andere dauerhaft", async () => {
    expect([0, 401, 408, 429, 500, 503].every((status) => isTemporary(status, undefined))).toBe(
      true,
    );
    expect(isTemporary(404, "PGRST202")).toBe(true);
    expect([400, 403, 404, 409].some((status) => isTemporary(status, "P0001"))).toBe(false);

    const change: Change = { id: "x", type: "deleteTask", taskId: "t" };
    const failure = async (answer: () => Answer | Error) => {
      try {
        await new SupabaseRemote(fakeClient(answer).client, { timeoutMs: 5 }).push(change);
      } catch (error) {
        return error as RemoteError;
      }
      throw new Error("kein Fehler");
    };
    const refused = await failure(() => failed(400, "P0001"));
    const unreachable = await failure(() => failed(0));
    const thrown = await failure(() => new TypeError("Failed to fetch"));

    expect(refused).toBeInstanceOf(RemoteError);
    expect(refused.permanent).toBe(true);
    expect(refused.message).toContain("delete_task");
    expect(unreachable.permanent).toBe(false);
    expect(thrown).toBeInstanceOf(RemoteError);
    expect(thrown.permanent).toBe(false);
  });

  it("Hinweise kommen bei Änderungen der Daten und wenn die Verbindung bereit ist; nach dem Beenden keine mehr", async () => {
    const { client, channels, removed } = fakeClient(() => ok(null));
    let hints = 0;

    const stop = new SupabaseRemote(client).subscribe(() => {
      hints++;
    });
    const channel = channels[0] as FakeChannel;
    const tables = channel.listeners
      .filter((listener) => listener.type === "postgres_changes")
      .map((listener) => (listener.filter as { table: string }).table);
    channel.emit("system", { extension: "postgres_changes", status: "ok" });
    channel.emit("system", { extension: "presence", status: "ok" });
    channel.emit("postgres_changes", { table: "tasks" });
    stop();
    channel.emit("postgres_changes", { table: "completions" });

    expect(channel.subscribed).toBe(true);
    expect(tables).toEqual(["households", "tasks", "completions"]);
    expect(hints).toBe(2);
    expect(removed).toEqual([channel]);
  });
});
