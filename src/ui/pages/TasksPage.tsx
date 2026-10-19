import { useEffect, useState } from "preact/hooks";
import type { Completion, Task } from "../../domain/task";
import { completionCount, groupOpenTasks } from "../../domain/taskManagement";
import type { PersonNames } from "../../storage/appData";
import { DeleteTaskDialog } from "../components/DeleteTaskDialog";
import { PageTitle } from "../components/PageTitle";
import { describeRecurrence, describeResponsibility, formatDay } from "../format";
import { editTaskHash, newTaskHash, routeInfo } from "../route";

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
      setDeleteError(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <>
      <PageTitle title={routeInfo("tasks").title} />
      <div role="status">
        {announced && (
          <div class="kern-alert kern-alert--success">
            <div class="kern-alert__body">
              <p class="kern-body">{announced}</p>
            </div>
          </div>
        )}
      </div>
      {deleteError && (
        <div class="kern-alert kern-alert--danger" role="alert">
          <div class="kern-alert__header">
            <span class="kern-icon kern-icon--danger" aria-hidden="true" />
            <span class="kern-title">Nicht gelöscht</span>
          </div>
          <div class="kern-alert__body">
            <p class="kern-body">{deleteError}</p>
          </div>
        </div>
      )}
      <p>
        <a class="kern-btn kern-btn--primary" href={newTaskHash()}>
          <span class="kern-label">Neue Aufgabe</span>
        </a>
      </p>

      {groups.recurring.length === 0 && groups.oneOff.length === 0 && (
        <p class="kern-body">Es gibt noch keine Aufgaben. Legen Sie die erste an.</p>
      )}
      <TaskGroup
        id="wiederkehrend"
        title="Wiederkehrende Aufgaben"
        tasks={groups.recurring}
        names={names}
        onDelete={setDeleting}
      />
      <TaskGroup
        id="einmalig"
        title="Einmalige Aufgaben"
        tasks={groups.oneOff}
        names={names}
        onDelete={setDeleting}
      />

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
    <section class="stack task-group" aria-labelledby={id}>
      <h2 class="kern-title" id={id}>
        {title}
      </h2>
      <ul class="card-list">
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
  return (
    <article class="kern-card kern-card--hug" aria-labelledby={titleId}>
      <div class="kern-card__container">
        <div class="kern-card__header">
          <h3 class="kern-title" id={titleId}>
            {task.title}
          </h3>
        </div>
        <div class="kern-card__body">
          <dl class="kern-description-list">
            {task.kind === "recurring" && (
              <Detail label="Rhythmus" value={describeRecurrence(task.recurrence)} />
            )}
            <Detail
              label={task.kind === "recurring" ? "Nächster Termin" : "Fällig am"}
              value={formatDay(task.dueDate)}
            />
            <Detail
              label="Zuständig"
              value={describeResponsibility(
                task.assignee,
                task.kind === "recurring" ? task.takenOverBy : undefined,
                names,
              )}
            />
            {task.note && <Detail label="Notiz" value={task.note} />}
          </dl>
        </div>
        <div class="kern-card__footer">
          {/* The name starts with the visible text and adds the task, so a button read on its own
              ("Löschen: Bad putzen") still says what it is for. */}
          <a
            class="kern-btn kern-btn--secondary"
            href={editTaskHash(task.id)}
            aria-label={`Bearbeiten: ${task.title}`}
          >
            <span class="kern-label">Bearbeiten</span>
          </a>
          <button
            class="kern-btn kern-btn--secondary"
            type="button"
            aria-label={`Löschen: ${task.title}`}
            onClick={onDelete}
          >
            <span class="kern-label">Löschen</span>
          </button>
        </div>
      </div>
    </article>
  );
}

function Detail({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div class="kern-description-list-item">
      <dt class="kern-description-list-item__key">{label}</dt>
      <dd class="kern-description-list-item__value">{value}</dd>
    </div>
  );
}
