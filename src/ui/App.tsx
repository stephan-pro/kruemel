import { useEffect, useState } from "preact/hooks";
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
import type { AppData } from "../storage/appData";
import { requestPersistentStorage } from "../storage/localStorage";
import {
  type AppStorage,
  type ColorScheme,
  DEFAULT_COLOR_SCHEME,
  type DeviceSettings,
  StorageError,
} from "../storage/storage";
import { applyColorScheme } from "./colorScheme";
import { Navigation } from "./components/Navigation";
import { APP_NAME } from "./components/PageTitle";
import { DonePage } from "./pages/DonePage";
import { SettingsPage } from "./pages/SettingsPage";
import { SetupPage } from "./pages/SetupPage";
import { StorageProblemPage } from "./pages/StorageProblemPage";
import { TaskFormPage } from "./pages/TaskFormPage";
import { TasksPage } from "./pages/TasksPage";
import { WeekPage } from "./pages/WeekPage";
import { WhoAmIPage } from "./pages/WhoAmIPage";
import { type PageLocation, parseLocation, routeHash } from "./route";
import { useToday } from "./useToday";

interface AppProps {
  readonly storage: AppStorage;
  /** Only set in demo mode (`npm run demo`). */
  readonly demo?: DemoInfo;
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

function useLocation(): PageLocation {
  const [pageLocation, setPageLocation] = useState(() => parseLocation(location.hash));
  useEffect(() => {
    const update = () => setPageLocation(parseLocation(location.hash));
    addEventListener("hashchange", update);
    return () => removeEventListener("hashchange", update);
  }, []);
  return pageLocation;
}

export function App({ storage, demo }: AppProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  /** What just happened to a task; the task list shows and announces it, then forgets it. */
  const [notice, setNotice] = useState<string>();
  const { route, taskId } = useLocation();
  const today = useToday();

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

  /** Setup and settings: the names (stored with the data) and "Ich bin" (stored on the device). */
  async function saveNamesAndPerson(names: PersonNameInput, person: Person) {
    if (state.status !== "ready") {
      return;
    }
    const data: AppData = {
      ...state.data,
      settings: { ...state.data.settings, personNames: names },
    };
    const device: DeviceSettings = { ...state.device, currentPerson: person };
    await storage.save(data);
    await storage.saveDevice(device);
    setState({ status: "ready", data, device });
    void requestPersistentStorage();
  }

  /** "Darstellung" (N8): saved on the device, then shown. Nothing changes if saving fails. */
  async function saveColorScheme(colorScheme: ColorScheme) {
    if (state.status !== "ready") {
      return;
    }
    const device: DeviceSettings = { ...state.device, colorScheme };
    await storage.saveDevice(device);
    applyColorScheme(colorScheme);
    setState({ ...state, device });
  }

  async function savePerson(person: Person) {
    if (state.status !== "ready") {
      return;
    }
    const device: DeviceSettings = { ...state.device, currentPerson: person };
    await storage.saveDevice(device);
    setState({ ...state, device });
  }

  /** Keeps the new data. Nothing changes on screen if saving fails; the caller shows the error. */
  async function saveData(data: AppData) {
    if (state.status !== "ready") {
      return;
    }
    await storage.save(data);
    setState({ status: "ready", data, device: state.device });
  }

  /** Creates a task, or replaces `existing` by the changed one, then goes back to the list. */
  async function saveTask(kind: TaskKind, values: TaskFormValues, existing: Task | undefined) {
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
    const completedBy = state.status === "ready" ? state.device.currentPerson : undefined;
    if (state.status !== "ready" || completedBy === undefined) {
      throw new Error("Die App ist noch nicht bereit.");
    }
    const result = completeInData(state.data, taskId, {
      completionId: crypto.randomUUID(),
      completedOn: today,
      completedBy,
    });
    await saveData(result.data);
    return { task: result.task, completion: result.completion };
  }

  /** Takes back the last completion of a task; returns the task as it is then. */
  async function undoCompletion(completionId: string): Promise<Task> {
    if (state.status !== "ready") {
      throw new Error("Die App ist noch nicht bereit.");
    }
    const result = undoInData(state.data, completionId);
    await saveData(result.data);
    return result.task;
  }

  /** "Übernehmen": the person of this device takes the task over, once or permanently (F5). */
  async function takeOverTask(taskId: string, mode: TakeOverMode): Promise<Task> {
    const person = state.status === "ready" ? state.device.currentPerson : undefined;
    if (state.status !== "ready" || person === undefined) {
      throw new Error("Die App ist noch nicht bereit.");
    }
    const result = takeOverInData(state.data, taskId, person, mode);
    await saveData(result.data);
    return result.task;
  }

  /** Ticks or unticks one item of a task's checklist (F4). */
  async function setChecklistItem(taskId: string, itemId: string, checked: boolean): Promise<Task> {
    if (state.status !== "ready") {
      throw new Error("Die App ist noch nicht bereit.");
    }
    const result = setChecklistItemInData(state.data, taskId, itemId, checked);
    await saveData(result.data);
    return result.task;
  }

  async function discard() {
    await storage.discard();
    await load();
  }

  const names = state.status === "ready" ? state.data.settings.personNames : undefined;
  const person = state.status === "ready" ? state.device.currentPerson : undefined;
  const inApp = state.status === "ready" && names !== undefined && person !== undefined;

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
            Ich bin: <strong>{names[person]}</strong>
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
          {state.status === "loading" && <p role="status">Wird geladen …</p>}
          {state.status === "problem" && (
            <StorageProblemPage
              message={state.message}
              details={state.details}
              rawData={state.rawData}
              onDiscard={discard}
              onRetry={() => void load()}
            />
          )}
          {state.status === "ready" && names === undefined && (
            <SetupPage onSubmit={saveNamesAndPerson} />
          )}
          {state.status === "ready" && names !== undefined && person === undefined && (
            <WhoAmIPage names={names} onSubmit={savePerson} />
          )}
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
