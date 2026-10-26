import { Download, LogOut, UserMinus } from "lucide-preact";
import { useRef, useState } from "preact/hooks";
import { ACCOUNT_TEXTS } from "../accountTexts";
import { type Failure, failureOf } from "../errorText";
import { LEAVE_TEXTS } from "../householdTexts";
import { householdMessage } from "../pages/HouseholdPage";
import { ErrorAlert } from "./Alert";
import { ConfirmDialog } from "./ConfirmDialog";

/**
 * "Sicherung herunterladen" inside a question before going (E2-5a), with "Sicherung
 * heruntergeladen." for eyes and screen readers.
 */
export function BackupOffer({ onBackup }: { readonly onBackup: () => void }) {
  const [done, setDone] = useState(false);
  return (
    <>
      <p>{LEAVE_TEXTS.backupOffer}</p>
      <div class="button-row">
        <button
          class="btn btn--secondary"
          type="button"
          onClick={() => {
            onBackup();
            setDone(true);
          }}
        >
          <Download size={20} />
          {LEAVE_TEXTS.backup}
        </button>
      </div>
      <p class="form-status" role="status">
        {done ? LEAVE_TEXTS.backupDone : ""}
      </p>
    </>
  );
}

interface RemoveMemberProps {
  /** The name of the person to remove. */
  readonly name: string;
  /** Removes them; only online. Throws `HouseholdError`. */
  readonly onRemove: () => Promise<void>;
}

/** "<Name> entfernen …" in the list of members, with the question (E2-5a). */
export function RemoveMember({ name, onRemove }: RemoveMemberProps) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<Failure>();
  const opener = useRef<HTMLButtonElement | null>(null);

  async function remove() {
    setAsking(false);
    setBusy(true);
    try {
      await onRemove();
    } catch (error) {
      setFailed(failureOf(error));
      opener.current?.focus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        class="btn btn--quiet"
        type="button"
        aria-disabled={busy}
        onClick={(event) => {
          if (busy) {
            return;
          }
          opener.current = event.currentTarget;
          setFailed(undefined);
          setAsking(true);
        }}
      >
        <UserMinus size={20} />
        {LEAVE_TEXTS.remove(name)}
      </button>
      {failed && (
        <ErrorAlert title={LEAVE_TEXTS.removeFailed}>{householdMessage(failed.cause)}</ErrorAlert>
      )}
      <ConfirmDialog
        open={asking}
        title={LEAVE_TEXTS.removeQuestion(name)}
        confirmLabel={LEAVE_TEXTS.removeConfirm}
        onConfirm={() => void remove()}
        onCancel={() => {
          setAsking(false);
          opener.current?.focus();
        }}
      >
        <p>{LEAVE_TEXTS.removeDialog(name)}</p>
        <p>{LEAVE_TEXTS.needsInternet}</p>
      </ConfirmDialog>
    </>
  );
}

interface LeaveHouseholdProps {
  /** The other person's name, or `undefined` when nobody else belongs to the household. */
  readonly other: string | undefined;
  /** Sends what waits and says how many changes still wait (before the question). */
  readonly onPrepare: () => Promise<number>;
  /** Leaves; only online. Throws `HouseholdError`. The app then shows "Haushalt anlegen". */
  readonly onLeave: () => Promise<void>;
  /** Downloads a backup of all data. */
  readonly onBackup: () => void;
}

/** "Haushalt verlassen …" with the question (E2-5a); the last one out deletes the household. */
export function LeaveHousehold({ other, onPrepare, onLeave, onBackup }: LeaveHouseholdProps) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState<Failure>();
  const opener = useRef<HTMLButtonElement | null>(null);
  const last = other === undefined;

  async function ask(button: HTMLButtonElement) {
    if (busy) {
      return;
    }
    opener.current = button;
    setFailed(undefined);
    setBusy(true);
    setPending(await onPrepare().catch(() => 0));
    setBusy(false);
    setAsking(true);
  }

  async function leave() {
    setAsking(false);
    setBusy(true);
    try {
      await onLeave();
    } catch (error) {
      setBusy(false);
      setFailed(failureOf(error));
      opener.current?.focus();
    }
  }

  return (
    <>
      <div class="button-row">
        <button
          class="btn btn--secondary"
          type="button"
          aria-disabled={busy}
          onClick={(event) => void ask(event.currentTarget)}
        >
          <LogOut size={20} />
          {LEAVE_TEXTS.leave}
        </button>
      </div>
      <p class="form-status" role="status">
        {busy ? ACCOUNT_TEXTS.busy : ""}
      </p>
      {failed && (
        <ErrorAlert title={LEAVE_TEXTS.leaveFailed}>{householdMessage(failed.cause)}</ErrorAlert>
      )}
      <ConfirmDialog
        open={asking}
        title={LEAVE_TEXTS.leaveQuestion}
        confirmLabel={last ? LEAVE_TEXTS.leaveLastConfirm : LEAVE_TEXTS.leaveConfirm}
        onConfirm={() => void leave()}
        onCancel={() => {
          setAsking(false);
          opener.current?.focus();
        }}
      >
        <p>{last ? LEAVE_TEXTS.leaveLastDialog : LEAVE_TEXTS.leaveDialog(other)}</p>
        {pending > 0 && <p>{LEAVE_TEXTS.pending(pending)}</p>}
        <p>{LEAVE_TEXTS.needsInternet}</p>
        {!last && <BackupOffer onBackup={onBackup} />}
      </ConfirmDialog>
    </>
  );
}
