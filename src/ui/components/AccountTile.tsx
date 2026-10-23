import { LogOut, UserX } from "lucide-preact";
import { useRef, useState } from "preact/hooks";
import { ACCOUNT_TEXTS, DELETE_ACCOUNT_TEXTS } from "../accountTexts";
import { errorText } from "../errorText";
import { SHARED_TEXTS } from "../householdTexts";
import { householdMessage } from "../pages/HouseholdPage";
import { ErrorAlert } from "./Alert";
import { ConfirmDialog } from "./ConfirmDialog";
import { DeleteAccountDialog } from "./DeleteAccountDialog";

interface AccountTileProps {
  /** The address the person signed in with. */
  readonly email: string;
  /** The data shown are the household's shared data; signing out deletes them from the device. */
  readonly shared?: boolean;
  /**
   * Ends the session on this device; the app shows the sign-in page afterwards. With shared data
   * and changes still waiting it downloads a backup file first.
   */
  readonly onSignOut: () => Promise<void>;
  /** With shared data: sends what waits and says how many changes still wait (asked first). */
  readonly onCheckPending?: () => Promise<number>;
  /** "Konto löschen" (E2-5a, with a household); missing without one. */
  readonly deleteAccount?: {
    /** The other person's name, or `undefined` when the household goes with the account. */
    readonly other: string | undefined;
    /** Deletes the account; only online. Throws `HouseholdError`. */
    readonly onDelete: () => Promise<void>;
    readonly onBackup: () => void;
  };
}

/**
 * "Anmeldung" in the settings (stage 2): who is signed in, signing out after a question and
 * deleting the account after typing a word (E2-5a).
 */
export function AccountTile({
  email,
  shared = false,
  onSignOut,
  onCheckPending,
  deleteAccount,
}: AccountTileProps) {
  const [asking, setAsking] = useState(false);
  /** Which question is open: signing out, or deleting the account. */
  const [question, setQuestion] = useState<"signOut" | "delete">("signOut");
  const [deleteError, setDeleteError] = useState<string>();
  const [checking, setChecking] = useState(false);
  /** Changes still waiting for the server when the question opened. */
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string>();
  const opener = useRef<HTMLButtonElement | null>(null);

  function cancel() {
    setAsking(false);
    opener.current?.focus();
  }

  async function ask(button: HTMLButtonElement, which: "signOut" | "delete" = "signOut") {
    if (checking) {
      return;
    }
    opener.current = button;
    setQuestion(which);
    setError(undefined);
    setDeleteError(undefined);
    if (onCheckPending !== undefined) {
      setChecking(true);
      setPending(await onCheckPending().catch(() => 0));
      setChecking(false);
    }
    setAsking(true);
  }

  async function signOut() {
    setAsking(false);
    try {
      await onSignOut();
    } catch (failed) {
      setError(errorText(failed));
      opener.current?.focus();
    }
  }

  async function remove() {
    setAsking(false);
    setChecking(true);
    try {
      await deleteAccount?.onDelete();
    } catch (failed) {
      setChecking(false);
      setDeleteError(householdMessage(failed));
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
          aria-disabled={checking}
          onClick={(event) => void ask(event.currentTarget)}
        >
          <LogOut size={20} />
          {ACCOUNT_TEXTS.signOut}
        </button>
      </div>
      <p class="form-status" role="status">
        {checking ? ACCOUNT_TEXTS.busy : ""}
      </p>
      {error && <ErrorAlert title={ACCOUNT_TEXTS.signOutFailed}>{error}</ErrorAlert>}
      {deleteAccount && (
        <>
          <p class="muted">{DELETE_ACCOUNT_TEXTS.intro}</p>
          <div class="button-row">
            <button
              class="btn btn--quiet"
              type="button"
              aria-disabled={checking}
              onClick={(event) => void ask(event.currentTarget, "delete")}
            >
              <UserX size={20} />
              {DELETE_ACCOUNT_TEXTS.open}
            </button>
          </div>
          {deleteError && (
            <ErrorAlert title={DELETE_ACCOUNT_TEXTS.failed}>{deleteError}</ErrorAlert>
          )}
          <DeleteAccountDialog
            open={asking && question === "delete"}
            other={deleteAccount.other}
            pending={pending}
            onBackup={deleteAccount.onBackup}
            onConfirm={() => void remove()}
            onCancel={cancel}
          />
        </>
      )}
      <ConfirmDialog
        open={asking && question === "signOut"}
        title={ACCOUNT_TEXTS.signOutQuestion}
        confirmLabel={pending > 0 ? SHARED_TEXTS.signOutWithBackup : ACCOUNT_TEXTS.signOut}
        tone={pending > 0 ? "warn" : "primary"}
        onConfirm={() => void signOut()}
        onCancel={cancel}
      >
        {pending > 0 && <p>{SHARED_TEXTS.signOutPending(pending)}</p>}
        <p>{shared ? SHARED_TEXTS.signOutExplained : ACCOUNT_TEXTS.signOutExplained}</p>
      </ConfirmDialog>
    </section>
  );
}
