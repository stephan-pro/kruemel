import { spawnSync } from "node:child_process";
import { describeAuthContract } from "../../src/auth/auth.contract";
import { SupabaseAuth } from "../../src/auth/supabaseAuth";
import { expireAccessToken, offlineFetch } from "../../src/auth/supabaseAuth.fixtures";
import { createSupabaseClient, SESSION_KEY } from "../../src/auth/supabaseClient";
import { FakeStore } from "../../src/storage/storage.fixtures";
import {
  addUser,
  admin,
  anonKey,
  call,
  codeFromMail,
  invite,
  mailTo,
  sleep,
  url,
  withHousehold,
} from "./setup";

// Sign-in with a code (S2) against the local instance: the same series of tests as for the fake
// server and the stand-in in `npm run check`. The code comes from the mail the instance sent,
// caught by its mail catcher (Mailpit). Settings as in the real project: six digits, ten minutes
// (`supabase/config.toml`); only "a new code after 1 s" instead of 60 s, so the run stays short.
// New accounts only with an invite (E2-5b): the hook of the migration `…_friend_invites.sql`.

declare const process: { env: Record<string, string | undefined> };

const DB_CONTAINER = process.env.SUPABASE_DB_CONTAINER || "supabase_db_kruemel";

/** Moves the time the codes of the address were sent back by `minutes` (in the database). */
function backdateCodes(email: string, minutes: number): void {
  if (!/^[a-z0-9-]+@example\.com$/.test(email)) {
    throw new Error(`Unerwartete Testadresse: ${email}`);
  }
  const database = new URL(process.env.SUPABASE_DB_URL ?? "");
  const shift = `interval '${minutes} minutes'`;
  const sql = `update auth.users set confirmation_sent_at = confirmation_sent_at - ${shift}, recovery_sent_at = recovery_sent_at - ${shift} where email = '${email}'`;
  const result = spawnSync(
    "docker",
    [
      "exec",
      "-e",
      `PGPASSWORD=${decodeURIComponent(database.password)}`,
      DB_CONTAINER,
      "psql",
      "-h",
      "127.0.0.1",
      "-U",
      decodeURIComponent(database.username),
      "-d",
      database.pathname.slice(1),
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      sql,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0 || !result.stdout.includes("UPDATE 1")) {
    throw new Error(`Codes nicht zurückdatiert: ${result.stdout} ${result.stderr}`);
  }
}

describeAuthContract("SupabaseAuth (lokale Supabase-Instanz, Code aus Mailpit)", async () => {
  const store = new FakeStore();
  const seen = new Map<string, number>();
  let offset = 0;
  const newEmail = () => `auth-${crypto.randomUUID()}@example.com`;
  const email = newEmail();
  await addUser(email);
  return {
    email,
    newEmail,
    friendInvite: async () =>
      (await call<{ token: string }>(await withHousehold(), "create_friend_invite")).token,
    householdInvite: async () => (await invite(await withHousehold())).token,
    mailCount: async (address) => {
      // A refused request sends nothing; wait a moment so a mail that went out would be there.
      await sleep(500);
      return (await mailTo(address)).length;
    },
    open: (options) =>
      new SupabaseAuth({
        client: createSupabaseClient({
          url,
          publishableKey: anonKey,
          store,
          ...(options?.offline ? { fetch: offlineFetch } : {}),
        }),
        store,
        now: () => Date.now() + offset,
      }),
    nextCode: (email) => codeFromMail(email, seen),
    expireCodes: async (email) => {
      backdateCodes(email, 11);
      offset += 11 * 60_000;
    },
    waitBeforeResend: () => sleep(1500),
    refuseSessions: async () => {
      const stored = JSON.parse(store.getItem(SESSION_KEY) ?? "{}") as { access_token?: string };
      const { error } = await admin.auth.admin.signOut(stored.access_token ?? "", "global");
      if (error) {
        throw error;
      }
      expireAccessToken(store);
    },
  };
});
