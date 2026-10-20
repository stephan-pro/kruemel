// Building blocks of the database tests: clients for the local instance and fresh people and
// households for every test (every test makes its own, so tests do not depend on each other).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare const process: { env: Record<string, string | undefined> };

function setting(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === "") {
    throw new Error(`${name} fehlt: die Datenbank-Tests laufen über \`npm run check:db\`.`);
  }
  return value;
}

/** The local instance's API and its public key (the app's `VITE_SUPABASE_*` there). */
export const url = setting("SUPABASE_URL");
export const anonKey = setting("SUPABASE_ANON_KEY");
const serviceKey = setting("SUPABASE_SERVICE_ROLE_KEY");

const noSession = { auth: { persistSession: false, autoRefreshToken: false } } as const;

/** Without sign-in, like anybody on the internet with the public key. */
export function anonymous(): SupabaseClient {
  return createClient(url, anonKey, noSession);
}

/** With the service role (only here, never in the app): sets up what a test needs. */
export const admin = createClient(url, serviceKey, noSession);

export interface Person {
  readonly id: string;
  readonly email: string;
  readonly client: SupabaseClient;
}

/** A new person, signed in. (The app signs in with a code; `auth.test.ts` tests that way.) */
export async function signedIn(): Promise<Person> {
  const email = `test-${crypto.randomUUID()}@example.com`;
  const password = crypto.randomUUID();
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error) {
    throw created.error;
  }
  const client = createClient(url, anonKey, noSession);
  const session = await client.auth.signInWithPassword({ email, password });
  if (session.error) {
    throw session.error;
  }
  return { id: created.data.user.id, email, client };
}

/** Calls a database function and returns its answer; throws with the database's message. */
export async function call<T = unknown>(
  person: Person | SupabaseClient,
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const client = "client" in person ? person.client : person;
  const { data, error } = await client.rpc(name, args);
  if (error) {
    throw new Error(error.message);
  }
  return data as T;
}

/** A person with a new household of their own (person A). */
export async function withHousehold(names = { a: "Alex", b: "Robin" }) {
  const person = await signedIn();
  const household = await call<string>(person, "create_household", {
    p_person_a: names.a,
    p_person_b: names.b,
  });
  return { ...person, household };
}

export async function invite(person: Person): Promise<{ token: string; expiresAt: string }> {
  return call(person, "create_invite");
}

/** A household of two: A created it, B accepted the invite. */
export async function couple() {
  const a = await withHousehold();
  const b = await signedIn();
  await call(b, "accept_invite", { p_token: (await invite(a)).token });
  return { a, b, household: a.household };
}
