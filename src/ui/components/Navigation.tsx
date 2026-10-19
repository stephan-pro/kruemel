import { Calendar, Check, List, type LucideIcon, Settings } from "lucide-preact";
import { type MainRoute, navigationRoute, ROUTES, type Route, routeHash } from "../route";

const ICONS: Record<MainRoute, LucideIcon> = {
  week: Calendar,
  tasks: List,
  done: Check,
  settings: Settings,
};

interface NavigationProps {
  readonly current: Route;
}

/** The four main pages: a bar at the bottom on phones, a column on the left on wide screens. */
export function Navigation({ current }: NavigationProps) {
  const section = navigationRoute(current);
  return (
    <nav aria-label="Hauptnavigation" class="main-nav">
      <ul class="main-nav__list">
        {ROUTES.map(({ route, label }) => {
          const Icon = ICONS[route];
          return (
            <li key={route}>
              {/* A form page belongs to its section: that link is "true", not the page itself. */}
              <a
                class="main-nav__link"
                href={routeHash(route)}
                aria-current={route === current ? "page" : route === section ? "true" : undefined}
              >
                <Icon class="main-nav__icon" size={24} />
                {label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
