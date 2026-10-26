import { useState } from "preact/hooks";
import {
  checkPersonNames,
  type PersonNameErrors,
  type PersonNameInput,
} from "../../domain/personNames";
import type { Person } from "../../domain/task";
import { t } from "../../i18n";
import { errorText, type Failure, failureOf } from "../errorText";
import { personNameErrorText } from "../formErrors";
import { ErrorAlert } from "./Alert";
import { TextField, useFieldErrorFocus } from "./fields";
import { PersonChoice } from "./PersonChoice";

interface NamesFormProps {
  readonly initialNames: PersonNameInput;
  readonly initialPerson: Person | undefined;
  readonly submitLabel: string;
  /** Saves; rejects with an `Error` whose message is shown to the user. */
  readonly onSubmit: (names: PersonNameInput, person: Person) => Promise<void>;
  /** Shown (and announced) after a successful save, e.g. "Saved." */
  readonly savedMessage?: string;
}

interface FieldErrors extends PersonNameErrors {
  /** "Ich bin" was not chosen. */
  person?: boolean;
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
  const { report, status } = useFieldErrorFocus();
  const [saveError, setSaveError] = useState<Failure>();
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
      found.person = true;
    }
    setErrors(found);
    setSaveError(undefined);
    if (!checked.ok || person === undefined) {
      if (found.personA) {
        report("name-personA", personNameErrorText(found.personA));
      } else if (found.personB) {
        report("name-personB", personNameErrorText(found.personB));
      } else {
        report("ich-bin-personA", t().formErrors.personMissing);
      }
      return;
    }
    setSaving(true);
    try {
      await onSubmit(checked.names, person);
      setNames(checked.names);
      setSaved(true);
    } catch (error) {
      setSaveError(failureOf(error));
    } finally {
      setSaving(false);
    }
  }

  const words = t().names;
  const labels = {
    personA: names.personA.trim() || words.firstPerson,
    personB: names.personB.trim() || words.secondPerson,
  };

  return (
    <>
      <form class="form" onSubmit={submit} noValidate>
        <TextField
          id="name-personA"
          label={words.firstName}
          value={names.personA}
          error={errors.personA && personNameErrorText(errors.personA)}
          onInput={(value) => edit(() => setNames({ ...names, personA: value }))}
        />
        <TextField
          id="name-personB"
          label={words.secondName}
          value={names.personB}
          error={errors.personB && personNameErrorText(errors.personB)}
          onInput={(value) => edit(() => setNames({ ...names, personB: value }))}
        />
        <PersonChoice
          labels={labels}
          value={person}
          error={errors.person ? t().formErrors.personMissing : undefined}
          onChange={(chosen) => edit(() => setPerson(chosen))}
        />
        {saveError && (
          <ErrorAlert title={t().common.notSaved}>{errorText(saveError.cause)}</ErrorAlert>
        )}
        <div class="button-row">
          <button class="btn btn--primary" type="submit">
            {submitLabel}
          </button>
        </div>
        <p class="form-status" role="status">
          {saved ? savedMessage : ""}
        </p>
      </form>
      {status}
    </>
  );
}
