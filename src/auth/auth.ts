// Signing in (stage 2): one e-mail address, a one-time code sent to it, a session. The app only
// talks to this interface; the implementations are the fake one (`fakeAuth.ts`, for tests) and,
// from E2-2, the one for Supabase. There are no passwords here (S4).

export interface Session {
  readonly userId: string;
  readonly email: string;
}

/** Why a sign-in step failed; the message is meant for the person. */
export type AuthFailure =
  /** The address does not look like an e-mail address. */
  | "invalidEmail"
  /** The code is wrong. */
  | "wrongCode"
  /** The code was valid once but its time ran out, or it was used up. */
  | "expiredCode"
  /** Too many tries or too many codes asked for. */
  | "tooManyTries";

export class AuthError extends Error {
  readonly failure: AuthFailure;

  constructor(failure: AuthFailure, message: string) {
    super(message);
    this.name = "AuthError";
    this.failure = failure;
  }
}

export interface Auth {
  /** The current session, or `null` when signed out. */
  session(): Promise<Session | null>;
  /** Sends a code to the address. Throws `AuthError`. */
  requestCode(email: string): Promise<void>;
  /** Checks the code and signs in. Throws `AuthError`. */
  verifyCode(email: string, code: string): Promise<Session>;
  signOut(): Promise<void>;
  /** Calls `listener` whenever the session changes (signed in or out); returns the way to stop. */
  onChange(listener: (session: Session | null) => void): () => void;
}
