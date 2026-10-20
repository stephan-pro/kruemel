// Test building blocks for `SupabaseAuth` (not part of the app, excluded from coverage).
//
// `fakeGoTrue` stands in for Supabase Auth behind supabase-js's `fetch`, with the answers the real
// service gives (checked against the local instance by the same contract in `check:db`): a wrong
// and an expired code both give 403 `otp_expired`, a new code too soon gives 429, a refused
// refresh gives 400 `refresh_token_not_found`. So `npm run check` tests `SupabaseAuth` together
// with the real supabase-js, without network.

import type { KeyValueStore } from "../storage/localStorage";
import { CODE_MINUTES } from "./auth";
import { SESSION_KEY } from "./supabaseClient";

export const FAKE_SUPABASE_URL = "http://supabase.test";

export interface FakeGoTrueOptions {
  /** Milliseconds since 1970 (code times); default `Date.now`. */
  readonly now?: () => number;
}

function answer(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** An error the way the service sends it. */
export function serviceError(status: number, code: string, message = code): Response {
  return answer(status, { code, error_code: code, msg: message });
}

export function fakeGoTrue(options: FakeGoTrueOptions = {}) {
  const now = options.now ?? Date.now;
  const users = new Map<string, string>(); // address → user id
  const codes = new Map<string, string>(); // address → open code
  const sentAt = new Map<string, number>(); // address → when the last mail went out
  const refreshTokens = new Map<string, string>(); // refresh token → address
  let counter = 0;

  function session(address: string) {
    counter++;
    const refreshToken = `refresh-${counter}`;
    refreshTokens.set(refreshToken, address);
    return {
      access_token: `access-${counter}`,
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      refresh_token: refreshToken,
      user: {
        id: users.get(address),
        aud: "authenticated",
        role: "authenticated",
        email: address,
        app_metadata: {},
        user_metadata: {},
        created_at: "2026-10-20T08:00:00Z",
      },
    };
  }

  const handler = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const body = (typeof init?.body === "string" ? JSON.parse(init.body) : {}) as Record<
      string,
      string
    >;
    const address = body.email ?? "";
    switch (url.pathname) {
      case "/auth/v1/otp": {
        const last = sentAt.get(address);
        if (last !== undefined && now() - last < 60_000) {
          return serviceError(429, "over_email_send_rate_limit");
        }
        if (!users.has(address)) {
          users.set(address, `user-${users.size + 1}`);
        }
        counter++;
        codes.set(address, String(100_000 + counter));
        sentAt.set(address, now());
        return answer(200, {});
      }
      case "/auth/v1/verify": {
        const valid =
          codes.get(address) === body.token &&
          now() - (sentAt.get(address) ?? 0) < CODE_MINUTES * 60_000;
        if (!valid) {
          return serviceError(403, "otp_expired", "Token has expired or is invalid");
        }
        codes.delete(address);
        return answer(200, session(address));
      }
      case "/auth/v1/token": {
        const known = refreshTokens.get(body.refresh_token ?? "");
        if (known === undefined) {
          return serviceError(400, "refresh_token_not_found", "Invalid Refresh Token");
        }
        refreshTokens.delete(body.refresh_token ?? "");
        return answer(200, session(known));
      }
      case "/auth/v1/logout":
        return answer(204);
      default:
        return serviceError(404, "not_found");
    }
  };

  return {
    fetch: handler as typeof fetch,
    lastCode: (email: string) => codes.get(email),
    /** Refuses every session of the address from now on (as "sign out everywhere" does). */
    refuseSessions(email: string) {
      for (const [token, address] of refreshTokens) {
        if (address === email) {
          refreshTokens.delete(token);
        }
      }
    },
  };
}

/** `fetch` without network. */
export const offlineFetch = (async () => {
  throw new TypeError("Failed to fetch");
}) as unknown as typeof fetch;

/**
 * Lets the short-lived access token of the session on the device run out (as an hour later), so
 * supabase-js has to renew it at the next start.
 */
export function expireAccessToken(store: KeyValueStore): void {
  const stored = JSON.parse(store.getItem(SESSION_KEY) ?? "null") as Record<string, unknown> | null;
  if (stored === null) {
    throw new Error("Keine Sitzung auf dem Gerät");
  }
  const past = Math.floor(Date.now() / 1000) - 60;
  store.setItem(SESSION_KEY, JSON.stringify({ ...stored, expires_at: past }));
}
