import { useState } from "preact/hooks";
import {
  checkPersonNames,
  type PersonNameErrors,
  type PersonNameInput,
} from "../../domain/personNames";
import type { Person } from "../../domain/task";
import { TextField } from "./fields";
import { PersonChoice } from "./PersonChoice";

interface NamesFormProps {
  readonly initialNames: PersonNameInput;
  readonly initialPerson: Person | undefined;
  readonly submitLabel: string;
  /** Saves; rejects with an `Error` whose message is shown to the user. */
  readonly onSubmit: (names: PersonNameInput, person: Person) => Promise<void>;
  /** Shown (and announced) after a successful save, e.g. "Gespeichert." */
  readonly savedMessage?: string;
}

interface FieldErrors extends PersonNameErrors {
  person?: string;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The two names plus "Ich bin"; used for the first-time setup and on the settings page. */
export function NamesForm({
  initialNames,
  initialPerson,
  submitLabel,
  onSubmit,
  savedMessage,
}: NamesFormProps) {
  const [names, setNames] = useState(initialNames);
  const [person, setPerson] = useState(initialPerson);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  function edit(change: () => void) {
    change();
    setSaved(false);
  }

  async function submit(event: Event) {
    event.preventDefault();
    if (saving) {
      return;
    }
    const checked = checkPersonNames(names);
    const found: FieldErrors = checked.ok ? {} : { ...checked.errors };
    if (person === undefined) {
      found.person = "Bitte auswählen, wer dieses Gerät benutzt.";
    }
    setErrors(found);
    setSaveError(undefined);
    if (!checked.ok || person === undefined) {
      const first = found.personA
        ? "name-personA"
        : found.personB
          ? "name-personB"
          : "ich-bin-personA";
      document.getElementById(first)?.focus();
      return;
    }
    setSaving(true);
    try {
      await onSubmit(checked.names, person);
      setNames(checked.names);
      setSaved(true);
    } catch (error) {
      setSaveError(messageOf(error));
    } finally {
      setSaving(false);
    }
  }

  const labels = {
    personA: names.personA.trim() || "Erste Person",
    personB: names.personB.trim() || "Zweite Person",
  };

  return (
    <form class="stack" onSubmit={submit} noValidate>
      <TextField
        id="name-personA"
        label="Name der ersten Person"
        value={names.personA}
        error={errors.personA}
        onInput={(value) => edit(() => setNames({ ...names, personA: value }))}
      />
      <TextField
        id="name-personB"
        label="Name der zweiten Person"
        value={names.personB}
        error={errors.personB}
        onInput={(value) => edit(() => setNames({ ...names, personB: value }))}
      />
      <PersonChoice
        labels={labels}
        value={person}
        error={errors.person}
        onChange={(chosen) => edit(() => setPerson(chosen))}
      />
      {saveError && (
        <div class="kern-alert kern-alert--danger" role="alert">
          <div class="kern-alert__header">
            <span class="kern-icon kern-icon--danger" aria-hidden="true" />
            <span class="kern-title">Nicht gespeichert</span>
          </div>
          <div class="kern-alert__body">
            <p class="kern-body">{saveError}</p>
          </div>
        </div>
      )}
      <div>
        <button class="kern-btn kern-btn--primary" type="submit">
          <span class="kern-label">{submitLabel}</span>
        </button>
      </div>
      <p class="kern-body" role="status">
        {saved ? savedMessage : ""}
      </p>
    </form>
  );
}
