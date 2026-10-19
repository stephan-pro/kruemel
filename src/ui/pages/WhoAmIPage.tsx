import { useState } from "preact/hooks";
import type { Person } from "../../domain/task";
import type { PersonNames } from "../../storage/appData";
import { ErrorAlert } from "../components/Alert";
import { PageTitle } from "../components/PageTitle";
import { PersonChoice } from "../components/PersonChoice";

interface WhoAmIPageProps {
  readonly names: PersonNames;
  readonly onSubmit: (person: Person) => Promise<void>;
}

/** The names exist, but this device does not know yet who uses it (new device, cleared data). */
export function WhoAmIPage({ names, onSubmit }: WhoAmIPageProps) {
  const [person, setPerson] = useState<Person>();
  const [error, setError] = useState<string>();
  const [saveError, setSaveError] = useState<string>();

  async function submit(event: Event) {
    event.preventDefault();
    if (person === undefined) {
      setError("Bitte auswählen, wer dieses Gerät benutzt.");
      document.getElementById("ich-bin-personA")?.focus();
      return;
    }
    setError(undefined);
    try {
      await onSubmit(person);
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  return (
    <>
      <PageTitle title="Wer benutzt dieses Gerät?" />
      <form class="tile tile--narrow form" onSubmit={submit} noValidate>
        <PersonChoice labels={names} value={person} error={error} onChange={setPerson} />
        {saveError && <ErrorAlert title="Nicht gespeichert">{saveError}</ErrorAlert>}
        <div class="button-row">
          <button class="btn btn--primary" type="submit">
            Weiter
          </button>
        </div>
      </form>
    </>
  );
}
