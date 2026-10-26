import type { PersonNameInput } from "../../domain/personNames";
import type { Person } from "../../domain/task";
import { t } from "../../i18n";
import { NamesForm } from "../components/NamesForm";
import { PageTitle } from "../components/PageTitle";

interface SetupPageProps {
  readonly onSubmit: (names: PersonNameInput, person: Person) => Promise<void>;
}

/** First start: the names of the two people and who uses this device (F5). */
export function SetupPage({ onSubmit }: SetupPageProps) {
  const words = t().names;
  return (
    <>
      <PageTitle title={words.setupTitle} />
      <div class="tile tile--narrow">
        <p class="intro">{words.setupIntro}</p>
        <NamesForm
          initialNames={{ personA: "", personB: "" }}
          initialPerson={undefined}
          submitLabel={words.setupSubmit}
          onSubmit={onSubmit}
        />
      </div>
    </>
  );
}
