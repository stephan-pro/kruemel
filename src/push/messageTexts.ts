// The texts of the messages the service worker shows (NT-a). In a file of their own, used only by
// the worker: a file the page uses too would become a shared chunk, and a service worker cannot
// import one (the build refuses that, see `serviceWorker()` in vite.config.ts). The texts of the
// tile are in `src/ui/notificationTexts.ts`. The messages never name a task or anything else of
// the household (lock screen): the daily overview (NT-c) says only numbers.

const plural = new Intl.PluralRules("de");

const isOne = (count: number) => plural.select(count) === "one";

/** "1 Aufgabe", "3 Aufgaben". */
function tasks(count: number): string {
  return `${count} ${isOne(count) ? "Aufgabe" : "Aufgaben"}`;
}

export const PUSH_MESSAGE_TEXTS = {
  /** Always the title. */
  title: "Krümel",
  test: "Testbenachrichtigung von Krümel",
  /**
   * The daily overview: `due` tasks for the person today or earlier, `overdue` of them before
   * today (0 ≤ overdue ≤ due, due ≥ 1).
   */
  daily: (due: number, overdue: number): string => {
    if (overdue === 0) {
      return `Heute ${tasks(due)} für dich.`;
    }
    if (overdue === due) {
      return `${due} überfällige ${isOne(due) ? "Aufgabe wartet" : "Aufgaben warten"} auf dich.`;
    }
    return `Heute ${tasks(due)} für dich, davon ${overdue} überfällig.`;
  },
  /** For a push the device cannot read: a message must always come, or browsers withdraw it. */
  fallback: "Neues in Krümel.",
} as const;
