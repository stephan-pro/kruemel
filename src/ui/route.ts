// The pages and their addresses (hash router: "#/woche" …). Pure functions; the page itself
// listens to `hashchange`.

import { t } from "../i18n";

/** The pages in the navigation (the plus for a new task is a link to a form, not a page). */
export type MainRoute = "today" | "week" | "statistics" | "settings";

/** Pages reached from "Woche" and the settings, not from the navigation. */
export type SubRoute = "tasks" | "done";

/** Pages that open without signing in (E2-5c): Impressum and Datenschutzerklärung. */
export type LegalRoute = "imprint" | "privacy";

/** The pages below "Einstellungen" (UX-a): one per group of the overview. */
export type SettingsRoute =
  | "settingsAccount"
  | "settingsNotifications"
  | "settingsAppearance"
  | "settingsData"
  | "settingsLegal";

/** Every page with a list entry in `ROUTES`. */
export type ListedRoute = MainRoute | SubRoute | LegalRoute | SettingsRoute;

/** The listed pages plus the two task forms, which belong to "Aufgaben". */
export type Route = ListedRoute | "taskNew" | "taskEdit";

interface RouteInfo<R extends ListedRoute = ListedRoute> {
  readonly route: R;
  /**
   * Part after "#/". The addresses are German in every language, so a link keeps working when the
   * language changes. The names of the pages are in the language files (`routes`).
   */
  readonly path: string;
}

export const ROUTES: readonly RouteInfo[] = [
  { route: "today", path: "heute" },
  { route: "week", path: "woche" },
  { route: "tasks", path: "aufgaben" },
  { route: "done", path: "erledigt" },
  { route: "statistics", path: "statistik" },
  { route: "settings", path: "einstellungen" },
  { route: "settingsAccount", path: "einstellungen/konto" },
  { route: "settingsNotifications", path: "einstellungen/benachrichtigungen" },
  { route: "settingsAppearance", path: "einstellungen/darstellung" },
  { route: "settingsData", path: "einstellungen/daten" },
  { route: "settingsLegal", path: "einstellungen/rechtliches" },
  { route: "imprint", path: "impressum" },
  { route: "privacy", path: "datenschutz" },
];

/** Whether the page shows without signing in and before anything else (E2-5c). */
export function isLegalRoute(route: Route): route is LegalRoute {
  return route === "imprint" || route === "privacy";
}

/** The group pages of the settings, in the order of the overview. */
export const SETTINGS_GROUPS: readonly SettingsRoute[] = [
  "settingsAccount",
  "settingsNotifications",
  "settingsAppearance",
  "settingsData",
  "settingsLegal",
];

export function isSettingsGroup(route: Route): route is SettingsRoute {
  return (SETTINGS_GROUPS as readonly Route[]).includes(route);
}

/** The entries of the navigation, in this order (the plus for a new task sits after "Woche"). */
export const NAVIGATION: readonly MainRoute[] = ["today", "week", "statistics", "settings"];

const NEW_TASK_PATH = "aufgaben/neu";
const EDIT_TASK_PREFIX = "aufgaben/bearbeiten/";

/** "Heute" is the start page, also for an empty or unknown address. */
export const DEFAULT_ROUTE: MainRoute = "today";

/** Where the browser is: the page and, for the edit form, the task it is about. */
export interface PageLocation {
  readonly route: Route;
  readonly taskId?: string;
}

/** The page heading and, with the app name, the title of the browser tab, in the chosen language. */
export function routeInfo(route: Route): { readonly title: string } {
  return { title: t().routes[route].title };
}

/** The text of an entry in the navigation, in the chosen language. */
export function routeLabel(route: MainRoute): string {
  return t().routes[route].label;
}

/**
 * The navigation entry a page belongs to; the list pages and task forms belong to "Woche", the
 * legal pages and the groups of the settings to "Einstellungen".
 */
export function navigationRoute(route: Route): MainRoute {
  if (isLegalRoute(route) || isSettingsGroup(route)) {
    return "settings";
  }
  return route === "tasks" || route === "done" || route === "taskNew" || route === "taskEdit"
    ? "week"
    : route;
}

/** Reads `location.hash` (e.g. "#/aufgaben" or "#/aufgaben/bearbeiten/abc"). */
export function parseLocation(hash: string): PageLocation {
  const path = hash.replace(/^#\/?/, "");
  if (path === NEW_TASK_PATH) {
    return { route: "taskNew" };
  }
  if (path.startsWith(EDIT_TASK_PREFIX)) {
    try {
      const taskId = decodeURIComponent(path.slice(EDIT_TASK_PREFIX.length));
      if (taskId !== "") {
        return { route: "taskEdit", taskId };
      }
    } catch {
      // A malformed address ("%E0%A4%A"): treated like any unknown address.
    }
    return { route: DEFAULT_ROUTE };
  }
  return { route: ROUTES.find((info) => info.path === path)?.route ?? DEFAULT_ROUTE };
}

export function parseRoute(hash: string): Route {
  return parseLocation(hash).route;
}

/** The link target for a listed page, e.g. "#/aufgaben". */
export function routeHash(route: ListedRoute): string {
  const info = ROUTES.find((candidate) => candidate.route === route) as RouteInfo;
  return `#/${info.path}`;
}

/** The link target of the form for a new task. */
export function newTaskHash(): string {
  return `#/${NEW_TASK_PATH}`;
}

const INVITE_PREFIX = "#/einladung/";

/** An invite token as the database and the fake server make them (letters, digits, - and _). */
const TOKEN = "[A-Za-z0-9_-]{16,}";

/** The part of an invite link after the app's address, e.g. "#/einladung/abc…". */
export function inviteHash(token: string): string {
  return `${INVITE_PREFIX}${token}`;
}

/**
 * The token of an invite: from the whole link as pasted from a message (also with text around
 * it), from the address part alone, or the token by itself. `undefined` for anything else.
 */
export function inviteTokenFrom(text: string): string | undefined {
  const inLink = new RegExp(`${INVITE_PREFIX}(${TOKEN})`).exec(text);
  if (inLink !== null) {
    return inLink[1];
  }
  const alone = text.trim();
  return new RegExp(`^${TOKEN}$`).test(alone) ? alone : undefined;
}

const FRIEND_INVITE_PREFIX = "#/freunde/";

/** The part of a friend invite link (E2-5b) after the app's address, e.g. "#/freunde/abc…". */
export function friendInviteHash(token: string): string {
  return `${FRIEND_INVITE_PREFIX}${token}`;
}

/** The token of a friend invite link in an address; `undefined` for anything else. */
export function friendInviteTokenFrom(text: string): string | undefined {
  return new RegExp(`${FRIEND_INVITE_PREFIX}(${TOKEN})`).exec(text)?.[1];
}

/** The link target of the form for changing a task. */
export function editTaskHash(taskId: string): string {
  return `#/${EDIT_TASK_PREFIX}${encodeURIComponent(taskId)}`;
}
