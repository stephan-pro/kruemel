import { LogOut } from "lucide-preact";
import { useRef, useState } from "preact/hooks";
import { ACCOUNT_TEXTS } from "../accountTexts";
import { ErrorAlert } from "./Alert";
import { ConfirmDialog } from "./ConfirmDialog";

interface AccountTileProps {
  /** The address the person signed in with. */
  readonly email: string;
  /** Ends the session on this device; the app shows the sign-in page afterwards. */
  readonly onSignOut: () => Promise<void>;
}

/** "Anmeldung" in the settings (stage 2): who is signed in, and signing out after a question. */
export function AccountTile({ email, onSignOut }: AccountTileProps) {
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string>();
  const opener = useRef<HTMLButtonElement | null>(null);

  function cancel() {
    setAsking(false);
    opener.current?.focus();
  }

  async function signOut() {
    setAsking(false);
    try {
      await onSignOut();
    } catch (failed) {
      setError(failed instanceof Error ? failed.message : String(failed));
      opener.current?.focus();
    }
  }

  return (
    <section class="tile tile--narrow form" aria-labelledby="anmeldung">
      <h2 class="tile__title" id="anmeldung">
        {ACCOUNT_TEXTS.accountTile}
      </h2>
      <p class="account-email">{ACCOUNT_TEXTS.accountSignedIn(email)}</p>
      <div class="button-row">
        <button
          class="btn btn--secondary"
          type="button"
          onClick={(event) => {
            opener.current = event.currentTarget;
            setError(undefined);
            setAsking(true);
          }}
        >
          <LogOut size={20} />
          {ACCOUNT_TEXTS.signOut}
        </button>
      </div>
      {error && <ErrorAlert title={ACCOUNT_TEXTS.signOutFailed}>{error}</ErrorAlert>}
      <ConfirmDialog
        open={asking}
        title={ACCOUNT_TEXTS.signOutQuestion}
        confirmLabel={ACCOUNT_TEXTS.signOut}
        tone="primary"
        onConfirm={() => void signOut()}
        onCancel={cancel}
      >
        <p>{ACCOUNT_TEXTS.signOutExplained}</p>
      </ConfirmDialog>
    </section>
  );
}
