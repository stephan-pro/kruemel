import { ArrowLeft } from "lucide-preact";
import type { ComponentChildren } from "preact";
import { useEffect, useState } from "preact/hooks";
import type { HouseholdInfo, Invite } from "../../auth/household";
import type { CalendarDay } from "../../domain/date";
import type { PersonNameInput } from "../../domain/personNames";
import type { Person } from "../../domain/task";
import type { Notifications } from "../../push/notifications";
import type { AppData, PersonNames } from "../../storage/appData";
import type { ColorScheme, SyncStatus } from "../../storage/storage";
import { APPEARANCE_TEXTS } from "../appearanceTexts";
import { appAddress } from "../appInfo";
import { AccountTile } from "../components/AccountTile";
import { ErrorAlert } from "../components/Alert";
import { BackupTile } from "../components/BackupTile";
import { FriendInviteTile } from "../components/FriendInviteTile";
import { type Choice, RadioGroup } from "../components/fields";
import { HouseholdTile } from "../components/HouseholdTile";
import { InstallTile } from "../components/InstallTile";
import { LegalLinks } from "../components/LegalLinks";
import { NamesForm } from "../components/NamesForm";
import { NotificationTile } from "../components/NotificationTile";
import { OtherDeviceTile } from "../components/OtherDeviceTile";
import { PageTitle } from "../components/PageTitle";
import { SettingsOverview } from "../components/SettingsOverview";
import { SyncTile } from "../components/SyncTile";
import { VersionTile } from "../components/VersionTile";
import { errorText } from "../errorText";
import type { InstallWay } from "../install";
import { LEGAL_TEXTS } from "../legalTexts";
import { routeHash, routeInfo, type SettingsRoute } from "../route";
import { SETTINGS_TEXTS } from "../settingsTexts";

interface SettingsPageProps {
  /** The group page to show (UX-a); missing: the overview. */
  readonly group?: SettingsRoute | undefined;
  /** The group page the person comes back from; the overview focuses its row. */
  readonly cameFrom?: SettingsRoute | undefined;
  /** Everything the app keeps: what "Sicherung" writes to a file. */
  readonly data: AppData;
  readonly names: PersonNames;
  readonly today: CalendarDay;
  readonly currentPerson: Person;
  readonly colorScheme: ColorScheme;
  readonly onSubmit: (names: PersonNameInput, person: Person) => Promise<void>;
  /** Saves and shows the colour scheme; rejects with an `Error` whose message is shown. */
  readonly onColorScheme: (scheme: ColorScheme) => Promise<void>;
  /** Whether the Krümel in the header moves (E2-4c). */
  readonly logoMotion: boolean;
  /** Saves and shows "Krümel bewegt sich"; rejects like `onColorScheme`. */
  readonly onLogoMotion: (moving: boolean) => Promise<void>;
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
    /** Deletes the account (E2-5a, with a household). Throws `HouseholdError`. */
    readonly onDeleteAccount?: () => Promise<void>;
  };
  /** The household and how to invite the second person (stage 2); missing without sign-in. */
  readonly household?: {
    readonly info: HouseholdInfo;
    readonly onCreateInvite: () => Promise<Invite>;
    /** Sets the household's name (E2-3g); only online. Throws `HouseholdError`. */
    readonly onRename: (name: string) => Promise<void>;
    /** Removes the other person (E2-5a); only online. Throws `HouseholdError`. */
    readonly onRemove: (person: Person) => Promise<void>;
    /** Leaves the household (E2-5a); only online. Throws `HouseholdError`. */
    readonly onLeave: () => Promise<void>;
    /** Before leaving or deleting the account: sends what waits, says how many still wait. */
    readonly onPrepare: () => Promise<number>;
    /** Downloads a backup of all data (offered in the questions). */
    readonly onBackup: () => void;
  };
  /** "Freunde einladen" (E2-5b); only for a member of a household. */
  readonly friends?: {
    readonly onCreate: () => Promise<Invite>;
    readonly onList: () => Promise<readonly Invite[]>;
    readonly onCancel: (token: string) => Promise<void>;
  };
  /** Where the shared data stand ("Übertragung", E2-3c); missing without shared data. */
  readonly sync?: {
    readonly status: SyncStatus;
    readonly rejected: number;
  };
  /** Notifications on this device (NT-a); missing without sign-in (the tile says why). */
  readonly notifications?: Notifications | undefined;
  /** The test build: notifications are only recorded. */
  readonly notificationsTestOnly?: boolean;
}

/** The name of the other member, or `undefined` when nobody else has joined. */
function otherMember(info: HouseholdInfo, names: PersonNames): string | undefined {
  const other = info.members.find((person) => person !== info.me);
  return other === undefined ? undefined : names[other];
}

const SCHEMES: readonly Choice<ColorScheme>[] = [
  { value: "light", label: "Hell" },
  { value: "dark", label: "Dunkel" },
  { value: "auto", label: "Automatisch (wie das Gerät)" },
];

export function SettingsPage({
  group,
  cameFrom,
  data,
  names,
  today,
  currentPerson,
  colorScheme,
  onSubmit,
  onColorScheme,
  logoMotion,
  onLogoMotion,
  onImport,
  shared = false,
  installWay,
  onInstall,
  account,
  household,
  friends,
  sync,
  notifications,
  notificationsTestOnly = false,
}: SettingsPageProps) {
  const [schemeError, setSchemeError] = useState<string>();
  /** Counts the imported backups; the names form starts over after each one. */
  const [importCount, setImportCount] = useState(0);

  async function importBackup(imported: AppData) {
    await onImport(imported);
    setImportCount((count) => count + 1);
  }

  async function chooseLogoMotion(moving: boolean) {
    try {
      setSchemeError(undefined);
      await onLogoMotion(moving);
    } catch (error) {
      setSchemeError(errorText(error));
    }
  }

  async function chooseScheme(scheme: ColorScheme) {
    try {
      setSchemeError(undefined);
      await onColorScheme(scheme);
    } catch (error) {
      setSchemeError(errorText(error));
    }
  }

  // A group page opens at its top; the overview does the same itself (and the focus).
  useEffect(() => {
    if (group !== undefined) {
      window.scrollTo(0, 0);
    }
  }, [group]);

  if (group === undefined) {
    return (
      <SettingsOverview
        signedIn={account !== undefined}
        {...(household
          ? {
              household: {
                name: household.info.name,
                people: household.info.members.length,
              },
            }
          : {})}
        logoMotion={logoMotion}
        notifications={notifications}
        {...(sync ? { sync } : {})}
        cameFrom={cameFrom}
      />
    );
  }

  const tiles: Record<SettingsRoute, ComponentChildren> = {
    settingsAccount: (
      <>
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
        {household && (
          <HouseholdTile
            household={household.info}
            names={names}
            onCreateInvite={household.onCreateInvite}
            onSaveOwnName={(name) =>
              onSubmit({ ...names, [household.info.me]: name }, household.info.me)
            }
            onRename={household.onRename}
            onRemove={household.onRemove}
            onPrepareLeave={household.onPrepare}
            onLeave={household.onLeave}
            onBackup={household.onBackup}
          />
        )}
        {friends && (
          <FriendInviteTile
            onCreate={friends.onCreate}
            onList={friends.onList}
            onCancel={friends.onCancel}
          />
        )}
        {account && (
          <AccountTile
            email={account.email}
            shared={shared}
            onSignOut={account.onSignOut}
            notifications={notifications}
            {...(account.onCheckPending ? { onCheckPending: account.onCheckPending } : {})}
            {...(household && account.onDeleteAccount
              ? {
                  deleteAccount: {
                    other: otherMember(household.info, names),
                    onDelete: account.onDeleteAccount,
                    onBackup: household.onBackup,
                  },
                }
              : {})}
          />
        )}
        <InstallTile way={installWay} onInstall={onInstall} shared={shared} />
        <OtherDeviceTile address={appAddress()} shared={shared} />
      </>
    ),
    settingsNotifications: (
      <NotificationTile
        notifications={notifications}
        testOnly={notificationsTestOnly}
        otherName={household ? otherMember(household.info, names) : undefined}
      />
    ),
    settingsAppearance: (
      /* N8: takes effect at once, without "Speichern": it only changes how this device looks. */
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
        <div class="choice">
          <input
            class="choice__input choice__input--switch"
            type="checkbox"
            role="switch"
            id="kruemel-bewegt-sich"
            checked={logoMotion}
            aria-checked={logoMotion}
            aria-describedby="kruemel-bewegt-sich-hinweis"
            onChange={(event) => void chooseLogoMotion(event.currentTarget.checked)}
          />
          <label class="choice__label" for="kruemel-bewegt-sich">
            {APPEARANCE_TEXTS.logoMotionLabel}
          </label>
        </div>
        <p class="muted" id="kruemel-bewegt-sich-hinweis">
          {APPEARANCE_TEXTS.logoMotionHint}
        </p>
      </section>
    ),
    settingsData: (
      <>
        {sync && <SyncTile status={sync.status} rejected={sync.rejected} />}
        <BackupTile data={data} today={today} shared={shared} onImport={importBackup} />
      </>
    ),
    settingsLegal: (
      <>
        <VersionTile />
        <section class="tile tile--narrow" aria-labelledby="rechtliches">
          <h2 class="tile__title" id="rechtliches">
            {LEGAL_TEXTS.settingsTitle}
          </h2>
          <p class="muted">{LEGAL_TEXTS.settingsIntro}</p>
          <LegalLinks />
        </section>
      </>
    ),
  };

  return (
    <>
      <a
        class="btn btn--quiet settings-back"
        href={routeHash("settings")}
        aria-label={SETTINGS_TEXTS.backLabel}
      >
        <ArrowLeft size={20} aria-hidden="true" />
        {SETTINGS_TEXTS.title}
      </a>
      <PageTitle title={routeInfo(group).title} />
      <div class="page-stack">{tiles[group]}</div>
    </>
  );
}
