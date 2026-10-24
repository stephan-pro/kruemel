// The Edge Function `push` (NT-a): Deno's entry, the real parts for `handlePush` (core.ts).
// Deployed by the PO with `npx supabase functions deploy push` (docs/BENACHRICHTIGUNGEN.md, 7.5);
// `verify_jwt = false` in supabase/config.toml, because the function checks the sign-in itself.
// The packages come from `deno.json` (exact versions); `npm run check` type-checks this file
// against the same packages in node_modules.

import { createClient } from "@supabase/supabase-js";
import {
  BackendRefusal,
  handlePush,
  type PushBackend,
  pushConfig,
  type TestTarget,
} from "./core.ts";
import { encryptPush } from "./encrypt.ts";

declare const Deno: {
  readonly env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): unknown;
};

/** The project's publishable key (`SUPABASE_PUBLISHABLE_KEYS` is JSON by name), else the old one. */
function publishableKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}") as Record<
      string,
      string
    >;
    return keys.default ?? Object.values(keys)[0] ?? Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  } catch {
    return Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  }
}

const url = Deno.env.get("SUPABASE_URL") ?? "";
const apiKey = publishableKey();

/** supabase-js as the person of `token`: the database applies its rules to them. */
function asPerson(token: string) {
  return createClient(url, apiKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const backend: PushBackend = {
  async userOf(token) {
    const { data, error } = await asPerson(token).auth.getUser(token);
    return error || data.user === null ? null : data.user.id;
  },
  async requestTest(token, deviceId) {
    const { data, error } = await asPerson(token).rpc("request_test_push", {
      p_device_id: deviceId,
    });
    if (error) {
      throw new BackendRefusal(error.message);
    }
    return data as TestTarget;
  },
  async forget(token, deviceId) {
    const { error } = await asPerson(token).rpc("unregister_push_device", {
      p_device_id: deviceId,
    });
    if (error) {
      throw new BackendRefusal(error.message);
    }
  },
};

Deno.serve((request) =>
  handlePush(request, {
    // Read for every request: a secret set in the dashboard counts at once.
    config: pushConfig((name) => Deno.env.get(name)),
    backend,
    encrypt: encryptPush,
    fetch: (input, init) => fetch(input, init),
    log: (entry) => console.log(JSON.stringify(entry)),
  }),
);
