import { useState } from "preact/hooks";
import type { PersonNameInput } from "../../domain/personNames";
import type { Person } from "../../domain/task";
import type { PersonNames } from "../../storage/appData";
import type { ColorScheme } from "../../storage/storage";
import { ErrorAlert } from "../components/Alert";
import { type Choice, RadioGroup } from "../components/fields";
import { NamesForm } from "../components/NamesForm";
import { PageTitle } from "../components/PageTitle";
import { routeInfo } from "../route";

interface SettingsPageProps {
  readonly names: PersonNames;
  readonly currentPerson: Person;
  readonly colorScheme: ColorScheme;
  readonly onSubmit: (names: PersonNameInput, person: Person) => Promise<void>;
  /** Saves and shows the colour scheme; rejects with an `Error` whose message is shown. */
  readonly onColorScheme: (scheme: ColorScheme) => Promise<void>;
}

const SCHEMES: readonly Choice<ColorScheme>[] = [
  { value: "light", label: "Hell" },
  { value: "dark", label: "Dunkel" },
  { value: "auto", label: "Automatisch (wie das Gerät)" },
];

export function SettingsPage({
  names,
  currentPerson,
  colorScheme,
  onSubmit,
  onColorScheme,
}: SettingsPageProps) {
  const [schemeError, setSchemeError] = useState<string>();

  async function chooseScheme(scheme: ColorScheme) {
    try {
      setSchemeError(undefined);
      await onColorScheme(scheme);
    } catch (error) {
      setSchemeError(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <>
      <PageTitle title={routeInfo("settings").title} />
      <div class="page-stack">
        <section class="tile tile--narrow" aria-labelledby="namen">
          <h2 class="tile__title" id="namen">
            Namen und „Ich bin“
          </h2>
          <NamesForm
            initialNames={names}
            initialPerson={currentPerson}
            submitLabel="Speichern"
            savedMessage="Gespeichert."
            onSubmit={onSubmit}
          />
        </section>
        {/* N8: takes effect at once, without "Speichern": it only changes how this device looks. */}
        <section class="tile tile--narrow form" aria-labelledby="darstellung">
          <h2 class="tile__title" id="darstellung">
            Darstellung
          </h2>
          <p class="muted">Gilt nur für dieses Gerät und wirkt sofort.</p>
          <RadioGroup
            name="farbschema"
            legend="Farbschema"
            choices={SCHEMES}
            value={colorScheme}
            onChange={chooseScheme}
          />
          {schemeError && <ErrorAlert title="Nicht gespeichert">{schemeError}</ErrorAlert>}
        </section>
      </div>
    </>
  );
}
