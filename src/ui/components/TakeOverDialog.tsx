import { useRef, useState } from "preact/hooks";
import { DEFAULT_TAKE_OVER_MODE, type TakeOverMode } from "../../domain/assignment";
import type { Person, Task } from "../../domain/task";
import type { PersonNames } from "../../storage/appData";
import { ErrorAlert } from "./Alert";
import { ConfirmDialog } from "./ConfirmDialog";
import { RadioGroup } from "./fields";

interface TakeOverDialogProps {
  /** The recurring task to take over; the question is open while there is one. */
  readonly task: Task | undefined;
  readonly names: PersonNames;
  /** Who takes over ("Ich bin"). */
  readonly person: Person;
  /** Saves; rejects with an `Error` whose message is shown in the dialog. */
  readonly onConfirm: (mode: TakeOverMode) => Promise<void>;
  readonly onCancel: () => void;
}

/**
 * "Übernehmen" of a recurring task (F5): only this time or for good. "Nur dieses Mal" is chosen
 * first; the next cycle then has the fixed assignee again.
 */
export function TakeOverDialog({ task, names, person, onConfirm, onCancel }: TakeOverDialogProps) {
  const [mode, setMode] = useState<TakeOverMode>(DEFAULT_TAKE_OVER_MODE);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  // The dialog closes a moment after `task` is gone; until then it keeps showing that task.
  const lastTask = useRef(task);
  if (task !== undefined) {
    lastTask.current = task;
  }
  const shown = lastTask.current;
  const afterOnce = shown === undefined ? "" : describeAfterOnce(shown, names);

  async function confirm() {
    if (busy) {
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      await onConfirm(mode);
      setMode(DEFAULT_TAKE_OVER_MODE);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setMode(DEFAULT_TAKE_OVER_MODE);
    setError(undefined);
    onCancel();
  }

  return (
    <ConfirmDialog
      open={task !== undefined}
      tone="primary"
      initialFocusId={`take-over-mode-${mode}`}
      title={`Aufgabe „${shown?.title ?? ""}“ übernehmen?`}
      confirmLabel="Übernehmen"
      onConfirm={confirm}
      onCancel={cancel}
    >
      <RadioGroup
        name="take-over-mode"
        legend="Wie lange?"
        choices={[
          { value: "once", label: `Nur dieses Mal (${afterOnce})` },
          { value: "permanently", label: `Dauerhaft (ab jetzt ist ${names[person]} zuständig)` },
        ]}
        value={mode}
        onChange={setMode}
      />
      {error && <ErrorAlert title="Nicht gespeichert">{error}</ErrorAlert>}
    </ConfirmDialog>
  );
}

/** Who is responsible again in the next cycle: "danach ist wieder Alex zuständig". */
function describeAfterOnce(task: Task, names: PersonNames): string {
  return task.assignee === "both"
    ? "danach sind wieder beide zuständig"
    : `danach ist wieder ${names[task.assignee]} zuständig`;
}
