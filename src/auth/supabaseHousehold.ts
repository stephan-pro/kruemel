// `HouseholdApi` over the database functions and tables of the real project (through supabase-js).
// Reading goes through the tables (row level security shows a person only their own household),
// writing through the functions `create_household`, `create_invite` and `accept_invite`; their
// errors are the messages the functions raise (`supabase/migrations/`).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Person } from "../domain/task";
import {
  checkedNames,
  type HouseholdApi,
  HouseholdError,
  type HouseholdFailure,
  type HouseholdInfo,
  type Invite,
} from "./household";

/** The messages the database functions raise, and what they mean. */
const RAISED: Readonly<Record<string, HouseholdFailure>> = {
  not_signed_in: "notSignedIn",
  already_member: "alreadyMember",
  no_household: "noHousehold",
  invite_unknown: "inviteUnknown",
  invite_used: "inviteUsed",
  invite_expired: "inviteExpired",
  household_full: "householdFull",
};

interface Failed {
  readonly message: string;
  readonly code?: string;
}

function failure(error: Failed): HouseholdError {
  const known = Object.entries(RAISED).find(([raised]) => error.message.includes(raised));
  if (known !== undefined) {
    return new HouseholdError(known[1]);
  }
  // A call that never reached the service has no error code at all.
  return new HouseholdError(error.code === undefined || error.code === "" ? "offline" : "unknown");
}

interface MemberRow {
  readonly user_id: string;
  readonly household_id: string;
  readonly role: Person;
  readonly households: {
    readonly person_a_name: string | null;
    readonly person_b_name: string | null;
  } | null;
}

export class SupabaseHousehold implements HouseholdApi {
  constructor(private readonly client: SupabaseClient) {}

  async current(): Promise<HouseholdInfo | null> {
    const { data: stored } = await this.client.auth.getSession();
    const userId = stored.session?.user.id;
    if (userId === undefined) {
      throw new HouseholdError("notSignedIn");
    }
    const { data, error } = await this.client
      .from("household_members")
      .select("user_id, household_id, role, households(person_a_name, person_b_name)")
      .returns<MemberRow[]>();
    if (error) {
      throw failure(error);
    }
    const mine = data.find((row) => row.user_id === userId);
    if (mine === undefined) {
      return null;
    }
    const { person_a_name: personA, person_b_name: personB } = mine.households ?? {};
    return {
      id: mine.household_id,
      me: mine.role,
      names: personA && personB ? { personA, personB } : null,
      members: data
        .filter((row) => row.household_id === mine.household_id)
        .map((row) => row.role)
        .sort(),
    };
  }

  async create(names: Parameters<HouseholdApi["create"]>[0]): Promise<HouseholdInfo> {
    const { personA, personB } = checkedNames(names);
    const { error } = await this.client.rpc("create_household", {
      p_person_a: personA,
      p_person_b: personB,
    });
    if (error) {
      throw failure(error);
    }
    return this.known();
  }

  async createInvite(): Promise<Invite> {
    const { data, error } = await this.client.rpc("create_invite");
    if (error) {
      throw failure(error);
    }
    return data as Invite;
  }

  async acceptInvite(token: string): Promise<HouseholdInfo> {
    const { error } = await this.client.rpc("accept_invite", { p_token: token });
    if (error) {
      throw failure(error);
    }
    return this.known();
  }

  /** The household right after it was created or joined. */
  private async known(): Promise<HouseholdInfo> {
    const info = await this.current();
    if (info === null) {
      throw new HouseholdError("unknown");
    }
    return info;
  }
}
