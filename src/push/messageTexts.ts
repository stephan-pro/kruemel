// The texts of the messages the service worker shows (NT-a). In a file of their own, used only by
// the worker: a file the page uses too would become a shared chunk, and a service worker cannot
// import one (the build refuses that, see `serviceWorker()` in vite.config.ts). The texts of the
// tile are in `src/ui/notificationTexts.ts`. The messages never name a task or anything else of
// the household (lock screen).

export const PUSH_MESSAGE_TEXTS = {
  /** Always the title. */
  title: "Krümel",
  test: "Testbenachrichtigung von Krümel",
  /** For a push the device cannot read: a message must always come, or browsers withdraw it. */
  fallback: "Neues in Krümel.",
} as const;
