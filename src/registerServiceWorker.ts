/**
 * Installs the service worker (`sw.ts`) once the page has loaded, so it never competes with the
 * first drawing. Only in the real build: the development server and the demo have none. If the
 * browser refuses (private window, old browser) the app simply works online as before.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || import.meta.env.MODE === "demo" || !("serviceWorker" in navigator)) {
    return;
  }
  const register = () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
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
