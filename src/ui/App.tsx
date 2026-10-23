import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Auth, Session } from "../auth/auth";
import { type HouseholdApi, HouseholdError, type HouseholdInfo } from "../auth/household";
import type { DemoInfo } from "../demo/start";
import type { TakeOverMode } from "../domain/assignment";
import type { PersonNameInput } from "../domain/personNames";
import type { Completion, Person, Task } from "../domain/task";
import { type TaskFormValues, type TaskKind, taskFromForm, updateTask } from "../domain/taskForm";
import {
  completeInData,
  deleteTask,
  setChecklistItemInData,
  takeOverInData,
  undoInData,
} from "../domain/taskManagement";
import type { AppData, PersonNames } from "../storage/appData";
import { exportData, rejectedFileName, signOutBackupFileName } from "../storage/exportImport";
import { requestPersistentStorage } from "../storage/localStorage";
import {
  type AppStorage,
  type ColorScheme,
  DEFAULT_COLOR_SCHEME,
  type DeviceSettings,
  StorageError,
  StorageUnavailableError,
  type StorageUpdate,
  type SyncStatus,
} from "../storage/storage";
import type { SharedAccount } from "../sync/browserShared";
import { exportRejected } from "../sync/rejected";
import type { SyncedStorage } from "../sync/syncedStorage";
import { ACCOUNT_TEXTS } from "./accountTexts";
import { applyColorScheme } from "./colorScheme";
import { InstallHint } from "./components/InstallHint";
import { Navigation } from "./components/Navigation";
import { APP_NAME } from "./components/PageTitle";
import { conflictText, SyncNotices } from "./components/SyncNotices";
import { downloadTextFile } from "./download";
import { pendingInvite, rememberInvite } from "./householdMemory";
import { SHARED_TEXTS } from "./householdTexts";
import { offersInstallHint, useInstallWay } from "./install";
import { DonePage } from "./pages/DonePage";
import { HouseholdPage, HouseholdUnavailablePage } from "./pages/HouseholdPage";
import { InvitePage } from "./pages/InvitePage";
import { SettingsPage } from "./pages/SettingsPage";
import { SetupPage } from "./pages/SetupPage";
import { SignInPage } from "./pages/SignInPage";
import { StatisticsPage } from "./pages/StatisticsPage";
import { StorageProblemPage } from "./pages/StorageProblemPage";
import { TaskFormPage } from "./pages/TaskFormPage";
import { TasksPage } from "./pages/TasksPage";
import { TodayPage } from "./pages/TodayPage";
import { WeekPage } from "./pages/WeekPage";
import { WhoAmIPage } from "./pages/WhoAmIPage";
import { inviteHash, inviteTokenFrom, type PageLocation, parseLocation, routeHash } from "./route";
import { useHousehold } from "./useHousehold";
import { useToday } from "./useToday";

interface AppProps {
  /** The data on this device; with `shared` only its device settings are used. */
  readonly storage: AppStorage;
  /** Only set in demo mode (`npm run demo`). */
  readonly demo?: DemoInfo;
  /** Sign-in (stage 2): with it the app opens only for a signed-in person. */
  readonly auth?: Auth;
  /** The household (stage 2, with `auth`): the app opens only for a person who has one. */
  readonly household?: HouseholdApi;
  /**
   * The household's shared data of a member (stage 2, E2-3b, with `household`): the app shows
   * them instead of the data in `storage`, which stay untouched.
   */
  readonly shared?: (account: SharedAccount) => SyncedStorage;
}

/** How many changes wait for the server. */
function pendingOf(status: SyncStatus): number {
  return status.state === "synced" ? 0 : status.pending;
}

/** A conflict reported by the shared storage, until the person closes its hint. */
interface Conflict {
  readonly id: number;
  readonly conflict: Extract<StorageUpdate, { type: "conflict" }>;
}

/** How long signing out waits for the transfer of waiting changes before it asks anyway. */
const SIGN_OUT_SYNC_MS = 5000;

/**
 * The session of `auth`: `undefined` while it is read, `null` when signed out. Without `auth`
 * always `null`. A change reported by `auth` (signed out elsewhere, refused for good) wins over a
 * read that is still on its way.
 */
function useSession(auth: Auth | undefined) {
  const [session, setSession] = useState<Session | null | undefined>(
    auth === undefined ? null : undefined,
  );
  useEffect(() => {
    if (auth === undefined) {
      return;
    }
    let changed = false;
    const stop = auth.onChange((next) => {
      changed = true;
      setSession(next);
    });
    void auth.session().then((remembered) => {
      if (!changed) {
        setSession(remembered);
      }
    });
    return stop;
  }, [auth]);
  return [session, setSession] as const;
}

type LoadState =
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly data: AppData; readonly device: DeviceSettings }
  /** The shared data were never loaded on this device and the server cannot be reached. */
  | { readonly status: "unavailable" }
  | {
      readonly status: "problem";
      readonly message: string;
      readonly details: readonly string[];
      readonly rawData: string | undefined;
    };

/** Reads everything the app needs; unreadable data becomes a state, never an empty app. */
async function loadState(storage: AppStorage): Promise<LoadState> {
  try {
    const data = await storage.load();
    const device = await storage.loadDevice();
    return { status: "ready", data, device };
  } catch (error) {
    if (error instanceof StorageUnavailableError) {
      return { status: "unavailable" };
    }
    let rawData: string | undefined;
    try {
      rawData = (await storage.loadRaw()) ?? undefined;
    } catch {
      rawData = undefined;
    }
    return error instanceof StorageError
      ? { status: "problem", message: error.message, details: error.details, rawData }
      : {
          status: "problem",
          message: "Beim Laden ist ein unerwarteter Fehler aufgetreten.",
          details: [String(error)],
          rawData,
        };
  }
}

/** The task of the edit address, or a note that there is none (a bookmark of a deleted task). */
function editedTask(
  tasks: readonly Task[],
  taskId: string | undefined,
): { readonly task: Task } | { readonly missing: true } {
  const task = tasks.find((candidate) => candidate.id === taskId);
  return task === undefined ? { missing: true } : { task };
}

/** After something on the page vanished with the focus in it: back to the top of the page. */
function focusPageHeading() {
  document.querySelector<HTMLElement>("main h1")?.focus();
}

/**
 * The invite of an opened link (`#/einladung/<token>`): remembered on the device (with
 * `household` only) and replaced by the start page, so it survives signing in and a reload but is
 * not opened twice from the history.
 */
function takeInvite(keep: boolean): string | undefined {
  if (location.hash.startsWith(inviteHash(""))) {
    const token = inviteTokenFrom(location.hash);
    history.replaceState(null, "", `${location.pathname}${location.search}${routeHash("today")}`);
    if (keep && token !== undefined) {
      rememberInvite(token);
    }
  }
  return keep ? pendingInvite() : undefined;
}

function useLocation(onInvite: () => void): PageLocation {
  const [pageLocation, setPageLocation] = useState(() => parseLocation(location.hash));
  useEffect(() => {
    const update = () => {
      onInvite();
      setPageLocation(parseLocation(location.hash));
    };
    addEventListener("hashchange", update);
    return () => removeEventListener("hashchange", update);
  }, []);
  return pageLocation;
}

export function App({
  storage: deviceStorage,
  demo,
  auth,
  household: householdApi,
  shared,
}: AppProps) {
  const [session, setSession] = useSession(auth);
  const [invite, setInvite] = useState(() => takeInvite(householdApi !== undefined));
  const household = useHousehold(householdApi, session?.userId);
  const joined = household.state.status === "ready" ? household.state.household : null;
  /**
   * The shared data of the signed-in member, one storage per account (E2-3b). `undefined` while
   * nobody is signed in or the household is not known yet: then nothing is loaded at all, so the
   * data on the device are never shown to, or saved for, an account.
   */
  const sharedStorage = useMemo(
    () =>
      shared !== undefined && session != null && joined !== null
        ? shared({ householdId: joined.id, userId: session.userId })
        : undefined,
    [shared, session?.userId, joined?.id],
  );
  const storage = shared === undefined ? deviceStorage : sharedStorage;
  /** The household holds data of a newer app ("Neue Version verfügbar – Neu laden"). */
  const [outdated, setOutdated] = useState(false);
  /** Where the shared data stand, how many changes were refused for good, open conflicts (E2-3c). */
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ state: "synced" });
  const [rejectedCount, setRejectedCount] = useState(0);
  const [conflicts, setConflicts] = useState<readonly Conflict[]>([]);
  const conflictIds = useRef(0);
  const [state, setStateValue] = useState<LoadState>({ status: "loading" });
  /**
   * The newest state, also between two drawings. With the shared storage the other device's data
   * can arrive at any moment; an action must start from them and not from what the last drawing
   * saw, or it would undo the other device's change. Every action below begins with
   * `const state = latest.current`.
   */
  const latest = useRef(state);
  function setState(next: LoadState | ((current: LoadState) => LoadState)) {
    const value = typeof next === "function" ? next(latest.current) : next;
    latest.current = value;
    setStateValue(value);
  }
  /** What just happened to a task; the task list shows and announces it, then forgets it. */
  const [notice, setNotice] = useState<string>();
  const { route, taskId } = useLocation(() => setInvite(takeInvite(householdApi !== undefined)));
  const today = useToday();
  const install = useInstallWay();

  /** The storage of the data shown now; only called once the app shows them. */
  function activeStorage(): AppStorage {
    if (storage === undefined) {
      throw new Error("Die App ist noch nicht bereit.");
    }
    return storage;
  }

  /** Counts the loads; the answer of an older one (another account, a retry) is dropped. */
  const loads = useRef(0);

  async function load() {
    const mine = ++loads.current;
    setState({ status: "loading" });
    if (storage === undefined) {
      return;
    }
    const loaded = await loadState(storage);
    if (mine !== loads.current) {
      return;
    }
    if (loaded.status === "ready") {
      // Usually already done by the script in index.html; this keeps both in step.
      applyColorScheme(loaded.device.colorScheme ?? DEFAULT_COLOR_SCHEME);
    }
    setState(loaded);
  }

  // A new storage (start, signed in, another account): load it, show what arrives from the other
  // device without a reload, keep the shared data in step and show where they stand.
  useEffect(() => {
    void load();
    setConflicts([]);
    if (storage === undefined) {
      return;
    }
    const showSync = () => {
      setSyncStatus(storage.syncStatus());
      setRejectedCount(sharedStorage?.rejected().length ?? 0);
    };
    showSync();
    const stopUpdates = storage.subscribe((update) => {
      if (update.type === "data") {
        setState((current) =>
          current.status === "ready" ? { ...current, data: update.data } : current,
        );
      } else if (update.type === "outdated") {
        setOutdated(true);
      } else if (update.type === "status") {
        showSync();
      } else {
        const id = ++conflictIds.current;
        setConflicts((current) => [...current, { id, conflict: update }]);
      }
    });
    const stopSync = sharedStorage?.start();
    return () => {
      loads.current++;
      stopUpdates();
      stopSync?.();
    };
  }, [storage]);

  // Shared data never loaded and no connection: try again as soon as the device is online.
  useEffect(() => {
    if (state.status !== "unavailable") {
      return;
    }
    const retry = () => void load();
    addEventListener("online", retry);
    return () => removeEventListener("online", retry);
  }, [state.status, storage]);

  /** Setup and settings: the names (stored with the data) and "Ich bin" (stored on the device). */
  async function saveNamesAndPerson(names: PersonNameInput, person: Person) {
    const state = latest.current;
    if (state.status !== "ready") {
      return;
    }
    const data: AppData = {
      ...state.data,
      settings: { ...state.data.settings, personNames: names },
    };
    // In a household the role decides, whatever the form or an old device says.
    const device: DeviceSettings = { ...state.device, currentPerson: joined?.me ?? person };
    const saved = await activeStorage().save(data);
    await activeStorage().saveDevice(device);
    setState({ status: "ready", data: saved, device });
    void requestPersistentStorage();
  }

  /** Replaces the shown device settings, keeping whatever data are shown by then. */
  function showDevice(device: DeviceSettings) {
    setState((current) => (current.status === "ready" ? { ...current, device } : current));
  }

  /** "Darstellung" (N8): saved on the device, then shown. Nothing changes if saving fails. */
  async function saveColorScheme(colorScheme: ColorScheme) {
    const state = latest.current;
    if (state.status !== "ready") {
      return;
    }
    const device: DeviceSettings = { ...state.device, colorScheme };
    await activeStorage().saveDevice(device);
    applyColorScheme(colorScheme);
    showDevice(device);
  }

  async function savePerson(person: Person) {
    const state = latest.current;
    if (state.status !== "ready") {
      return;
    }
    const device: DeviceSettings = { ...state.device, currentPerson: person };
    await activeStorage().saveDevice(device);
    showDevice(device);
  }

  /** Keeps the new data. Nothing changes on screen if saving fails; the caller shows the error. */
  async function saveData(data: AppData) {
    if (latest.current.status !== "ready") {
      return;
    }
    const saved = await activeStorage().save(data);
    setState((current) => (current.status === "ready" ? { ...current, data: saved } : current));
  }

  /**
   * "Sicherung einspielen" in the household: replaces the data for both, only online. A backup
   * without names keeps the household's names.
   */
  async function importShared(data: AppData) {
    if (sharedStorage === undefined) {
      return;
    }
    const personNames = data.settings.personNames ?? names;
    await sharedStorage.replaceAll(
      personNames === undefined ? data : { ...data, settings: { ...data.settings, personNames } },
    );
  }

  /** Creates a task, or replaces `existing` by the changed one, then goes back to the list. */
  async function saveTask(kind: TaskKind, values: TaskFormValues, existing: Task | undefined) {
    const state = latest.current;
    if (state.status !== "ready") {
      return;
    }
    const { data } = state;
    const task =
      existing === undefined
        ? taskFromForm(kind, crypto.randomUUID(), values)
        : updateTask(existing, values);
    const tasks =
      existing === undefined
        ? [...data.tasks, task]
        : data.tasks.map((candidate) => (candidate.id === task.id ? task : candidate));
    await saveData({ ...data, tasks });
    setNotice(`Aufgabe „${task.title}“ ${existing === undefined ? "angelegt" : "gespeichert"}.`);
    location.hash = routeHash("tasks");
  }

  /** Deletes a task together with its completions. */
  async function removeTask(taskId: string) {
    const state = latest.current;
    if (state.status !== "ready") {
      return;
    }
    const title = state.data.tasks.find((task) => task.id === taskId)?.title ?? "";
    await saveData(deleteTask(state.data, taskId));
    setNotice(`Aufgabe „${title}“ gelöscht.`);
    location.hash = routeHash("tasks");
  }

  /** Ticks a task off today, noted for the person this device belongs to ("Ich bin"). */
  async function completeTask(taskId: string): Promise<{ task: Task; completion: Completion }> {
    const state = latest.current;
    const completedBy = state.status === "ready" ? person : undefined;
    if (state.status !== "ready" || completedBy === undefined) {
      throw new Error("Die App ist noch nicht bereit.");
    }
    const result = completeInData(state.data, taskId, {
      completionId: crypto.randomUUID(),
      completedOn: today,
      completedBy,
      completedAt: new Date().toISOString(),
    });
    await saveData(result.data);
    return { task: result.task, completion: result.completion };
  }

  /** Takes back the last completion of a task; returns the task as it is then. */
  async function undoCompletion(completionId: string): Promise<Task> {
    const state = latest.current;
    if (state.status !== "ready") {
      throw new Error("Die App ist noch nicht bereit.");
    }
    const result = undoInData(state.data, completionId);
    await saveData(result.data);
    return result.task;
  }

  /** "Übernehmen": the person of this device takes the task over, once or permanently (F5). */
  async function takeOverTask(taskId: string, mode: TakeOverMode): Promise<Task> {
    const state = latest.current;
    if (state.status !== "ready" || person === undefined) {
      throw new Error("Die App ist noch nicht bereit.");
    }
    const result = takeOverInData(state.data, taskId, person, mode);
    await saveData(result.data);
    return result.task;
  }

  /** Ticks or unticks one item of a task's checklist (F4). */
  async function setChecklistItem(taskId: string, itemId: string, checked: boolean): Promise<Task> {
    const state = latest.current;
    if (state.status !== "ready") {
      throw new Error("Die App ist noch nicht bereit.");
    }
    const result = setChecklistItemInData(state.data, taskId, itemId, checked);
    await saveData(result.data);
    return result.task;
  }

  /** "Krümel als App" closed: it stays closed on this device (if that can be saved). */
  async function dismissInstallHint() {
    const state = latest.current;
    if (state.status !== "ready") {
      return;
    }
    const device: DeviceSettings = { ...state.device, installHintDismissed: true };
    showDevice(device);
    focusPageHeading();
    try {
      await activeStorage().saveDevice(device);
    } catch {
      // Closed for now; it shows again after the next start. Not worth an error message.
    }
  }

  /** The browser's install question from the hint; the hint is gone afterwards either way. */
  async function installFromHint() {
    await install.install();
    focusPageHeading();
  }

  /** Unreadable data: deleted after the question; the shared copy then comes anew from the server. */
  async function discard() {
    await activeStorage().discard();
    await load();
  }

  /**
   * Before the question "Abmelden?": sends what waits (for a few seconds at most) and says how
   * many changes still wait.
   */
  async function pendingBeforeSignOut(): Promise<number> {
    if (sharedStorage === undefined) {
      return 0;
    }
    await Promise.race([
      sharedStorage.sync().catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, SIGN_OUT_SYNC_MS)),
    ]);
    return pendingOf(sharedStorage.syncStatus()) + sharedStorage.rejected().length;
  }

  /** "Als Datei herunterladen": the changes the server refused for good. */
  function downloadRejected() {
    if (sharedStorage !== undefined) {
      downloadTextFile(
        rejectedFileName(today),
        exportRejected(sharedStorage.rejected(), new Date()),
        "application/json",
      );
    }
  }

  /** "Verwerfen": the refused changes are forgotten. */
  async function discardRejected() {
    await sharedStorage?.discardRejected();
  }

  /**
   * "Abmelden": ends the session on this device. The shared copy and its outbox are deleted; if
   * changes still wait, a backup file with all data is downloaded first, and the changes the
   * server refused as a file of their own. The data of stage 1 on the device stay untouched.
   */
  async function signOut() {
    if (sharedStorage !== undefined) {
      const shown = latest.current;
      if (pendingOf(sharedStorage.syncStatus()) > 0 && shown.status === "ready") {
        downloadTextFile(signOutBackupFileName(today), exportData(shown.data), "application/json");
      }
      if (sharedStorage.rejected().length > 0) {
        downloadRejected();
      }
      await sharedStorage.close();
    }
    await auth?.signOut();
    household.forget();
    setSession(null);
  }

  /** "Haushalt anlegen": the new household is shown and its names taken over (see below). */
  async function createHousehold(names: PersonNames): Promise<HouseholdInfo> {
    if (householdApi === undefined) {
      throw new HouseholdError("unknown");
    }
    try {
      const created = await householdApi.create(names);
      household.show(created);
      return created;
    } catch (error) {
      if (error instanceof HouseholdError && error.failure === "alreadyMember") {
        // Created meanwhile on another device: the message shows, then the app opens.
        void household.refresh();
      }
      throw error;
    }
  }

  /** An invite link pasted on "Haushalt anlegen". */
  function openInvite(token: string) {
    rememberInvite(token);
    setInvite(token);
  }

  /** "Haushalt beitreten": the invite is used up; the app opens for the new member. */
  async function acceptInvite(): Promise<HouseholdInfo> {
    if (householdApi === undefined || invite === undefined) {
      throw new HouseholdError("unknown");
    }
    const joined = await householdApi.acceptInvite(invite);
    dismissInvite();
    household.show(joined);
    return joined;
  }

  function dismissInvite() {
    rememberInvite(undefined);
    setInvite(undefined);
  }

  // The other person may have joined meanwhile: the settings show the household as it is now.
  useEffect(() => {
    if (route === "settings" && joined !== null) {
      void household.refresh();
    }
  }, [route, joined !== null]);

  /**
   * With sign-in: "waiting" while the session is read, "signIn" without one; with a household
   * interface then "invite" for an opened invite and "household" until the person has one.
   */
  const gate =
    auth === undefined
      ? "open"
      : session === undefined
        ? "waiting"
        : session === null
          ? "signIn"
          : householdApi === undefined
            ? "open"
            : household.state.status === "loading"
              ? "waiting"
              : household.state.status === "failed"
                ? "unavailable"
                : invite !== undefined
                  ? "invite"
                  : joined === null
                    ? "household"
                    : "open";
  // With a household the role decides who "Ich bin" is. The names are those of the shared data
  // (they follow a change by the other device or a backup), else those the household reported.
  // The local values stay untouched: a device with data from stage 1 still knows its old "Ich
  // bin" for E2-3d.
  const member = householdApi === undefined ? null : joined;
  const shownNames = state.status === "ready" ? state.data.settings.personNames : undefined;
  const names =
    (sharedStorage === undefined ? undefined : shownNames) ?? member?.names ?? shownNames;
  const person = member?.me ?? (state.status === "ready" ? state.device.currentPerson : undefined);
  const inApp =
    gate === "open" && state.status === "ready" && names !== undefined && person !== undefined;

  return (
    <div class={`app${inApp ? " app--with-nav" : ""}`}>
      {/* A button, not a "#inhalt" link: that would change the hash and with it the page. */}
      <button
        class="skip-link"
        type="button"
        onClick={() => document.getElementById("inhalt")?.focus()}
      >
        Zum Inhalt springen
      </button>
      {/* Phones: a bar on top with the navigation fixed at the bottom; wide screens: a column. */}
      <header class="app-header">
        <p class="app-name">{APP_NAME}</p>
        {inApp && <Navigation current={route} />}
        {inApp && (
          <p class="app-person">
            {session ? ACCOUNT_TEXTS.signedInAs : ACCOUNT_TEXTS.thisDevice}{" "}
            <strong>{names[person]}</strong>
          </p>
        )}
      </header>
      <div class="app-content">
        {demo && (
          <aside class="demo-hint" aria-label="Hinweis zum Demo-Modus">
            <p>
              Demo-Modus: {demo.taskCount} Beispielaufgaben und {demo.completionCount} Erledigungen
              liegen im Demo-Speicher dieses Browsers. Echte Daten bleiben unberührt.{" "}
              <a href="?demo=neu">Beispieldaten neu laden</a>
            </p>
          </aside>
        )}
        {outdated && (
          <aside class="demo-hint update-hint" aria-label={SHARED_TEXTS.newVersionLabel}>
            <p role="status">{SHARED_TEXTS.newVersion}</p>
            <div class="button-row">
              <button class="btn btn--primary" type="button" onClick={() => location.reload()}>
                {SHARED_TEXTS.reload}
              </button>
            </div>
          </aside>
        )}
        {inApp && sharedStorage !== undefined && (
          <SyncNotices
            status={syncStatus}
            rejected={rejectedCount}
            conflicts={conflicts.map(({ id, conflict }) => ({
              id,
              text: conflictText(conflict, names, person),
            }))}
            onDownload={downloadRejected}
            onDiscard={discardRejected}
            onCloseConflict={(id) =>
              setConflicts((current) => current.filter((entry) => entry.id !== id))
            }
          />
        )}
        <main id="inhalt" tabIndex={-1}>
          {(gate === "waiting" || (gate === "open" && state.status === "loading")) && (
            <p role="status">Wird geladen …</p>
          )}
          {gate === "signIn" && auth && <SignInPage auth={auth} onSignedIn={setSession} />}
          {gate === "unavailable" && household.state.status === "failed" && (
            <HouseholdUnavailablePage message={household.state.message} onRetry={household.retry} />
          )}
          {gate === "invite" && session && (
            <InvitePage
              email={session.email}
              hasHousehold={joined !== null}
              onAccept={acceptInvite}
              onDismiss={dismissInvite}
              onSignOut={signOut}
            />
          )}
          {gate === "household" && (
            <HouseholdPage onCreate={createHousehold} onInvite={openInvite} />
          )}
          {gate === "open" && state.status === "unavailable" && (
            <HouseholdUnavailablePage
              message={SHARED_TEXTS.notLoadedYet}
              onRetry={() => void load()}
            />
          )}
          {gate === "open" && state.status === "problem" && (
            <StorageProblemPage
              message={state.message}
              details={state.details}
              rawData={state.rawData}
              shared={sharedStorage !== undefined}
              onDiscard={discard}
              onRetry={() => void load()}
            />
          )}
          {gate === "open" && state.status === "ready" && names === undefined && (
            <SetupPage onSubmit={saveNamesAndPerson} />
          )}
          {gate === "open" &&
            state.status === "ready" &&
            names !== undefined &&
            person === undefined && <WhoAmIPage names={names} onSubmit={savePerson} />}
          {inApp && route === "settings" && (
            <SettingsPage
              data={state.data}
              names={names}
              today={today}
              currentPerson={person}
              colorScheme={state.device.colorScheme ?? DEFAULT_COLOR_SCHEME}
              onSubmit={saveNamesAndPerson}
              onColorScheme={saveColorScheme}
              onImport={sharedStorage === undefined ? saveData : importShared}
              shared={sharedStorage !== undefined}
              installWay={install.way}
              onInstall={install.install}
              {...(session
                ? {
                    account: {
                      email: session.email,
                      onSignOut: signOut,
                      ...(sharedStorage === undefined
                        ? {}
                        : { onCheckPending: pendingBeforeSignOut }),
                    },
                  }
                : {})}
              {...(householdApi && joined
                ? {
                    household: {
                      info: joined,
                      onCreateInvite: () => householdApi.createInvite(),
                    },
                  }
                : {})}
              {...(sharedStorage === undefined
                ? {}
                : { sync: { status: syncStatus, rejected: rejectedCount } })}
            />
          )}
          {inApp && route === "tasks" && (
            <TasksPage
              tasks={state.data.tasks}
              completions={state.data.completions}
              names={names}
              notice={notice}
              onDelete={removeTask}
              onLeave={() => setNotice(undefined)}
            />
          )}
          {inApp && route === "taskNew" && (
            <TaskFormPage
              completions={state.data.completions}
              names={names}
              currentPerson={person}
              onSave={saveTask}
              onDelete={removeTask}
            />
          )}
          {inApp && route === "taskEdit" && (
            <TaskFormPage
              {...editedTask(state.data.tasks, taskId)}
              completions={state.data.completions}
              names={names}
              currentPerson={person}
              onSave={saveTask}
              onDelete={removeTask}
            />
          )}
          {inApp && route === "today" && (
            <TodayPage
              tasks={state.data.tasks}
              completions={state.data.completions}
              names={names}
              currentPerson={person}
              today={today}
              onComplete={completeTask}
              onUndo={undoCompletion}
              onTakeOver={takeOverTask}
              onChecklistItem={setChecklistItem}
            />
          )}
          {inApp && route === "statistics" && (
            <StatisticsPage
              tasks={state.data.tasks}
              completions={state.data.completions}
              names={names}
              today={today}
            />
          )}
          {inApp && route === "week" && (
            <WeekPage
              tasks={state.data.tasks}
              completions={state.data.completions}
              names={names}
              currentPerson={person}
              today={today}
              onComplete={completeTask}
              onUndo={undoCompletion}
              onTakeOver={takeOverTask}
              onChecklistItem={setChecklistItem}
            />
          )}
          {/* Below the tiles: seen when looking for it, never in the way (N3). */}
          {inApp &&
            route === "week" &&
            !state.device.installHintDismissed &&
            offersInstallHint(install.way) && (
              <InstallHint
                way={install.way}
                onInstall={() => void installFromHint()}
                onDismiss={() => void dismissInstallHint()}
              />
            )}
          {inApp && route === "done" && (
            <DonePage
              tasks={state.data.tasks}
              completions={state.data.completions}
              names={names}
              onUndo={undoCompletion}
            />
          )}
        </main>
      </div>
    </div>
  );
}
