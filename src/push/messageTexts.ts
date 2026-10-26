// The texts of the messages the service worker shows (NT-a, EN-c), in German and English. In a file
// of their own, used only by the worker: a file the page uses too would become a shared chunk, and
// a service worker cannot import one (the build refuses that, see `serviceWorker()` in
// vite.config.ts), so these texts do not come from `src/i18n/`. The texts of the tile are in
// `src/i18n/` (`notifications`). Which language a message is in, the payload says (`l`): the server
// knows it per device (`push_devices.locale`); without `l` the message is German. The messages never
// name a task or anything else of the household (lock screen): the daily overview (NT-c) says only
// numbers, the messages about the other person and about joining (NT-d) only their name in the
// household and numbers.

export type MessageLanguage = "de" | "en";

/** The texts of one language. */
export interface MessageTexts {
  /** Always the title. */
  readonly title: string;
  readonly test: string;
  /**
   * The daily overview: `due` tasks for the person today or earlier, `overdue` of them before
   * today (0 ≤ overdue ≤ due, due ≥ 1).
   */
  readonly daily: (due: number, overdue: number) => string;
  /**
   * The other person (`name`, else a general phrase) did `done` tasks for the person and took
   * over `took` from them (NT-d, at least one of the two).
   */
  readonly partner: (name: string | undefined, done: number, took: number) => string;
  /** Somebody joined the household (NT-d). */
  readonly joined: (name: string | undefined) => string;
  /** For a push the device cannot read: a message must always come, or browsers withdraw it. */
  readonly fallback: string;
}

/** The language a payload names: `l: "en"`, anything else German. */
export function messageLanguageOf(value: unknown): MessageLanguage {
  return value === "en" ? "en" : "de";
}

const germanPlural = new Intl.PluralRules("de");
const englishPlural = new Intl.PluralRules("en");

const isOneDe = (count: number) => germanPlural.select(count) === "one";
const isOneEn = (count: number) => englishPlural.select(count) === "one";

/** "1 Aufgabe", "3 Aufgaben". */
function tasksDe(count: number): string {
  return `${count} ${isOneDe(count) ? "Aufgabe" : "Aufgaben"}`;
}

/** "1 task", "3 tasks". */
function tasksEn(count: number): string {
  return `${count} ${isOneEn(count) ? "task" : "tasks"}`;
}

const de: MessageTexts = {
  title: "Krümel",
  test: "Testbenachrichtigung von Krümel",
  daily: (due, overdue) => {
    if (overdue === 0) {
      return `Heute ${tasksDe(due)} für dich.`;
    }
    if (overdue === due) {
      return `${due} überfällige ${isOneDe(due) ? "Aufgabe wartet" : "Aufgaben warten"} auf dich.`;
    }
    return `Heute ${tasksDe(due)} für dich, davon ${overdue} überfällig.`;
  },
  partner: (name, done, took) => {
    const who = name ?? "Die andere Person";
    const one = (count: number) => (isOneDe(count) ? "eine" : String(count));
    if (took === 0) {
      return `${who} hat ${isOneDe(done) ? "eine Aufgabe" : tasksDe(done)} für dich erledigt.`;
    }
    if (done === 0) {
      return `${who} hat ${isOneDe(took) ? "eine Aufgabe" : tasksDe(took)} von dir übernommen.`;
    }
    const doneTasks = isOneDe(done) ? "eine Aufgabe" : tasksDe(done);
    return `${who} hat ${doneTasks} für dich erledigt und ${one(took)} übernommen.`;
  },
  joined: (name) =>
    name === undefined
      ? "Jemand ist jetzt in deinem Haushalt dabei."
      : `${name} ist jetzt im Haushalt dabei.`,
  fallback: "Neues in Krümel.",
};

const en: MessageTexts = {
  title: "Krümel",
  test: "Test notification from Krümel",
  daily: (due, overdue) => {
    if (overdue === 0) {
      return `${tasksEn(due)} for you today.`;
    }
    if (overdue === due) {
      return `${due} overdue ${isOneEn(due) ? "task is" : "tasks are"} waiting for you.`;
    }
    return `${tasksEn(due)} for you today, ${overdue} of them overdue.`;
  },
  partner: (name, done, took) => {
    const who = name ?? "The other person";
    if (took === 0) {
      return `${who} did ${tasksEn(done)} for you.`;
    }
    if (done === 0) {
      return `${who} took over ${tasksEn(took)} from you.`;
    }
    return `${who} did ${tasksEn(done)} for you and took over ${took}.`;
  },
  joined: (name) =>
    name === undefined ? "Someone has joined your household." : `${name} has joined the household.`,
  fallback: "Something new in Krümel.",
};

const TEXTS: Readonly<Record<MessageLanguage, MessageTexts>> = { de, en };

/** The texts of a language. */
export function messageTextsFor(language: MessageLanguage): MessageTexts {
  return TEXTS[language];
}

/** The German texts (what a message without a named language says). */
export const PUSH_MESSAGE_TEXTS: MessageTexts = de;
