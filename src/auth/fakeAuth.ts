// The sign-in service of the fake server (`fakeServer.ts`), in memory, with the rules of the real
// one as far as the app sees them: a code of six digits, valid for ten minutes, usable once, a new
// code only after a minute and it makes the old one invalid. One rule the real service has per
// network address instead (a limit on tries) is a limit per code here: after five wrong tries the
// code is used up. For tests; `lastCode` stands in for the mail that would carry the code.
// The app's side is `FakeHttpAuth` (`fakeHttpAuth.ts`).

import { AuthError, CODE_MINUTES, emailAddress, type Session } from "./auth";

const MAX_WRONG_TRIES = 5;

interface PendingCode {
  readonly code: string;
  readonly expiresAt: number;
  wrongTries: number;
}

export interface FakeAuthOptions {
  /** Milliseconds since 1970; default `Date.now`. */
  readonly now?: () => number;
  /** A code of six digits; default random. */
  readonly newCode?: () => string;
  /** A user id for an address seen the first time; default `crypto.randomUUID`. */
  readonly newUserId?: () => string;
  /** How long after a code a new one may be asked for; default 60 s (as in the real project). */
  readonly resendAfterMs?: number;
}

/** What a successful sign-in hands to the device: the session and the secret that proves it. */
export interface SignedIn {
  readonly token: string;
  readonly session: Session;
}

export class FakeAuth {
  private readonly codes = new Map<string, PendingCode>();
  private readonly sentAt = new Map<string, number>();
  private readonly users = new Map<string, string>();
  private readonly sessions = new Map<string, Session>();
  private readonly now: () => number;
  private readonly newCode: () => string;
  private readonly newUserId: () => string;
  private readonly resendAfterMs: number;

  constructor(options: FakeAuthOptions = {}) {
    this.now = options.now ?? Date.now;
    this.newCode =
      options.newCode ?? (() => String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0"));
    this.newUserId = options.newUserId ?? (() => crypto.randomUUID());
    this.resendAfterMs = options.resendAfterMs ?? 60_000;
  }

  /** The code the last mail to this address carried (the test's way to "read the mail"). */
  lastCode(email: string): string | undefined {
    return this.codes.get(email.trim().toLowerCase())?.code;
  }

  requestCode(email: string): void {
    const address = emailAddress(email);
    const last = this.sentAt.get(address);
    if (last !== undefined && this.now() - last < this.resendAfterMs) {
      throw new AuthError("tooManyTries");
    }
    this.sentAt.set(address, this.now());
    this.codes.set(address, {
      code: this.newCode(),
      expiresAt: this.now() + CODE_MINUTES * 60_000,
      wrongTries: 0,
    });
  }

  verifyCode(email: string, code: string): SignedIn {
    const address = emailAddress(email);
    const pending = this.codes.get(address);
    if (pending === undefined || pending.expiresAt <= this.now()) {
      this.codes.delete(address);
      throw new AuthError("expiredCode");
    }
    if (pending.wrongTries >= MAX_WRONG_TRIES) {
      this.codes.delete(address);
      throw new AuthError("tooManyTries");
    }
    if (pending.code !== code.replace(/\s/g, "")) {
      pending.wrongTries++;
      throw new AuthError("wrongCode");
    }
    this.codes.delete(address); // a code works once
    let userId = this.users.get(address);
    if (userId === undefined) {
      userId = this.newUserId();
      this.users.set(address, userId);
    }
    const signedIn = { token: crypto.randomUUID(), session: { userId, email: address } };
    this.sessions.set(signedIn.token, signedIn.session);
    return signedIn;
  }

  /** The session a secret belongs to; `undefined` when it is unknown or ended. */
  sessionFor(token: string | undefined): Session | undefined {
    return token === undefined ? undefined : this.sessions.get(token);
  }

  /** Ends one session (signing out on one device). */
  signOut(token: string | undefined): void {
    if (token !== undefined) {
      this.sessions.delete(token);
    }
  }

  /** Ends every session of the address, as the real service does when it refuses them for good. */
  signOutEverywhere(email: string): void {
    const address = email.trim().toLowerCase();
    for (const [token, session] of this.sessions) {
      if (session.email === address) {
        this.sessions.delete(token);
      }
    }
  }
}
