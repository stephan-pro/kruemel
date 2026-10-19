import { PageTitle } from "../components/PageTitle";
import { type Route, routeInfo } from "../route";

interface PlaceholderPageProps {
  readonly route: Route;
}

/** Stands in for a page that a later work package fills (see docs/PLAN.md). */
export function PlaceholderPage({ route }: PlaceholderPageProps) {
  return (
    <>
      <PageTitle title={routeInfo(route).title} />
      <p class="kern-body">Diese Seite ist noch im Aufbau.</p>
    </>
  );
}
