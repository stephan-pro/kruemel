// The household of a signed-in person (stage 2): create one, see who belongs to it, invite the
// other person and accept an invite. The app only talks to this interface; the implementations are
// `SupabaseHousehold` (`supabaseHousehold.ts`, the database functions of `supabase/migrations/`)
// and `FakeHttpHousehold` (`fakeHttpHousehold.ts`, against the fake server). Both pass the same
// series of tests (`household.contract.ts`). The rules (one household per person, at most two
// people, an invite works once for 7 days) are enforced by the database, not by the app (S5).

import type { Person } from "../domain/task";
import type { PersonNames } from "../storage/appData";

export interface HouseholdInfo {
  readonly id: string;
  /** Who the signed-in person is in this household: the creator is `personA`. */
  readonly me: Person;
  /** Missing until the names were set. */
  readonly names: PersonNames | null;
  /** The people who have joined so far (one or two). */
  readonly members: readonly Person[];
}

export interface Invite {
  /** Goes into the link after `#/einladung/`. */
  readonly token: string;
  /** ISO time. */
  readonly expiresAt: string;
}

/** Why a step failed; `HOUSEHOLD_MESSAGES` says it to the person. */
export type HouseholdFailure =
  | "notSignedIn"
  /** This person already belongs to a household (creating, or accepting an invite). */
  | "alreadyMember"
  /** This person has no household yet (inviting). */
  | "noHousehold"
  | "inviteUnknown"
  | "inviteUsed"
  | "inviteExpired"
  /** Two people belong to the household already. */
  | "householdFull"
  | "invalidNames"
  | "offline"
  | "unknown";

export const HOUSEHOLD_MESSAGES: Readonly<Record<HouseholdFailure, string>> = {
  notSignedIn: "Bitte zuerst anmelden.",
  alreadyMember: "Du gehörst schon zu einem Haushalt.",
  noHousehold: "Du hast noch keinen Haushalt.",
  inviteUnknown: "Diese Einladung gibt es nicht. Bitte nach einem neuen Link fragen.",
  inviteUsed: "Diese Einladung wurde schon benutzt. Bitte nach einem neuen Link fragen.",
  inviteExpired: "Diese Einladung ist abgelaufen. Bitte nach einem neuen Link fragen.",
  householdFull: "In diesem Haushalt sind schon zwei Personen.",
  invalidNames: "Bitte beide Namen eingeben (höchstens 30 Zeichen).",
  offline: "Keine Verbindung zum Server. Bitte Internet prüfen und erneut versuchen.",
  unknown: "Das hat nicht geklappt. Bitte später erneut versuchen.",
};

/** How long an invite works (the same in the database and the fake). */
export const INVITE_DAYS = 7;

/** The longest name, as in the database. */
export const NAME_MAX = 30;

export class HouseholdError extends Error {
  readonly failure: HouseholdFailure;

  constructor(failure: HouseholdFailure, message: string = HOUSEHOLD_MESSAGES[failure]) {
    super(message);
    this.name = "HouseholdError";
    this.failure = failure;
  }
}

export function isHouseholdFailure(value: unknown): value is HouseholdFailure {
  return typeof value === "string" && Object.hasOwn(HOUSEHOLD_MESSAGES, value);
}

/** The names trimmed; throws `invalidNames` if one is empty or too long. */
export function checkedNames(names: PersonNames): PersonNames {
  const personA = names.personA.trim();
  const personB = names.personB.trim();
  for (const name of [personA, personB]) {
    if (name.length === 0 || name.length > NAME_MAX) {
      throw new HouseholdError("invalidNames");
    }
  }
  return { personA, personB };
}

export interface HouseholdApi {
  /** The household of the signed-in person, or `null` when there is none yet. */
  current(): Promise<HouseholdInfo | null>;
  /** Creates a household; the signed-in person becomes `personA`. Throws `HouseholdError`. */
  create(names: PersonNames): Promise<HouseholdInfo>;
  /** A new invite; earlier unused invites stop working. Throws `HouseholdError`. */
  createInvite(): Promise<Invite>;
  /** Joins the household the invite belongs to. Throws `HouseholdError`. */
  acceptInvite(token: string): Promise<HouseholdInfo>;
}
