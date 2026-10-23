import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "../../src/storage/appData";
import { admin, anonymous, call, couple, invite, signedIn, withHousehold } from "./setup";

// S5 (ETAPPE2.md): every person sees and changes only the data of their own household. Checked with
// direct requests to the API, as an attacker with the public key would send them.

const TABLES = ["households", "household_members", "invites", "tasks", "completions"] as const;

const task = {
  kind: "recurring",
  id: "t-bad",
  title: "Bad putzen",
  symbol: "standard",
  recurrence: { unit: "week", interval: 1 },
  assignee: "personA",
  dueDate: "2026-10-19",
  checklist: [],
};

const completion = {
  id: "c-1",
  taskId: "t-bad",
  completedOn: "2026-10-21",
  completedBy: "personA",
  previousDueDate: "2026-10-19",
  checkedItemIds: [],
};

/** A household of two with a task, a completion and an open invite (made before B joined). */
async function filledHousehold() {
  const a = await withHousehold();
  const open = await invite(a);
  await call(a, "save_task", {
    p_change_id: crypto.randomUUID(),
    p_schema_version: SCHEMA_VERSION,
    p_task_id: "t-bad",
    p_set: task,
    p_unset: [],
    p_create: task,
  });
  await call(a, "complete_task", {
    p_change_id: crypto.randomUUID(),
    p_schema_version: SCHEMA_VERSION,
    p_completion: completion,
    p_set: { dueDate: "2026-10-28" },
    p_unset: [],
  });
  return { a, open };
}

/** All rows of a table that the client may read (none if reading is not allowed at all). */
async function readable(client: SupabaseClient, table: string): Promise<unknown[]> {
  const { data } = await client.from(table).select("*");
  return data ?? [];
}

async function failure(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return (error as Error).message;
  }
  return "kein Fehler";
}

describe("S5 Ohne Anmeldung", () => {
  it("S5 Ohne Anmeldung ist nichts lesbar", async () => {
    await filledHousehold();
    const stranger = anonymous();

    for (const table of TABLES) {
      expect(await readable(stranger, table), table).toEqual([]);
    }
  });

  it("S5 Ohne Anmeldung lässt sich nichts anlegen, abrufen oder annehmen", async () => {
    const { open } = await filledHousehold();
    const stranger = anonymous();

    for (const [name, args] of [
      ["create_household", { p_person_a: "X", p_person_b: "Y" }],
      ["pull_changes", { p_cursor: null }],
      ["accept_invite", { p_token: open.token }],
      ["create_invite", {}],
      ["rename_household", { p_name: "Fremd" }],
      [
        "add_household_data",
        {
          p_change_id: crypto.randomUUID(),
          p_schema_version: SCHEMA_VERSION,
          p_data: { tasks: [task], completions: [] },
        },
      ],
    ] as const) {
      expect(await failure(call(stranger, name, args)), name).toMatch(/permission denied/);
    }
  });

  it("S5 Ohne Anmeldung antwortet nur ping (tägliches Wach-Signal gegen die Pausierung)", async () => {
    expect(await call(anonymous(), "ping")).toBe(true);
  });
});

describe("S5 Fremder Haushalt", () => {
  it("S5 Der fremde Haushalt ist nicht lesbar, weder direkt noch über den Abruf", async () => {
    const { a } = await filledHousehold();
    const other = await withHousehold({ a: "Kim", b: "Sam" });

    const households = (await readable(other.client, "households")) as { id: string }[];
    expect(households.map((row) => row.id)).toEqual([other.household]);
    expect(await readable(other.client, "household_members")).toEqual([
      expect.objectContaining({ user_id: other.id, role: "personA" }),
    ]);
    expect(await readable(other.client, "invites")).toEqual([]);
    expect(await readable(other.client, "tasks")).toEqual([]);
    expect(await readable(other.client, "completions")).toEqual([]);

    const pulled = await call<{ tasks: unknown[]; completions: unknown[]; settings: unknown }>(
      other,
      "pull_changes",
      { p_cursor: null },
    );
    expect(pulled.tasks).toEqual([]);
    expect(pulled.completions).toEqual([]);
    expect(pulled.settings).toEqual({ personNames: { personA: "Kim", personB: "Sam" } });
    expect((await readable(a.client, "tasks")).length).toBe(1);
  });

  it("S5 Der fremde Haushalt ist nicht änderbar: Funktionen wirken nur auf den eigenen", async () => {
    const { a } = await filledHousehold();
    const other = await withHousehold();
    const change = () => ({ p_change_id: crypto.randomUUID(), p_schema_version: SCHEMA_VERSION });

    expect(
      await call(other, "save_task", {
        ...change(),
        p_task_id: "t-bad",
        p_set: { title: "Fremd" },
        p_unset: [],
      }),
    ).toEqual({ status: "rejected", reason: "taskGone" });
    expect(
      await call(other, "complete_task", {
        ...change(),
        p_completion: { ...completion, id: "c-fremd", previousDueDate: "2026-10-28" },
        p_set: {},
        p_unset: [],
      }),
    ).toEqual({ status: "rejected", reason: "taskGone" });
    expect(
      await call(other, "undo_completion", {
        ...change(),
        p_completion_id: "c-1",
        p_set: {},
        p_unset: [],
      }),
    ).toEqual({ status: "rejected", reason: "completionGone" });
    await call(other, "delete_task", { ...change(), p_task_id: "t-bad" });
    await call(other, "set_names", { ...change(), p_names: { personA: "X", personB: "Y" } });
    await call(other, "rename_household", { p_name: "Fremd" });
    await call(other, "replace_household_data", {
      p_change_id: crypto.randomUUID(),
      p_data: { schemaVersion: SCHEMA_VERSION, settings: {}, tasks: [], completions: [] },
    });
    await call(other, "add_household_data", {
      ...change(),
      p_data: {
        tasks: [{ ...task, title: "Fremd übernommen" }],
        completions: [{ ...completion, id: "c-fremd" }],
      },
    });

    type Pulled = { tasks: { task: { title: string } }[]; completions: { id: string }[] };
    const own = await call<Pulled>(a, "pull_changes", { p_cursor: null });
    expect(own.tasks.map((row) => row.task.title)).toEqual(["Bad putzen"]);
    expect(own.completions.map((row) => row.id)).toEqual(["c-1"]);
    // The taking over landed in the caller's own household (same task id, no clash).
    const theirs = await call<Pulled>(other, "pull_changes", { p_cursor: null });
    expect(theirs.tasks.map((row) => row.task.title)).toEqual(["Fremd übernommen"]);
    const names = (await readable(a.client, "households")) as {
      person_a_name: string;
      name: string | null;
    }[];
    expect(names[0]?.person_a_name).toBe("Alex");
    expect(names[0]?.name).toBeNull();
    const theirName = (await readable(other.client, "households")) as { name: string | null }[];
    expect(theirName[0]?.name).toBe("Fremd");
  });

  it("S5 Direkt in die Tabellen schreiben geht nicht, auch nicht im eigenen Haushalt", async () => {
    const { a } = await filledHousehold();
    const other = await withHousehold();

    for (const client of [a.client, other.client]) {
      const updated = await client
        .from("tasks")
        .update({ data: { title: "x" } })
        .eq("id", "t-bad");
      expect(updated.error?.message).toMatch(/permission denied/);
      const deleted = await client.from("completions").delete().eq("id", "c-1");
      expect(deleted.error?.message).toMatch(/permission denied/);
      const renamed = await client
        .from("households")
        .update({ person_a_name: "x" })
        .eq("id", a.household);
      expect(renamed.error?.message).toMatch(/permission denied/);
      const named = await client.from("households").update({ name: "x" }).eq("id", a.household);
      expect(named.error?.message).toMatch(/permission denied/);
    }
    expect((await readable(a.client, "tasks")).length).toBe(1);
    expect((await readable(a.client, "completions")).length).toBe(1);
  });

  it("S5 Einfügen in einen fremden Haushalt scheitert (Aufgabe, Mitglied, Einladung)", async () => {
    const { a } = await filledHousehold();
    const other = await withHousehold();
    const target = a.household;

    const rows: [string, Record<string, unknown>][] = [
      ["tasks", { household_id: target, id: "t-fremd", data: task, schema_version: 3 }],
      ["household_members", { household_id: target, user_id: other.id, role: "personB" }],
      [
        "invites",
        { household_id: target, token: crypto.randomUUID(), expires_at: "2099-01-01T00:00:00Z" },
      ],
      ["households", { person_a_name: "X", person_b_name: "Y" }],
    ];
    for (const [table, row] of rows) {
      const inserted = await other.client.from(table).insert(row);
      expect(inserted.error?.message, table).toMatch(/permission denied/);
    }
    expect(((await readable(a.client, "household_members")) as unknown[]).length).toBe(1);
  });

  it("S5 Der fremde Haushalt ist nicht löschbar", async () => {
    const { a } = await filledHousehold();
    const other = await withHousehold();

    const gone = await other.client.from("households").delete().eq("id", a.household);
    const members = await other.client.from("household_members").delete().eq("user_id", a.id);

    expect(gone.error?.message).toMatch(/permission denied/);
    expect(members.error?.message).toMatch(/permission denied/);
    expect((await readable(a.client, "households")).length).toBe(1);
    expect((await readable(a.client, "household_members")).length).toBe(1);
  });

  it("S5 Echtzeit meldet Änderungen nur den Mitgliedern des Haushalts", async () => {
    const { a, b } = await couple();
    const other = await withHousehold();
    const seen = { member: 0, stranger: 0 };
    const listen = async (client: SupabaseClient, who: keyof typeof seen) => {
      const { data } = await client.auth.getSession();
      await client.realtime.setAuth(data.session?.access_token ?? null);
      // Ready once the server confirms the database subscription (a "system" message), not
      // already when the channel is joined: before that, changes are not delivered yet.
      return new Promise<() => void>((resolve, reject) => {
        const channel = client
          .channel(`tasks-${who}-${crypto.randomUUID()}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "tasks" }, () => {
            seen[who]++;
          })
          .on("system", {}, (message: { extension?: string; status?: string }) => {
            console.info(`Echtzeit ${who}:`, JSON.stringify(message));
            if (message.extension === "postgres_changes" && message.status === "ok") {
              resolve(() => void client.removeChannel(channel));
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
    };
    const stops = [await listen(b.client, "member"), await listen(other.client, "stranger")];

    await call(a, "save_task", {
      p_change_id: crypto.randomUUID(),
      p_schema_version: SCHEMA_VERSION,
      p_task_id: "t-bad",
      p_set: task,
      p_unset: [],
      p_create: task,
    });
    await expect.poll(() => seen.member, { timeout: 15_000 }).toBeGreaterThan(0);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    for (const stop of stops) stop();

    expect(seen.stranger).toBe(0);
  });
});

describe("S5 Einladungen", () => {
  it("Einladung: der Token ist zufällig und lang; die zweite Person wird Person B", async () => {
    const a = await withHousehold();
    const first = await invite(a);
    const second = await invite(a);
    const b = await signedIn();

    await call(b, "accept_invite", { p_token: second.token });

    expect(first.token).not.toBe(second.token);
    expect(second.token.length).toBeGreaterThanOrEqual(32);
    expect(new Date(second.expiresAt).getTime() - Date.now()).toBeGreaterThan(6.9 * 86_400_000);
    const members = (await readable(b.client, "household_members")) as { role: string }[];
    expect(members.map((row) => row.role).sort()).toEqual(["personA", "personB"]);
  });

  it("Einladung: eine neue macht die alte ungültig, unbekannte Tokens werden abgelehnt", async () => {
    const a = await withHousehold();
    const old = await invite(a);
    await invite(a);
    const b = await signedIn();

    expect(await failure(call(b, "accept_invite", { p_token: old.token }))).toBe("invite_unknown");
    expect(await failure(call(b, "accept_invite", { p_token: "ausgedacht" }))).toBe(
      "invite_unknown",
    );
  });

  it("Einladung: abgelaufen wird abgelehnt", async () => {
    const a = await withHousehold();
    const { token } = await invite(a);
    await admin.from("invites").update({ expires_at: "2026-01-01T00:00:00Z" }).eq("token", token);
    const b = await signedIn();

    expect(await failure(call(b, "accept_invite", { p_token: token }))).toBe("invite_expired");
  });

  it("Einladung: nur einmal nutzbar", async () => {
    const a = await withHousehold();
    const { token } = await invite(a);
    await call(await signedIn(), "accept_invite", { p_token: token });

    expect(await failure(call(await signedIn(), "accept_invite", { p_token: token }))).toBe(
      "invite_used",
    );
  });

  it("Einladung: der Haushalt ist voll – keine neue Einladung, keine dritte Person", async () => {
    const { a, household } = await couple();
    expect(await failure(invite(a))).toBe("household_full");

    // An invite that exists anyway (e.g. made by hand) does not let a third person in.
    const token = crypto.randomUUID();
    await admin
      .from("invites")
      .insert({ token, household_id: household, expires_at: "2099-01-01T00:00:00Z" });
    expect(await failure(call(await signedIn(), "accept_invite", { p_token: token }))).toBe(
      "household_full",
    );
  });

  it("Einladung: wer schon einen Haushalt hat, kann keine annehmen und keinen zweiten anlegen", async () => {
    const a = await withHousehold();
    const other = await withHousehold();
    const { token } = await invite(a);

    expect(await failure(call(other, "accept_invite", { p_token: token }))).toBe("already_member");
    expect(
      await failure(call(other, "create_household", { p_person_a: "X", p_person_b: "Y" })),
    ).toBe("already_member");
  });

  it("Ohne Haushalt gibt es keinen Abruf, keine Einladung und keine Übernahme", async () => {
    const lonely = await signedIn();

    expect(await failure(call(lonely, "pull_changes", { p_cursor: null }))).toBe("no_household");
    expect(await failure(invite(lonely))).toBe("no_household");
    expect(
      await failure(
        call(lonely, "add_household_data", {
          p_change_id: crypto.randomUUID(),
          p_schema_version: SCHEMA_VERSION,
          p_data: { tasks: [task], completions: [] },
        }),
      ),
    ).toBe("no_household");
  });
});
