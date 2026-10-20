// The fake server of the end-to-end tests without the HTTP details: households, who may use them
// (a secret per person) and the three calls the app makes, plus the sign-in with a code
// (`FakeAuth`, from E2-2a; the app's side is `FakeHttpAuth`). `scripts/fake-server.ts` puts a real
// HTTP server in front of it; unit tests call `handle` directly. It uses `FakeHousehold`, so it
// follows the same rules as `FakeRemote`.
//
// Test-only: the households do not know the sign-in yet (E2-2b); their secrets are just random
// text handed out by `/test/household`.

import { AuthError } from "../auth/auth";
import { FakeAuth, type FakeAuthOptions } from "../auth/fakeAuth";
import type { Person } from "../domain/task";
import type { AppData } from "../storage/appData";
import type { Change } from "./changes";
import { FakeHousehold } from "./fakeHousehold";

export interface ApiRequest {
  readonly method: string;
  /** Without the query, e.g. "/pull". */
  readonly path: string;
  readonly query: Readonly<Record<string, string>>;
  /** The secret of a person (`Authorization: Bearer …`). */
  readonly token: string | undefined;
  /** The parsed JSON body, if there was one. */
  readonly body: unknown;
}

export interface ApiResponse {
  readonly status: number;
  readonly body: unknown;
}

interface Member {
  readonly household: FakeHousehold;
  readonly person: Person;
}

function isChange(value: unknown): value is Change {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const { id, type } = value as { id?: unknown; type?: unknown };
  return typeof id === "string" && typeof type === "string";
}

export interface FakeServerOptions {
  /** Rules of the sign-in (clock, codes) for tests. */
  readonly auth?: FakeAuthOptions;
}

/** A text field of a JSON body; "" when it is missing or not text. */
function textOf(body: unknown, field: string): string {
  const value = (body as Record<string, unknown> | undefined)?.[field];
  return typeof value === "string" ? value : "";
}

export class FakeServer {
  private readonly members = new Map<string, Member>();
  /** The sign-in service; tests read the codes there (`auth.lastCode`). */
  readonly auth: FakeAuth;

  constructor(options: FakeServerOptions = {}) {
    this.auth = new FakeAuth(options.auth);
  }

  /** A new household (optionally with data) and the secret of each of its two people. */
  createHousehold(initial?: AppData): {
    readonly tokens: Readonly<Record<Person, string>>;
    readonly household: FakeHousehold;
  } {
    const household = new FakeHousehold(initial);
    const tokens = { personA: crypto.randomUUID(), personB: crypto.randomUUID() };
    this.members.set(tokens.personA, { household, person: "personA" });
    this.members.set(tokens.personB, { household, person: "personB" });
    return { tokens, household };
  }

  /** The household a secret belongs to; `undefined` for an unknown one. */
  householdFor(token: string | undefined): FakeHousehold | undefined {
    return token === undefined ? undefined : this.members.get(token)?.household;
  }

  handle(request: ApiRequest): ApiResponse {
    const { method, path } = request;
    if (method === "POST" && path === "/test/household") {
      const data = (request.body as { data?: AppData } | undefined)?.data;
      const { tokens } = this.createHousehold(data);
      return { status: 200, body: { tokens } };
    }
    if (path.startsWith("/auth/") || path === "/test/code") {
      return this.handleAuth(request);
    }
    const household = this.householdFor(request.token);
    if (household === undefined) {
      return { status: 401, body: { error: "Nicht angemeldet" } };
    }
    if (method === "GET" && path === "/pull") {
      return { status: 200, body: household.pull(request.query.cursor ?? null) };
    }
    if (method === "POST" && path === "/push") {
      return isChange(request.body)
        ? { status: 200, body: household.push(request.body) }
        : { status: 400, body: { error: "Keine Änderung" } };
    }
    if (method === "GET" && path === "/test/data") {
      return { status: 200, body: household.snapshot() };
    }
    return { status: 404, body: { error: "Unbekannte Adresse" } };
  }

  /**
   *   POST /auth/code     {email}        a code "by mail" (read with /test/code)
   *   POST /auth/verify   {email, code}  → {token, session}
   *   GET  /auth/session                 the session of the secret, 401 if it ended
   *   POST /auth/sign-out                ends the session of the secret
   *   GET  /test/code?email=             → {code}, the last code sent to the address
   * A refused step answers with `{failure}` (an `AuthFailure`), status 429 for too many tries.
   */
  private handleAuth(request: ApiRequest): ApiResponse {
    const { method, path, body, token } = request;
    try {
      if (method === "POST" && path === "/auth/code") {
        this.auth.requestCode(textOf(body, "email"));
        return { status: 200, body: {} };
      }
      if (method === "POST" && path === "/auth/verify") {
        return {
          status: 200,
          body: this.auth.verifyCode(textOf(body, "email"), textOf(body, "code")),
        };
      }
    } catch (error) {
      if (error instanceof AuthError) {
        return {
          status: error.failure === "tooManyTries" ? 429 : 400,
          body: { failure: error.failure },
        };
      }
      throw error;
    }
    if (method === "GET" && path === "/auth/session") {
      const session = this.auth.sessionFor(token);
      return session === undefined
        ? { status: 401, body: { error: "Sitzung beendet" } }
        : { status: 200, body: session };
    }
    if (method === "POST" && path === "/auth/sign-out") {
      this.auth.signOut(token);
      return { status: 200, body: {} };
    }
    if (method === "GET" && path === "/test/code") {
      const code = this.auth.lastCode(request.query.email ?? "");
      return code === undefined
        ? { status: 404, body: { error: "Kein Code" } }
        : { status: 200, body: { code } };
    }
    return { status: 404, body: { error: "Unbekannte Adresse" } };
  }
}
