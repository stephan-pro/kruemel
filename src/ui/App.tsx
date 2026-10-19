import { useEffect, useState } from "preact/hooks";
import type { DemoInfo } from "../demo/start";
import type { PersonNameInput } from "../domain/personNames";
import type { Person } from "../domain/task";
import type { AppData } from "../storage/appData";
import { requestPersistentStorage } from "../storage/localStorage";
import { type AppStorage, type DeviceSettings, StorageError } from "../storage/storage";
import { Navigation } from "./components/Navigation";
import { APP_NAME } from "./components/PageTitle";
import { PlaceholderPage } from "./pages/PlaceholderPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SetupPage } from "./pages/SetupPage";
import { StorageProblemPage } from "./pages/StorageProblemPage";
import { WhoAmIPage } from "./pages/WhoAmIPage";
import { parseRoute, type Route } from "./route";

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

function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const update = () => setRoute(parseRoute(location.hash));
    addEventListener("hashchange", update);
    return () => removeEventListener("hashchange", update);
  }, []);
  return route;
}

export function App({ storage, demo }: AppProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const route = useRoute();

  async function load() {
    setState({ status: "loading" });
    setState(await loadState(storage));
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

  async function savePerson(person: Person) {
    if (state.status !== "ready") {
      return;
    }
    const device: DeviceSettings = { ...state.device, currentPerson: person };
    await storage.saveDevice(device);
    setState({ ...state, device });
  }

  async function discard() {
    await storage.discard();
    await load();
  }

  const names = state.status === "ready" ? state.data.settings.personNames : undefined;
  const person = state.status === "ready" ? state.device.currentPerson : undefined;
  const inApp = state.status === "ready" && names !== undefined && person !== undefined;

  return (
    <div class="app">
      {/* A button, not a "#inhalt" link: that would change the hash and with it the page. */}
      <button
        class="skip-link"
        type="button"
        onClick={() => document.getElementById("inhalt")?.focus()}
      >
        Zum Inhalt springen
      </button>
      {demo && (
        <aside class="kern-alert kern-alert--info demo-hint" aria-label="Hinweis zum Demo-Modus">
          <div class="kern-alert__body">
            <p class="kern-body">
              Demo-Modus: {demo.taskCount} Beispielaufgaben und {demo.completionCount} Erledigungen
              liegen im Demo-Speicher dieses Browsers. Echte Daten bleiben unberührt.{" "}
              <a class="kern-link" href="?demo=neu">
                Beispieldaten neu laden
              </a>
            </p>
          </div>
        </aside>
      )}
      <header class="app-header">
        <p class="app-name">{APP_NAME}</p>
        {inApp && (
          <p class="app-person kern-body kern-body--small">
            Ich bin: <strong>{names[person]}</strong>
          </p>
        )}
        {inApp && <Navigation current={route} />}
      </header>
      <main id="inhalt" tabIndex={-1}>
        {state.status === "loading" && (
          <p class="kern-body" role="status">
            Wird geladen …
          </p>
        )}
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
          <SettingsPage names={names} currentPerson={person} onSubmit={saveNamesAndPerson} />
        )}
        {inApp && route !== "settings" && <PlaceholderPage route={route} />}
      </main>
    </div>
  );
}
