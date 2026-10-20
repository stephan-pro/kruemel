// Archivo from the app's own files (no request to Google Fonts, see DESIGN.md section 4).
import "@fontsource-variable/archivo/wght.css";
import "./ui/tokens.css";
import "./ui/app.css";
import { render } from "preact";
import { registerServiceWorker } from "./registerServiceWorker";
import { createLocalStorage, type KeyValueStore } from "./storage/localStorage";
import { App } from "./ui/App";
import { watchInstallPrompt } from "./ui/install";

/**
 * The browser's storage. With blocked site data even reading `localStorage` throws; the app then
 * gets a store that reports this on first use, so the page can explain it.
 */
function browserStore(): KeyValueStore {
  try {
    return localStorage;
  } catch (error) {
    const blocked = (): never => {
      throw error;
    };
    return { getItem: blocked, setItem: blocked, removeItem: blocked };
  }
}

// Before anything else: the browser may offer to install right after loading (App installieren).
watchInstallPrompt();

const root = document.getElementById("app");
if (!root) {
  throw new Error("Element #app fehlt in index.html");
}

const store = browserStore();

// `npm run demo` builds in mode "demo". Vite replaces the condition at build time, so the demo
// code is not part of the real app.
if (import.meta.env.MODE === "demo") {
  const { startDemo } = await import("./demo/start");
  const { DEMO_NAMESPACE } = await import("./demo/demoData");
  const demo = await startDemo(store, location.search);
  if (demo.wasReset) {
    // Otherwise every reload would reset the data again.
    history.replaceState(null, "", location.pathname);
  }
  const storage = createLocalStorage({ store, namespace: DEMO_NAMESPACE });
  render(<App storage={storage} demo={demo} />, root);
} else if (__BACKEND__ === "fake") {
  // The end-to-end tests: shared storage against the fake server (build mode `e2e`), no service
  // worker. `__BACKEND__` is fixed at build time, so none of this is in the real app.
  const { createFakeBackendStorage } = await import("./sync/browserFake");
  const storage = createFakeBackendStorage(store, createLocalStorage({ store }));
  render(<App storage={storage} />, root);
  storage.start();
} else if (__BACKEND__ === "supabase") {
  throw new Error("Der Modus supabase ist noch nicht umgesetzt (kommt mit E2-1 bis E2-3).");
} else {
  render(<App storage={createLocalStorage({ store })} />, root);
  registerServiceWorker();
}
