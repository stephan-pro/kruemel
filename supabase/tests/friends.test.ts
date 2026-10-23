import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  addUser,
  admin,
  anonKey,
  anonymous,
  call,
  codeFromMail,
  invite,
  mailTo,
  signedIn,
  sleep,
  url,
  withHousehold,
} from "./setup";

// E2-5b: new accounts only with an invite. The gate is the Auth hook "Before User Created"
// (`public.before_user_created`, switched on in `supabase/config.toml`); the sign-in contract
// (`auth.test.ts`) and the household contract (`household.test.ts`) check the rules as the app sees
// them. Here the database side: expired, withdrawn, used and foreign links, no mail to unknown
// addresses, and that nobody but Supabase Auth calls the gate (S5).

const newEmail = () => `freund-${crypto.randomUUID()}@example.com`;

/** Asks for a code as the app does (`SupabaseAuth.requestCode`); the service's error or `null`. */
async function requestCode(email: string, key?: string) {
  const { error } = await anonymous().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, ...(key === undefined ? {} : { data: { invite: key } }) },
  });
  return error === null ? null : { status: error.status, message: error.message };
}

/** Mails to the address, after a moment in which a mail that went out would have arrived. */
async function mailCount(email: string): Promise<number> {
  await sleep(500);
  return (await mailTo(email)).length;
}

/** Whether an account with this address exists (the service role sees all). */
async function hasAccount(email: string): Promise<boolean> {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) {
    throw error;
  }
  return data.users.some((user) => user.email === email);
}

/** Signs in with the code from the mail and returns the person's client. */
async function signInWithMail(email: string) {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const code = await codeFromMail(email, new Map());
  const { data, error } = await client.auth.verifyOtp({ email, token: code, type: "email" });
  if (error || data.user === null) {
    throw error ?? new Error("Kein Benutzer");
  }
  return { id: data.user.id, email, client };
}

async function failure(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return (error as Error).message;
  }
  return "kein Fehler";
}

const friendInvite = (person: Awaited<ReturnType<typeof withHousehold>>) =>
  call<{ token: string; expiresAt: string }>(person, "create_friend_invite");

const refused = (message: string) => ({ status: 403, message });

describe("E2-5b Neue Konten nur mit Einladung (Datenbank)", () => {
  it("Ohne Einladung: unbekannte Adresse abgelehnt, kein Konto, keine Mail; ein von Hand angelegtes Konto meldet sich an", async () => {
    const stranger = newEmail();
    const known = newEmail();
    await addUser(known);

    expect(await requestCode(stranger)).toEqual(refused("invite_required"));
    expect(await requestCode(stranger, "")).toEqual(refused("invite_required"));
    expect(await requestCode(stranger, "gibt-es-nicht-0123456789")).toEqual(
      refused("invite_invalid"),
    );
    expect(await mailCount(stranger)).toBe(0);
    expect(await hasAccount(stranger)).toBe(false);

    expect(await requestCode(known)).toBeNull();
    expect(await mailCount(known)).toBe(1);
  });

  it("Freundes-Einladung: das neue Konto legt einen eigenen Haushalt an; der Link ist danach verbraucht", async () => {
    const alex = await withHousehold();
    const { token, expiresAt } = await friendInvite(alex);
    const [friend, other] = [newEmail(), newEmail()];

    expect(Date.parse(expiresAt) - Date.now()).toBeGreaterThan(6.9 * 24 * 60 * 60_000);
    expect(await requestCode(friend, token)).toBeNull();
    const signed = await signInWithMail(friend);
    const household = await call<string>(signed, "create_household", {
      p_person_a: "Sam",
      p_person_b: "Kim",
    });

    expect(household).not.toBe(alex.household);
    expect(await call(alex, "open_friend_invites")).toEqual([]);
    expect(await requestCode(other, token)).toEqual(refused("invite_invalid"));
    expect(await mailCount(other)).toBe(0);
    expect(await hasAccount(other)).toBe(false);
  });

  it("Abgelaufene und zurückgezogene Freundes-Einladungen lassen niemanden herein", async () => {
    const alex = await withHousehold();
    const expired = await friendInvite(alex);
    const withdrawn = await friendInvite(alex);
    await admin
      .from("friend_invites")
      .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq("token", expired.token);
    await call(alex, "cancel_friend_invite", { p_token: withdrawn.token });
    const stranger = newEmail();

    expect(await requestCode(stranger, expired.token)).toEqual(refused("invite_invalid"));
    expect(await requestCode(stranger, withdrawn.token)).toEqual(refused("invite_invalid"));
    expect(await mailCount(stranger)).toBe(0);
  });

  it("Haushalts-Einladung: ein neues Konto damit, nicht zwei; der Beitritt bleibt wie bisher, abgelaufen geht nichts", async () => {
    const alex = await withHousehold();
    const { token } = await invite(alex);
    const [robin, other] = [newEmail(), newEmail()];

    expect(await requestCode(robin, token)).toBeNull();
    expect(await requestCode(other, token)).toEqual(refused("invite_invalid"));
    const joined = await signInWithMail(robin);
    expect(await call(joined, "accept_invite", { p_token: token })).toBe(alex.household);

    const sam = await withHousehold({ a: "Sam", b: "Kim" });
    const old = await invite(sam);
    await admin
      .from("invites")
      .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq("token", old.token);
    expect(await requestCode(other, old.token)).toEqual(refused("invite_invalid"));
    expect(await hasAccount(other)).toBe(false);
  });

  it("S5 Freundes-Einladungen: nur Mitglieder erzeugen sie, jede Person sieht und zieht nur ihre eigenen zurück", async () => {
    const [alex, sam, loner] = [await withHousehold(), await withHousehold(), await signedIn()];
    const mine = await friendInvite(alex);

    expect(await failure(call(loner, "create_friend_invite"))).toContain("no_household");
    expect(await failure(call(anonymous(), "create_friend_invite"))).toContain("permission denied");
    expect(await failure(call(anonymous(), "open_friend_invites"))).toContain("permission denied");

    await call(sam, "cancel_friend_invite", { p_token: mine.token });
    expect(await call(alex, "open_friend_invites")).toEqual([mine]);
    expect(await call(sam, "open_friend_invites")).toEqual([]);
    const { data: seen } = await sam.client.from("friend_invites").select("token");
    expect(seen).toEqual([]);
    const { data: own } = await alex.client.from("friend_invites").select("token");
    expect(own).toEqual([{ token: mine.token }]);

    // Schreiben geht nur über die Funktionen.
    const { error } = await alex.client
      .from("friend_invites")
      .update({ expires_at: new Date(Date.now() + 365 * 24 * 60 * 60_000).toISOString() })
      .eq("token", mine.token);
    expect(error?.message).toContain("permission denied");
  });

  it("S5 Die Sperre ruft nur der Anmeldedienst auf, weder ohne noch mit Anmeldung", async () => {
    const alex = await withHousehold();
    const { token } = await friendInvite(alex);
    const event = { user: { email: newEmail(), user_metadata: { invite: token } } };

    for (const caller of [anonymous(), alex]) {
      expect(await failure(call(caller, "before_user_created", { event }))).toContain(
        "permission denied",
      );
    }
    // Der Link ist dadurch nicht verbraucht.
    expect(await call(alex, "open_friend_invites")).toEqual([expect.objectContaining({ token })]);
  });
});
