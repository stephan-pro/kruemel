// The Edge Function `push` (NT-a, NT-c): Deno's entry, the real parts for `handlePush` (core.ts).
// Deployed by the PO with `npx supabase functions deploy push` (docs/BENACHRICHTIGUNGEN.md, 7.5);
// `verify_jwt = false` in supabase/config.toml, because the function checks the sign-in (route
// `test`) and the token of the schedule (route `flush`) itself. The packages come from `deno.json`
// (exact versions); `npm run check` type-checks this file against the same packages in
// node_modules.

import { createClient } from "@supabase/supabase-js";
import {
  BackendRefusal,
  type ClaimedJobs,
  cronTokenOf,
  handlePush,
  type JobsBackend,
  type PushBackend,
  pushConfig,
  type TestTarget,
} from "./core.ts";
import { encryptPush } from "./encrypt.ts";

declare const Deno: {
  readonly env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Response | Promise<Response>): unknown;
};

/** A key of the project (`SUPABASE_PUBLISHABLE_KEYS`/`SUPABASE_SECRET_KEYS` are JSON by name). */
function projectKey(keys: string, legacy: string): string {
  try {
    const named = JSON.parse(Deno.env.get(keys) ?? "{}") as Record<string, string>;
    return named.default ?? Object.values(named)[0] ?? Deno.env.get(legacy) ?? "";
  } catch {
    return Deno.env.get(legacy) ?? "";
  }
}

const url = Deno.env.get("SUPABASE_URL") ?? "";
const apiKey = projectKey("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");

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

/**
 * The database with the project's secret key, only for the route `flush` (`claim_push_jobs` and
 * `finish_push_jobs` are granted to `service_role` alone). Supabase hands the key to every
 * function; it never leaves it and is never logged.
 */
function jobsBackend(): JobsBackend | null {
  const secretKey = projectKey("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
  if (secretKey === "") {
    return null;
  }
  const service = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return {
    async claim(limit) {
      const { data, error } = await service.rpc("claim_push_jobs", { p_limit: limit });
      if (error) {
        throw new BackendRefusal("claim");
      }
      return data as ClaimedJobs;
    },
    async finish(results) {
      const { error } = await service.rpc("finish_push_jobs", { p_results: results });
      if (error) {
        throw new BackendRefusal("finish");
      }
    },
  };
}

const jobs = jobsBackend();

Deno.serve((request) =>
  handlePush(request, {
    // Read for every request: a secret set in the dashboard counts at once.
    config: pushConfig((name) => Deno.env.get(name)),
    cronToken: cronTokenOf((name) => Deno.env.get(name)),
    backend,
    jobs,
    encrypt: encryptPush,
    fetch: (input, init) => fetch(input, init),
    log: (entry) => console.log(JSON.stringify(entry)),
  }),
);
