// `Auth` in memory, with the rules of the real thing as far as the app sees them: a code of six
// digits, valid for ten minutes, usable once, only a few wrong tries. For tests; `lastCode` stands
// in for the mail that would carry the code.

import { type Auth, AuthError, type Session } from "./auth";

const CODE_MINUTES = 10;
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
}

export class FakeAuth implements Auth {
  private current: Session | null = null;
  private readonly codes = new Map<string, PendingCode>();
  private readonly users = new Map<string, string>();
  private readonly listeners = new Set<(session: Session | null) => void>();
  private readonly now: () => number;
  private readonly newCode: () => string;
  private readonly newUserId: () => string;

  constructor(options: FakeAuthOptions = {}) {
    this.now = options.now ?? Date.now;
    this.newCode =
      options.newCode ?? (() => String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0"));
    this.newUserId = options.newUserId ?? (() => crypto.randomUUID());
  }

  /** The code the last mail to this address carried (the test's way to "read the mail"). */
  lastCode(email: string): string | undefined {
    return this.codes.get(normalise(email))?.code;
  }

  async session(): Promise<Session | null> {
    return this.current;
  }

  async requestCode(email: string): Promise<void> {
    const address = normalise(email);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      throw new AuthError("invalidEmail", "Bitte eine gültige E-Mail-Adresse eingeben.");
    }
    this.codes.set(address, {
      code: this.newCode(),
      expiresAt: this.now() + CODE_MINUTES * 60_000,
      wrongTries: 0,
    });
  }

  async verifyCode(email: string, code: string): Promise<Session> {
    const address = normalise(email);
    const pending = this.codes.get(address);
    if (pending === undefined || pending.expiresAt <= this.now()) {
      this.codes.delete(address);
      throw new AuthError("expiredCode", "Der Code ist abgelaufen. Bitte einen neuen anfordern.");
    }
    if (pending.wrongTries >= MAX_WRONG_TRIES) {
      this.codes.delete(address);
      throw new AuthError("tooManyTries", "Zu viele Versuche. Bitte einen neuen Code anfordern.");
    }
    if (pending.code !== code.trim()) {
      pending.wrongTries++;
      throw new AuthError("wrongCode", "Der Code stimmt nicht. Bitte prüfen und erneut eingeben.");
    }
    this.codes.delete(address); // a code works once
    let userId = this.users.get(address);
    if (userId === undefined) {
      userId = this.newUserId();
      this.users.set(address, userId);
    }
    this.current = { userId, email: address };
    this.notify();
    return this.current;
  }

  async signOut(): Promise<void> {
    this.current = null;
    this.notify();
  }

  onChange(listener: (session: Session | null) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of [...this.listeners]) {
      listener(this.current);
    }
  }
}

function normalise(email: string): string {
  return email.trim().toLowerCase();
}
