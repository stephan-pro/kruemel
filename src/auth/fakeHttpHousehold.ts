// `HouseholdApi` against the fake server of the end-to-end tests (`scripts/fake-server.ts`,
// `FakeAccounts`). It uses the secret of the session `FakeHttpAuth` keeps in the device's storage.
// Test-only.

import type { Person } from "../domain/task";
import type { PersonNames } from "../storage/appData";
import type { KeyValueStore } from "../storage/localStorage";
import { fakeAuthToken } from "./fakeHttpAuth";
import {
  checkedHouseholdName,
  checkedNames,
  type HouseholdApi,
  HouseholdError,
  type HouseholdFailure,
  type HouseholdInfo,
  type Invite,
  isHouseholdFailure,
} from "./household";

export interface FakeHttpHouseholdOptions {
  /** e.g. "http://localhost:4180" */
  readonly baseUrl: string;
  /** The device's storage (where `FakeHttpAuth` keeps the session). */
  readonly store: KeyValueStore;
  /** Default: the browser's `fetch`. */
  readonly fetch?: typeof fetch;
}

export class FakeHttpHousehold implements HouseholdApi {
  private readonly send: typeof fetch;

  constructor(private readonly options: FakeHttpHouseholdOptions) {
    this.send = options.fetch ?? ((input, init) => fetch(input, init));
  }

  async current(): Promise<HouseholdInfo | null> {
    const answer = (await this.call("GET", "/household")) as { household: HouseholdInfo | null };
    return answer.household;
  }

  async create(names: PersonNames): Promise<HouseholdInfo> {
    const { personA, personB } = checkedNames(names);
    const answer = (await this.call("POST", "/household/create", { personA, personB })) as {
      household: HouseholdInfo;
    };
    return answer.household;
  }

  async createInvite(): Promise<Invite> {
    return (await this.call("POST", "/household/invite")) as Invite;
  }

  async acceptInvite(token: string): Promise<HouseholdInfo> {
    const answer = (await this.call("POST", "/household/accept", { token })) as {
      household: HouseholdInfo;
    };
    return answer.household;
  }

  async rename(name: string): Promise<HouseholdInfo> {
    const answer = (await this.call("POST", "/household/rename", {
      name: checkedHouseholdName(name) ?? "",
    })) as { household: HouseholdInfo };
    return answer.household;
  }

  async removeMember(person: Person): Promise<HouseholdInfo> {
    const answer = (await this.call("POST", "/household/remove", { person })) as {
      household: HouseholdInfo;
    };
    return answer.household;
  }

  async leave(): Promise<void> {
    await this.call("POST", "/household/leave");
  }

  async deleteAccount(): Promise<void> {
    await this.call("POST", "/household/delete-account");
  }

  private async call(method: string, path: string, body?: object): Promise<unknown> {
    const token = fakeAuthToken(this.options.store);
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token !== undefined) {
      headers.Authorization = `Bearer ${token}`;
    }
    let response: Response;
    try {
      response = await this.send(`${this.options.baseUrl}${path}`, {
        method,
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } catch {
      throw new HouseholdError("offline");
    }
    const answer = (await response.json().catch(() => undefined)) as
      | { failure?: unknown }
      | undefined;
    if (!response.ok) {
      const given = answer?.failure;
      const failure: HouseholdFailure = isHouseholdFailure(given)
        ? given
        : response.status >= 500
          ? "offline"
          : "unknown";
      throw new HouseholdError(failure);
    }
    return answer;
  }
}
