import { useRef, useState } from "preact/hooks";
import { dayFromDate } from "../../domain/date";
import type { Completion, Person, Task } from "../../domain/task";
import type { TaskFormValues, TaskKind } from "../../domain/taskForm";
import { completionCount } from "../../domain/taskManagement";
import type { PersonNames } from "../../storage/appData";
import { DeleteTaskDialog } from "../components/DeleteTaskDialog";
import { PageTitle } from "../components/PageTitle";
import { TaskForm } from "../components/TaskForm";
import { routeHash, routeInfo } from "../route";

interface TaskFormPageProps {
  /** The task to change; missing for a new one. */
  readonly task?: Task;
  /** The address asked for a task that does not exist (any more). */
  readonly missing?: boolean;
  readonly completions: readonly Completion[];
  readonly names: PersonNames;
  readonly currentPerson: Person;
  readonly onSave: (
    kind: TaskKind,
    values: TaskFormValues,
    existing: Task | undefined,
  ) => Promise<void>;
  readonly onDelete: (taskId: string) => Promise<void>;
}

/** The form for a new task or for changing one (F1, F3); changing also offers to delete. */
export function TaskFormPage({
  task,
  missing,
  completions,
  names,
  currentPerson,
  onSave,
  onDelete,
}: TaskFormPageProps) {
  const [asking, setAsking] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();
  // Deleting removes the task before the page is left; the form must not turn into "nicht
  // gefunden" for that moment, so the task shown last stays.
  const lastTask = useRef(task);
  if (task !== undefined) {
    lastTask.current = task;
  }
  const shown = task ?? lastTask.current;

  if (missing && shown === undefined) {
    return (
      <>
        <PageTitle title="Aufgabe nicht gefunden" />
        <p class="kern-body">
          Diese Aufgabe gibt es nicht (mehr). Vielleicht wurde sie gelöscht.{" "}
          <a class="kern-link" href={routeHash("tasks")}>
            Zurück zu den Aufgaben
          </a>
        </p>
      </>
    );
  }

  async function confirmDelete() {
    setAsking(false);
    if (shown === undefined) {
      return;
    }
    try {
      setDeleteError(undefined);
      await onDelete(shown.id);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <>
      <PageTitle title={routeInfo(shown === undefined ? "taskNew" : "taskEdit").title} />
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
      <TaskForm
        key={shown?.id ?? "neu"}
        {...(shown === undefined ? {} : { task: shown })}
        names={names}
        today={dayFromDate(new Date())}
        currentPerson={currentPerson}
        onSubmit={(kind, values) => onSave(kind, values, shown)}
        {...(shown === undefined ? {} : { onDelete: () => setAsking(true) })}
      />
      <DeleteTaskDialog
        task={asking ? shown : undefined}
        completionCount={shown ? completionCount(completions, shown.id) : 0}
        onConfirm={confirmDelete}
        onCancel={() => setAsking(false)}
      />
    </>
  );
}
