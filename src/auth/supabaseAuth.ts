// `Auth` for the real service: Supabase Auth through supabase-js, sign-in with a six-digit code
// by mail (`signInWithOtp`, `verifyOtp` with type "email"); no link, no password (S2). Keeping,
// renewing and ending the session is left to supabase-js (S1, S4): it renews quietly in the
// background and removes the session only when the server refuses it for good, never because the
// network is gone. What this class adds:
//
// - `session()` reads the session supabase-js keeps on the device, without waiting for a renewal
//   (which offline would take its retries, about half a minute).
// - The service's errors become `AuthFailure`s. It answers a wrong and an expired code alike
//   ("Token has expired or is invalid", `otp_expired`); the device tells them apart by when it asked
//   for the code (kept in `CODE_REQUEST_KEY`, so it survives a reload while the person reads mail).

import {
  isAuthApiError,
  isAuthRetryableFetchError,
  type AuthError as SupabaseAuthError,
  type SupabaseClient,
  type User,
} from "@supabase/supabase-js";
import type { KeyValueStore } from "../storage/localStorage";
import {
  type Auth,
  AuthError,
  type AuthFailure,
  CODE_MINUTES,
  emailAddress,
  type Session,
} from "./auth";
import { SESSION_KEY } from "./supabaseClient";

/** When this device last asked for a code, and for which address: `{email, requestedAt}`. */
export const CODE_REQUEST_KEY = "kruemel:auth-code";

export interface SupabaseAuthOptions {
  /** Made by `createSupabaseClient` with the same `store`. */
  readonly client: SupabaseClient;
  /** The device's storage the client keeps its session in. */
  readonly store: KeyValueStore;
  /** Milliseconds since 1970; default `Date.now`. */
  readonly now?: () => number;
}

interface CodeRequest {
  readonly email: string;
  readonly requestedAt: number;
}

const TOO_MANY = ["over_email_send_rate_limit", "over_request_rate_limit"];
const NOT_ALLOWED = [
  "signup_disabled",
  "otp_disabled",
  "email_provider_disabled",
  "email_address_not_authorized",
  "user_banned",
];

function toSession(user: Pick<User, "id" | "email">): Session {
  return { userId: user.id, email: user.email ?? "" };
}

export class SupabaseAuth implements Auth {
  private readonly client: SupabaseClient;
  private readonly store: KeyValueStore;
  private readonly now: () => number;

  constructor(options: SupabaseAuthOptions) {
    this.client = options.client;
    this.store = options.store;
    this.now = options.now ?? Date.now;
  }

  async session(): Promise<Session | null> {
    return this.remembered();
  }

  async requestCode(email: string): Promise<void> {
    const address = emailAddress(email);
    const { error } = await this.client.auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: true },
    });
    if (error) {
      throw new AuthError(this.failureOf(error, "request", address), error.message);
    }
    this.write(CODE_REQUEST_KEY, JSON.stringify({ email: address, requestedAt: this.now() }));
  }

  async verifyCode(email: string, code: string): Promise<Session> {
    const address = emailAddress(email);
    const { data, error } = await this.client.auth.verifyOtp({
      email: address,
      token: code.replace(/\s/g, ""),
      type: "email",
    });
    if (error) {
      throw new AuthError(this.failureOf(error, "verify", address), error.message);
    }
    const user = data.session?.user;
    if (typeof user?.id !== "string") {
      throw new AuthError("unknown");
    }
    this.remove(CODE_REQUEST_KEY);
    return toSession(user);
  }

  async signOut(): Promise<void> {
    // Only this device ("local"); without network supabase-js ends it here and reports an error,
    // which does not matter: the server lets the session run out by itself.
    await this.client.auth.signOut({ scope: "local" });
  }

  onChange(listener: (session: Session | null) => void): () => void {
    // supabase-js also reports the session it found at start and every renewal; only a change of
    // the person counts here.
    let last = this.remembered()?.userId ?? null;
    const { data } = this.client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        if (last !== null) {
          last = null;
          listener(null);
        }
      } else if (event !== "INITIAL_SESSION" && session !== null && session.user.id !== last) {
        last = session.user.id;
        listener(toSession(session.user));
      }
    });
    return () => data.subscription.unsubscribe();
  }

  /** The session supabase-js keeps on the device (read only, never changed here). */
  private remembered(): Session | null {
    const stored = this.read(SESSION_KEY) as {
      refresh_token?: unknown;
      user?: { id?: unknown; email?: unknown };
    } | null;
    const id = stored?.user?.id;
    if (typeof stored?.refresh_token !== "string" || typeof id !== "string") {
      return null;
    }
    const email = stored.user?.email;
    return { userId: id, email: typeof email === "string" ? email : "" };
  }

  private failureOf(
    error: SupabaseAuthError,
    step: "request" | "verify",
    address: string,
  ): AuthFailure {
    if (isAuthRetryableFetchError(error)) {
      return "offline";
    }
    const code = isAuthApiError(error) ? error.code : undefined;
    if (code === "otp_expired") {
      return this.codeRunOut(address) ? "expiredCode" : "wrongCode";
    }
    if (code === "validation_failed" || code === "email_address_invalid") {
      return step === "request" ? "invalidEmail" : "wrongCode";
    }
    if ((code !== undefined && TOO_MANY.includes(code)) || error.status === 429) {
      return "tooManyTries";
    }
    if (code !== undefined && NOT_ALLOWED.includes(code)) {
      return "notAllowed";
    }
    return "unknown";
  }

  /** Whether the code this device asked for has run out (or it asked for none). */
  private codeRunOut(address: string): boolean {
    const request = this.read(CODE_REQUEST_KEY) as Partial<CodeRequest> | null;
    return (
      request?.email !== address ||
      typeof request.requestedAt !== "number" ||
      this.now() - request.requestedAt >= CODE_MINUTES * 60_000
    );
  }

  private read(key: string): unknown {
    try {
      return JSON.parse(this.store.getItem(key) ?? "null");
    } catch {
      return null;
    }
  }

  private write(key: string, value: string): void {
    try {
      this.store.setItem(key, value);
    } catch {
      // Without storage a wrong code may be reported as expired; signing in still works.
    }
  }

  private remove(key: string): void {
    try {
      this.store.removeItem(key);
    } catch {
      // see write
    }
  }
}
