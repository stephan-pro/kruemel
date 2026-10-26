import { useState } from "preact/hooks";
import { HOUSEHOLD_MESSAGES, HouseholdError, type HouseholdInfo } from "../../auth/household";
import { checkPersonNames, type PersonNameErrors } from "../../domain/personNames";
import type { PersonNames } from "../../storage/appData";
import { ACCOUNT_TEXTS } from "../accountTexts";
import { ErrorAlert } from "../components/Alert";
import { TextField, useFieldErrorFocus } from "../components/fields";
import { LegalLinks } from "../components/LegalLinks";
import { PageTitle } from "../components/PageTitle";
import { personNameErrorText } from "../formErrors";
import { HOUSEHOLD_TEXTS, LEAVE_TEXTS } from "../householdTexts";
import { friendInviteTokenFrom, inviteTokenFrom } from "../route";

const OWN_NAME_FIELD = "haushalt-name-ich";
const OTHER_NAME_FIELD = "haushalt-name-andere";
const LINK_FIELD = "haushalt-einladung";

/** What a refused step says to the person. */
export function householdMessage(error: unknown): string {
  return HOUSEHOLD_MESSAGES[error instanceof HouseholdError ? error.failure : "unknown"];
}

function linkErrorText(problem: "friend" | "notAnInvite"): string {
  return problem === "friend" ? HOUSEHOLD_TEXTS.friendLinkHere : HOUSEHOLD_TEXTS.notAnInvite;
}

interface HouseholdPageProps {
  /** Creates the household with the signed-in person as `personA`. Throws `HouseholdError`. */
  readonly onCreate: (names: PersonNames) => Promise<HouseholdInfo>;
  /** An invite link was pasted: the app goes on to "Einladung annehmen". */
  readonly onInvite: (token: string) => void;
  /** Why the person is here again (left, or removed; E2-5a); shown above the form. */
  readonly notice?: string | undefined;
}

/**
 * Signed in without a household (stage 2): create one, or open an invite. The invite link usually
 * opens the app by itself; the field is for the installed app on an iPhone, where a tapped link
 * opens in Safari instead.
 */
export function HouseholdPage({ onCreate, onInvite, notice }: HouseholdPageProps) {
  const [names, setNames] = useState<PersonNames>({ personA: "", personB: "" });
  const [errors, setErrors] = useState<PersonNameErrors>({});
  const [failed, setFailed] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  /** What is wrong with the pasted link; the sentence is read when drawing (language switch). */
  const [linkError, setLinkError] = useState<"friend" | "notAnInvite">();
  const { report, status } = useFieldErrorFocus();

  async function create(event: Event) {
    event.preventDefault();
    if (busy) {
      return;
    }
    const checked = checkPersonNames(names);
    setErrors(checked.ok ? {} : checked.errors);
    setFailed(undefined);
    if (!checked.ok) {
      const { personA, personB } = checked.errors;
      const first = personA ?? personB;
      report(personA ? OWN_NAME_FIELD : OTHER_NAME_FIELD, first ? personNameErrorText(first) : "");
      return;
    }
    setBusy(true);
    try {
      await onCreate(checked.names);
    } catch (error) {
      setFailed(householdMessage(error));
    } finally {
      setBusy(false);
    }
  }

  function openInvite(event: Event) {
    event.preventDefault();
    const token = inviteTokenFrom(link);
    if (token === undefined) {
      const problem = friendInviteTokenFrom(link) !== undefined ? "friend" : "notAnInvite";
      setLinkError(problem);
      report(LINK_FIELD, linkErrorText(problem));
      return;
    }
    onInvite(token);
  }

  return (
    <>
      <PageTitle title={HOUSEHOLD_TEXTS.createTitle} />
      <div class="page-stack">
        {notice && (
          <section class="tile tile--narrow" aria-label={LEAVE_TEXTS.noticeLabel}>
            <p>{notice}</p>
          </section>
        )}
        <div class="tile tile--narrow">
          <p class="intro">{HOUSEHOLD_TEXTS.createIntro}</p>
          <form class="form" onSubmit={create} noValidate>
            <TextField
              id={OWN_NAME_FIELD}
              label={HOUSEHOLD_TEXTS.ownNameLabel}
              autocomplete="given-name"
              value={names.personA}
              error={errors.personA && personNameErrorText(errors.personA)}
              onInput={(personA) => setNames({ ...names, personA })}
            />
            <TextField
              id={OTHER_NAME_FIELD}
              label={HOUSEHOLD_TEXTS.otherNameLabel}
              value={names.personB}
              error={errors.personB && personNameErrorText(errors.personB)}
              onInput={(personB) => setNames({ ...names, personB })}
            />
            {failed && <ErrorAlert title={HOUSEHOLD_TEXTS.createFailed}>{failed}</ErrorAlert>}
            <div class="button-row">
              <button class="btn btn--primary" type="submit">
                {busy ? ACCOUNT_TEXTS.busy : HOUSEHOLD_TEXTS.create}
              </button>
            </div>
          </form>
        </div>
        <section class="tile tile--narrow" aria-labelledby="einladung-offen">
          <h2 class="tile__title" id="einladung-offen">
            {HOUSEHOLD_TEXTS.haveInviteTitle}
          </h2>
          <p class="muted">{HOUSEHOLD_TEXTS.haveInviteIntro}</p>
          <form class="form" onSubmit={openInvite} noValidate>
            <TextField
              id={LINK_FIELD}
              label={HOUSEHOLD_TEXTS.inviteLinkField}
              value={link}
              error={linkError && linkErrorText(linkError)}
              onInput={(value) => {
                setLink(value);
                setLinkError(undefined);
              }}
            />
            <div class="button-row">
              <button class="btn btn--secondary" type="submit">
                {HOUSEHOLD_TEXTS.openInvite}
              </button>
            </div>
          </form>
        </section>
        {status}
        <LegalLinks />
      </div>
    </>
  );
}

interface HouseholdUnavailablePageProps {
  readonly message: string;
  readonly onRetry: () => void;
}

/** The household could not be read and none is remembered on this device (first start offline). */
export function HouseholdUnavailablePage({ message, onRetry }: HouseholdUnavailablePageProps) {
  return (
    <>
      <PageTitle title={HOUSEHOLD_TEXTS.unavailableTitle} />
      <div class="tile tile--narrow form">
        <ErrorAlert title={HOUSEHOLD_TEXTS.unavailableAlert}>{message}</ErrorAlert>
        <div class="button-row">
          <button class="btn btn--primary" type="button" onClick={onRetry}>
            {HOUSEHOLD_TEXTS.retry}
          </button>
        </div>
      </div>
    </>
  );
}
