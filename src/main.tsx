// Archivo from the app's own files (no request to Google Fonts, see DESIGN.md section 4).
import "@fontsource-variable/archivo/wght.css";
import "./ui/tokens.css";
import "./ui/app.css";
import { type ComponentChild, render } from "preact";
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
const container: HTMLElement = root;

/** Draws the app in place of the loading picture of index.html. */
function show(app: ComponentChild): void {
  container.replaceChildren();
  render(app, container);
}

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
  show(<App storage={storage} demo={demo} />);
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
    const { FakeHttpPushApi, fakeVapidPublicKey } = await import("./push/fakeHttpPushApi");
    const { Notifications } = await import("./push/notifications");
    const { browserPushPort } = await import("./push/browserPush");
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
    // Notifications against the fake server; the tests mock the browser's Push API.
    const push = {
      create: (userId: string) =>
        new Notifications({
          port: browserPushPort(),
          api: new FakeHttpPushApi({ baseUrl: __FAKE_SERVER__, store }),
          store,
          publicKey: fakeVapidPublicKey(store),
          userId,
        }),
      testOnly: true,
    };
    show(<App storage={local} auth={auth} household={household} shared={shared} push={push} />);
  } else {
    const storage = createFakeBackendStorage(store, createLocalStorage({ store }));
    show(<App storage={storage} />);
    storage.start();
  }
} else if (__BACKEND__ === "supabase") {
  // Sign-in, household and the household's shared data against the real project (E2-3b). The
  // local storage only keeps the device settings; the data of stage 1 stay untouched (E2-3d).
  // All at once: one after the other, each file would wait for the one before.
  const [
    { createSupabaseClient },
    { SupabaseAuth },
    { SupabaseHousehold },
    { SupabaseRemote },
    { createBrowserSharedStorage },
    { SupabasePushApi },
    { Notifications },
    { browserPushPort },
  ] = await Promise.all([
    import("./auth/supabaseClient"),
    import("./auth/supabaseAuth"),
    import("./auth/supabaseHousehold"),
    import("./sync/supabaseRemote"),
    import("./sync/browserShared"),
    import("./push/supabasePushApi"),
    import("./push/notifications"),
    import("./push/browserPush"),
  ]);
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
  // Notifications (NT-a); the public key is a repository variable read at build time. Without it
  // the tile says "noch nicht eingerichtet".
  const push = {
    create: (userId: string) =>
      new Notifications({
        port: browserPushPort(),
        api: new SupabasePushApi(client),
        store,
        publicKey: import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "",
        userId,
      }),
  };
  show(<App storage={local} auth={auth} household={household} shared={shared} push={push} />);
  registerServiceWorker();
} else {
  show(<App storage={createLocalStorage({ store })} />);
  registerServiceWorker();
}
