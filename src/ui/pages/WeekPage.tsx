import { Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-preact";
import { useEffect, useId, useRef, useState } from "preact/hooks";
import type { TakeOverMode, TaskFilter } from "../../domain/assignment";
import { addWeeks, type CalendarDay } from "../../domain/date";
import type { Completion, Person, Task } from "../../domain/task";
import {
  type OpenWeekEntry,
  type WeekDayView,
  type WeekEntry,
  type WeekProgress,
  weekView,
} from "../../domain/week";
import { t } from "../../i18n";
import type { PersonNames } from "../../storage/appData";
import { ChecklistToggles } from "../components/ChecklistToggles";
import { PageTitle } from "../components/PageTitle";
import { TaskSymbol } from "../components/TaskSymbol";
import {
  countTasks,
  dayOfMonth,
  describeChecklist,
  describeCompletedBy,
  describeOverdue,
  describeRecurrence,
  describeResponsibility,
  formatShortDay,
  formatWeekLabel,
  weekdayShort,
  weekTitle,
} from "../format";
import { newTaskHash, routeHash, routeInfo } from "../route";
import {
  canTakeOver,
  type OpenDetail,
  type RowActions,
  targetOf,
  useTaskActions,
} from "../useTaskActions";

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
  /** "Übernehmen" for the person of this device; rejects like `onComplete`. */
  readonly onTakeOver: (taskId: string, mode: TakeOverMode) => Promise<Task>;
  /** Ticks or unticks a checklist item; rejects like `onComplete`. */
  readonly onChecklistItem: (taskId: string, itemId: string, checked: boolean) => Promise<Task>;
}

function filters(): readonly { readonly value: TaskFilter; readonly label: string }[] {
  const words = t().week;
  return [
    { value: "all", label: t().common.all },
    { value: "mine", label: words.filterMine },
  ];
}

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
 * what is overdue, how far the week is, and all seven days to choose from. A task opens its
 * details; "Übernehmen" and the checklist are at hand in the rows (F4, F5).
 */
export function WeekPage({
  tasks,
  completions,
  names,
  currentPerson,
  today,
  onComplete,
  onUndo,
  onTakeOver,
  onChecklistItem,
}: WeekPageProps) {
  // Weeks from the current one (0 = this week), not a day: when a page stays open past midnight
  // "diese Woche" moves on with `today`.
  const [weekOffset, setWeekOffset] = useState(0);
  const [filter, setFilter] = useState<TaskFilter>("all");
  const [chosenDay, setChosenDay] = useState<CalendarDay>();
  const [allOverdue, setAllOverdue] = useState(false);
  const [dayFocusCount, setDayFocusCount] = useState(0);
  const dayHeading = useRef<HTMLHeadingElement>(null);
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
    fallbackFocus: dayHeading,
  });

  // A chosen day shows in the day tile further up: the focus (and the view) goes there.
  useEffect(() => {
    if (dayFocusCount > 0) {
      dayHeading.current?.focus();
    }
  }, [dayFocusCount]);

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
          <nav aria-label={t().common.changeWeek} class="week-nav">
            <button
              class="icon-btn"
              type="button"
              aria-label={t().common.previousWeek}
              onClick={() => changeWeek(weekOffset - 1)}
            >
              <ChevronLeft size={22} />
            </button>
            <button class="btn btn--quiet" type="button" onClick={() => changeWeek(0)}>
              {t().common.thisWeek}
            </button>
            <button
              class="icon-btn"
              type="button"
              aria-label={t().common.nextWeek}
              onClick={() => changeWeek(weekOffset + 1)}
            >
              <ChevronRight size={22} />
            </button>
          </nav>
        )}
        <div class="week-head__actions">
          {tasks.length > 0 && (
            <fieldset class="segmented">
              <legend class="visually-hidden">{t().common.filterTasks}</legend>
              {filters().map(({ value, label }) => (
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
        </div>
      </header>

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
        <div class={`week-board${view.overdue.length > 0 ? " week-board--overdue" : ""}`}>
          {/* First in the page, so it is in sight at once on a phone; wide screens put it on the
              right next to the day (CSS grid). */}
          {view.overdue.length > 0 && (
            <OverdueTile
              entries={view.overdue}
              names={names}
              expanded={allOverdue}
              actions={rowActions}
              onToggle={() => setAllOverdue(!allOverdue)}
              onComplete={complete}
            />
          )}
          <DayTile
            day={shown}
            names={names}
            headingRef={dayHeading}
            actions={rowActions}
            onComplete={complete}
          />
          <ProgressTile progress={view.progress} current={weekOffset === 0} />
          <WeekStrip
            days={view.days}
            chosen={shown.day}
            names={names}
            onChoose={chooseDay}
            onOpen={rowActions.onOpen}
          />
        </div>
      )}

      {/* The lists behind the week; "Neue Aufgabe" is the plus in the navigation. */}
      <nav aria-label={t().week.lists} class="week-lists">
        <a class="btn btn--quiet" href={routeHash("tasks")}>
          {t().routes.tasks.label}
        </a>
        <a class="btn btn--quiet" href={routeHash("done")}>
          {t().routes.done.label}
        </a>
      </nav>

      {dialogs}
    </>
  );
}

interface DayTileProps {
  readonly day: WeekDayView;
  readonly names: PersonNames;
  readonly headingRef: { current: HTMLHeadingElement | null };
  readonly actions: RowActions;
  readonly onComplete: (task: Task) => void;
}

/** The tasks of one day ("Heute · Mi, 21.10."), each with its button to tick it off. */
function DayTile({ day, names, headingRef, actions, onComplete }: DayTileProps) {
  const open = day.entries.filter((entry) => entry.kind === "open").length;
  const done = day.entries.length - open;
  const summary = [
    done > 0 ? t().week.doneCount(done) : "",
    open > 0 ? t().week.openCount(open) : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <section class="tile day-tile" aria-labelledby="tag-titel">
      <div class="tile__head">
        <h2 class="tile__title" id="tag-titel" tabIndex={-1} ref={headingRef}>
          {day.isToday ? t().week.todayDay(formatShortDay(day.day)) : formatShortDay(day.day)}
        </h2>
        {summary && <span class="tile__aside">{summary}</span>}
      </div>
      {day.entries.length === 0 ? (
        <p class="muted">{t().week.noTasksDay}</p>
      ) : (
        <ul class="entries">
          {day.entries.map((entry) => (
            <Entry
              key={entry.kind === "done" ? entry.completion.id : entry.task.id}
              entry={entry}
              names={names}
              actions={actions}
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
  return task.kind === "recurring" ? describeRecurrence(task.recurrence) : t().common.oneOff;
}

interface EntryProps {
  readonly entry: WeekEntry;
  readonly names: PersonNames;
  readonly actions: RowActions;
  readonly onComplete: (task: Task) => void;
}

/**
 * One task of the day tile. The picture and text are a button that opens the details; beside it the
 * box to tick the task off. Below: "Übernehmen" and the checklist as boxes to tick (on phones
 * folded away behind "Checkliste").
 */
function Entry({ entry, names, actions, onComplete }: EntryProps) {
  const { task } = entry;
  const checklist = task.checklist;
  const checked = checklist.filter((item) => item.checked).length;
  const [itemsShown, setItemsShown] = useState(false);
  const itemsId = useId();
  const open = entry.kind === "open";
  const takeOver = open && canTakeOver(task, actions.person);
  return (
    <li class={`entry${open ? "" : " entry--done"}`}>
      <div class="entry__row">
        <button
          class="entry__open"
          type="button"
          data-task-open={task.id}
          aria-haspopup="dialog"
          onClick={(event) => actions.onOpen(targetOf(entry), event.currentTarget)}
        >
          <TaskSymbol symbol={task.symbol} />
          <span class="entry__text">
            <span class="entry__title">{task.title}</span>
            <span class="entry__meta">
              {entry.kind === "done"
                ? describeCompletedBy(entry.completion, names)
                : `${responsibilityOf(task, names)} · ${rhythmOf(task)}`}
            </span>
            {entry.kind === "open" && entry.daysOverdue > 0 && (
              <span class="entry__meta entry__meta--warn">
                {describeOverdue(entry.daysOverdue)}
              </span>
            )}
            {open && checklist.length > 0 && (
              <span class="entry__progress">
                <span class="bar" aria-hidden="true">
                  <span
                    class="bar__fill"
                    style={{ width: `${(checked / checklist.length) * 100}%` }}
                  />
                </span>
                <span class="entry__meta">{describeChecklist(checklist)}</span>
              </span>
            )}
          </span>
        </button>
        {open ? (
          <button
            class="tick"
            type="button"
            aria-label={t().common.tickOffTask(task.title)}
            onClick={() => onComplete(task)}
          >
            <Check class="tick__icon" size={22} />
          </button>
        ) : (
          <span class="tick tick--done" aria-hidden="true">
            <Check size={22} />
          </span>
        )}
      </div>
      {open && (takeOver || checklist.length > 0) && (
        <div class="entry__extras">
          {takeOver && (
            <button
              class="btn btn--secondary btn--small"
              type="button"
              aria-label={t().common.takeOverTask(task.title)}
              onClick={(event) => actions.onTakeOver(task, event.currentTarget)}
            >
              {t().common.takeOver}
            </button>
          )}
          {checklist.length > 0 && (
            <button
              class="btn btn--secondary btn--small entry__toggle"
              type="button"
              aria-label={t().common.checklistOfTask(task.title)}
              aria-expanded={itemsShown}
              aria-controls={itemsId}
              onClick={() => setItemsShown(!itemsShown)}
            >
              {t().week.checklist}
              <ChevronDown class="entry__toggle-icon" size={18} />
            </button>
          )}
        </div>
      )}
      {open && checklist.length > 0 && (
        <div id={itemsId} class={`entry__items${itemsShown ? " entry__items--open" : ""}`}>
          <ChecklistToggles
            task={task}
            variant="chips"
            onToggle={(itemId, isChecked) => actions.onToggleItem(task, itemId, isChecked)}
          />
        </div>
      )}
    </li>
  );
}

interface OverdueTileProps {
  readonly entries: readonly OpenWeekEntry[];
  readonly names: PersonNames;
  readonly expanded: boolean;
  readonly actions: RowActions;
  readonly onToggle: () => void;
  readonly onComplete: (task: Task) => void;
}

/** The most urgent overdue task; the others behind "+ N weitere". */
function OverdueTile({
  entries,
  names,
  expanded,
  actions,
  onToggle,
  onComplete,
}: OverdueTileProps) {
  const shown = expanded ? entries : entries.slice(0, 1);
  const more = entries.length - 1;
  return (
    <section
      class={`tile warn-tile${expanded ? " warn-tile--expanded" : ""}`}
      aria-labelledby="ueberfaellig"
    >
      <div class="tile__head">
        <h2 class="tile__label" id="ueberfaellig">
          {t().week.overdue}
        </h2>
      </div>
      <ul class="overdue-list" id="ueberfaellig-liste">
        {shown.map((entry) => {
          const { task, daysOverdue } = entry;
          return (
            <li class="overdue" key={task.id}>
              <button
                class="overdue__open"
                type="button"
                data-task-open={task.id}
                aria-haspopup="dialog"
                onClick={(event) => actions.onOpen(targetOf(entry), event.currentTarget)}
              >
                <span class="overdue__head">
                  <span class="overdue__title">{task.title}</span>
                  <TaskSymbol symbol={task.symbol} variant="plain" />
                </span>
                <span class="overdue__meta">
                  {t().week.overdueMeta(
                    describeOverdue(daysOverdue),
                    formatShortDay(task.dueDate),
                    responsibilityOf(task, names),
                  )}
                </span>
              </button>
              <div class="overdue__actions">
                <button
                  class="btn btn--warn-action"
                  type="button"
                  aria-label={t().common.tickOffTask(task.title)}
                  onClick={() => onComplete(task)}
                >
                  {t().common.tickOff}
                </button>
                {canTakeOver(task, actions.person) && (
                  <button
                    class="btn btn--warn-action"
                    type="button"
                    aria-label={t().common.takeOverTask(task.title)}
                    onClick={(event) => actions.onTakeOver(task, event.currentTarget)}
                  >
                    {t().common.takeOver}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {more > 0 && (
        <button
          class="text-btn"
          type="button"
          aria-expanded={expanded}
          aria-controls="ueberfaellig-liste"
          onClick={onToggle}
        >
          {expanded ? t().week.showLess : t().week.showMore(more)}
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
        {t().week.progress}
      </h2>
      <p class="stand">
        <span aria-hidden="true">
          {done}
          <span class="stand__of"> / {due}</span>
        </span>
        <span class="visually-hidden">{t().common.xOfY(done, due)}</span>
      </p>
      <p class="stand__text">{current ? t().week.progressCurrent : t().week.progressOther}</p>
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
  readonly onOpen: OpenDetail;
}

/**
 * Monday to Sunday: a button per day with the number of its tasks, which shows the day in the day
 * tile. Wide screens also list the tasks of every day; each opens its details.
 */
function WeekStrip({ days, chosen, names, onChoose, onOpen }: WeekStripProps) {
  return (
    <section class="tile week-strip" aria-labelledby="woche-tage">
      <h2 class="tile__title" id="woche-tage">
        {t().week.overview}
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
                    <button
                      class="chip__open"
                      type="button"
                      data-task-open={entry.task.id}
                      aria-haspopup="dialog"
                      onClick={(event) => onOpen(targetOf(entry), event.currentTarget)}
                    >
                      <span class="chip__title">
                        <TaskSymbol symbol={entry.task.symbol} variant="small" />
                        {entry.task.title}
                      </span>
                      <span class="chip__meta">
                        {entry.kind === "done"
                          ? t().format.doneBy(names[entry.completion.completedBy])
                          : responsibilityOf(entry.task, names)}
                      </span>
                    </button>
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
