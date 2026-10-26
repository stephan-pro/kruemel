import { Pencil, Trash2 } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import type { Completion, Task } from "../../domain/task";
import { completionCount, groupOpenTasks } from "../../domain/taskManagement";
import { t } from "../../i18n";
import type { PersonNames } from "../../storage/appData";
import { ErrorAlert } from "../components/Alert";
import { DeleteTaskDialog } from "../components/DeleteTaskDialog";
import { PageTitle } from "../components/PageTitle";
import { TaskSymbol } from "../components/TaskSymbol";
import { errorText } from "../errorText";
import { describeRecurrence, describeResponsibility, formatDay } from "../format";
import { editTaskHash, routeInfo } from "../route";

interface TasksPageProps {
  readonly tasks: readonly Task[];
  readonly completions: readonly Completion[];
  readonly names: PersonNames;
  /** What just happened ("Aufgabe … angelegt."); shown and announced when the page opens. */
  readonly notice: string | undefined;
  /** Deletes the task and its completions; rejects with an `Error` whose message is shown. */
  readonly onDelete: (taskId: string) => Promise<void>;
  /** The page is left; the notice has been seen. */
  readonly onLeave: () => void;
}

/** "Aufgaben": all open tasks with the buttons to change and delete them (F1, F3). */
export function TasksPage({
  tasks,
  completions,
  names,
  notice,
  onDelete,
  onLeave,
}: TasksPageProps) {
  const [deleting, setDeleting] = useState<Task>();
  const [deleteError, setDeleteError] = useState<string>();
  // The live region is there from the start and gets its text afterwards: text that is already in
  // a region when the page appears is not reliably announced.
  const [announced, setAnnounced] = useState<string>();
  const [focusHeading, setFocusHeading] = useState(0);
  const groups = groupOpenTasks(tasks);

  useEffect(() => setAnnounced(notice), [notice]);
  useEffect(() => onLeave, []);
  // After a delete the button that had the focus is gone: the focus goes to the heading.
  useEffect(() => {
    if (focusHeading > 0) {
      document.querySelector<HTMLElement>("main h1")?.focus();
    }
  }, [focusHeading]);

  async function confirmDelete() {
    const task = deleting;
    setDeleting(undefined);
    if (task === undefined) {
      return;
    }
    try {
      setDeleteError(undefined);
      await onDelete(task.id);
      setFocusHeading((count) => count + 1);
    } catch (error) {
      setDeleteError(errorText(error));
    }
  }

  return (
    <>
      <div class="page-head">
        <PageTitle title={routeInfo("tasks").title} />
      </div>
      <div class="page-stack">
        <div role="status">{announced && <p class="success-note">{announced}</p>}</div>
        {deleteError && <ErrorAlert title={t().common.notDeleted}>{deleteError}</ErrorAlert>}

        {groups.recurring.length === 0 && groups.oneOff.length === 0 && (
          <div class="tile">
            <p>{t().tasks.noTasks}</p>
          </div>
        )}
        <TaskGroup
          id="wiederkehrend"
          title={t().tasks.recurringGroup}
          tasks={groups.recurring}
          names={names}
          onDelete={setDeleting}
        />
        <TaskGroup
          id="einmalig"
          title={t().tasks.oneOffGroup}
          tasks={groups.oneOff}
          names={names}
          onDelete={setDeleting}
        />
      </div>

      <DeleteTaskDialog
        task={deleting}
        completionCount={deleting ? completionCount(completions, deleting.id) : 0}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(undefined)}
      />
    </>
  );
}

interface TaskGroupProps {
  readonly id: string;
  readonly title: string;
  readonly tasks: readonly Task[];
  readonly names: PersonNames;
  readonly onDelete: (task: Task) => void;
}

function TaskGroup({ id, title, tasks, names, onDelete }: TaskGroupProps) {
  if (tasks.length === 0) {
    return null;
  }
  return (
    <section class="task-group" aria-labelledby={id}>
      <h2 class="section-title" id={id}>
        {title}
      </h2>
      <ul class="task-cards">
        {tasks.map((task) => (
          <li key={task.id}>
            <TaskCard task={task} names={names} onDelete={() => onDelete(task)} />
          </li>
        ))}
      </ul>
    </section>
  );
}

interface TaskCardProps {
  readonly task: Task;
  readonly names: PersonNames;
  readonly onDelete: () => void;
}

function TaskCard({ task, names, onDelete }: TaskCardProps) {
  const titleId = `aufgabe-${task.id}`;
  const words = t().tasks;
  return (
    <article class="tile task-card" aria-labelledby={titleId}>
      <div class="task-card__head">
        <TaskSymbol symbol={task.symbol} />
        <h3 class="task-card__title" id={titleId}>
          {task.title}
        </h3>
      </div>
      <dl class="details">
        {task.kind === "recurring" && (
          <Detail label={words.rhythm} value={describeRecurrence(task.recurrence)} />
        )}
        <Detail
          label={task.kind === "recurring" ? words.nextDate : words.dueOn}
          value={formatDay(task.dueDate)}
        />
        <Detail
          label={words.assignee}
          value={describeResponsibility(
            task.assignee,
            task.kind === "recurring" ? task.takenOverBy : undefined,
            names,
          )}
        />
        {task.note && <Detail label={words.note} value={task.note} />}
      </dl>
      <div class="button-row task-card__actions">
        {/* The name starts with the visible text and adds the task, so a button read on its own
            ("Löschen: Bad putzen") still says what it is for. */}
        <a
          class="btn btn--secondary btn--small"
          href={editTaskHash(task.id)}
          aria-label={t().common.editTask(task.title)}
        >
          <Pencil size={18} />
          {t().common.edit}
        </a>
        <button
          class="btn btn--secondary btn--small"
          type="button"
          aria-label={t().common.deleteTask(task.title)}
          onClick={onDelete}
        >
          <Trash2 size={18} />
          {t().common.delete}
        </button>
      </div>
    </article>
  );
}

function Detail({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div class="details__item">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
