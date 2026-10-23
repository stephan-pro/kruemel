import { useEffect, useState } from "preact/hooks";
import { DELETE_ACCOUNT_TEXTS, DELETE_WORD } from "../accountTexts";
import { LEAVE_TEXTS } from "../householdTexts";
import { TextField } from "./fields";
import { BackupOffer } from "./HouseholdLeave";
import { Modal } from "./Modal";

const WORD_FIELD = "konto-loeschen-wort";

interface DeleteAccountDialogProps {
  readonly open: boolean;
  /** The other person's name, or `undefined` when the household goes with the account. */
  readonly other: string | undefined;
  /** Changes still waiting for the server when the question opened. */
  readonly pending: number;
  readonly onBackup: () => void;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/**
 * "Konto endgültig löschen?" (E2-5a): what goes, what stays, that it cannot be undone and that
 * there is no way back in by oneself. The account is only deleted once "löschen" is typed (upper or
 * lower case does not matter); a wrong word gets a message at the field. The focus starts on the
 * title, so the explanation is read before the field.
 */
export function DeleteAccountDialog({
  open,
  other,
  pending,
  onBackup,
  onConfirm,
  onCancel,
}: DeleteAccountDialogProps) {
  const [word, setWord] = useState("");
  const [error, setError] = useState<string>();

  // Every question starts with an empty field.
  useEffect(() => {
    if (open) {
      setWord("");
      setError(undefined);
    }
  }, [open]);

  function submit(event: Event) {
    event.preventDefault();
    if (word.trim().toLocaleLowerCase("de-DE") !== DELETE_WORD) {
      setError(DELETE_ACCOUNT_TEXTS.wordMissing);
      document.getElementById(WORD_FIELD)?.focus();
      return;
    }
    onConfirm();
  }

  return (
    <Modal open={open} title={DELETE_ACCOUNT_TEXTS.question} onCancel={onCancel} focusTitle>
      <form class="form" onSubmit={submit} noValidate>
        <div class="dialog__body">
          <p>{DELETE_ACCOUNT_TEXTS.goes}</p>
          <p>
            {other === undefined
              ? DELETE_ACCOUNT_TEXTS.staysNothing
              : DELETE_ACCOUNT_TEXTS.stays(other)}
          </p>
          {pending > 0 && <p>{LEAVE_TEXTS.pending(pending)}</p>}
          <p>
            <strong>{DELETE_ACCOUNT_TEXTS.noUndo}</strong> {DELETE_ACCOUNT_TEXTS.wayBack}
          </p>
          {other !== undefined && <BackupOffer onBackup={onBackup} />}
          <TextField
            id={WORD_FIELD}
            label={DELETE_ACCOUNT_TEXTS.wordLabel}
            value={word}
            error={error}
            onInput={(value) => {
              setWord(value);
              setError(undefined);
            }}
          />
        </div>
        <div class="button-row">
          <button class="btn btn--secondary" type="button" onClick={onCancel}>
            Abbrechen
          </button>
          <button class="btn btn--warn" type="submit">
            {DELETE_ACCOUNT_TEXTS.confirm}
          </button>
        </div>
      </form>
    </Modal>
  );
}
