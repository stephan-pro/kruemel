import { spawnSync } from "node:child_process";
import { describeAuthContract } from "../../src/auth/auth.contract";
import { SupabaseAuth } from "../../src/auth/supabaseAuth";
import { expireAccessToken, offlineFetch } from "../../src/auth/supabaseAuth.fixtures";
import { createSupabaseClient, SESSION_KEY } from "../../src/auth/supabaseClient";
import { FakeStore } from "../../src/storage/storage.fixtures";
import { admin, anonKey, url } from "./setup";

// Sign-in with a code (S2) against the local instance: the same series of tests as for the fake
// server and the stand-in in `npm run check`. The code comes from the mail the instance sent,
// caught by its mail catcher (Mailpit). Settings as in the real project: six digits, ten minutes
// (`supabase/config.toml`); only "a new code after 1 s" instead of 60 s, so the run stays short.

declare const process: { env: Record<string, string | undefined> };

const MAIL_URL = process.env.SUPABASE_MAIL_URL || "http://127.0.0.1:54324";
const DB_CONTAINER = process.env.SUPABASE_DB_CONTAINER || "supabase_db_kruemel";

interface MailSummary {
  readonly ID: string;
  readonly To: readonly { readonly Address: string }[];
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mailTo(email: string): Promise<MailSummary[]> {
  const response = await fetch(`${MAIL_URL}/api/v1/messages?limit=500`);
  const { messages } = (await response.json()) as { messages: MailSummary[] };
  return messages.filter((mail) => mail.To.some((to) => to.Address.toLowerCase() === email));
}

/** The code in the newest mail to the address, once more mails arrived than `seen` counts. */
async function codeFromMail(email: string, seen: Map<string, number>): Promise<string> {
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
  return {
    email: `auth-${crypto.randomUUID()}@example.com`,
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
