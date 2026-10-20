// The fake server of the end-to-end tests without the HTTP details: households, who may use them
// (a secret per person) and the three calls the app makes. `scripts/fake-server.ts` puts a real
// HTTP server in front of it; unit tests call `handle` directly. It uses `FakeHousehold`, so it
// follows the same rules as `FakeRemote`.
//
// Test-only: it has no login, and its secrets are just random text handed out by `/test/household`.

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

export class FakeServer {
  private readonly members = new Map<string, Member>();

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
}
