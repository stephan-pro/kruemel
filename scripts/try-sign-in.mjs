// `npm run try:sign-in` (E2-1): tries the sign-in with a code against the real Supabase project,
// before the app has a sign-in page (E2-2). It asks for an e-mail address, Supabase sends the code
// (over the Gmail account), the script asks for the code and signs in, then out again.
// Reads the public project address and key from `.env.local` (see `.env.example`); no secrets.
import { existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";

if (!existsSync(".env.local")) {
  console.error("❌ .env.local fehlt. Vorlage: .env.example (Projekt-URL und Publishable Key).");
  process.exit(1);
}
process.loadEnvFile(".env.local");
const url = process.env.VITE_SUPABASE_URL?.replace(/\/+$/, "");
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) {
  console.error("❌ In .env.local fehlen VITE_SUPABASE_URL oder VITE_SUPABASE_PUBLISHABLE_KEY.");
  process.exit(1);
}

async function auth(path, body, token) {
  const response = await fetch(`${url}/auth/v1/${path}`, {
    method: "POST",
    headers: {
      apikey: key,
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    let message = text;
    try {
      const parsed = JSON.parse(text);
      message = parsed.msg ?? parsed.message ?? parsed.error_description ?? text;
    } catch {
      // not JSON
    }
    throw new Error(`${response.status}: ${message}`);
  }
  return text ? JSON.parse(text) : {};
}

const terminal = createInterface({ input: process.stdin, output: process.stdout });
try {
  const email = (await terminal.question("E-Mail-Adresse: ")).trim();
  await auth("otp", { email, create_user: true });
  console.log(
    `Code an ${email} geschickt (kann eine Minute dauern, auch im Spam-Ordner nachsehen).`,
  );
  const answer = (await terminal.question("Code aus der Mail (oder kopierter Link): ")).trim();
  // Without our own mail server, Supabase sends its standard mail with a link instead of the code
  // (the templates with the code need custom SMTP). The link carries a one-time token as well.
  const link = /^https?:\/\//.test(answer) ? new URL(answer) : null;
  const session = link
    ? await auth("verify", {
        type: link.searchParams.get("type") ?? "magiclink",
        token_hash: link.searchParams.get("token"),
      })
    : await auth("verify", { type: "email", email, token: answer.replace(/\s/g, "") });
  console.log(
    `✅ Angemeldet als ${session.user?.email ?? email} (${link ? "über den Link" : "per Code"}).`,
  );
  await auth("logout", {}, session.access_token);
  console.log("Wieder abgemeldet.");
} catch (error) {
  console.error(`❌ Anmeldung fehlgeschlagen: ${error.message}`);
  process.exitCode = 1;
} finally {
  terminal.close();
}
