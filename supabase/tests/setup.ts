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

// The mails of the local instance, caught by its mail catcher (Mailpit).

const MAIL_URL = process.env.SUPABASE_MAIL_URL || "http://127.0.0.1:54324";

interface MailSummary {
  readonly ID: string;
  readonly To: readonly { readonly Address: string }[];
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The mails sent to the address so far, newest first. */
export async function mailTo(email: string): Promise<MailSummary[]> {
  const response = await fetch(`${MAIL_URL}/api/v1/messages?limit=500`);
  const { messages } = (await response.json()) as { messages: MailSummary[] };
  return messages.filter((mail) => mail.To.some((to) => to.Address.toLowerCase() === email));
}

/** The code in the newest mail to the address, once more mails arrived than `seen` counts. */
export async function codeFromMail(email: string, seen: Map<string, number>): Promise<string> {
  const known = seen.get(email) ?? 0;
  for (let attempt = 0; attempt < 50; attempt++) {
    const mails = await mailTo(email);
    const newest = mails[0];
    if (mails.length > known && newest !== undefined) {
      seen.set(email, mails.length);
      const message = (await (await fetch(`${MAIL_URL}/api/v1/message/${newest.ID}`)).json()) as {
        Text?: string;
        HTML?: string;
      };
      const text = `${message.Text ?? ""} ${(message.HTML ?? "").replace(/<[^>]*>/g, " ")}`;
      const code = /\b\d{6}\b/.exec(text)?.[0];
      if (code === undefined) {
        throw new Error(`Kein sechsstelliger Code in der Mail an ${email}: ${text}`);
      }
      return code;
    }
    await sleep(200);
  }
  throw new Error(`Keine neue Mail an ${email} in Mailpit (${MAIL_URL}).`);
}

/** An account made by hand, as the operator does in the dashboard ("Add user"), not signed in. */
export async function addUser(email: string): Promise<void> {
  const { error } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (error) {
    throw error;
  }
}

/** A household of two: A created it, B accepted the invite. */
export async function couple() {
  const a = await withHousehold();
  const b = await signedIn();
  await call(b, "accept_invite", { p_token: (await invite(a)).token });
  return { a, b, household: a.household };
}
