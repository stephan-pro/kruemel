// Who belongs to which household and the invites, in memory, with the rules of the database
// (`supabase/migrations/`, functions `create_household`, `create_invite`, `accept_invite`): one
// household per person, at most two people, the creator is `personA`, an invite works once for
// seven days, a new invite makes the unused earlier ones invalid. For the fake server of the tests;
// the app's side is `FakeHttpHousehold`.

import {
  checkedNames,
  HouseholdError,
  type HouseholdInfo,
  INVITE_DAYS,
  type Invite,
} from "../auth/household";
import type { Person } from "../domain/task";
import { emptyAppData, type PersonNames } from "../storage/appData";
import { FakeHousehold } from "./fakeHousehold";

interface Home {
  readonly id: string;
  readonly household: FakeHousehold;
  readonly names: PersonNames;
  readonly members: Map<string, Person>; // user id → role
}

interface StoredInvite {
  readonly home: Home;
  readonly expiresAt: number;
  used: boolean;
}

export class FakeAccounts {
  private readonly homeOf = new Map<string, Home>(); // user id → household
  private readonly invites = new Map<string, StoredInvite>();

  /** @param now Milliseconds since 1970. */
  constructor(private readonly now: () => number = Date.now) {}

  /** The server side of the household a person belongs to. */
  householdOf(userId: string): FakeHousehold | undefined {
    return this.homeOf.get(userId)?.household;
  }

  info(userId: string): HouseholdInfo | null {
    const home = this.homeOf.get(userId);
    if (home === undefined) {
      return null;
    }
    return {
      id: home.id,
      me: home.members.get(userId) as Person,
      names: home.names,
      members: [...home.members.values()].sort(),
    };
  }

  create(userId: string, names: PersonNames): HouseholdInfo {
    const checked = checkedNames(names);
    if (this.homeOf.has(userId)) {
      throw new HouseholdError("alreadyMember");
    }
    const home: Home = {
      id: crypto.randomUUID(),
      household: new FakeHousehold({
        ...emptyAppData(),
        settings: { personNames: checked },
      }),
      names: checked,
      members: new Map([[userId, "personA"]]),
    };
    this.homeOf.set(userId, home);
    return this.info(userId) as HouseholdInfo;
  }

  createInvite(userId: string): Invite {
    const home = this.homeOf.get(userId);
    if (home === undefined) {
      throw new HouseholdError("noHousehold");
    }
    if (home.members.size >= 2) {
      throw new HouseholdError("householdFull");
    }
    for (const [token, invite] of this.invites) {
      if (invite.home === home && !invite.used) {
        this.invites.delete(token);
      }
    }
    const token = crypto.randomUUID().replaceAll("-", "");
    const expiresAt = this.now() + INVITE_DAYS * 24 * 60 * 60_000;
    this.invites.set(token, { home, expiresAt, used: false });
    return { token, expiresAt: new Date(expiresAt).toISOString() };
  }

  acceptInvite(userId: string, token: string): HouseholdInfo {
    const invite = this.invites.get(token);
    if (invite === undefined) {
      throw new HouseholdError("inviteUnknown");
    }
    if (invite.used) {
      throw new HouseholdError("inviteUsed");
    }
    if (invite.expiresAt <= this.now()) {
      throw new HouseholdError("inviteExpired");
    }
    if (this.homeOf.has(userId)) {
      throw new HouseholdError("alreadyMember");
    }
    invite.home.members.set(userId, "personB");
    this.homeOf.set(userId, invite.home);
    invite.used = true;
    return this.info(userId) as HouseholdInfo;
  }
}
