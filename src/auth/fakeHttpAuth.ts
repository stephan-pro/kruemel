// `Auth` against the fake server of the end-to-end tests (`scripts/fake-server.ts`, sign-in in
// `FakeAuth`). It behaves towards the app like `SupabaseAuth`: the session is kept in the
// device's storage and read from there (also offline), the server is asked in the background
// whether it still holds, and only its refusal (401) signs out. Test-only: the "secret" is random
// text from the fake server, not a real token.

import type { KeyValueStore } from "../storage/localStorage";
import {
  type Auth,
  AuthError,
  type AuthFailure,
  emailAddress,
  isAuthFailure,
  type Session,
} from "./auth";

/** Where the session is kept in the device's storage: `{token, session}`. */
export const FAKE_AUTH_KEY = "kruemel-fake:auth";

interface Stored {
  readonly token: string;
  readonly session: Session;
}

export interface FakeHttpAuthOptions {
  /** e.g. "http://localhost:4180" */
  readonly baseUrl: string;
  /** The device's storage (the browser's localStorage). */
  readonly store: KeyValueStore;
  /** Default: the browser's `fetch`. */
  readonly fetch?: typeof fetch;
}

function isStored(value: unknown): value is Stored {
  const stored = value as Partial<Stored> | null;
  return (
    typeof stored?.token === "string" &&
    typeof stored.session?.userId === "string" &&
    typeof stored.session.email === "string"
  );
}

/** The secret of the session kept on the device, for the other calls to the fake server. */
export function fakeAuthToken(store: KeyValueStore): string | undefined {
  try {
    const value: unknown = JSON.parse(store.getItem(FAKE_AUTH_KEY) ?? "null");
    return isStored(value) ? value.token : undefined;
  } catch {
    return undefined;
  }
}

export class FakeHttpAuth implements Auth {
  private readonly baseUrl: string;
  private readonly store: KeyValueStore;
  private readonly send: typeof fetch;
  private readonly listeners = new Set<(session: Session | null) => void>();

  constructor(options: FakeHttpAuthOptions) {
    this.baseUrl = options.baseUrl;
    this.store = options.store;
    this.send = options.fetch ?? ((input, init) => fetch(input, init));
  }

  async session(): Promise<Session | null> {
    const stored = this.stored();
    if (stored === null) {
      return null;
    }
    void this.confirm(stored.token);
    return stored.session;
  }

  async requestCode(email: string, invite?: string): Promise<void> {
    await this.call("/auth/code", { email: emailAddress(email), ...(invite ? { invite } : {}) });
  }

  async verifyCode(email: string, code: string): Promise<Session> {
    const signedIn = await this.call("/auth/verify", { email: emailAddress(email), code });
    if (!isStored(signedIn)) {
      throw new AuthError("unknown");
    }
    this.store.setItem(FAKE_AUTH_KEY, JSON.stringify(signedIn));
    this.notify(signedIn.session);
    return signedIn.session;
  }

  async signOut(): Promise<void> {
    const stored = this.stored();
    if (stored === null) {
      return;
    }
    try {
      await this.request("/auth/sign-out", "POST", stored.token);
    } catch {
      // Without network the session ends on this device anyway.
    }
    this.forget();
  }

  onChange(listener: (session: Session | null) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Asks the server whether the session still holds; forgets it only on a clear "no". */
  private async confirm(token: string): Promise<void> {
    let response: Response;
    try {
      response = await this.request("/auth/session", "GET", token);
    } catch {
      return; // offline: keep the session
    }
    if (response.status === 401 && this.stored()?.token === token) {
      this.forget();
    }
  }

  private async call(path: string, body: object): Promise<unknown> {
    let response: Response;
    try {
      response = await this.request(path, "POST", undefined, body);
    } catch {
      throw new AuthError("offline");
    }
    const answer = (await response.json().catch(() => undefined)) as
      | { failure?: unknown }
      | undefined;
    if (!response.ok) {
      const given = answer?.failure;
      const failure: AuthFailure = isAuthFailure(given)
        ? given
        : response.status >= 500
          ? "offline"
          : "unknown";
      throw new AuthError(failure);
    }
    return answer;
  }

  private request(
    path: string,
    method: string,
    token: string | undefined,
    body?: object,
  ): Promise<Response> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token !== undefined) {
      headers.Authorization = `Bearer ${token}`;
    }
    return this.send(`${this.baseUrl}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  private stored(): Stored | null {
    try {
      const value: unknown = JSON.parse(this.store.getItem(FAKE_AUTH_KEY) ?? "null");
      return isStored(value) ? value : null;
    } catch {
      return null;
    }
  }

  private forget(): void {
    this.store.removeItem(FAKE_AUTH_KEY);
    this.notify(null);
  }

  private notify(session: Session | null): void {
    for (const listener of [...this.listeners]) {
      listener(session);
    }
  }
}
