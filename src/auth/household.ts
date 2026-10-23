// The household of a signed-in person (stage 2): create one, see who belongs to it, invite the
// other person and accept an invite; remove the other person, leave, delete one's account (E2-5a). The app only talks to this interface; the implementations are
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
  /** The household's own name (E2-3g), e.g. "WG Sonnenweg"; `null` while it has none. */
  readonly name: string | null;
  /** The people who have joined so far (one or two). */
  readonly members: readonly Person[];
}

export interface Invite {
  /** Goes into the link after `#/einladung/` (a friend invite: after `#/freunde/`). */
  readonly token: string;
  /** ISO time. */
  readonly expiresAt: string;
}

/** At most this many open friend invites per person (E2-5b, database and fake). */
export const FRIEND_INVITES_OPEN = 5;

/** At most this many new friend invites per person in 24 hours, withdrawn ones included. */
export const FRIEND_INVITES_PER_DAY = 10;

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
  | "invalidHouseholdName"
  /** Removing oneself, or a place that does not exist (E2-5a; leaving is `leave`). */
  | "invalidMember"
  /** Already `FRIEND_INVITES_OPEN` open friend invites (E2-5b). */
  | "friendInvitesOpen"
  /** Already `FRIEND_INVITES_PER_DAY` friend invites in the last 24 hours (E2-5b). */
  | "friendInvitesToday"
  | "offline"
  | "unknown";

export const HOUSEHOLD_MESSAGES: Readonly<Record<HouseholdFailure, string>> = {
  notSignedIn: "Bitte zuerst anmelden.",
  alreadyMember:
    "Du gehörst schon zu einem Haushalt. Willst du wechseln, verlass zuerst deinen Haushalt (Einstellungen → Haushalt) und öffne den Link dann noch einmal.",
  noHousehold: "Du hast noch keinen Haushalt.",
  inviteUnknown: "Diese Einladung gibt es nicht. Bitte nach einem neuen Link fragen.",
  inviteUsed: "Diese Einladung wurde schon benutzt. Bitte nach einem neuen Link fragen.",
  inviteExpired: "Diese Einladung ist abgelaufen. Bitte nach einem neuen Link fragen.",
  householdFull:
    "In diesem Haushalt sind schon zwei Personen. Frag nach, ob jemand Platz macht, und lass dir dann einen neuen Link schicken.",
  invalidNames: "Bitte beide Namen eingeben (höchstens 30 Zeichen).",
  invalidHouseholdName: "Der Name des Haushalts darf höchstens 30 Zeichen lang sein.",
  invalidMember: "Dich selbst kannst du nicht entfernen. Nimm dafür „Haushalt verlassen“.",
  friendInvitesOpen: `Du hast schon ${FRIEND_INVITES_OPEN} offene Links. Zieh einen zurück oder warte, bis jemand einen benutzt.`,
  friendInvitesToday: `Du hast in den letzten 24 Stunden schon ${FRIEND_INVITES_PER_DAY} Links erzeugt. Bitte versuch es morgen wieder.`,
  offline: "Keine Verbindung zu Krümel. Prüf dein Internet und versuch es noch einmal.",
  unknown: "Das hat nicht geklappt. Versuch es später noch einmal.",
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

/** The household's name trimmed, `null` for none; throws `invalidHouseholdName` if too long. */
export function checkedHouseholdName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length > NAME_MAX) {
    throw new HouseholdError("invalidHouseholdName");
  }
  return trimmed === "" ? null : trimmed;
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
  /** Sets the household's name, an empty one removes it; only online. Throws `HouseholdError`. */
  rename(name: string): Promise<HouseholdInfo>;
  /**
   * Removes the other person (E2-5a); their place is free again and can be invited anew. A free
   * place stays free (nothing happens). Only online. Throws `HouseholdError`.
   */
  removeMember(person: Person): Promise<HouseholdInfo>;
  /**
   * Leaves the household (E2-5a). Tasks, completions and names stay for the other person; the
   * last one out deletes the household with all its data. Only online. Throws `HouseholdError`.
   */
  leave(): Promise<void>;
  /**
   * Deletes the signed-in person's account for good, after leaving the household as `leave` does
   * (E2-5a). A database function does it, no secret key is needed. Only online. Throws
   * `HouseholdError`. The session on the device is ended by the caller (`Auth.signOut`).
   */
  deleteAccount(): Promise<void>;
  /**
   * A friend invite (E2-5b): a link with which somebody gets an account and creates a household
   * of their own; 7 days, once. Only for members, within `FRIEND_INVITES_OPEN` and
   * `FRIEND_INVITES_PER_DAY`. Its token goes into the link after `#/freunde/`. Throws
   * `HouseholdError`.
   */
  createFriendInvite(): Promise<Invite>;
  /** The person's open friend invites (not used, withdrawn or expired), oldest first. */
  friendInvites(): Promise<readonly Invite[]>;
  /** Withdraws one of the person's open friend invites; anything else changes nothing. */
  cancelFriendInvite(token: string): Promise<void>;
}
