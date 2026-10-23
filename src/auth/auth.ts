// Signing in (stage 2): one e-mail address, a one-time code sent to it, a session. The app only
// talks to this interface; the implementations are `SupabaseAuth` (`supabaseAuth.ts`, the real
// service through supabase-js) and `FakeHttpAuth` (`fakeHttpAuth.ts`, against the fake server of
// the end-to-end tests). Both pass the same series of tests (`auth.contract.ts`). There are no
// passwords here and no session or crypto logic of our own (S1, S4).

export interface Session {
  readonly userId: string;
  readonly email: string;
}

/** Why a sign-in step failed; `AUTH_MESSAGES` says it to the person. */
export type AuthFailure =
  /** The address does not look like an e-mail address. */
  | "invalidEmail"
  /** The code is wrong. */
  | "wrongCode"
  /** The code was valid once but its time ran out, or it was used up. */
  | "expiredCode"
  /** Too many tries, or a new code asked for too soon. */
  | "tooManyTries"
  /** No connection to the sign-in service (no network, or the service does not answer). */
  | "offline"
  /**
   * The service does not let this address sign in: a new address without an invite (E2-5b), or
   * new sign-ups switched off.
   */
  | "notAllowed"
  /** A new address came with an invite that does not work (unknown, used, expired, withdrawn). */
  | "inviteInvalid"
  /** Anything else the service refused. */
  | "unknown";

export const AUTH_MESSAGES: Readonly<Record<AuthFailure, string>> = {
  invalidEmail: "Bitte eine gültige E-Mail-Adresse eingeben.",
  wrongCode: "Der Code stimmt nicht. Bitte prüfen und erneut eingeben.",
  expiredCode: "Der Code ist abgelaufen. Bitte einen neuen anfordern.",
  tooManyTries: "Zu viele Versuche. Bitte kurz warten und dann einen neuen Code anfordern.",
  offline: "Keine Verbindung zum Anmeldedienst. Bitte Internet prüfen und erneut versuchen.",
  notAllowed:
    "Krümel ist gerade nur mit Einladung nutzbar. Frag jemanden, der Krümel schon nutzt, nach einem Einladungslink. Hast du schon ein Konto? Dann prüf deine Adresse.",
  inviteInvalid:
    "Dein Einladungslink gilt nicht mehr: Er ist abgelaufen, schon benutzt oder zurückgezogen. Frag nach einem neuen Link. Hast du schon ein Konto? Dann prüf deine Adresse.",
  unknown: "Die Anmeldung hat nicht geklappt. Bitte später erneut versuchen.",
};

/** How long a code is valid (the same in the real project, `supabase/config.toml` and the fakes). */
export const CODE_MINUTES = 10;

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
