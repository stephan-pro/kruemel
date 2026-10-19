import { Trash2 } from "lucide-preact";
import { useState } from "preact/hooks";
import type { CalendarDay } from "../../domain/date";
import type { Person, Task } from "../../domain/task";
import {
  checkTaskForm,
  firstTaskFormError,
  MAX_DUE_DATE,
  MIN_DUE_DATE,
  type TaskFormErrors,
  type TaskFormField,
  type TaskFormInput,
  type TaskFormValues,
  type TaskKind,
} from "../../domain/taskForm";
import type { PersonNames } from "../../storage/appData";
import { routeHash } from "../route";
import { ErrorAlert } from "./Alert";
import {
  type Choice,
  FieldGroup,
  RadioGroup,
  SelectField,
  TextAreaField,
  TextField,
} from "./fields";

interface TaskFormProps {
  /** The task being changed; missing when a new one is created. */
  readonly task?: Task;
  readonly names: PersonNames;
  /** The first due date of a new task is today. */
  readonly today: CalendarDay;
  /** Who uses this device; preselected as the responsible person of a new task. */
  readonly currentPerson: Person;
  /** Saves; rejects with an `Error` whose message is shown to the user. */
  readonly onSubmit: (kind: TaskKind, values: TaskFormValues) => Promise<void>;
  /** Asks whether to delete the task (only when changing one). */
  readonly onDelete?: () => void;
}

const KINDS: readonly Choice<TaskKind>[] = [
  { value: "recurring", label: "Wiederkehrend (z. B. Bad putzen)" },
  { value: "oneOff", label: "Einmalig (z. B. Paket abholen)" },
];

const UNITS: readonly Choice<string>[] = [
  { value: "day", label: "Tage" },
  { value: "week", label: "Wochen" },
  { value: "month", label: "Monate" },
];

/** The element that takes the focus for the field. Radio groups take their first radio. */
const FOCUS_TARGET: Record<TaskFormField, string> = {
  title: "task-title",
  interval: "task-interval",
  unit: "task-unit",
  dueDate: "task-dueDate",
  assignee: "task-assignee-personA",
  note: "task-note",
};

function initialInput(task: Task | undefined, today: CalendarDay, person: Person): TaskFormInput {
  if (task === undefined) {
    return { title: "", dueDate: today, assignee: person, note: "", interval: "1", unit: "week" };
  }
  return {
    title: task.title,
    dueDate: task.dueDate,
    assignee: task.assignee,
    note: task.note ?? "",
    interval: task.kind === "recurring" ? String(task.recurrence.interval) : "1",
    unit: task.kind === "recurring" ? task.recurrence.unit : "week",
  };
}

function withoutError(errors: TaskFormErrors, field: TaskFormField): TaskFormErrors {
  const { [field]: _removed, ...rest } = errors;
  return rest;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Creates or changes a task (F1, F3). Every field has a visible label; a message about a field
 * stands at that field. A submit with errors puts the focus on the first field with an error.
 */
export function TaskForm({ task, names, today, currentPerson, onSubmit, onDelete }: TaskFormProps) {
  const [kind, setKind] = useState<TaskKind>(task?.kind ?? "recurring");
  const [input, setInput] = useState(() => initialInput(task, today, currentPerson));
  const [errors, setErrors] = useState<TaskFormErrors>({});
  const [saveError, setSaveError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const creating = task === undefined;
  const recurring = kind === "recurring";

  /** Changes a field; a message about it is out of date from now on. */
  function change(field: keyof TaskFormInput, value: string) {
    setInput({ ...input, [field]: value });
    setErrors(withoutError(errors, field));
  }

  function chooseKind(chosen: TaskKind) {
    setKind(chosen);
    // The rhythm fields disappear for a one-off task, and so do their messages.
    if (chosen === "oneOff") {
      setErrors(withoutError(withoutError(errors, "interval"), "unit"));
    }
  }

  async function submit(event: Event) {
    event.preventDefault();
    if (saving) {
      return;
    }
    setSaveError(undefined);
    const checked = checkTaskForm(kind, input);
    if (!checked.ok) {
      setErrors(checked.errors);
      const first = firstTaskFormError(checked.errors);
      if (first !== undefined) {
        document.getElementById(FOCUS_TARGET[first])?.focus();
      }
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await onSubmit(kind, checked.values);
    } catch (error) {
      setSaveError(messageOf(error));
    } finally {
      setSaving(false);
    }
  }

  const dateLabel = recurring ? (creating ? "Erster Termin" : "Nächster Termin") : "Fällig am";
  const people: readonly Choice<string>[] = [
    { value: "personA", label: names.personA },
    { value: "personB", label: names.personB },
    { value: "both", label: "Beide" },
  ];

  return (
    <form class="form" onSubmit={submit} noValidate>
      {creating ? (
        <RadioGroup
          name="task-kind"
          legend="Art der Aufgabe"
          choices={KINDS}
          value={kind}
          onChange={chooseKind}
        />
      ) : (
        <p>
          Art der Aufgabe: <strong>{recurring ? "Wiederkehrend" : "Einmalig"}</strong> (lässt sich
          nicht ändern)
        </p>
      )}

      <TextField
        id="task-title"
        label="Titel"
        value={input.title}
        error={errors.title}
        onInput={(title) => change("title", title)}
      />

      {recurring && (
        <FieldGroup legend="Rhythmus">
          <TextField
            id="task-interval"
            label="Abstand (Anzahl)"
            hint="Beispiel: 2 und „Wochen“ ergeben „alle 2 Wochen“."
            value={input.interval}
            inputMode="numeric"
            narrow
            error={errors.interval}
            onInput={(interval) => change("interval", interval)}
          />
          <SelectField
            id="task-unit"
            label="Einheit"
            value={input.unit}
            choices={UNITS}
            error={errors.unit}
            onChange={(unit) => change("unit", unit)}
          />
        </FieldGroup>
      )}

      <TextField
        id="task-dueDate"
        label={dateLabel}
        hint={
          recurring
            ? "Danach zählt der Rhythmus ab dem Tag, an dem die Aufgabe abgehakt wird."
            : undefined
        }
        type="date"
        min={MIN_DUE_DATE}
        max={MAX_DUE_DATE}
        value={input.dueDate}
        error={errors.dueDate}
        onInput={(dueDate) => change("dueDate", dueDate)}
      />

      <RadioGroup
        name="task-assignee"
        legend="Zuständig"
        choices={people}
        value={input.assignee === "" ? undefined : input.assignee}
        error={errors.assignee}
        onChange={(assignee) => change("assignee", assignee)}
      />

      <TextAreaField
        id="task-note"
        label="Notiz (optional)"
        value={input.note}
        error={errors.note}
        onInput={(note) => change("note", note)}
      />

      {saveError && <ErrorAlert title="Nicht gespeichert">{saveError}</ErrorAlert>}

      <div class="button-row">
        <button class="btn btn--primary" type="submit">
          {creating ? "Aufgabe anlegen" : "Speichern"}
        </button>
        <a class="btn btn--secondary" href={routeHash("tasks")}>
          Abbrechen
        </a>
        {onDelete && (
          <button class="btn btn--text-warn" type="button" onClick={onDelete}>
            <Trash2 size={20} />
            Aufgabe löschen …
          </button>
        )}
      </div>
    </form>
  );
}
