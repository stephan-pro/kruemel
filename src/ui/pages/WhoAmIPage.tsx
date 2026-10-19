import { useState } from "preact/hooks";
import type { Person } from "../../domain/task";
import type { PersonNames } from "../../storage/appData";
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
      <form class="stack" onSubmit={submit} noValidate>
        <PersonChoice labels={names} value={person} error={error} onChange={setPerson} />
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
            <span class="kern-label">Weiter</span>
          </button>
        </div>
      </form>
    </>
  );
}
