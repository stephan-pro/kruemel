import { navigationRoute, ROUTES, type Route, routeHash } from "../route";

interface NavigationProps {
  readonly current: Route;
}

export function Navigation({ current }: NavigationProps) {
  const section = navigationRoute(current);
  return (
    <nav aria-label="Hauptnavigation" class="main-nav">
      <ul class="main-nav__list">
        {ROUTES.map(({ route, label }) => (
          <li key={route}>
            {/* A form page belongs to its section: that link is "true", not the page itself. */}
            <a
              class="main-nav__link"
              href={routeHash(route)}
              aria-current={route === current ? "page" : route === section ? "true" : undefined}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
