import { useEffect, useState } from "preact/hooks";
import { AUTH_MESSAGES, type Auth, AuthError, emailAddress, type Session } from "../../auth/auth";
import { ACCOUNT_TEXTS, CODE_DIGITS, RESEND_AFTER_SECONDS } from "../accountTexts";
import { TextField, useFieldErrorFocus } from "../components/fields";
import { LanguageSwitch } from "../components/LanguageSwitch";
import { LegalLinks } from "../components/LegalLinks";
import { PageTitle } from "../components/PageTitle";
import { type CodeStep, rememberedStep, rememberStep } from "../signInStep";

interface SignInPageProps {
  readonly auth: Auth;
  /** Called with the new session once the code was right. */
  readonly onSignedIn: (session: Session) => void;
  /** Said above the form, e.g. that the account was deleted (E2-5a). */
  readonly notice?: string | undefined;
  /**
   * The invite of an opened link (E2-5b): its key goes with the code request, so a new address
   * gets an account; the page says what comes after signing in.
   */
  readonly invite?: { readonly key: string; readonly kind: "friend" | "household" } | undefined;
}

const EMAIL_FIELD = "anmelden-email";
const CODE_FIELD = "anmelden-code";

/** What a refused step says to the person; the service's own (English) text is never shown. */
function messageOf(error: unknown): string {
  return AUTH_MESSAGES[error instanceof AuthError ? error.failure : "unknown"];
}

/**
 * Signing in (stage 2): the e-mail address, then the code from the mail. Each step is a page of
 * its own (heading, tab title, focus). A refused step shows its message at the field and moves
 * the focus there; if the focus is there already, a hidden status line reads the message out.
 */
export function SignInPage({ auth, onSignedIn, notice: farewell, invite }: SignInPageProps) {
  const [step, setStep] = useState<CodeStep | undefined>(() => rememberedStep());
  const [email, setEmail] = useState(step?.email ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [canResend, setCanResend] = useState(false);
  /** Each refusal moves the focus to its field or is read out once. */
  const { report, status } = useFieldErrorFocus();

  // A new code may be asked for a minute after the last one; until then a hint says so.
  useEffect(() => {
    if (step === undefined) {
      return;
    }
    const wait = step.sentAt + RESEND_AFTER_SECONDS * 1000 - Date.now();
    setCanResend(wait <= 0);
    if (wait <= 0) {
      return;
    }
    const timer = setTimeout(() => setCanResend(true), wait);
    return () => clearTimeout(timer);
  }, [step]);

  function fail(message: string, fieldId: string) {
    setError(message);
    setNotice(undefined);
    report(fieldId, message);
  }

  /** Runs one step at a time; a second tap while it runs does nothing. */
  async function run(action: () => Promise<void>, fieldId: string) {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await action();
    } catch (refused) {
      fail(messageOf(refused), fieldId);
    } finally {
      setBusy(false);
    }
  }

  /** Asks for a code and goes on to (or stays on) the code step. */
  async function sendCode(address: string) {
    await auth.requestCode(address, invite?.key);
    const sent: CodeStep = { email: address, sentAt: Date.now() };
    rememberStep(sent);
    setStep(sent);
    setCode("");
    setError(undefined);
  }

  function submitEmail(event: Event) {
    event.preventDefault();
    void run(async () => {
      await sendCode(emailAddress(email));
      setNotice(undefined);
    }, EMAIL_FIELD);
  }

  function submitCode(event: Event) {
    event.preventDefault();
    if (step === undefined) {
      return;
    }
    const digits = code.replace(/\s/g, "");
    if (!new RegExp(`^\\d{${CODE_DIGITS}}$`).test(digits)) {
      fail(ACCOUNT_TEXTS.codeFormat, CODE_FIELD);
      return;
    }
    void run(async () => {
      const session = await auth.verifyCode(step.email, digits);
      rememberStep(undefined);
      onSignedIn(session);
    }, CODE_FIELD);
  }

  function resend() {
    if (step === undefined) {
      return;
    }
    void run(async () => {
      await sendCode(step.email);
      setNotice(ACCOUNT_TEXTS.codeResent);
      document.getElementById(CODE_FIELD)?.focus();
    }, CODE_FIELD);
  }

  function otherEmail() {
    rememberStep(undefined);
    setStep(undefined);
    setError(undefined);
    setNotice(undefined);
  }

  if (step === undefined) {
    return (
      <>
        <PageTitle title={ACCOUNT_TEXTS.signInTitle} />
        <div class="tile tile--narrow">
          {farewell && <p class="intro">{farewell}</p>}
          {invite && (
            <p class="intro">
              {invite.kind === "friend"
                ? ACCOUNT_TEXTS.invitedFriend
                : ACCOUNT_TEXTS.invitedHousehold}
            </p>
          )}
          <p class="intro">{ACCOUNT_TEXTS.signInIntro}</p>
          <form class="form" onSubmit={submitEmail} noValidate>
            <TextField
              id={EMAIL_FIELD}
              label={ACCOUNT_TEXTS.emailLabel}
              type="email"
              autocomplete="email"
              value={email}
              error={error}
              onInput={setEmail}
            />
            <div class="button-row">
              <button class="btn btn--primary" type="submit">
                {busy ? ACCOUNT_TEXTS.busy : ACCOUNT_TEXTS.sendCode}
              </button>
            </div>
            {status}
          </form>
        </div>
        <LanguageSwitch variant="compact" />
        <LegalLinks />
      </>
    );
  }

  return (
    <>
      <PageTitle title={ACCOUNT_TEXTS.codeTitle} />
      <div class="tile tile--narrow">
        <p class="intro">{ACCOUNT_TEXTS.codeIntro(step.email)}</p>
        <form class="form" onSubmit={submitCode} noValidate>
          <TextField
            id={CODE_FIELD}
            label={ACCOUNT_TEXTS.codeLabel}
            hint={ACCOUNT_TEXTS.codeHint}
            inputMode="numeric"
            autocomplete="one-time-code"
            narrow
            value={code}
            error={error}
            onInput={setCode}
          />
          <div class="button-row">
            <button class="btn btn--primary" type="submit">
              {busy ? ACCOUNT_TEXTS.busy : ACCOUNT_TEXTS.verifyCode}
            </button>
          </div>
          <p class="form-status" role="status">
            {notice ?? ""}
          </p>
          {status}
        </form>
        <p class="muted" role="status">
          {canResend ? ACCOUNT_TEXTS.resendReady : ACCOUNT_TEXTS.resendWait}
        </p>
        <div class="button-row">
          {canResend && (
            <button class="btn btn--secondary" type="button" onClick={resend}>
              {ACCOUNT_TEXTS.resendCode}
            </button>
          )}
          <button class="btn btn--quiet" type="button" onClick={otherEmail}>
            {ACCOUNT_TEXTS.otherEmail}
          </button>
        </div>
      </div>
      <LanguageSwitch variant="compact" />
      <LegalLinks />
    </>
  );
}
