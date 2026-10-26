import { Trash2 } from "lucide-preact";
import { useState } from "preact/hooks";
import type { ChecklistItem } from "../../domain/checklist";
import type { CalendarDay } from "../../domain/date";
import type { Person, Task } from "../../domain/task";
import {
  checklistItemError,
  checkTaskForm,
  firstTaskFormError,
  MAX_DUE_DATE,
  MIN_DUE_DATE,
  type TaskFormError,
  type TaskFormErrors,
  type TaskFormField,
  type TaskFormInput,
  type TaskFormValues,
  type TaskKind,
} from "../../domain/taskForm";
import { DEFAULT_TASK_SYMBOL } from "../../domain/taskSymbols";
import { t } from "../../i18n";
import type { PersonNames } from "../../storage/appData";
import { errorText } from "../errorText";
import { taskFormErrorText } from "../formErrors";
import { routeHash } from "../route";
import { ErrorAlert } from "./Alert";
import { ChecklistEditor } from "./ChecklistEditor";
import {
  type Choice,
  FieldGroup,
  RadioGroup,
  SelectField,
  TextAreaField,
  TextField,
  useFieldErrorFocus,
} from "./fields";
import { SymbolField } from "./SymbolField";

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

function kinds(): readonly Choice<TaskKind>[] {
  const words = t().taskForm;
  return [
    { value: "recurring", label: words.recurring },
    { value: "oneOff", label: words.oneOff },
  ];
}

function units(): readonly Choice<string>[] {
  const words = t().taskForm.units;
  return [
    { value: "day", label: words.day },
    { value: "week", label: words.week },
    { value: "month", label: words.month },
  ];
}

/** The element that takes the focus for the field. Radio groups take their first radio. */
const FOCUS_TARGET: Record<TaskFormField, string> = {
  title: "task-title",
  symbol: `task-symbol-${DEFAULT_TASK_SYMBOL}`,
  interval: "task-interval",
  unit: "task-unit",
  dueDate: "task-dueDate",
  assignee: "task-assignee-personA",
  note: "task-note",
  checklist: "task-checklist-new",
};

function initialInput(task: Task | undefined, today: CalendarDay, person: Person): TaskFormInput {
  if (task === undefined) {
    return {
      title: "",
      symbol: DEFAULT_TASK_SYMBOL,
      dueDate: today,
      assignee: person,
      note: "",
      interval: "1",
      unit: "week",
    };
  }
  return {
    title: task.title,
    symbol: task.symbol,
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

/**
 * Creates or changes a task (F1, F3, symbol F8, checklist F4). Every field has a visible label; a
 * message about a field stands at that field. A submit with errors puts the focus on the first
 * field with an error.
 */
export function TaskForm({ task, names, today, currentPerson, onSubmit, onDelete }: TaskFormProps) {
  const [kind, setKind] = useState<TaskKind>(task?.kind ?? "recurring");
  const [input, setInput] = useState(() => initialInput(task, today, currentPerson));
  const [checklist, setChecklist] = useState<readonly ChecklistItem[]>(task?.checklist ?? []);
  /** The text in the field for a new item; saving the form adds it, so it is never lost. */
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState<TaskFormError>();
  const [errors, setErrors] = useState<TaskFormErrors>({});
  const { report, status } = useFieldErrorFocus();
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
    const pendingText = draft.trim();
    const pendingError = pendingText === "" ? undefined : checklistItemError(draft);
    const items =
      pendingText !== "" && pendingError === undefined
        ? [...checklist, { id: crypto.randomUUID(), text: pendingText, checked: false }]
        : checklist;
    const checked = checkTaskForm(kind, { ...input, checklist: items });
    if (!checked.ok || pendingError !== undefined) {
      const found: TaskFormErrors = checked.ok ? {} : checked.errors;
      setErrors(found);
      setDraftError(pendingError);
      // A draft that cannot be added is a problem of the checklist field, the last of the form.
      const all = pendingError === undefined ? found : { ...found, checklist: pendingError };
      const first = firstTaskFormError(all);
      const firstError = first === undefined ? undefined : all[first];
      if (first !== undefined && firstError !== undefined) {
        report(FOCUS_TARGET[first], taskFormErrorText(firstError));
      }
      return;
    }
    setErrors({});
    setDraftError(undefined);
    setChecklist(items);
    setDraft("");
    setSaving(true);
    try {
      await onSubmit(kind, checked.values);
    } catch (error) {
      setSaveError(errorText(error));
    } finally {
      setSaving(false);
    }
  }

  const words = t().taskForm;
  /** The message of a field, in the language set now. */
  const message = (field: TaskFormField) => {
    const error = errors[field];
    return error === undefined ? undefined : taskFormErrorText(error);
  };
  const dateLabel = recurring ? (creating ? words.firstDate : words.nextDate) : words.dueOn;
  const people: readonly Choice<string>[] = [
    { value: "personA", label: names.personA },
    { value: "personB", label: names.personB },
    { value: "both", label: t().common.both },
  ];

  return (
    <form class="form" onSubmit={submit} noValidate>
      {creating ? (
        <RadioGroup
          name="task-kind"
          legend={words.kindLegend}
          choices={kinds()}
          value={kind}
          onChange={chooseKind}
        />
      ) : (
        <p>
          {words.kindFixed(recurring)[0]}
          <strong>{words.kindFixed(recurring)[1]}</strong>
          {words.kindFixed(recurring)[2]}
        </p>
      )}

      <TextField
        id="task-title"
        label={words.title}
        value={input.title}
        error={message("title")}
        onInput={(title) => change("title", title)}
      />

      <SymbolField
        name="task-symbol"
        value={input.symbol}
        error={message("symbol")}
        onChange={(symbol) => change("symbol", symbol)}
      />

      {recurring && (
        <FieldGroup legend={words.rhythm}>
          <TextField
            id="task-interval"
            label={words.interval}
            hint={words.intervalHint}
            value={input.interval}
            inputMode="numeric"
            narrow
            error={message("interval")}
            onInput={(interval) => change("interval", interval)}
          />
          <SelectField
            id="task-unit"
            label={words.unit}
            value={input.unit}
            choices={units()}
            error={message("unit")}
            onChange={(unit) => change("unit", unit)}
          />
        </FieldGroup>
      )}

      <TextField
        id="task-dueDate"
        label={dateLabel}
        hint={recurring ? words.dateHint : undefined}
        type="date"
        min={MIN_DUE_DATE}
        max={MAX_DUE_DATE}
        value={input.dueDate}
        error={message("dueDate")}
        onInput={(dueDate) => change("dueDate", dueDate)}
      />

      <RadioGroup
        name="task-assignee"
        legend={words.assignee}
        choices={people}
        value={input.assignee === "" ? undefined : input.assignee}
        error={message("assignee")}
        onChange={(assignee) => change("assignee", assignee)}
      />

      <TextAreaField
        id="task-note"
        label={words.note}
        value={input.note}
        error={message("note")}
        onInput={(note) => change("note", note)}
      />

      <ChecklistEditor
        id="task-checklist-new"
        items={checklist}
        onChange={(items) => {
          setChecklist(items);
          setErrors(withoutError(errors, "checklist"));
        }}
        draft={draft}
        onDraft={(text) => {
          setDraft(text);
          setDraftError(undefined);
        }}
        draftError={draftError}
        onDraftError={setDraftError}
        error={message("checklist")}
      />

      {saveError && <ErrorAlert title={t().common.notSaved}>{saveError}</ErrorAlert>}

      <div class="button-row">
        <button class="btn btn--primary" type="submit">
          {creating ? words.create : t().common.save}
        </button>
        <a class="btn btn--secondary" href={routeHash("tasks")}>
          {t().common.cancel}
        </a>
        {onDelete && (
          <button class="btn btn--text-warn" type="button" onClick={onDelete}>
            <Trash2 size={20} />
            {words.deleteTask}
          </button>
        )}
      </div>
      {status}
    </form>
  );
}
