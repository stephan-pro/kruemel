import { Check, ChevronLeft, ChevronRight, Plus, TriangleAlert } from "lucide-preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { TaskFilter } from "../../domain/assignment";
import { addWeeks, type CalendarDay } from "../../domain/date";
import type { Completion, Person, Task } from "../../domain/task";
import {
  type OpenWeekEntry,
  type WeekDayView,
  type WeekEntry,
  type WeekProgress,
  weekView,
} from "../../domain/week";
import type { PersonNames } from "../../storage/appData";
import { ErrorAlert } from "../components/Alert";
import { PageTitle } from "../components/PageTitle";
import { TaskSymbol } from "../components/TaskSymbol";
import {
  completionNotice,
  countTasks,
  dayOfMonth,
  describeChecklist,
  describeCompletedBy,
  describeOverdue,
  describeRecurrence,
  describeResponsibility,
  formatShortDay,
  formatWeekLabel,
  undoNotice,
  weekdayShort,
  weekTitle,
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

const FILTERS: readonly { readonly value: TaskFilter; readonly label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "mine", label: "Nur meine" },
];

/**
 * The day the day tile shows unless one was chosen: today in the current week, otherwise the first
 * day with something on it (or Monday).
 */
function defaultDay(days: readonly WeekDayView[]): WeekDayView {
  const first = days[0] as WeekDayView;
  return days.find((day) => day.isToday) ?? days.find((day) => day.entries.length > 0) ?? first;
}

/**
 * "Wochenübersicht" as a board of tiles (F6, DESIGN.md section 6): the chosen day with its tasks,
 * what is overdue, how far the week is, and all seven days to choose from.
 */
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
  const [chosenDay, setChosenDay] = useState<CalendarDay>();
  const [allOverdue, setAllOverdue] = useState(false);
  const [notice, setNotice] = useState<Notice>();
  const [noticeCount, setNoticeCount] = useState(0);
  const [dayFocusCount, setDayFocusCount] = useState(0);
  const [error, setError] = useState<string>();
  const noticeBox = useRef<HTMLElement>(null);
  const dayHeading = useRef<HTMLHeadingElement>(null);
  const busy = useRef(false);

  // The button that was pressed is gone after ticking off, so the focus goes to the message: it is
  // read out there and the buttons that follow (undo, the next task) are the next stops.
  useEffect(() => {
    if (noticeCount > 0) {
      noticeBox.current?.focus();
    }
  }, [noticeCount]);

  // A chosen day shows in the day tile further up: the focus (and the view) goes there.
  useEffect(() => {
    if (dayFocusCount > 0) {
      dayHeading.current?.focus();
    }
  }, [dayFocusCount]);

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

  function changeWeek(offset: number) {
    setWeekOffset(offset);
    setChosenDay(undefined);
  }

  function chooseDay(day: CalendarDay) {
    setChosenDay(day);
    setDayFocusCount((count) => count + 1);
  }

  const shownDay = addWeeks(today, weekOffset);
  const view = weekView({ tasks, completions, shownDay, today, filter, person: currentPerson });
  const shown = view.days.find((day) => day.day === chosenDay) ?? defaultDay(view.days);
  const monday = (view.days[0] as WeekDayView).day;

  return (
    <>
      <header class="week-head">
        <div class="week-head__titles">
          <PageTitle title={routeInfo("week").title} heading={weekTitle(weekOffset)} />
          {/* A live region: a screen reader announces the new week when the buttons change it. */}
          <p class="eyebrow" role="status">
            {formatWeekLabel(monday, today)}
          </p>
        </div>
        {tasks.length > 0 && (
          <nav aria-label="Woche wechseln" class="week-nav">
            <button
              class="icon-btn"
              type="button"
              aria-label="Vorherige Woche"
              onClick={() => changeWeek(weekOffset - 1)}
            >
              <ChevronLeft size={22} />
            </button>
            <button class="btn btn--quiet" type="button" onClick={() => changeWeek(0)}>
              Diese Woche
            </button>
            <button
              class="icon-btn"
              type="button"
              aria-label="Nächste Woche"
              onClick={() => changeWeek(weekOffset + 1)}
            >
              <ChevronRight size={22} />
            </button>
          </nav>
        )}
        <div class="week-head__actions">
          {tasks.length > 0 && (
            <fieldset class="segmented">
              <legend class="visually-hidden">Aufgaben filtern</legend>
              {FILTERS.map(({ value, label }) => (
                <button
                  key={value}
                  class="segmented__option"
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </button>
              ))}
            </fieldset>
          )}
          {/* One link: a button in the head on wide screens, a floating button on phones. */}
          <a class="btn btn--primary new-task" href={newTaskHash()}>
            <Plus size={22} />
            <span class="new-task__label">Neue Aufgabe</span>
          </a>
        </div>
      </header>

      {notice && (
        <section class="snackbar" aria-label="Hinweis" tabIndex={-1} ref={noticeBox}>
          <p>{notice.text}</p>
          {notice.undo !== undefined && (
            <button
              class="btn btn--snackbar"
              type="button"
              onClick={() => notice.undo && undo(notice.undo)}
            >
              Rückgängig
            </button>
          )}
        </section>
      )}
      {error && <ErrorAlert title="Nicht gespeichert">{error}</ErrorAlert>}

      {tasks.length === 0 ? (
        <div class="tile tile--narrow">
          <p>Es gibt noch keine Aufgaben.</p>
          <div class="button-row">
            <a class="btn btn--primary" href={newTaskHash()}>
              Erste Aufgabe anlegen
            </a>
          </div>
        </div>
      ) : (
        <div class="week-board">
          <DayTile day={shown} names={names} headingRef={dayHeading} onComplete={complete} />
          <div class="side-tiles">
            {view.overdue.length > 0 && (
              <OverdueTile
                entries={view.overdue}
                names={names}
                expanded={allOverdue}
                onToggle={() => setAllOverdue(!allOverdue)}
                onComplete={complete}
              />
            )}
            <ProgressTile progress={view.progress} current={weekOffset === 0} />
          </div>
          <WeekStrip days={view.days} chosen={shown.day} names={names} onChoose={chooseDay} />
        </div>
      )}
    </>
  );
}

interface DayTileProps {
  readonly day: WeekDayView;
  readonly names: PersonNames;
  readonly headingRef: { current: HTMLHeadingElement | null };
  readonly onComplete: (task: Task) => void;
}

/** The tasks of one day ("Heute · Mi, 21.10."), each with its button to tick it off. */
function DayTile({ day, names, headingRef, onComplete }: DayTileProps) {
  const open = day.entries.filter((entry) => entry.kind === "open").length;
  const done = day.entries.length - open;
  const summary = [done > 0 ? `${done} erledigt` : "", open > 0 ? `${open} offen` : ""]
    .filter(Boolean)
    .join(" · ");
  return (
    <section class="tile day-tile" aria-labelledby="tag-titel">
      <div class="tile__head">
        <h2 class="tile__title" id="tag-titel" tabIndex={-1} ref={headingRef}>
          {day.isToday ? `Heute · ${formatShortDay(day.day)}` : formatShortDay(day.day)}
        </h2>
        {summary && <span class="tile__aside">{summary}</span>}
      </div>
      {day.entries.length === 0 ? (
        <p class="muted">Keine Aufgaben.</p>
      ) : (
        <ul class="entries">
          {day.entries.map((entry) => (
            <Entry
              key={entry.kind === "done" ? entry.completion.id : entry.task.id}
              entry={entry}
              names={names}
              onComplete={onComplete}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function responsibilityOf(task: Task, names: PersonNames): string {
  return describeResponsibility(
    task.assignee,
    task.kind === "recurring" ? task.takenOverBy : undefined,
    names,
  );
}

function rhythmOf(task: Task): string {
  return task.kind === "recurring" ? describeRecurrence(task.recurrence) : "einmalig";
}

interface EntryProps {
  readonly entry: WeekEntry;
  readonly names: PersonNames;
  readonly onComplete: (task: Task) => void;
}

function Entry({ entry, names, onComplete }: EntryProps) {
  const { task } = entry;
  const checklist = task.checklist;
  const checked = checklist.filter((item) => item.checked).length;
  return (
    <li class={`entry${entry.kind === "done" ? " entry--done" : ""}`}>
      <TaskSymbol />
      <div class="entry__text">
        <p class="entry__title">{task.title}</p>
        <p class="entry__meta">
          {entry.kind === "done"
            ? describeCompletedBy(entry.completion, names)
            : `${responsibilityOf(task, names)} · ${rhythmOf(task)}`}
        </p>
        {entry.kind === "open" && entry.daysOverdue > 0 && (
          <p class="entry__meta entry__meta--warn">{describeOverdue(entry.daysOverdue)}</p>
        )}
        {entry.kind === "open" && checklist.length > 0 && (
          <div class="entry__progress">
            <span class="bar" aria-hidden="true">
              <span class="bar__fill" style={{ width: `${(checked / checklist.length) * 100}%` }} />
            </span>
            <span class="entry__meta">{describeChecklist(checklist)}</span>
          </div>
        )}
      </div>
      {entry.kind === "open" ? (
        <button
          class="tick"
          type="button"
          aria-label={`Abhaken: ${task.title}`}
          onClick={() => onComplete(task)}
        >
          <Check class="tick__icon" size={22} />
        </button>
      ) : (
        <span class="tick tick--done" aria-hidden="true">
          <Check size={22} />
        </span>
      )}
    </li>
  );
}

interface OverdueTileProps {
  readonly entries: readonly OpenWeekEntry[];
  readonly names: PersonNames;
  readonly expanded: boolean;
  readonly onToggle: () => void;
  readonly onComplete: (task: Task) => void;
}

/** The most urgent overdue task; the others behind "+ N weitere". */
function OverdueTile({ entries, names, expanded, onToggle, onComplete }: OverdueTileProps) {
  const shown = expanded ? entries : entries.slice(0, 1);
  const more = entries.length - 1;
  return (
    <section
      class={`tile warn-tile${expanded ? " warn-tile--expanded" : ""}`}
      aria-labelledby="ueberfaellig"
    >
      <div class="tile__head">
        <h2 class="tile__label" id="ueberfaellig">
          Überfällig
        </h2>
        <TriangleAlert size={24} />
      </div>
      <ul class="overdue-list" id="ueberfaellig-liste">
        {shown.map(({ task, daysOverdue }) => (
          <li class="overdue" key={task.id}>
            <p class="overdue__title">{task.title}</p>
            <p class="overdue__meta">
              {describeOverdue(daysOverdue)} (seit {formatShortDay(task.dueDate)}) ·{" "}
              {responsibilityOf(task, names)}
            </p>
            <button
              class="btn btn--warn-action"
              type="button"
              aria-label={`Abhaken: ${task.title}`}
              onClick={() => onComplete(task)}
            >
              Abhaken
            </button>
          </li>
        ))}
      </ul>
      {more > 0 && (
        <button
          class="text-btn"
          type="button"
          aria-expanded={expanded}
          aria-controls="ueberfaellig-liste"
          onClick={onToggle}
        >
          {expanded ? "Weniger anzeigen" : `+ ${more} weitere anzeigen`}
        </button>
      )}
    </section>
  );
}

/** "Stand": done of due in the shown week. */
function ProgressTile({
  progress,
  current,
}: {
  readonly progress: WeekProgress;
  readonly current: boolean;
}) {
  const { done, due } = progress;
  return (
    <section class="tile accent-tile" aria-labelledby="stand">
      <h2 class="tile__label" id="stand">
        Stand
      </h2>
      <p class="stand">
        <span aria-hidden="true">
          {done}
          <span class="stand__of"> / {due}</span>
        </span>
        <span class="visually-hidden">
          {done} von {due}
        </span>
      </p>
      <p class="stand__text">{current ? "diese Woche erledigt" : "in dieser Woche erledigt"}</p>
      <span class="bar bar--on-accent" aria-hidden="true">
        <span class="bar__fill" style={{ width: `${due === 0 ? 0 : (done / due) * 100}%` }} />
      </span>
    </section>
  );
}

interface WeekStripProps {
  readonly days: readonly WeekDayView[];
  readonly chosen: CalendarDay;
  readonly names: PersonNames;
  readonly onChoose: (day: CalendarDay) => void;
}

/**
 * Monday to Sunday: a button per day with the number of its tasks, which shows the day in the day
 * tile. Wide screens also list the tasks of every day.
 */
function WeekStrip({ days, chosen, names, onChoose }: WeekStripProps) {
  return (
    <section class="tile week-strip" aria-labelledby="woche-tage">
      <h2 class="tile__title" id="woche-tage">
        Woche im Überblick
      </h2>
      <div class="week-strip__scroll">
        <ul class="week-strip__days">
          {days.map(({ day, isToday, entries }) => (
            <li class="week-strip__day" key={day}>
              <button
                class={`day-button${isToday ? " day-button--today" : ""}`}
                type="button"
                aria-pressed={day === chosen}
                aria-current={isToday ? "date" : undefined}
                onClick={() => onChoose(day)}
              >
                {/* The spaces keep the parts apart in the name ("Mi 21. 2 Aufgaben"). */}
                <span class="day-button__name">{weekdayShort(day)}</span>{" "}
                <span class="day-button__date">{dayOfMonth(day)}.</span>{" "}
                <span class="day-button__count">
                  <span aria-hidden="true">{entries.length === 0 ? "–" : entries.length}</span>
                  <span class="visually-hidden">{countTasks(entries.length)}</span>
                </span>
              </button>
              <ul class="chips">
                {entries.map((entry) => (
                  <li
                    class={`chip${entry.kind === "done" ? " chip--done" : ""}`}
                    key={entry.kind === "done" ? entry.completion.id : entry.task.id}
                  >
                    <span class="chip__title">{entry.task.title}</span>
                    <span class="chip__meta">
                      {entry.kind === "done"
                        ? `erledigt von ${names[entry.completion.completedBy]}`
                        : responsibilityOf(entry.task, names)}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
