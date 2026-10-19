// The four main pages and their addresses (hash router: "#/woche" …). Pure functions; the page
// itself listens to `hashchange`.

export type Route = "week" | "tasks" | "done" | "settings";

interface RouteInfo {
  readonly route: Route;
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

/** The week view is the start page, also for an empty or unknown address. */
export const DEFAULT_ROUTE: Route = "week";

export function routeInfo(route: Route): RouteInfo {
  return ROUTES.find((info) => info.route === route) ?? (ROUTES[0] as RouteInfo);
}

/** Reads `location.hash` (e.g. "#/aufgaben"). */
export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, "");
  return ROUTES.find((info) => info.path === path)?.route ?? DEFAULT_ROUTE;
}

/** The link target for a page, e.g. "#/aufgaben". */
export function routeHash(route: Route): string {
  return `#/${routeInfo(route).path}`;
}
