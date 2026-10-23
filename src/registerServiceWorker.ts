/** Who wants to hear that a new version of the app has taken over (the hint "Neu laden"). */
const newVersionListeners = new Set<() => void>();
let newVersionReady = false;

/**
 * Calls `listener` once a new version of the app is installed while this page still runs the old
 * one (also right away if that already happened). Returns the function that stops listening.
 */
export function onNewVersion(listener: () => void): () => void {
  newVersionListeners.add(listener);
  if (newVersionReady) {
    listener();
  }
  return () => newVersionListeners.delete(listener);
}

function announceNewVersion(): void {
  newVersionReady = true;
  for (const listener of [...newVersionListeners]) {
    listener();
  }
}

/**
 * Installs the service worker (`sw.ts`) once the page has loaded, so it never competes with the
 * first drawing. Only in the real build: the development server and the demo have none. If the
 * browser refuses (private window, old browser) the app simply works online as before.
 *
 * The worker serves the page from the device (fast start). A new build is found when the browser
 * checks `sw.js` (each start, and here whenever the app comes back to the screen); once the new
 * worker has taken over, the page offers to reload. On the very first visit there is no old
 * worker, so nothing is offered.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || import.meta.env.MODE === "demo" || !("serviceWorker" in navigator)) {
    return;
  }
  const container = navigator.serviceWorker;
  const hadWorker = container.controller !== null;
  container.addEventListener("controllerchange", () => {
    if (hadWorker) {
      announceNewVersion();
    }
  });
  const register = () => {
    container
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .then((registration) => {
        // An installed app often comes back from the background without a new start.
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") {
            registration.update().catch(() => undefined);
          }
        });
      })
      .catch(() => {
        // No offline use, nothing else lost.
      });
  };
  if (document.readyState === "complete") {
    register();
  } else {
    addEventListener("load", register);
  }
}
