// Signing in (stage 2): one e-mail address, a one-time code sent to it, a session. The app only
// talks to this interface; the implementations are `SupabaseAuth` (`supabaseAuth.ts`, the real
// service through supabase-js) and `FakeHttpAuth` (`fakeHttpAuth.ts`, against the fake server of
// the end-to-end tests). Both pass the same series of tests (`auth.contract.ts`). There are no
// passwords here and no session or crypto logic of our own (S1, S4).

import { t } from "../i18n";
import { liveTexts } from "../i18n/live";

export interface Session {
  readonly userId: string;
  readonly email: string;
}

/**
 * Why a sign-in step failed; `AUTH_MESSAGES` says it to the person.
 * - `invalidEmail`: the address does not look like an e-mail address.
 * - `wrongCode`: the code is wrong.
 * - `expiredCode`: the code was valid once but its time ran out, or it was used up.
 * - `tooManyTries`: too many tries, or a new code asked for too soon.
 * - `offline`: no connection to the sign-in service (no network, or it does not answer).
 * - `notAllowed`: the service does not let this address sign in: a new address without an invite
 *   (E2-5b), or new sign-ups switched off.
 * - `inviteInvalid`: a new address came with an invite that does not work (unknown, used,
 *   expired, withdrawn).
 * - `unknown`: anything else the service refused.
 */
export const AUTH_FAILURES = [
  "invalidEmail",
  "wrongCode",
  "expiredCode",
  "tooManyTries",
  "offline",
  "notAllowed",
  "inviteInvalid",
  "unknown",
] as const;

export type AuthFailure = (typeof AUTH_FAILURES)[number];

/**
 * What a failure says to the person, in the language set when it is read (the texts are in
 * `src/i18n/`). Read it when showing the message, not when the failure happens.
 */
export const AUTH_MESSAGES: Readonly<Record<AuthFailure, string>> = liveTexts(
  AUTH_FAILURES,
  (failure) => t().errors.auth[failure],
);

export { CODE_MINUTES } from "./limits";

export class AuthError extends Error {
  readonly failure: AuthFailure;

  constructor(failure: AuthFailure, message: string = AUTH_MESSAGES[failure]) {
    super(message);
    this.name = "AuthError";
    this.failure = failure;
  }
}

export function isAuthFailure(value: unknown): value is AuthFailure {
  return typeof value === "string" && Object.hasOwn(AUTH_MESSAGES, value);
}

/** The address as it is sent (trimmed, lower case); throws `invalidEmail` if it is none. */
export function emailAddress(email: string): string {
  const address = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
    throw new AuthError("invalidEmail");
  }
  return address;
}

export interface Auth {
  /**
   * The session remembered on this device, or `null` when signed out. Read from the device's
   * storage, so it works without network; renewing it runs quietly in the background, and only
   * a final refusal by the server ends it (then `onChange` reports `null`).
   */
  session(): Promise<Session | null>;
  /**
   * Sends a code to the address. A new address gets an account (and a code) only with `invite`,
   * the key of a friend or household invite, which the service checks and uses up (E2-5b); for an
   * address that has an account already the key does not matter. Throws `AuthError`.
   */
  requestCode(email: string, invite?: string): Promise<void>;
  /** Checks the code and signs in. Throws `AuthError`. */
  verifyCode(email: string, code: string): Promise<Session>;
  /** Ends the session on this device, also without network. */
  signOut(): Promise<void>;
  /** Calls `listener` whenever the session changes (signed in or out); returns the way to stop. */
  onChange(listener: (session: Session | null) => void): () => void;
}
