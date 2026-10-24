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
  literal,
  mailTo,
  sleep,
  sql,
  url,
  withHousehold,
} from "./setup";

// Sign-in with a code (S2) against the local instance: the same series of tests as for the fake
// server and the stand-in in `npm run check`. The code comes from the mail the instance sent,
// caught by its mail catcher (Mailpit). Settings as in the real project: six digits, ten minutes
// (`supabase/config.toml`); only "a new code after 1 s" instead of 60 s, so the run stays short.
// New accounts only with an invite (E2-5b): the hook of the migration `…_friend_invites.sql`.

/** Moves the time the codes of the address were sent back by `minutes` (in the database). */
function backdateCodes(email: string, minutes: number): void {
  if (!/^[a-z0-9-]+@example\.com$/.test(email)) {
    throw new Error(`Unerwartete Testadresse: ${email}`);
  }
  const shift = `interval '${minutes} minutes'`;
  const updated = sql(
    `update auth.users set confirmation_sent_at = confirmation_sent_at - ${shift}, recovery_sent_at = recovery_sent_at - ${shift} where email = ${literal(email)} returning id`,
  );
  if (updated.length !== 1) {
    throw new Error(`Codes nicht zurückdatiert: ${updated.length} Zeilen`);
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
