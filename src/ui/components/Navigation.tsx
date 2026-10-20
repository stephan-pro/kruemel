import { Calendar, ChartNoAxesColumn, House, type LucideIcon, Plus, Settings } from "lucide-preact";
import {
  type MainRoute,
  NAVIGATION,
  navigationRoute,
  newTaskHash,
  type Route,
  routeHash,
  routeLabel,
} from "../route";

const ICONS: Record<MainRoute, LucideIcon> = {
  today: House,
  week: Calendar,
  statistics: ChartNoAxesColumn,
  settings: Settings,
};

interface NavigationProps {
  readonly current: Route;
}

/**
 * Heute · Woche · [Plus] · Statistik · Einstellungen (DESIGN.md section 7): a floating bar on
 * phones, where only the current page shows its name (the others keep it for screen readers), and
 * a column on the left on wide screens. The plus opens the form for a new task.
 */
export function Navigation({ current }: NavigationProps) {
  const section = navigationRoute(current);
  const item = (route: MainRoute) => {
    const Icon = ICONS[route];
    return (
      <li key={route}>
        {/* A page below a section (the task list, a form) leaves that link "true", not "page". */}
        <a
          class="main-nav__link"
          href={routeHash(route)}
          aria-current={route === current ? "page" : route === section ? "true" : undefined}
        >
          <Icon class="main-nav__icon" size={22} aria-hidden="true" />
          <span class="main-nav__label">{routeLabel(route)}</span>
        </a>
      </li>
    );
  };
  const [first, second, ...rest] = NAVIGATION;
  return (
    <nav aria-label="Hauptnavigation" class="main-nav">
      <ul class="main-nav__list">
        {item(first as MainRoute)}
        {item(second as MainRoute)}
        <li key="new">
          <a
            class="main-nav__link main-nav__plus"
            href={newTaskHash()}
            aria-current={current === "taskNew" ? "page" : undefined}
          >
            <Plus class="main-nav__icon" size={24} strokeWidth={2.6} aria-hidden="true" />
            <span class="main-nav__label">Neue Aufgabe</span>
          </a>
        </li>
        {rest.map(item)}
      </ul>
    </nav>
  );
}
