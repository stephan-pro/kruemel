import { ROUTES, type Route, routeHash } from "../route";

interface NavigationProps {
  readonly current: Route;
}

export function Navigation({ current }: NavigationProps) {
  return (
    <nav aria-label="Hauptnavigation" class="main-nav">
      <ul class="main-nav__list">
        {ROUTES.map(({ route, label }) => (
          <li key={route}>
            <a
              class="main-nav__link"
              href={routeHash(route)}
              aria-current={route === current ? "page" : undefined}
            >
              {label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
