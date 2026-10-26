import { Check, ChevronLeft, ChevronRight } from "lucide-preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { TakeOverMode, TaskFilter } from "../../domain/assignment";
import { addWeeks, type CalendarDay } from "../../domain/date";
import type { Completion, Person, Task } from "../../domain/task";
import { dayList } from "../../domain/today";
import { type DoneWeekEntry, type OpenWeekEntry, weekView } from "../../domain/week";
import { t } from "../../i18n";
import type { PersonNames } from "../../storage/appData";
import { PageTitle } from "../components/PageTitle";
import { TaskSymbol } from "../components/TaskSymbol";
import {
  dayField,
  describeDoneAt,
  describeOverdue,
  describeRecurrence,
  describeResponsibility,
  formatLongDay,
  formatShortDay,
  formatWeekNumber,
  greeting,
  percentOf,
  todaySummary,
  weekdayShort,
} from "../format";
import { newTaskHash, routeInfo } from "../route";
import { type RowActions, targetOf, useTaskActions } from "../useTaskActions";

interface TodayPageProps {
  readonly tasks: readonly Task[];
  readonly completions: readonly Completion[];
  readonly names: PersonNames;
  /** "Ich bin": the greeting, "Meine" and who is noted as having done a task. */
  readonly currentPerson: Person;
  readonly today: CalendarDay;
  readonly onComplete: (taskId: string) => Promise<{ task: Task; completion: Completion }>;
  readonly onUndo: (completionId: string) => Promise<Task>;
  readonly onTakeOver: (taskId: string, mode: TakeOverMode) => Promise<Task>;
  readonly onChecklistItem: (taskId: string, itemId: string, checked: boolean) => Promise<Task>;
}

function filters(): readonly { readonly value: TaskFilter; readonly label: string }[] {
  const words = t().today;
  return [
    { value: "mine", label: words.filterMine },
    { value: "all", label: words.filterAll },
  ];
}

/** The circumference of the ring (radius 25). */
const RING = 2 * Math.PI * 25;

/**
 * "Heute" (DESIGN.md section 5): the greeting by name, what stands on today in one sentence, the
 * week as seven day fields, how far it is (yours and together) and the tasks of the day with the
 * overdue ones first.
 */
export function TodayPage({
  tasks,
  completions,
  names,
  currentPerson,
  today,
  onComplete,
  onUndo,
  onTakeOver,
  onChecklistItem,
}: TodayPageProps) {
  // Weeks from the current one (0 = this week), as in the week view.
  const [weekOffset, setWeekOffset] = useState(0);
  const [filter, setFilter] = useState<TaskFilter>("mine");
  const [chosenDay, setChosenDay] = useState<CalendarDay>();
  const [headingFocusCount, setHeadingFocusCount] = useState(0);
  const listHeading = useRef<HTMLHeadingElement>(null);
  const { complete, rowActions, messages, dialogs } = useTaskActions({
    tasks,
    completions,
    names,
    currentPerson,
    today,
    onComplete,
    onUndo,
    onTakeOver,
    onChecklistItem,
    fallbackFocus: listHeading,
  });

  // A chosen day shows in the list below: the focus goes to its heading.
  useEffect(() => {
    if (headingFocusCount > 0) {
      listHeading.current?.focus();
    }
  }, [headingFocusCount]);

  const shownDay = addWeeks(today, weekOffset);
  const common = { tasks, completions, shownDay, today, person: currentPerson } as const;
  const mine = weekView({ ...common, filter: "mine" });
  const together = weekView({ ...common, filter: "all" });
  const monday = mine.days[0]?.day as CalendarDay;
  const day = chosenDay ?? (weekOffset === 0 ? today : monday);
  const isToday = day === today;

  const todayMine = dayList({ ...common, day: today, filter: "mine" });
  const summary = todaySummary(
    todayMine.open.length,
    todayMine.open.filter((entry) => entry.daysOverdue > 0).length,
    todayMine.done.length,
  );
  const list = dayList({ ...common, day, filter });
  const name = names[currentPerson];

  function changeWeek(offset: number) {
    setWeekOffset(offset);
    setChosenDay(undefined);
  }

  function chooseDay(chosen: CalendarDay) {
    setChosenDay(chosen);
    setHeadingFocusCount((count) => count + 1);
  }

  return (
    <div class="today">
      <header class="today__head">
        <div class="today__who">
          <span
            class={`avatar avatar--${currentPerson === "personA" ? "a" : "b"}`}
            role="img"
            aria-label={name}
          >
            {name.slice(0, 1).toUpperCase()}
          </span>
          <span class="today__date">{formatLongDay(today)}</span>
        </div>
        <nav aria-label={t().common.changeWeek} class="week-pill">
          <button
            class="week-pill__step"
            type="button"
            aria-label={t().common.previousWeek}
            onClick={() => changeWeek(weekOffset - 1)}
          >
            <ChevronLeft size={18} />
          </button>
          {/* A live region: a screen reader announces the new week when the buttons change it. */}
          <span class="week-pill__label" role="status">
            {formatWeekNumber(monday)}
          </span>
          <button
            class="week-pill__step"
            type="button"
            aria-label={t().common.nextWeek}
            onClick={() => changeWeek(weekOffset + 1)}
          >
            <ChevronRight size={18} />
          </button>
          {weekOffset !== 0 && (
            <button class="week-pill__today" type="button" onClick={() => changeWeek(0)}>
              {t().common.thisWeek}
            </button>
          )}
        </nav>
      </header>

      <PageTitle title={routeInfo("today").title} heading={greeting(new Date().getHours(), name)} />
      <p class="today__summary">
        {summary[0]}
        <strong>{summary[1]}</strong>
        {summary[2]}
      </p>

      {messages}

      {tasks.length === 0 ? (
        <div class="tile tile--narrow">
          <p>{t().common.noTasksYet}</p>
          <div class="button-row">
            <a class="btn btn--primary" href={newTaskHash()}>
              {t().common.createFirstTask}
            </a>
          </div>
        </div>
      ) : (
        <>
          <section class="today__week" aria-labelledby="deine-woche">
            <h2 class="section-label" id="deine-woche">
              {t().today.yourWeek}
            </h2>
            <ol class="day-fields">
              {mine.days.map((view) => {
                const field = dayField(view);
                return (
                  <li key={view.day}>
                    <button
                      class={`day-field day-field--${field.state}`}
                      type="button"
                      aria-pressed={view.day === day}
                      aria-current={view.isToday ? "date" : undefined}
                      onClick={() => chooseDay(view.day)}
                    >
                      <span class="day-field__name" aria-hidden="true">
                        {weekdayShort(view.day)}
                      </span>
                      <span class="day-field__mark" aria-hidden="true">
                        {field.state === "done" ? <Check size={16} strokeWidth={3} /> : field.mark}
                      </span>
                      {/* The whole sentence is the name; the visible parts above are short. */}
                      <span class="visually-hidden">{field.label}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>

          <div class="today__tiles">
            <section class="stat-tile" aria-labelledby="kachel-du">
              <h2 class="stat-tile__label" id="kachel-du">
                {t().today.yourWeek}
              </h2>
              <p class="stat-tile__value">
                <span aria-hidden="true">
                  {mine.progress.done}
                  <span class="stat-tile__of"> / {mine.progress.due}</span>
                </span>
                <span class="visually-hidden">
                  {t().common.xOfY(mine.progress.done, mine.progress.due)}
                </span>
              </p>
              <p class="stat-tile__text">{t().today.tasksDone}</p>
            </section>
            <section class="stat-tile stat-tile--together" aria-labelledby="kachel-wir">
              <TogetherRing done={together.progress.done} due={together.progress.due} />
              <div class="stat-tile__body">
                <h2 class="stat-tile__label" id="kachel-wir">
                  {t().today.together}
                </h2>
                <p class="stat-tile__text">
                  {t().today.togetherText(
                    together.progress.done,
                    together.progress.due,
                    weekOffset === 0,
                  )}
                </p>
              </div>
            </section>
          </div>

          <section class="today__list" aria-labelledby="liste-titel">
            <div class="today__list-head">
              <h2 class="section-label" id="liste-titel" tabIndex={-1} ref={listHeading}>
                {t().today.listTitle(
                  isToday ? t().today.today : formatShortDay(day),
                  filter === "mine",
                )}
              </h2>
              <fieldset class="filter-pill">
                <legend class="visually-hidden">{t().common.filterTasks}</legend>
                {filters().map(({ value, label }) => (
                  <button
                    key={value}
                    class="filter-pill__option"
                    type="button"
                    aria-pressed={filter === value}
                    onClick={() => setFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </fieldset>
            </div>
            {list.open.length === 0 && list.done.length === 0 ? (
              <p class="muted">{t().today.nothingThatDay}</p>
            ) : (
              <ul class="today-cards">
                {list.open.map((entry) => (
                  <OpenCard
                    key={entry.task.id}
                    entry={entry}
                    names={names}
                    showWho={filter === "all"}
                    actions={rowActions}
                    onComplete={complete}
                  />
                ))}
                {list.done.map((entry) => (
                  <DoneCard
                    key={entry.completion.id}
                    entry={entry}
                    names={names}
                    currentPerson={currentPerson}
                    actions={rowActions}
                  />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
      {dialogs}
    </div>
  );
}

/** The ring of "Gemeinsam": the share of the week that is done, with the percentage inside. */
function TogetherRing({ done, due }: { readonly done: number; readonly due: number }) {
  const percent = percentOf(done, due);
  return (
    <svg
      class="ring"
      width="62"
      height="62"
      viewBox="0 0 62 62"
      role="img"
      aria-label={t().today.ringLabel(done, due)}
    >
      <circle class="ring__track" cx="31" cy="31" r="25" fill="none" stroke-width="7" />
      <circle
        class="ring__fill"
        cx="31"
        cy="31"
        r="25"
        fill="none"
        stroke-width="7"
        stroke-linecap="round"
        stroke-dasharray={`${(percent / 100) * RING} ${RING}`}
        transform="rotate(-90 31 31)"
      />
      <text class="ring__text" x="31" y="36" text-anchor="middle">
        {percent}%
      </text>
    </svg>
  );
}

interface OpenCardProps {
  readonly entry: OpenWeekEntry;
  readonly names: PersonNames;
  /** Overdue tasks name their person only here ("Alle"): the list "Meine" is all yours. */
  readonly showWho: boolean;
  readonly actions: RowActions;
  readonly onComplete: (task: Task) => void;
}

/** An open task: picture and text open the details, the round button ticks it off. */
function OpenCard({ entry, names, showWho, actions, onComplete }: OpenCardProps) {
  const { task, daysOverdue } = entry;
  const responsibility = describeResponsibility(
    task.assignee,
    task.kind === "recurring" ? task.takenOverBy : undefined,
    names,
  );
  return (
    <li class="today-card">
      <button
        class="today-card__open"
        type="button"
        data-task-open={task.id}
        aria-haspopup="dialog"
        onClick={(event) => actions.onOpen(targetOf(entry), event.currentTarget)}
      >
        <TaskSymbol symbol={task.symbol} />
        <span class="today-card__text">
          <span class="today-card__title">{task.title}</span>
          {daysOverdue > 0 && (
            <span class="today-card__meta today-card__meta--warn">
              {describeOverdue(daysOverdue)}
            </span>
          )}
          {(daysOverdue === 0 || showWho) && (
            <span class="today-card__meta">
              {responsibility} ·{" "}
              {task.kind === "recurring" ? describeRecurrence(task.recurrence) : t().common.oneOff}
            </span>
          )}
        </span>
      </button>
      <button
        class="tick-round"
        type="button"
        aria-label={t().common.tickOffTask(task.title)}
        onClick={() => onComplete(task)}
      >
        <Check class="tick-round__icon" size={22} strokeWidth={3} />
      </button>
    </li>
  );
}

interface DoneCardProps {
  readonly entry: DoneWeekEntry;
  readonly names: PersonNames;
  readonly currentPerson: Person;
  readonly actions: RowActions;
}

/** A task ticked off on this day: struck through, with the time. */
function DoneCard({ entry, names, currentPerson, actions }: DoneCardProps) {
  const { task, completion } = entry;
  return (
    <li class="today-card today-card--done">
      <button
        class="today-card__open"
        type="button"
        data-task-open={task.id}
        aria-haspopup="dialog"
        onClick={(event) => actions.onOpen(targetOf(entry), event.currentTarget)}
      >
        <TaskSymbol symbol={task.symbol} />
        <span class="today-card__text">
          <span class="today-card__title">{task.title}</span>
          <span class="today-card__meta">{describeDoneAt(completion, names, currentPerson)}</span>
        </span>
      </button>
      <span class="tick-round tick-round--done" role="img" aria-label={t().today.done}>
        <Check size={20} strokeWidth={3} />
      </span>
    </li>
  );
}
