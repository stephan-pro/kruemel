import type { PersonNameInput } from "../../domain/personNames";
import type { Person } from "../../domain/task";
import { NamesForm } from "../components/NamesForm";
import { PageTitle } from "../components/PageTitle";

interface SetupPageProps {
  readonly onSubmit: (names: PersonNameInput, person: Person) => Promise<void>;
}

/** First start: the names of the two people and who uses this device (F5). */
export function SetupPage({ onSubmit }: SetupPageProps) {
  return (
    <>
      <PageTitle title="Ersteinrichtung" />
      <div class="tile tile--narrow">
        <p class="intro">
          Willkommen bei Krümel. Tragen Sie die Namen der beiden Personen ein, die den Haushalt
          gemeinsam organisieren, und wählen Sie, wer dieses Gerät benutzt. Beides lässt sich später
          in den Einstellungen ändern.
        </p>
        <NamesForm
          initialNames={{ personA: "", personB: "" }}
          initialPerson={undefined}
          submitLabel="Los geht’s"
          onSubmit={onSubmit}
        />
      </div>
    </>
  );
}
