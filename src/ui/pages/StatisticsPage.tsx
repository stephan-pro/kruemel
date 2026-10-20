import type { CalendarDay } from "../../domain/date";
import type { Completion, Person, Task } from "../../domain/task";
import type { PersonNames } from "../../storage/appData";
import { PageTitle } from "../components/PageTitle";
import { routeInfo } from "../route";

interface StatisticsPageProps {
  readonly tasks: readonly Task[];
  readonly completions: readonly Completion[];
  readonly names: PersonNames;
  readonly currentPerson: Person;
  readonly today: CalendarDay;
}

/** "Statistik": filled in by E2-4b. */
export function StatisticsPage(_props: StatisticsPageProps) {
  return (
    <>
      <PageTitle title={routeInfo("statistics").title} />
      <p class="muted">Die Statistik folgt.</p>
    </>
  );
}
