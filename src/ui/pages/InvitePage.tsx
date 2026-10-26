import { useState } from "preact/hooks";
import {
  HOUSEHOLD_MESSAGES,
  HouseholdError,
  type HouseholdFailure,
  type HouseholdInfo,
} from "../../auth/household";
import { ACCOUNT_TEXTS } from "../accountTexts";
import { ErrorAlert } from "../components/Alert";
import { LanguageSwitch } from "../components/LanguageSwitch";
import { LegalLinks } from "../components/LegalLinks";
import { PageTitle } from "../components/PageTitle";
import { HOUSEHOLD_TEXTS, INVITE_FAILURE_TITLES } from "../householdTexts";

interface InvitePageProps {
  /** The address the person is signed in with: joining with the wrong one cannot be undone. */
  readonly email: string;
  /** The person already belongs to a household: the invite cannot be accepted. */
  readonly hasHousehold: boolean;
  /** Joins the household of the invite. Throws `HouseholdError`. */
  readonly onAccept: () => Promise<HouseholdInfo>;
  /** Forgets the invite ("Nicht jetzt", or "Weiter" after it failed for good). */
  readonly onDismiss: () => void;
  /** Signs out; the invite stays remembered for the next sign-in. */
  readonly onSignOut: () => Promise<void>;
}

/**
 * "Einladung annehmen" (stage 2): after the link was opened and the person signed in. Joining
 * needs a tap, so nobody joins with the wrong address by accident. An invite that cannot work
 * (unknown, used, expired, household full, already in a household) gets a page of its own;
 * no connection only a message, it can be tried again.
 */
export function InvitePage({
  email,
  hasHousehold,
  onAccept,
  onDismiss,
  onSignOut,
}: InvitePageProps) {
  const [refused, setRefused] = useState<HouseholdFailure | undefined>(
    hasHousehold ? "alreadyMember" : undefined,
  );
  /** Why joining failed this time; the sentence is read when drawing (language switch). */
  const [failed, setFailed] = useState<HouseholdFailure>();
  const [busy, setBusy] = useState(false);

  async function accept() {
    if (busy) {
      return;
    }
    setBusy(true);
    setFailed(undefined);
    try {
      await onAccept();
    } catch (error) {
      const failure = error instanceof HouseholdError ? error.failure : undefined;
      if (failure !== undefined && INVITE_FAILURE_TITLES[failure] !== undefined) {
        setRefused(failure);
      } else {
        setFailed(failure ?? "unknown");
      }
    } finally {
      setBusy(false);
    }
  }

  const refusedTitle = refused === undefined ? undefined : INVITE_FAILURE_TITLES[refused];
  if (refused !== undefined && refusedTitle !== undefined) {
    return (
      <>
        <PageTitle title={refusedTitle} />
        <div class="tile tile--narrow form">
          <p class="intro">{HOUSEHOLD_MESSAGES[refused]}</p>
          <div class="button-row">
            <button class="btn btn--primary" type="button" onClick={onDismiss}>
              {HOUSEHOLD_TEXTS.goOn}
            </button>
          </div>
        </div>
        <LanguageSwitch variant="compact" />
        <LegalLinks />
      </>
    );
  }

  return (
    <>
      <PageTitle title={HOUSEHOLD_TEXTS.acceptTitle} />
      <div class="tile tile--narrow form">
        <p class="intro">{HOUSEHOLD_TEXTS.acceptIntro}</p>
        <p class="account-email">{HOUSEHOLD_TEXTS.acceptAs(email)}</p>
        {failed && (
          <ErrorAlert title={HOUSEHOLD_TEXTS.acceptFailed}>{HOUSEHOLD_MESSAGES[failed]}</ErrorAlert>
        )}
        <div class="button-row">
          <button class="btn btn--primary" type="button" onClick={() => void accept()}>
            {busy ? ACCOUNT_TEXTS.busy : HOUSEHOLD_TEXTS.accept}
          </button>
          <button class="btn btn--quiet" type="button" onClick={onDismiss}>
            {HOUSEHOLD_TEXTS.notNow}
          </button>
        </div>
        <div class="button-row">
          <button class="btn btn--quiet" type="button" onClick={() => void onSignOut()}>
            {ACCOUNT_TEXTS.otherEmail}
          </button>
        </div>
      </div>
      <LanguageSwitch variant="compact" />
      <LegalLinks />
    </>
  );
}
