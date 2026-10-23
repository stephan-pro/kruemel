import { useEffect, useRef, useState } from "preact/hooks";
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
import { requestPersistentStorage } from "../storage/localStorage";
import {
  type AppStorage,
  type ColorScheme,
  DEFAULT_COLOR_SCHEME,
  type DeviceSettings,
  StorageError,
} from "../storage/storage";
import { ACCOUNT_TEXTS } from "./accountTexts";
import { applyColorScheme } from "./colorScheme";
import { InstallHint } from "./components/InstallHint";
import { Navigation } from "./components/Navigation";
import { APP_NAME } from "./components/PageTitle";
import { pendingInvite, rememberInvite } from "./householdMemory";
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
  readonly storage: AppStorage;
  /** Only set in demo mode (`npm run demo`). */
  readonly demo?: DemoInfo;
  /** Sign-in (stage 2): with it the app opens only for a signed-in person. */
  readonly auth?: Auth;
  /** The household (stage 2, with `auth`): the app opens only for a person who has one. */
  readonly household?: HouseholdApi;
}

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

export function App({ storage, demo, auth, household: householdApi }: AppProps) {
  const [session, setSession] = useSession(auth);
  const [invite, setInvite] = useState(() => takeInvite(householdApi !== undefined));
  const household = useHousehold(householdApi, session?.userId);
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

  async function load() {
    setState({ status: "loading" });
    const loaded = await loadState(storage);
    if (loaded.status === "ready") {
      // Usually already done by the script in index.html; this keeps both in step.
      applyColorScheme(loaded.device.colorScheme ?? DEFAULT_COLOR_SCHEME);
    }
    setState(loaded);
  }

  useEffect(() => {
    void load();
  }, []);

  // Data that arrive from the other device (shared storage): show them without a reload. The
  // sync state and conflicts are shown from E2-3 on.
  useEffect(
    () =>
      storage.subscribe((update) => {
        if (update.type === "data") {
          setState((current) =>
            current.status === "ready" ? { ...current, data: update.data } : current,
          );
        }
      }),
    [storage],
  );

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
    const saved = await storage.save(data);
    await storage.saveDevice(device);
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
    await storage.saveDevice(device);
    applyColorScheme(colorScheme);
    showDevice(device);
  }

  async function savePerson(person: Person) {
    const state = latest.current;
    if (state.status !== "ready") {
      return;
    }
    const device: DeviceSettings = { ...state.device, currentPerson: person };
    await storage.saveDevice(device);
    showDevice(device);
  }

  /** Keeps the new data. Nothing changes on screen if saving fails; the caller shows the error. */
  async function saveData(data: AppData) {
    if (latest.current.status !== "ready") {
      return;
    }
    const saved = await storage.save(data);
    setState((current) => (current.status === "ready" ? { ...current, data: saved } : current));
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
      await storage.saveDevice(device);
    } catch {
      // Closed for now; it shows again after the next start. Not worth an error message.
    }
  }

  /** The browser's install question from the hint; the hint is gone afterwards either way. */
  async function installFromHint() {
    await install.install();
    focusPageHeading();
  }

  async function discard() {
    await storage.discard();
    await load();
  }

  /** "Abmelden": ends the session on this device; the data stay (until E2-3 they are local). */
  async function signOut() {
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

  const joined = household.state.status === "ready" ? household.state.household : null;

  // A device without names (a new phone, the invited person): it takes the household's names and
  // "Ich bin" from the role instead of asking for them in the first-time setup. Devices that
  // already have data keep them (the shared storage of E2-3 decides about those).
  const [adoptFailed, setAdoptFailed] = useState(false);
  const adopting =
    householdApi !== undefined &&
    joined?.names != null &&
    state.status === "ready" &&
    state.data.settings.personNames === undefined &&
    !adoptFailed;
  useEffect(() => {
    if (adopting && joined?.names) {
      saveNamesAndPerson(joined.names, joined.me).catch(() => setAdoptFailed(true));
    }
  }, [adopting]);

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
                    : adopting
                      ? "waiting"
                      : "open";
  // With a household the role decides who "Ich bin" is, and its names win over those kept on the
  // device (until E2-3b they live in the local data and could drift apart). The local values stay
  // untouched: a device with data from stage 1 still knows its old "Ich bin" for E2-3d.
  const member = householdApi === undefined ? null : joined;
  const names =
    member?.names ?? (state.status === "ready" ? state.data.settings.personNames : undefined);
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
          {gate === "open" && state.status === "problem" && (
            <StorageProblemPage
              message={state.message}
              details={state.details}
              rawData={state.rawData}
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
              onImport={saveData}
              installWay={install.way}
              onInstall={install.install}
              {...(session ? { account: { email: session.email, onSignOut: signOut } } : {})}
              {...(householdApi && joined
                ? {
                    household: {
                      info: joined,
                      onCreateInvite: () => householdApi.createInvite(),
                    },
                  }
                : {})}
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
