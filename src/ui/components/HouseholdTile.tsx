import { Copy, Link, QrCode as QrCodeIcon, Share2 } from "lucide-preact";
import { useEffect, useId, useState } from "preact/hooks";
import type { HouseholdInfo, Invite } from "../../auth/household";
import type { Person } from "../../domain/task";
import type { PersonNames } from "../../storage/appData";
import { appAddress } from "../appInfo";
import { formatInviteEnd, HOUSEHOLD_TEXTS } from "../householdTexts";
import { householdMessage } from "../pages/HouseholdPage";
import { inviteHash } from "../route";
import { ErrorAlert } from "./Alert";
import { QrCode } from "./QrCode";

interface HouseholdTileProps {
  readonly household: HouseholdInfo;
  /** The names to show: the household's, or this device's while the household has none. */
  readonly names: PersonNames;
  /** A new invite; earlier unused ones stop working. Throws `HouseholdError`. */
  readonly onCreateInvite: () => Promise<Invite>;
}

const PEOPLE: readonly Person[] = ["personA", "personB"];

const LINK_FIELD = "einladungslink";

/** The whole invite link, e.g. "https://…/kruemel/#/einladung/abc…". */
export function inviteLink(token: string): string {
  return `${appAddress()}${inviteHash(token)}`;
}

/**
 * "Haushalt" in the settings (stage 2): who belongs to it and, while the second person is missing,
 * the invite link to pass on: copy (with "Kopiert." for eyes and screen readers), the phone's share
 * menu where there is one, and a QR code to scan from the screen.
 */
export function HouseholdTile({ household, names, onCreateInvite }: HouseholdTileProps) {
  const [invite, setInvite] = useState<Invite>();
  const [failed, setFailed] = useState<string>();
  const [busy, setBusy] = useState(false);
  /** What the status line says after copying, and how often it was said (read out each time). */
  const [copied, setCopied] = useState<{ text: string; count: number }>();
  const [qrShown, setQrShown] = useState(false);
  const qrId = useId();
  const link = invite === undefined ? undefined : inviteLink(invite.token);
  const canShare = typeof navigator.share === "function";

  // A new link: the focus goes to it, so a screen reader reads it with its hint.
  useEffect(() => {
    if (invite !== undefined) {
      document.getElementById(LINK_FIELD)?.focus();
    }
  }, [invite]);

  async function createInvite() {
    if (busy) {
      return;
    }
    setBusy(true);
    setFailed(undefined);
    setCopied(undefined);
    try {
      setInvite(await onCreateInvite());
    } catch (error) {
      setFailed(householdMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (link === undefined) {
      return;
    }
    let text: string = HOUSEHOLD_TEXTS.copied;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      text = HOUSEHOLD_TEXTS.copyFailed;
      document.getElementById(LINK_FIELD)?.focus();
    }
    setCopied((before) => ({ text, count: (before?.count ?? 0) + 1 }));
  }

  async function share() {
    if (link === undefined) {
      return;
    }
    try {
      await navigator.share({
        title: HOUSEHOLD_TEXTS.shareTitle,
        text: HOUSEHOLD_TEXTS.shareText,
        url: link,
      });
    } catch {
      // Closed without sharing, or the browser refused: the link is still there to copy.
    }
  }

  const complete = household.members.length >= 2;

  return (
    <section class="tile tile--narrow form" aria-labelledby="haushalt">
      <h2 class="tile__title" id="haushalt">
        {HOUSEHOLD_TEXTS.tileTitle}
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
      {complete ? (
        <p class="muted">{HOUSEHOLD_TEXTS.bothJoined}</p>
      ) : (
        <>
          <p class="muted">{HOUSEHOLD_TEXTS.inviteIntro}</p>
          {link !== undefined && invite !== undefined && (
            <>
              <div class="field">
                <label class="field__label" for={LINK_FIELD}>
                  {HOUSEHOLD_TEXTS.inviteLinkField}
                </label>
                <span class="field__hint" id={`${LINK_FIELD}-hinweis`}>
                  {HOUSEHOLD_TEXTS.validUntil(formatInviteEnd(invite.expiresAt))}
                </span>
                <input
                  class="input"
                  id={LINK_FIELD}
                  type="text"
                  readOnly
                  value={link}
                  aria-describedby={`${LINK_FIELD}-hinweis`}
                  onFocus={(event) => event.currentTarget.select()}
                />
              </div>
              <div class="button-row">
                <button class="btn btn--primary" type="button" onClick={() => void copy()}>
                  <Copy size={20} />
                  {HOUSEHOLD_TEXTS.copy}
                </button>
                {canShare && (
                  <button class="btn btn--secondary" type="button" onClick={() => void share()}>
                    <Share2 size={20} />
                    {HOUSEHOLD_TEXTS.share}
                  </button>
                )}
                <button
                  class="btn btn--secondary"
                  type="button"
                  aria-expanded={qrShown}
                  aria-controls={qrId}
                  onClick={() => setQrShown(!qrShown)}
                >
                  <QrCodeIcon size={20} />
                  {qrShown ? HOUSEHOLD_TEXTS.hideQr : HOUSEHOLD_TEXTS.showQr}
                </button>
              </div>
              <p class="form-status" role="status">
                {copied && <span key={copied.count}>{copied.text}</span>}
              </p>
              <div class="qr" id={qrId} hidden={!qrShown}>
                {qrShown && <QrCode content={link} label={HOUSEHOLD_TEXTS.qrLabel} />}
              </div>
              <p class="muted">{HOUSEHOLD_TEXTS.newInviteHint}</p>
            </>
          )}
          {failed && <ErrorAlert title={HOUSEHOLD_TEXTS.inviteFailed}>{failed}</ErrorAlert>}
          <div class="button-row">
            <button
              class={`btn ${link === undefined ? "btn--primary" : "btn--quiet"}`}
              type="button"
              onClick={() => void createInvite()}
            >
              <Link size={20} />
              {link === undefined ? HOUSEHOLD_TEXTS.createInvite : HOUSEHOLD_TEXTS.newInvite}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
