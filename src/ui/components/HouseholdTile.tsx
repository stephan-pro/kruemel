import { Link } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import type { HouseholdInfo, Invite } from "../../auth/household";
import type { Person } from "../../domain/task";
import type { PersonNames } from "../../storage/appData";
import { appAddress } from "../appInfo";
import { HOUSEHOLD_TEXTS, LEAVE_TEXTS } from "../householdTexts";
import { householdMessage } from "../pages/HouseholdPage";
import { inviteHash } from "../route";
import { ErrorAlert } from "./Alert";
import { LeaveHousehold, RemoveMember } from "./HouseholdLeave";
import { HouseholdNamesForm } from "./HouseholdNamesForm";
import { InviteLinkShare } from "./InviteLinkShare";

interface HouseholdTileProps {
  readonly household: HouseholdInfo;
  /** The names to show: the household's, or this device's while the household has none. */
  readonly names: PersonNames;
  /** A new invite; earlier unused ones stop working. Throws `HouseholdError`. */
  readonly onCreateInvite: () => Promise<Invite>;
  /** Saves the person's own name with the shared data (E2-3g). */
  readonly onSaveOwnName: (name: string) => Promise<void>;
  /** Sets the household's name (E2-3g); only online. Throws `HouseholdError`. */
  readonly onRename: (name: string) => Promise<void>;
  /** Removes the other person (E2-5a); only online. Throws `HouseholdError`. */
  readonly onRemove: (person: Person) => Promise<void>;
  /** Before "Haushalt verlassen?": sends what waits and says how many changes still wait. */
  readonly onPrepareLeave: () => Promise<number>;
  /** Leaves the household (E2-5a); only online. Throws `HouseholdError`. */
  readonly onLeave: () => Promise<void>;
  /** Downloads a backup of all data (offered in the question). */
  readonly onBackup: () => void;
}

const PEOPLE: readonly Person[] = ["personA", "personB"];

const LINK_FIELD = "einladungslink";
const INVITE_BUTTON = "einladung-erzeugen";

/** The whole invite link, e.g. "https://…/kruemel/#/einladung/abc…". */
export function inviteLink(token: string): string {
  return `${appAddress()}${inviteHash(token)}`;
}

/**
 * "Haushalt" in the settings (stage 2): who belongs to it and, while the second person is missing,
 * the invite link to pass on (`InviteLinkShare`). Below, the names (E2-3g).
 */
export function HouseholdTile({
  household,
  names,
  onCreateInvite,
  onSaveOwnName,
  onRename,
  onRemove,
  onPrepareLeave,
  onLeave,
  onBackup,
}: HouseholdTileProps) {
  const [invite, setInvite] = useState<Invite>();
  const [failed, setFailed] = useState<string>();
  const [busy, setBusy] = useState(false);
  const link = invite === undefined ? undefined : inviteLink(invite.token);

  async function createInvite() {
    if (busy) {
      return;
    }
    setBusy(true);
    setFailed(undefined);
    try {
      setInvite(await onCreateInvite());
    } catch (error) {
      setFailed(householdMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const complete = household.members.length >= 2;
  const other: Person = household.me === "personA" ? "personB" : "personA";
  const otherJoined = household.members.includes(other);
  const [removed, setRemoved] = useState<string>();

  // The button is gone with the person: the focus goes on to inviting someone new.
  useEffect(() => {
    if (removed !== undefined && !otherJoined) {
      document.getElementById(INVITE_BUTTON)?.focus();
    }
  }, [removed, otherJoined]);

  return (
    <section class="tile tile--narrow form" aria-labelledby="haushalt">
      <h2 class="tile__title" id="haushalt">
        {household.name ?? HOUSEHOLD_TEXTS.tileTitle}
      </h2>
      <ul class="member-list">
        {PEOPLE.map((person) => (
          <li key={person} class="member-list__item" data-person={person}>
            <span class="member-list__name">
              {names[person]}
              {person === household.me && ` ${HOUSEHOLD_TEXTS.you}`}
            </span>
            <span class="muted">
              {household.members.includes(person)
                ? HOUSEHOLD_TEXTS.joined
                : HOUSEHOLD_TEXTS.notJoined}
            </span>
          </li>
        ))}
      </ul>
      {otherJoined && (
        <div class="button-row">
          <RemoveMember
            name={names[other]}
            onRemove={async () => {
              await onRemove(other);
              setRemoved(LEAVE_TEXTS.removed(names[other]));
            }}
          />
        </div>
      )}
      {complete ? (
        <p class="muted">{HOUSEHOLD_TEXTS.bothJoined}</p>
      ) : (
        <>
          <p class="muted">{HOUSEHOLD_TEXTS.inviteIntro}</p>
          {link !== undefined && invite !== undefined && (
            <>
              <InviteLinkShare
                link={link}
                expiresAt={invite.expiresAt}
                fieldId={LINK_FIELD}
                fieldLabel={HOUSEHOLD_TEXTS.secondPersonLinkField}
                shareTitle={HOUSEHOLD_TEXTS.shareTitle}
                shareText={HOUSEHOLD_TEXTS.shareText(household.name)}
                qrLabel={HOUSEHOLD_TEXTS.qrLabel}
              />
              <p class="muted">{HOUSEHOLD_TEXTS.newInviteHint}</p>
            </>
          )}
          {failed && <ErrorAlert title={HOUSEHOLD_TEXTS.inviteFailed}>{failed}</ErrorAlert>}
          <div class="button-row">
            <button
              class={`btn ${link === undefined ? "btn--primary" : "btn--quiet"}`}
              type="button"
              id={INVITE_BUTTON}
              onClick={() => void createInvite()}
            >
              <Link size={20} />
              {link === undefined ? HOUSEHOLD_TEXTS.createInvite : HOUSEHOLD_TEXTS.newInvite}
            </button>
          </div>
        </>
      )}
      <p class="form-status" role="status">
        {removed && !otherJoined ? removed : ""}
      </p>
      <HouseholdNamesForm
        householdName={household.name}
        names={names}
        me={household.me}
        onSaveOwnName={onSaveOwnName}
        onRename={onRename}
      />
      <LeaveHousehold
        other={otherJoined ? names[other] : undefined}
        onPrepare={onPrepareLeave}
        onLeave={onLeave}
        onBackup={onBackup}
      />
    </section>
  );
}
