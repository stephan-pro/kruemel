import { useState } from "preact/hooks";
import type { HouseholdInfo, Invite } from "../../auth/household";
import type { CalendarDay } from "../../domain/date";
import type { PersonNameInput } from "../../domain/personNames";
import type { Person } from "../../domain/task";
import type { AppData, PersonNames } from "../../storage/appData";
import type { ColorScheme } from "../../storage/storage";
import { appAddress } from "../appInfo";
import { AccountTile } from "../components/AccountTile";
import { ErrorAlert } from "../components/Alert";
import { BackupTile } from "../components/BackupTile";
import { type Choice, RadioGroup } from "../components/fields";
import { HouseholdTile } from "../components/HouseholdTile";
import { InstallTile } from "../components/InstallTile";
import { NamesForm } from "../components/NamesForm";
import { OtherDeviceTile } from "../components/OtherDeviceTile";
import { PageTitle } from "../components/PageTitle";
import { VersionTile } from "../components/VersionTile";
import type { InstallWay } from "../install";
import { routeHash, routeInfo } from "../route";

interface SettingsPageProps {
  /** Everything the app keeps: what "Sicherung" writes to a file. */
  readonly data: AppData;
  readonly names: PersonNames;
  readonly today: CalendarDay;
  readonly currentPerson: Person;
  readonly colorScheme: ColorScheme;
  readonly onSubmit: (names: PersonNameInput, person: Person) => Promise<void>;
  /** Saves and shows the colour scheme; rejects with an `Error` whose message is shown. */
  readonly onColorScheme: (scheme: ColorScheme) => Promise<void>;
  /** Replaces all data by the imported data; rejects with an `Error` whose message is shown. */
  readonly onImport: (data: AppData) => Promise<void>;
  /** The data are the household's shared data (stage 2): a backup then replaces them for both. */
  readonly shared?: boolean;
  /** How this browser puts the app on the home screen ("Als App installieren"). */
  readonly installWay: InstallWay;
  /** The browser's own install question; resolves `true` if accepted. */
  readonly onInstall: () => Promise<boolean>;
  /** Who is signed in and how to sign out (stage 2); missing when the app runs without sign-in. */
  readonly account?: {
    readonly email: string;
    readonly onSignOut: () => Promise<void>;
    /** With shared data: sends what waits and says how many changes still wait. */
    readonly onCheckPending?: () => Promise<number>;
  };
  /** The household and how to invite the second person (stage 2); missing without sign-in. */
  readonly household?: {
    readonly info: HouseholdInfo;
    readonly onCreateInvite: () => Promise<Invite>;
  };
}

const SCHEMES: readonly Choice<ColorScheme>[] = [
  { value: "light", label: "Hell" },
  { value: "dark", label: "Dunkel" },
  { value: "auto", label: "Automatisch (wie das Gerät)" },
];

export function SettingsPage({
  data,
  names,
  today,
  currentPerson,
  colorScheme,
  onSubmit,
  onColorScheme,
  onImport,
  shared = false,
  installWay,
  onInstall,
  account,
  household,
}: SettingsPageProps) {
  const [schemeError, setSchemeError] = useState<string>();
  /** Counts the imported backups; the names form starts over after each one. */
  const [importCount, setImportCount] = useState(0);

  async function importBackup(imported: AppData) {
    await onImport(imported);
    setImportCount((count) => count + 1);
  }

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
        <section class="tile tile--narrow" aria-labelledby="listen">
          <h2 class="tile__title" id="listen">
            Aufgaben und Erledigtes
          </h2>
          <div class="button-row">
            <a class="btn btn--secondary" href={routeHash("tasks")}>
              Aufgaben
            </a>
            <a class="btn btn--secondary" href={routeHash("done")}>
              Erledigt
            </a>
          </div>
        </section>
        {/* In a household the names and "Ich bin" come from the household; see the tile below. */}
        {!household && (
          <section class="tile tile--narrow" aria-labelledby="namen">
            <h2 class="tile__title" id="namen">
              Namen und „Ich bin“
            </h2>
            {/* The form keeps what is typed; a new key shows the names of an imported backup. */}
            <NamesForm
              key={importCount}
              initialNames={names}
              initialPerson={currentPerson}
              submitLabel="Speichern"
              savedMessage="Gespeichert."
              onSubmit={onSubmit}
            />
          </section>
        )}
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
        <BackupTile data={data} today={today} shared={shared} onImport={importBackup} />
        {household && (
          <HouseholdTile
            household={household.info}
            names={names}
            onCreateInvite={household.onCreateInvite}
          />
        )}
        {account && (
          <AccountTile
            email={account.email}
            shared={shared}
            onSignOut={account.onSignOut}
            {...(account.onCheckPending ? { onCheckPending: account.onCheckPending } : {})}
          />
        )}
        <InstallTile way={installWay} onInstall={onInstall} />
        <OtherDeviceTile address={appAddress()} />
        <VersionTile />
      </div>
    </>
  );
}
