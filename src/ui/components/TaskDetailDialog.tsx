import { Pencil } from "lucide-preact";
import { useRef, useState } from "preact/hooks";
import { effectiveAssignee } from "../../domain/assignment";
import { type CalendarDay, daysBetween } from "../../domain/date";
import type { Completion, Person, Task } from "../../domain/task";
import { t } from "../../i18n";
import type { PersonNames } from "../../storage/appData";
import { errorText } from "../errorText";
import {
  describeChecklist,
  describeCompletedBy,
  describeOverdue,
  describeRecurrence,
  describeResponsibility,
  formatDay,
} from "../format";
import { editTaskHash } from "../route";
import { ErrorAlert } from "./Alert";
import { ChecklistToggles } from "./ChecklistToggles";
import { Modal } from "./Modal";
import { TaskSymbol } from "./TaskSymbol";

interface TaskDetailDialogProps {
  /** The task to show; the dialog is open while there is one. */
  readonly task: Task | undefined;
  /** Set for a task shown as done (a past week): then there is nothing to tick or take over. */
  readonly completion: Completion | undefined;
  readonly names: PersonNames;
  /** Who uses this device ("Ich bin"): decides whether "Übernehmen" is offered. */
  readonly person: Person;
  readonly today: CalendarDay;
  readonly onClose: () => void;
  /** Ticks or unticks an item; rejects with an `Error` whose message is shown in the dialog. */
  readonly onToggleItem: (task: Task, itemId: string, checked: boolean) => Promise<void>;
  /** Starts "Übernehmen"; rejects like `onToggleItem`. */
  readonly onTakeOver: (task: Task) => Promise<void>;
}

function Detail({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div class="details__item">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/**
 * The details of a task (F6): everything about it, with the checklist to tick, "Bearbeiten" and
 * "Übernehmen". It opens when a task of the week is chosen; Escape closes it.
 */
export function TaskDetailDialog({
  task,
  completion,
  names,
  person,
  today,
  onClose,
  onToggleItem,
  onTakeOver,
}: TaskDetailDialogProps) {
  const [error, setError] = useState<string>();
  // The dialog closes a moment after `task` is gone; until then it keeps showing that task.
  const last = useRef({ task, completion });
  if (task !== undefined) {
    last.current = { task, completion };
  }
  const shown = last.current.task;
  const shownCompletion = last.current.completion;

  async function attempt(action: () => Promise<void>) {
    setError(undefined);
    try {
      await action();
    } catch (failure) {
      setError(errorText(failure));
    }
  }

  function close() {
    setError(undefined);
    onClose();
  }

  const open = shown !== undefined && shownCompletion === undefined;
  const recurring = shown?.kind === "recurring";
  const overdueDays = shown === undefined || !open ? 0 : daysBetween(shown.dueDate, today);
  const canTakeOver = open && shown !== undefined && effectiveAssignee(shown) !== person;
  const words = t().tasks;

  return (
    <Modal
      open={task !== undefined}
      title={shown?.title ?? ""}
      titlePrefix={shown && <TaskSymbol symbol={shown.symbol} />}
      onCancel={close}
      focusTitle
    >
      {shown && (
        <>
          <dl class="details details--dialog">
            <Detail
              label={words.assignee}
              value={describeResponsibility(
                shown.assignee,
                shown.kind === "recurring" ? shown.takenOverBy : undefined,
                names,
              )}
            />
            {shown.kind === "recurring" ? (
              <Detail label={words.rhythm} value={describeRecurrence(shown.recurrence)} />
            ) : (
              <Detail label={words.kind} value={words.oneOffTask} />
            )}
            <Detail
              label={recurring ? words.nextDate : words.dueOn}
              value={
                overdueDays > 0
                  ? `${formatDay(shown.dueDate)} (${describeOverdue(overdueDays)})`
                  : formatDay(shown.dueDate)
              }
            />
            {shownCompletion && (
              <Detail label={t().detail.done} value={describeCompletedBy(shownCompletion, names)} />
            )}
            {shown.note && <Detail label={words.note} value={shown.note} />}
          </dl>

          {open && shown.checklist.length > 0 && (
            <section class="dialog__section" aria-labelledby="detail-checkliste">
              <h3 class="dialog__subtitle" id="detail-checkliste">
                {t().checklist.title}
                <span class="dialog__subtitle-aside">{describeChecklist(shown.checklist)}</span>
              </h3>
              <ChecklistToggles
                task={shown}
                variant="list"
                onToggle={(itemId, checked) =>
                  void attempt(() => onToggleItem(shown, itemId, checked))
                }
              />
            </section>
          )}

          {error && <ErrorAlert title={t().common.notSaved}>{error}</ErrorAlert>}

          <div class="button-row">
            <a class="btn btn--secondary" href={editTaskHash(shown.id)}>
              <Pencil size={18} />
              {t().common.edit}
            </a>
            {canTakeOver && (
              <button
                class="btn btn--secondary"
                type="button"
                onClick={() => void attempt(() => onTakeOver(shown))}
              >
                {t().common.takeOver}
              </button>
            )}
            <button class="btn btn--primary" type="button" onClick={close}>
              {t().common.close}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
