import { Link } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import type { Invite } from "../../auth/household";
import { appAddress } from "../appInfo";
import { FRIEND_TEXTS, formatInviteEnd } from "../householdTexts";
import { householdMessage } from "../pages/HouseholdPage";
import { friendInviteHash } from "../route";
import { ErrorAlert } from "./Alert";
import { InviteLinkShare } from "./InviteLinkShare";

interface FriendInviteTileProps {
  /** A new friend invite. Throws `HouseholdError` (also for the limits). */
  readonly onCreate: () => Promise<Invite>;
  /** The open friend invites, oldest first. Throws `HouseholdError`. */
  readonly onList: () => Promise<readonly Invite[]>;
  /** Withdraws one. Throws `HouseholdError`. */
  readonly onCancel: (token: string) => Promise<void>;
}

const LINK_FIELD = "freunde-einladungslink";
const CREATE_BUTTON = "freunde-einladen";

/** The whole friend invite link, e.g. "https://…/kruemel/#/freunde/abc…". */
export function friendInviteLink(token: string): string {
  return `${appAddress()}${friendInviteHash(token)}`;
}

/**
 * "Freunde einladen" in the settings (E2-5b): a link with which somebody gets an account and a
 * household of their own, passed on like the household invite (`InviteLinkShare`). Below, the
 * open links: show one again, or withdraw it. The limits are the server's; its refusal shows as
 * an error.
 */
export function FriendInviteTile({ onCreate, onList, onCancel }: FriendInviteTileProps) {
  const [open, setOpen] = useState<readonly Invite[]>([]);
  const [shown, setShown] = useState<Invite>();
  const [listFailed, setListFailed] = useState(false);
  const [failed, setFailed] = useState<{ title: string; message: string }>();
  const [status, setStatus] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function refresh() {
    try {
      setOpen(await onList());
      setListFailed(false);
    } catch {
      setListFailed(true);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function run(title: string, action: () => Promise<void>) {
    if (busy) {
      return;
    }
    setBusy(true);
    setFailed(undefined);
    setStatus(undefined);
    try {
      await action();
    } catch (error) {
      setFailed({ title, message: householdMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  function create() {
    void run(FRIEND_TEXTS.failed, async () => {
      const invite = await onCreate();
      setShown(invite);
      await refresh();
    });
  }

  function cancel(token: string) {
    void run(FRIEND_TEXTS.cancelFailed, async () => {
      await onCancel(token);
      if (shown?.token === token) {
        setShown(undefined);
      }
      await refresh();
      setStatus(FRIEND_TEXTS.cancelled);
      // The row is gone with its buttons: the focus goes on to making a new link.
      document.getElementById(CREATE_BUTTON)?.focus();
    });
  }

  return (
    <section class="tile tile--narrow form" aria-labelledby="freunde">
      <h2 class="tile__title" id="freunde">
        {FRIEND_TEXTS.tileTitle}
      </h2>
      <p class="muted">{FRIEND_TEXTS.intro}</p>
      {shown !== undefined && (
        <InviteLinkShare
          link={friendInviteLink(shown.token)}
          expiresAt={shown.expiresAt}
          fieldId={LINK_FIELD}
          fieldLabel={FRIEND_TEXTS.linkField}
          shareTitle={FRIEND_TEXTS.shareTitle}
          shareText={FRIEND_TEXTS.shareText}
          qrLabel={FRIEND_TEXTS.qrLabel}
        />
      )}
      {failed && <ErrorAlert title={failed.title}>{failed.message}</ErrorAlert>}
      <div class="button-row">
        <button
          class={`btn ${shown === undefined ? "btn--primary" : "btn--quiet"}`}
          type="button"
          id={CREATE_BUTTON}
          onClick={create}
        >
          <Link size={20} />
          {shown === undefined ? FRIEND_TEXTS.create : FRIEND_TEXTS.createAnother}
        </button>
      </div>
      <p class="muted">{FRIEND_TEXTS.limits}</p>
      {listFailed && <p class="muted">{FRIEND_TEXTS.listFailed}</p>}
      {open.length > 0 && (
        <>
          <h3 class="tile__subtitle">{FRIEND_TEXTS.openTitle}</h3>
          <ul class="member-list">
            {open.map((invite) => {
              const end = formatInviteEnd(invite.expiresAt);
              return (
                <li key={invite.token} class="member-list__item">
                  <span>{FRIEND_TEXTS.openEntry(end)}</span>
                  <span class="button-row">
                    <button class="btn btn--quiet" type="button" onClick={() => setShown(invite)}>
                      {FRIEND_TEXTS.show}
                      <span class="visually-hidden">{FRIEND_TEXTS.entryName(end)}</span>
                    </button>
                    <button
                      class="btn btn--quiet"
                      type="button"
                      onClick={() => cancel(invite.token)}
                    >
                      {FRIEND_TEXTS.cancel}
                      <span class="visually-hidden">{FRIEND_TEXTS.entryName(end)}</span>
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <p class="form-status" role="status">
        {status ?? ""}
      </p>
    </section>
  );
}
