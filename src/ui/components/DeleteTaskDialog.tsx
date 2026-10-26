import { useRef } from "preact/hooks";
import type { Task } from "../../domain/task";
import { t } from "../../i18n";
import { ConfirmDialog } from "./ConfirmDialog";

interface DeleteTaskDialogProps {
  /** The task to delete; the question is open while there is one. */
  readonly task: Task | undefined;
  /** How many entries in "Erledigt" disappear with the task. */
  readonly completionCount: number;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
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
  const words = t().deleteTask;
  return (
    <ConfirmDialog
      open={task !== undefined}
      title={words.title(lastTask.current?.title ?? "")}
      confirmLabel={words.confirm}
      onConfirm={onConfirm}
      onCancel={onCancel}
    >
      <p>{words.text(words.consequence(completionCount))}</p>
    </ConfirmDialog>
  );
}
