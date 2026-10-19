// The pages and their addresses (hash router: "#/woche" …). Pure functions; the page itself
// listens to `hashchange`.

/** The four pages in the navigation. */
export type MainRoute = "week" | "tasks" | "done" | "settings";

/** The main pages plus the two task forms, which belong to "Aufgaben". */
export type Route = MainRoute | "taskNew" | "taskEdit";

interface RouteInfo<R extends Route = MainRoute> {
  readonly route: R;
  /** Part after "#/". */
  readonly path: string;
  /** Short text in the navigation. */
  readonly label: string;
  /** Page heading and, with the app name, the title of the browser tab. */
  readonly title: string;
}

export const ROUTES: readonly RouteInfo[] = [
  { route: "week", path: "woche", label: "Woche", title: "Wochenübersicht" },
  { route: "tasks", path: "aufgaben", label: "Aufgaben", title: "Aufgaben" },
  { route: "done", path: "erledigt", label: "Erledigt", title: "Erledigt" },
  { route: "settings", path: "einstellungen", label: "Einstellungen", title: "Einstellungen" },
];

const NEW_TASK_PATH = "aufgaben/neu";
const EDIT_TASK_PREFIX = "aufgaben/bearbeiten/";

const TASK_FORM_TITLES = { taskNew: "Neue Aufgabe", taskEdit: "Aufgabe bearbeiten" } as const;

/** The week view is the start page, also for an empty or unknown address. */
export const DEFAULT_ROUTE: MainRoute = "week";

/** Where the browser is: the page and, for the edit form, the task it is about. */
export interface PageLocation {
  readonly route: Route;
  readonly taskId?: string;
}

export function routeInfo(route: Route): { readonly title: string } {
  if (route === "taskNew" || route === "taskEdit") {
    return { title: TASK_FORM_TITLES[route] };
  }
  return ROUTES.find((info) => info.route === route) ?? (ROUTES[0] as RouteInfo);
}

/** The navigation entry a page belongs to; the task forms belong to "Aufgaben". */
export function navigationRoute(route: Route): MainRoute {
  return route === "taskNew" || route === "taskEdit" ? "tasks" : route;
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

/** The link target for a main page, e.g. "#/aufgaben". */
export function routeHash(route: MainRoute): string {
  const info = ROUTES.find((candidate) => candidate.route === route) as RouteInfo;
  return `#/${info.path}`;
}

/** The link target of the form for a new task. */
export function newTaskHash(): string {
  return `#/${NEW_TASK_PATH}`;
}

/** The link target of the form for changing a task. */
export function editTaskHash(taskId: string): string {
  return `#/${EDIT_TASK_PREFIX}${encodeURIComponent(taskId)}`;
}
