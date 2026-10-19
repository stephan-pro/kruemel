import type { PersonNameInput } from "../../domain/personNames";
import type { Person } from "../../domain/task";
import type { PersonNames } from "../../storage/appData";
import { NamesForm } from "../components/NamesForm";
import { PageTitle } from "../components/PageTitle";
import { routeInfo } from "../route";

interface SettingsPageProps {
  readonly names: PersonNames;
  readonly currentPerson: Person;
  readonly onSubmit: (names: PersonNameInput, person: Person) => Promise<void>;
}

export function SettingsPage({ names, currentPerson, onSubmit }: SettingsPageProps) {
  return (
    <>
      <PageTitle title={routeInfo("settings").title} />
      <NamesForm
        initialNames={names}
        initialPerson={currentPerson}
        submitLabel="Speichern"
        savedMessage="Gespeichert."
        onSubmit={onSubmit}
      />
    </>
  );
}
