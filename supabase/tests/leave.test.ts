import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "../../src/storage/appData";
import { RemoteError } from "../../src/sync/remote";
import { SupabaseRemote } from "../../src/sync/supabaseRemote";
import { admin, anonymous, call, couple, invite, signedIn, withHousehold } from "./setup";

// E2-5a: remove the other person, leave, delete one's account. The household contract
// (`household.test.ts`) checks the rules as the app sees them; here the database side: what stays,
// what goes, and that nobody can do it to a household or an account that is not theirs (S5).

const task = {
  kind: "recurring",
  id: "t-bad",
  title: "Bad putzen",
  symbol: "standard",
  recurrence: { unit: "week", interval: 1 },
  assignee: "personB",
  dueDate: "2026-10-19",
  checklist: [],
};

const completion = {
  id: "c-1",
  taskId: "t-bad",
  completedOn: "2026-10-21",
  completedBy: "personB",
  previousDueDate: "2026-10-19",
  checkedItemIds: [],
};

const change = () => ({ p_change_id: crypto.randomUUID(), p_schema_version: SCHEMA_VERSION });

/** A household of two in which B made a task and ticked it off. */
async function filledCouple() {
  const { a, b, household } = await couple();
  await call(b, "save_task", {
    ...change(),
    p_task_id: "t-bad",
    p_set: task,
    p_unset: [],
    p_create: task,
  });
  await call(b, "complete_task", {
    ...change(),
    p_completion: completion,
    p_set: { dueDate: "2026-10-26" },
    p_unset: [],
  });
  return { a, b, household };
}

async function failure(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return (error as Error).message;
  }
  return "kein Fehler";
}

async function rows(client: SupabaseClient, table: string): Promise<unknown[]> {
  const { data } = await client.from(table).select("*");
  return data ?? [];
}

/** Rows of the household as the service role sees them (also after nobody may read them). */
async function stored(table: string, household: string): Promise<unknown[]> {
  const { data, error } = await admin.from(table).select("*").eq("household_id", household);
  if (error) {
    throw error;
  }
  return data;
}

type Pulled = {
  tasks: { id: string; task: { assignee: string } }[];
  completions: { id: string }[];
  settings?: unknown;
};

describe("E2-5a Person entfernen", () => {
  it("E2-5a Entfernt: Aufgaben, Erledigungen und Namen bleiben; die entfernte Person liest und schreibt nichts mehr", async () => {
    const { a, b, household } = await filledCouple();

    await call(a, "remove_member", { p_role: "personB" });

    const own = await call<Pulled>(a, "pull_changes", { p_cursor: null });
    expect(own.tasks.map((row) => row.task.assignee)).toEqual(["personB"]);
    expect(own.completions.map((row) => row.id)).toEqual(["c-1"]);
    expect(own.settings).toEqual({ personNames: { personA: "Alex", personB: "Robin" } });
    for (const table of ["households", "household_members", "invites", "tasks", "completions"]) {
      expect(await rows(b.client, table), table).toEqual([]);
    }
    expect(await failure(call(b, "pull_changes", { p_cursor: null }))).toBe("no_household");
    expect(await failure(call(b, "delete_task", { ...change(), p_task_id: "t-bad" }))).toBe(
      "no_household",
    );
    expect(await stored("tasks", household)).toHaveLength(1);
  });

  it("E2-5a Die App hört es beim Abruf und beim Senden als „kein Mitglied“ (nicht als abgelehnte Änderung)", async () => {
    const { a, b } = await filledCouple();
    const remote = new SupabaseRemote(b.client);
    await remote.pull(null);

    await call(a, "remove_member", { p_role: "personB" });

    for (const attempt of [
      remote.pull(null),
      remote.push({ id: crypto.randomUUID(), type: "deleteTask", taskId: "t-bad" }),
    ]) {
      const failed = await attempt.catch((error: unknown) => error);
      expect(failed).toBeInstanceOf(RemoteError);
      expect((failed as RemoteError).notMember).toBe(true);
    }
  });

  it("E2-5a Doppelt entfernen ändert nichts, sich selbst entfernen geht nicht, eine neue Einladung füllt den Platz", async () => {
    const { a, b, household } = await filledCouple();

    await call(a, "remove_member", { p_role: "personB" });
    await call(a, "remove_member", { p_role: "personB" });
    expect(await failure(call(a, "remove_member", { p_role: "personA" }))).toBe("invalid_member");
    expect(await failure(call(a, "remove_member", { p_role: "chef" }))).toBe("invalid_member");
    expect(await stored("household_members", household)).toEqual([
      expect.objectContaining({ user_id: a.id, role: "personA" }),
    ]);

    const next = await signedIn();
    await call(next, "accept_invite", { p_token: (await invite(a)).token });
    expect(await stored("household_members", household)).toHaveLength(2);
    // The removed person's account is untouched: they may start a household of their own.
    await call(b, "create_household", { p_person_a: "Robin", p_person_b: "Kim" });
  });

  it("E2-5a S5 Wer nicht dazugehört, entfernt niemanden: die Funktion wirkt nur im eigenen Haushalt", async () => {
    const { a, b, household } = await filledCouple();
    const stranger = await withHousehold({ a: "Kim", b: "Sam" });
    const lonely = await signedIn();

    await call(stranger, "remove_member", { p_role: "personB" });
    expect(await failure(call(lonely, "remove_member", { p_role: "personB" }))).toBe(
      "no_household",
    );
    // Directly in the table: not allowed, for strangers and members alike.
    for (const client of [stranger.client, a.client]) {
      const deleted = await client.from("household_members").delete().eq("user_id", b.id);
      expect(deleted.error?.message).toMatch(/permission denied/);
    }
    expect(await stored("household_members", household)).toHaveLength(2);
  });

  it("E2-5a S5 Echtzeit meldet der entfernten Person nichts mehr", async () => {
    const { a, b } = await couple();
    let seen = 0;
    const { data } = await b.client.auth.getSession();
    await b.client.realtime.setAuth(data.session?.access_token ?? null);
    const stop = await new Promise<() => void>((resolve, reject) => {
      const channel = b.client
        .channel(`removed-${crypto.randomUUID()}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
          seen++;
        })
        .on("system", {}, (message: { extension?: string; status?: string }) => {
          if (message.extension === "postgres_changes" && message.status === "ok") {
            resolve(() => void b.client.removeChannel(channel));
          } else if (message.extension === "postgres_changes") {
            reject(new Error(`Echtzeit: ${JSON.stringify(message)}`));
          }
        })
        .subscribe((status, error) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            reject(new Error(`Echtzeit: ${status} ${error?.message ?? ""}`));
          }
        });
    });

    await call(a, "remove_member", { p_role: "personB" });
    await call(a, "save_task", {
      ...change(),
      p_task_id: "t-bad",
      p_set: task,
      p_unset: [],
      p_create: task,
    });
    await new Promise((resolve) => setTimeout(resolve, 3000));
    stop();

    expect(seen).toBe(0);
  });
});

describe("E2-5a Haushalt verlassen", () => {
  it("E2-5a Verlassen: die andere Person behält alles, auch die Erledigungen der Gehenden", async () => {
    const { a, b, household } = await filledCouple();

    await call(b, "leave_household");

    const own = await call<Pulled>(a, "pull_changes", { p_cursor: null });
    expect(own.tasks.map((row) => row.id)).toEqual(["t-bad"]);
    expect(own.completions.map((row) => row.id)).toEqual(["c-1"]);
    expect(await rows(b.client, "tasks")).toEqual([]);
    expect(await failure(call(b, "leave_household"))).toBe("no_household");
    expect(await stored("household_members", household)).toHaveLength(1);
  });

  it("E2-5a Die letzte Person nimmt den Haushalt mit: alle Zeilen sind gelöscht, auch die Einladung", async () => {
    const { a, b, household } = await filledCouple();
    await call(b, "leave_household");
    const open = await invite(a);

    await call(a, "leave_household");

    for (const table of ["household_members", "invites", "tasks", "completions"]) {
      expect(await stored(table, household), table).toEqual([]);
    }
    const { data } = await admin.from("households").select("id").eq("id", household);
    expect(data).toEqual([]);
    expect(await failure(call(await signedIn(), "accept_invite", { p_token: open.token }))).toBe(
      "invite_unknown",
    );
  });

  it("E2-5a Gehen beide gleichzeitig, ist danach niemand mehr da und der Haushalt gelöscht", async () => {
    const { a, b, household } = await filledCouple();

    await Promise.all([call(a, "leave_household"), call(b, "leave_household")]);

    const { data } = await admin.from("households").select("id").eq("id", household);
    expect(data).toEqual([]);
  });
});

describe("E2-5a Konto löschen", () => {
  it("E2-5a Konto löschen: Konto und Mitgliedschaft sind weg, der Haushalt bleibt für die andere Person", async () => {
    const { a, b, household } = await filledCouple();

    await call(b, "delete_account");

    const gone = await admin.auth.admin.getUserById(b.id);
    expect(gone.data.user).toBeNull();
    expect(await stored("household_members", household)).toEqual([
      expect.objectContaining({ user_id: a.id }),
    ]);
    const own = await call<Pulled>(a, "pull_changes", { p_cursor: null });
    expect(own.completions.map((row) => row.id)).toEqual(["c-1"]);
    // Done twice (the old session is still in the device's hand): nothing more happens.
    await call(b, "delete_account");
    expect((await admin.auth.admin.getUserById(a.id)).data.user?.id).toBe(a.id);
  });

  it("E2-5a Konto löschen als letzte Person löscht den Haushalt; ohne Haushalt nur das Konto", async () => {
    const a = await withHousehold();
    const lonely = await signedIn();

    await call(a, "delete_account");
    await call(lonely, "delete_account");

    const { data } = await admin.from("households").select("id").eq("id", a.household);
    expect(data).toEqual([]);
    expect((await admin.auth.admin.getUserById(a.id)).data.user).toBeNull();
    expect((await admin.auth.admin.getUserById(lonely.id)).data.user).toBeNull();
  });

  it("E2-5a S5 Jede Person löscht nur ihr eigenes Konto", async () => {
    const { a, b } = await couple();
    const stranger = await signedIn();

    await call(stranger, "delete_account");

    expect((await admin.auth.admin.getUserById(a.id)).data.user?.id).toBe(a.id);
    expect((await admin.auth.admin.getUserById(b.id)).data.user?.id).toBe(b.id);
    // The function takes no argument: there is nothing to name someone else with.
    expect(await failure(call(stranger, "delete_account", { p_user: a.id }))).toMatch(
      /delete_account/,
    );
  });
});

describe("E2-5a S5 Ohne Anmeldung", () => {
  it("E2-5a S5 Ohne Anmeldung lässt sich niemand entfernen, nichts verlassen, kein Konto löschen", async () => {
    const { a, household } = await filledCouple();
    const stranger = anonymous();

    for (const [name, args] of [
      ["remove_member", { p_role: "personB" }],
      ["leave_household", {}],
      ["delete_account", {}],
    ] as const) {
      expect(await failure(call(stranger, name, args)), name).toMatch(/permission denied/);
    }
    expect(await stored("household_members", household)).toHaveLength(2);
    expect((await admin.auth.admin.getUserById(a.id)).data.user?.id).toBe(a.id);
  });
});
