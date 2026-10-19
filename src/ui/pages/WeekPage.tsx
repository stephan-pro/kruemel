import { useEffect, useRef, useState } from "preact/hooks";
import type { TaskFilter } from "../../domain/assignment";
import { addWeeks, type CalendarDay, startOfWeek } from "../../domain/date";
import type { Completion, Person, Task } from "../../domain/task";
import { type OpenWeekEntry, type WeekEntry, weekView } from "../../domain/week";
import type { PersonNames } from "../../storage/appData";
import { RadioGroup } from "../components/fields";
import { PageTitle } from "../components/PageTitle";
import {
  completionNotice,
  describeCompletedBy,
  describeOverdue,
  describeRecurrence,
  describeResponsibility,
  formatDay,
  formatWeekRange,
  undoNotice,
} from "../format";
import { newTaskHash, routeInfo } from "../route";

interface WeekPageProps {
  readonly tasks: readonly Task[];
  readonly completions: readonly Completion[];
  readonly names: PersonNames;
  /** "Ich bin": decides what "nur meine" shows and who is noted as having done a task. */
  readonly currentPerson: Person;
  readonly today: CalendarDay;
  /** Ticks the task off; rejects with an `Error` whose message is shown. */
  readonly onComplete: (taskId: string) => Promise<{ task: Task; completion: Completion }>;
  /** Takes the completion back and gives the task as it is now; rejects like `onComplete`. */
  readonly onUndo: (completionId: string) => Promise<Task>;
}

/** What the page just did, with the way back for a completion. */
interface Notice {
  readonly text: string;
  /** Set after ticking off a task: what "Rückgängig" takes back. */
  readonly undo?: { readonly completionId: string; readonly title: string };
}

const FILTER_CHOICES = [
  { value: "all", label: "Alle Aufgaben" },
  { value: "mine", label: "Nur meine Aufgaben" },
] as const;

/** "Wochenübersicht": Monday to Sunday with what is due, overdue tasks on top (F6). */
export function WeekPage({
  tasks,
  completions,
  names,
  currentPerson,
  today,
  onComplete,
  onUndo,
}: WeekPageProps) {
  // Weeks from the current one (0 = this week), not a day: when a page stays open past midnight
  // "diese Woche" moves on with `today`.
  const [weekOffset, setWeekOffset] = useState(0);
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [notice, setNotice] = useState<Notice>();
  const [noticeCount, setNoticeCount] = useState(0);
  const [error, setError] = useState<string>();
  const noticeBox = useRef<HTMLElement>(null);
  const busy = useRef(false);

  // The button that was pressed is gone after ticking off, so the focus goes to the message: it is
  // read out there and the buttons that follow (undo, the next task) are the next stops.
  useEffect(() => {
    if (noticeCount > 0) {
      noticeBox.current?.focus();
    }
  }, [noticeCount]);

  async function run(action: () => Promise<Notice>) {
    if (busy.current) {
      return;
    }
    busy.current = true;
    try {
      setError(undefined);
      setNotice(await action());
      setNoticeCount((count) => count + 1);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      busy.current = false;
    }
  }

  const complete = (task: Task) =>
    run(async () => {
      const result = await onComplete(task.id);
      return {
        text: completionNotice(task.title, result.completion),
        undo: { completionId: result.completion.id, title: task.title },
      };
    });

  const undo = ({ completionId, title }: { completionId: string; title: string }) =>
    run(async () => {
      const task = await onUndo(completionId);
      return { text: undoNotice(title, task.dueDate) };
    });

  const shownDay = addWeeks(today, weekOffset);
  const view = weekView({ tasks, completions, shownDay, today, filter, person: currentPerson });
  const monday = startOfWeek(shownDay);
  const sunday = view.days[6]?.day ?? monday;
  const range = formatWeekRange(monday, sunday);
  const weekLabel =
    view.position === "current"
      ? `Diese Woche: ${range}`
      : `${view.position === "past" ? "Vergangene Woche" : "Woche"} vom ${range}`;

  return (
    <>
      <PageTitle title={routeInfo("week").title} />

      {tasks.length === 0 ? (
        <>
          <p class="kern-body">Es gibt noch keine Aufgaben.</p>
          <p>
            <a class="kern-btn kern-btn--primary" href={newTaskHash()}>
              <span class="kern-label">Erste Aufgabe anlegen</span>
            </a>
          </p>
        </>
      ) : (
        <>
          <div class="week-controls">
            <nav aria-label="Woche wechseln" class="button-row">
              <button
                class="kern-btn kern-btn--secondary"
                type="button"
                onClick={() => setWeekOffset(weekOffset - 1)}
              >
                <span class="kern-label">Vorherige Woche</span>
              </button>
              <button
                class="kern-btn kern-btn--secondary"
                type="button"
                onClick={() => setWeekOffset(0)}
              >
                <span class="kern-label">Diese Woche</span>
              </button>
              <button
                class="kern-btn kern-btn--secondary"
                type="button"
                onClick={() => setWeekOffset(weekOffset + 1)}
              >
                <span class="kern-label">Nächste Woche</span>
              </button>
            </nav>
            <RadioGroup
              name="woche-filter"
              legend="Anzeigen"
              choices={FILTER_CHOICES}
              value={filter}
              onChange={setFilter}
            />
          </div>

          {/* A live region: a screen reader announces the new week when the buttons change it. */}
          <p class="week-range kern-body" role="status">
            <strong>{weekLabel}</strong>
          </p>

          {notice && (
            <section
              class="kern-alert kern-alert--success"
              aria-label="Hinweis"
              tabIndex={-1}
              ref={noticeBox}
            >
              <div class="kern-alert__body stack">
                <p class="kern-body">{notice.text}</p>
                {notice.undo !== undefined && (
                  <div>
                    <button
                      class="kern-btn kern-btn--secondary"
                      type="button"
                      onClick={() => notice.undo && undo(notice.undo)}
                    >
                      <span class="kern-label">Rückgängig</span>
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}
          {error && (
            <div class="kern-alert kern-alert--danger" role="alert">
              <div class="kern-alert__header">
                <span class="kern-icon kern-icon--danger" aria-hidden="true" />
                <span class="kern-title">Nicht gespeichert</span>
              </div>
              <div class="kern-alert__body">
                <p class="kern-body">{error}</p>
              </div>
            </div>
          )}

          {view.overdue.length > 0 && (
            <section class="week-day week-day--overdue stack" aria-labelledby="ueberfaellig">
              <h2 class="kern-title" id="ueberfaellig">
                Überfällig
              </h2>
              <EntryList entries={view.overdue} names={names} onComplete={complete} />
            </section>
          )}

          {view.days.map(({ day, isToday, entries }) => (
            <section
              key={day}
              class={`week-day stack${isToday ? " week-day--today" : ""}`}
              aria-labelledby={`tag-${day}`}
              aria-current={isToday ? "date" : undefined}
            >
              <h2 class="kern-title" id={`tag-${day}`}>
                {formatDay(day)}
                {isToday && " (heute)"}
              </h2>
              {entries.length === 0 ? (
                <p class="kern-body week-empty">Keine Aufgaben.</p>
              ) : (
                <EntryList entries={entries} names={names} onComplete={complete} />
              )}
            </section>
          ))}
        </>
      )}
    </>
  );
}

interface EntryListProps {
  readonly entries: readonly WeekEntry[];
  readonly names: PersonNames;
  readonly onComplete: (task: Task) => void;
}

function EntryList({ entries, names, onComplete }: EntryListProps) {
  return (
    <ul class="week-items">
      {entries.map((entry) => (
        <li
          key={entry.kind === "done" ? entry.completion.id : entry.task.id}
          class={`week-item${entry.kind === "done" ? " week-item--done" : ""}`}
        >
          <div class="week-item__text">
            <p class="kern-body week-item__title">
              <strong>{entry.task.title}</strong>
            </p>
            <p class="kern-body kern-body--small week-item__meta">
              {entry.kind === "done" ? (
                describeCompletedBy(entry.completion, names)
              ) : (
                <OpenDetails entry={entry} names={names} />
              )}
            </p>
          </div>
          {entry.kind === "open" && (
            <button
              class="kern-btn kern-btn--secondary"
              type="button"
              aria-label={`Abhaken: ${entry.task.title}`}
              onClick={() => onComplete(entry.task)}
            >
              <span class="kern-label">Abhaken</span>
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function OpenDetails({
  entry,
  names,
}: {
  readonly entry: OpenWeekEntry;
  readonly names: PersonNames;
}) {
  const { task, daysOverdue } = entry;
  const responsibility = describeResponsibility(
    task.assignee,
    task.kind === "recurring" ? task.takenOverBy : undefined,
    names,
  );
  return (
    <>
      Zuständig: {responsibility} ·{" "}
      {task.kind === "recurring" ? describeRecurrence(task.recurrence) : "einmalig"}
      {daysOverdue > 0 && (
        <>
          <br />
          <span class="week-overdue">{describeOverdue(daysOverdue)}</span> · fällig war{" "}
          {formatDay(task.dueDate)}
        </>
      )}
    </>
  );
}
