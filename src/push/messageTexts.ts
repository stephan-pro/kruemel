// The texts of the messages the service worker shows (NT-a). In a file of their own, used only by
// the worker: a file the page uses too would become a shared chunk, and a service worker cannot
// import one (the build refuses that, see `serviceWorker()` in vite.config.ts). The texts of the
// tile are in `src/ui/notificationTexts.ts`. The messages never name a task or anything else of
// the household (lock screen): the daily overview (NT-c) says only numbers, the messages about the
// other person and about joining (NT-d) only their name in the household and numbers.

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
  /**
   * The other person (`name`, else "Die andere Person") did `done` tasks for the person and took
   * over `took` from them (NT-d, at least one of the two).
   */
  partner: (name: string | undefined, done: number, took: number): string => {
    const who = name ?? "Die andere Person";
    const one = (count: number) => (isOne(count) ? "eine" : String(count));
    if (took === 0) {
      return `${who} hat ${isOne(done) ? "eine Aufgabe" : tasks(done)} für dich erledigt.`;
    }
    if (done === 0) {
      return `${who} hat ${isOne(took) ? "eine Aufgabe" : tasks(took)} von dir übernommen.`;
    }
    const doneTasks = isOne(done) ? "eine Aufgabe" : tasks(done);
    return `${who} hat ${doneTasks} für dich erledigt und ${one(took)} übernommen.`;
  },
  /** Somebody joined the household (NT-d). */
  joined: (name: string | undefined): string =>
    name === undefined
      ? "Jemand ist jetzt in deinem Haushalt dabei."
      : `${name} ist jetzt im Haushalt dabei.`,
  /** For a push the device cannot read: a message must always come, or browsers withdraw it. */
  fallback: "Neues in Krümel.",
} as const;
