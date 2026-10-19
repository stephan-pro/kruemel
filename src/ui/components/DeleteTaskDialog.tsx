import { useRef } from "preact/hooks";
import type { Task } from "../../domain/task";
import { ConfirmDialog } from "./ConfirmDialog";

interface DeleteTaskDialogProps {
  /** The task to delete; the question is open while there is one. */
  readonly task: Task | undefined;
  /** How many entries in "Erledigt" disappear with the task. */
  readonly completionCount: number;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

function consequence(count: number): string {
  if (count === 0) {
    return "Sie hat noch keine Einträge in „Erledigt“.";
  }
  return count === 1
    ? "Auch ihr 1 Eintrag in „Erledigt“ verschwindet."
    : `Auch ihre ${count} Einträge in „Erledigt“ verschwinden.`;
}

/** Deleting takes the history of the task with it, so it is only done after this question. */
export function DeleteTaskDialog({
  task,
  completionCount,
  onConfirm,
  onCancel,
}: DeleteTaskDialogProps) {
  // The dialog closes a moment after `task` is gone; until then it keeps showing that task.
  const lastTask = useRef(task);
  if (task !== undefined) {
    lastTask.current = task;
  }
  return (
    <ConfirmDialog
      open={task !== undefined}
      title={`Aufgabe „${lastTask.current?.title ?? ""}“ löschen?`}
      confirmLabel="Ja, Aufgabe löschen"
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <p>
        Die Aufgabe wird gelöscht. {consequence(completionCount)} Das lässt sich nicht rückgängig
        machen.
      </p>
    </ConfirmDialog>
  );
}
