import { useState } from "preact/hooks";
import type { Person } from "../../domain/task";
import { t } from "../../i18n";
import type { PersonNames } from "../../storage/appData";
import { ErrorAlert } from "../components/Alert";
import { PageTitle } from "../components/PageTitle";
import { PersonChoice } from "../components/PersonChoice";
import { errorText, type Failure, failureOf } from "../errorText";

interface WhoAmIPageProps {
  readonly names: PersonNames;
  readonly onSubmit: (person: Person) => Promise<void>;
}

/** The names exist, but this device does not know yet who uses it (new device, cleared data). */
export function WhoAmIPage({ names, onSubmit }: WhoAmIPageProps) {
  const [person, setPerson] = useState<Person>();
  /** Nobody was chosen; the sentence is read when drawing, so it follows the language. */
  const [missing, setMissing] = useState(false);
  const [saveError, setSaveError] = useState<Failure>();

  async function submit(event: Event) {
    event.preventDefault();
    if (person === undefined) {
      setMissing(true);
      document.getElementById("ich-bin-personA")?.focus();
      return;
    }
    setMissing(false);
    try {
      await onSubmit(person);
    } catch (caught) {
      setSaveError(failureOf(caught));
    }
  }

  return (
    <>
      <PageTitle title={t().names.whoTitle} />
      <form class="tile tile--narrow form" onSubmit={submit} noValidate>
        <PersonChoice
          labels={names}
          value={person}
          error={missing ? t().formErrors.personMissing : undefined}
          onChange={setPerson}
        />
        {saveError && (
          <ErrorAlert title={t().common.notSaved}>{errorText(saveError.cause)}</ErrorAlert>
        )}
        <div class="button-row">
          <button class="btn btn--primary" type="submit">
            {t().names.whoSubmit}
          </button>
        </div>
      </form>
    </>
  );
}
