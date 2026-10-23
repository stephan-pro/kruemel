import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { HouseholdError } from "./household";
import { SupabaseHousehold } from "./supabaseHousehold";

// The rules themselves are tested against the real database functions (`supabase/tests/`, same
// series as for the fake). Here: how answers and errors of supabase-js become `HouseholdApi` results.

interface Stub {
  userId?: string;
  rows?: unknown[];
  readError?: { message: string; code?: string | undefined };
  rpcError?: { message: string; code?: string | undefined };
  rpcData?: unknown;
  /** Filled with the calls of `rpc`. */
  calls?: [string, unknown][];
}

function client(stub: Stub): SupabaseClient {
  const read = Promise.resolve(
    stub.readError ? { data: null, error: stub.readError } : { data: stub.rows ?? [], error: null },
  );
  return {
    auth: {
      getSession: async () => ({
        data: { session: stub.userId === undefined ? null : { user: { id: stub.userId } } },
      }),
    },
    from: () => ({ select: () => ({ returns: () => read }) }),
    rpc: async (name: string, args: unknown) => {
      stub.calls?.push([name, args]);
      return { data: stub.rpcData ?? null, error: stub.rpcError ?? null };
    },
  } as unknown as SupabaseClient;
}

const row = (userId: string, role: string, names: [string, string] | null = ["Alex", "Robin"]) => ({
  user_id: userId,
  household_id: "h1",
  role,
  households: names && { person_a_name: names[0], person_b_name: names[1] },
});

async function failureOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(HouseholdError);
    return (error as HouseholdError).failure;
  }
  throw new Error("Sollte scheitern");
}

describe("SupabaseHousehold", () => {
  it("Aus den Zeilen der Datenbank wird der eigene Haushalt mit Rolle, Namen und Mitgliedern", async () => {
    const api = new SupabaseHousehold(
      client({ userId: "u2", rows: [row("u2", "personB"), row("u1", "personA")] }),
    );

    // Ohne Spalte `name` (Projekt noch ohne die Migration von E2-3g): kein Name, kein Fehler.
    expect(await api.current()).toEqual({
      id: "h1",
      me: "personB",
      names: { personA: "Alex", personB: "Robin" },
      name: null,
      members: ["personA", "personB"],
    });
  });

  it("E2-3g Umbenennen prüft den Namen vorher, schickt ihn gekürzt (leer entfernt ihn) und liest den Haushalt neu", async () => {
    const calls: [string, unknown][] = [];
    const named = { ...row("u1", "personA"), households: { name: "Zuhause" } };
    const api = new SupabaseHousehold(client({ userId: "u1", rows: [named], calls }));

    expect((await api.rename(" Zuhause ")).name).toBe("Zuhause");
    await api.rename("  ");
    expect(calls).toEqual([
      ["rename_household", { p_name: "Zuhause" }],
      ["rename_household", { p_name: "" }],
    ]);
    expect(await failureOf(api.rename("x".repeat(31)))).toBe("invalidHouseholdName");
    expect(calls).toHaveLength(2);
    expect(
      await failureOf(
        new SupabaseHousehold(
          client({ userId: "u1", rpcError: { message: "invalid_household_name", code: "P0001" } }),
        ).rename("x"),
      ),
    ).toBe("invalidHouseholdName");
  });

  it("E2-5a Entfernen, Verlassen und Konto löschen rufen ihre Funktion; Fehler werden zu Fehlerarten", async () => {
    const calls: [string, unknown][] = [];
    const api = new SupabaseHousehold(
      client({ userId: "u1", rows: [row("u1", "personA")], calls }),
    );

    expect((await api.removeMember("personB")).members).toEqual(["personA"]);
    await api.leave();
    await api.deleteAccount();

    expect(calls).toEqual([
      ["remove_member", { p_role: "personB" }],
      ["leave_household", undefined],
      ["delete_account", undefined],
    ]);
    const failing = new SupabaseHousehold(
      client({ userId: "u1", rpcError: { message: "invalid_member", code: "P0001" } }),
    );
    expect(await failureOf(failing.removeMember("personA"))).toBe("invalidMember");
    expect(
      await failureOf(
        new SupabaseHousehold(client({ userId: "u1", rpcError: { message: "x" } })).leave(),
      ),
    ).toBe("offline");
  });

  it("Ohne Anmeldung auf dem Gerät: „nicht angemeldet“; ohne eigene Zeile: kein Haushalt; ohne Namen: names ist null", async () => {
    expect(await failureOf(new SupabaseHousehold(client({})).current())).toBe("notSignedIn");
    expect(await new SupabaseHousehold(client({ userId: "u1" })).current()).toBeNull();
    const unnamed = new SupabaseHousehold(
      client({ userId: "u1", rows: [row("u1", "personA", null)] }),
    );
    expect((await unnamed.current())?.names).toBeNull();
  });

  it("Meldungen der Datenbankfunktionen werden zu Fehlerarten, ein Aufruf ohne Antwort zu „offline“", async () => {
    const failing = (message: string, code?: string) =>
      new SupabaseHousehold(client({ userId: "u1", rpcError: { message, code } }));

    expect(await failureOf(failing("invite_used", "P0001").acceptInvite("t"))).toBe("inviteUsed");
    expect(await failureOf(failing("invite_expired", "P0001").acceptInvite("t"))).toBe(
      "inviteExpired",
    );
    expect(await failureOf(failing("household_full", "P0001").createInvite())).toBe(
      "householdFull",
    );
    expect(await failureOf(failing("TypeError: Failed to fetch", "").createInvite())).toBe(
      "offline",
    );
    expect(await failureOf(failing("TypeError: Failed to fetch").createInvite())).toBe("offline");
    expect(await failureOf(failing("etwas anderes", "XX000").createInvite())).toBe("unknown");
    expect(
      await failureOf(
        new SupabaseHousehold(
          client({ userId: "u1", readError: { message: "no_household", code: "P0001" } }),
        ).current(),
      ),
    ).toBe("noHousehold");
  });

  it("Anlegen prüft die Namen vorher, schickt sie gekürzt und liest den neuen Haushalt; Einladung gibt die Antwort weiter", async () => {
    const rows = [row("u1", "personA")];
    const created = await new SupabaseHousehold(client({ userId: "u1", rows })).create({
      personA: " Alex ",
      personB: "Robin",
    });
    const invite = { token: "abc", expiresAt: "2026-10-27T10:00:00Z" };

    expect(created.me).toBe("personA");
    expect(
      await failureOf(
        new SupabaseHousehold(client({ userId: "u1" })).create({ personA: "", personB: "x" }),
      ),
    ).toBe("invalidNames");
    expect(
      await new SupabaseHousehold(client({ userId: "u1", rpcData: invite })).createInvite(),
    ).toEqual(invite);
    expect(
      await failureOf(new SupabaseHousehold(client({ userId: "u1", rows: [] })).acceptInvite("t")),
    ).toBe("unknown");
  });
});
