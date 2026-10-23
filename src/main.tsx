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
  // The end-to-end tests (build mode `e2e`), no service worker. `__BACKEND__` is fixed at build
  // time, so none of this is in the real app. With a test session (`kruemel-fake:session`): the
  // shared storage against the fake server, without sign-in. Without one: as in the mode
  // `supabase`, sign-in, household and the household's shared data against the fake server.
  const { createFakeBackendStorage, FAKE_SESSION_KEY } = await import("./sync/browserFake");
  if (store.getItem(FAKE_SESSION_KEY) === null) {
    const { FakeHttpAuth, fakeAuthToken } = await import("./auth/fakeHttpAuth");
    const { FakeHttpHousehold } = await import("./auth/fakeHttpHousehold");
    const { createFakeHttpRemote } = await import("./sync/fakeHttpRemote");
    const { createBrowserSharedStorage } = await import("./sync/browserShared");
    const auth = new FakeHttpAuth({ baseUrl: __FAKE_SERVER__, store });
    const household = new FakeHttpHousehold({ baseUrl: __FAKE_SERVER__, store });
    const local = createLocalStorage({ store });
    const shared = (account: { householdId: string; userId: string }) =>
      createBrowserSharedStorage(
        createFakeHttpRemote({ baseUrl: __FAKE_SERVER__, token: fakeAuthToken(store) ?? "" }),
        store,
        local,
        account,
      );
    render(<App storage={local} auth={auth} household={household} shared={shared} />, root);
  } else {
    const storage = createFakeBackendStorage(store, createLocalStorage({ store }));
    render(<App storage={storage} />, root);
    storage.start();
  }
} else if (__BACKEND__ === "supabase") {
  // Sign-in, household and the household's shared data against the real project (E2-3b). The
  // local storage only keeps the device settings; the data of stage 1 stay untouched (E2-3d).
  const { createSupabaseClient } = await import("./auth/supabaseClient");
  const { SupabaseAuth } = await import("./auth/supabaseAuth");
  const { SupabaseHousehold } = await import("./auth/supabaseHousehold");
  const { SupabaseRemote } = await import("./sync/supabaseRemote");
  const { createBrowserSharedStorage } = await import("./sync/browserShared");
  const client = createSupabaseClient({
    url: import.meta.env.VITE_SUPABASE_URL ?? "",
    publishableKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
    store,
  });
  const auth = new SupabaseAuth({ client, store });
  const household = new SupabaseHousehold(client);
  const local = createLocalStorage({ store });
  const shared = (account: { householdId: string; userId: string }) =>
    createBrowserSharedStorage(new SupabaseRemote(client), store, local, account);
  render(<App storage={local} auth={auth} household={household} shared={shared} />, root);
  registerServiceWorker();
} else {
  render(<App storage={createLocalStorage({ store })} />, root);
  registerServiceWorker();
}
