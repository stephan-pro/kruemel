import { Check, ChevronDown, ChevronLeft, ChevronRight, Plus } from "lucide-preact";
import { useEffect, useId, useRef, useState } from "preact/hooks";
import { effectiveAssignee, type TakeOverMode, type TaskFilter } from "../../domain/assignment";
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
import { ChecklistToggles } from "../components/ChecklistToggles";
import { PageTitle } from "../components/PageTitle";
import { TakeOverDialog } from "../components/TakeOverDialog";
import { TaskDetailDialog } from "../components/TaskDetailDialog";
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
  takeOverNotice,
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
  /** "Übernehmen" for the person of this device; rejects like `onComplete`. */
  readonly onTakeOver: (taskId: string, mode: TakeOverMode) => Promise<Task>;
  /** Ticks or unticks a checklist item; rejects like `onComplete`. */
  readonly onChecklistItem: (taskId: string, itemId: string, checked: boolean) => Promise<Task>;
}

/** What the page just did, with the way back for a completion. */
interface Notice {
  readonly text: string;
  /** Set after ticking off a task: what "Rückgängig" takes back. */
  readonly undo?: { readonly completionId: string; readonly title: string };
}

/** The task whose details are shown; `completionId` is set for a task shown as done. */
interface DetailTarget {
  readonly taskId: string;
  readonly completionId: string | undefined;
}

/** Opens the details of a task; `from` is the button to give the focus back to. */
type OpenDetail = (target: DetailTarget, from: HTMLElement) => void;

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

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Opening a done task shows it with its completion, an open one without. */
function targetOf(entry: WeekEntry): DetailTarget {
  return {
    taskId: entry.task.id,
    completionId: entry.kind === "done" ? entry.completion.id : undefined,
  };
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
  const [notice, setNotice] = useState<Notice>();
  const [noticeCount, setNoticeCount] = useState(0);
  const [dayFocusCount, setDayFocusCount] = useState(0);
  const [detail, setDetail] = useState<DetailTarget>();
  const [takingOver, setTakingOver] = useState<Task>();
  const [returnFocusCount, setReturnFocusCount] = useState(0);
  const [error, setError] = useState<string>();
  const noticeBox = useRef<HTMLElement>(null);
  const dayHeading = useRef<HTMLHeadingElement>(null);
  /** The button that opened the details or the question; it gets the focus back afterwards. */
  const opener = useRef<{ readonly element: HTMLElement; readonly taskId: string } | undefined>(
    undefined,
  );
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

  // After closing the details (or cancelling the question) the focus returns to the task. Runs
  // after the dialog has closed, so it wins over the browser's own attempt (Safari does not
  // remember buttons that were clicked).
  useEffect(() => {
    if (returnFocusCount === 0) {
      return;
    }
    const from = opener.current;
    const target = from?.element.isConnected
      ? from.element
      : from &&
        document.querySelector<HTMLElement>(`[data-task-open="${CSS.escape(from.taskId)}"]`);
    (target || dayHeading.current)?.focus();
  }, [returnFocusCount]);

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
      setError(messageOf(failure));
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

  /** Saves the takeover and says what happened; rejects if it could not be saved. */
  async function takeOverNow(task: Task, mode: TakeOverMode): Promise<Notice> {
    await onTakeOver(task.id, mode);
    return { text: takeOverNotice(task.title, task.kind, currentPerson, names, mode) };
  }

  /** The takeover is done: the dialogs go away and the message takes the focus. */
  function finishTakeOver(done: Notice) {
    setDetail(undefined);
    setTakingOver(undefined);
    setError(undefined);
    setNotice(done);
    setNoticeCount((count) => count + 1);
  }

  /** "Übernehmen" in a row: a one-off task is handed over at once, a recurring one asks first. */
  function takeOverFromRow(task: Task, from: HTMLElement) {
    if (task.kind === "oneOff") {
      void run(() => takeOverNow(task, "once"));
      return;
    }
    opener.current = { element: from, taskId: task.id };
    setTakingOver(task);
  }

  /** "Übernehmen" in the details: the same, but problems show in the dialog. */
  async function takeOverFromDetail(task: Task) {
    if (task.kind === "recurring") {
      setTakingOver(task);
      return;
    }
    finishTakeOver(await takeOverNow(task, "once"));
  }

  async function confirmTakeOver(mode: TakeOverMode) {
    if (takingOver !== undefined) {
      finishTakeOver(await takeOverNow(takingOver, mode));
    }
  }

  function cancelTakeOver() {
    setTakingOver(undefined);
    // Asked from the details: they stay open and keep the focus.
    if (detail === undefined) {
      setReturnFocusCount((count) => count + 1);
    }
  }

  /** A tick in a row: a problem shows on the page. No message and no focus jump for a tick. */
  async function toggleInRow(task: Task, itemId: string, checked: boolean) {
    try {
      setError(undefined);
      await onChecklistItem(task.id, itemId, checked);
    } catch (failure) {
      setError(messageOf(failure));
    }
  }

  async function toggleInDetail(task: Task, itemId: string, checked: boolean) {
    await onChecklistItem(task.id, itemId, checked);
  }

  const openDetail: OpenDetail = (target, from) => {
    opener.current = { element: from, taskId: target.taskId };
    setDetail(target);
  };

  function closeDetail() {
    setDetail(undefined);
    setReturnFocusCount((count) => count + 1);
  }

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
  const detailTask = tasks.find((task) => task.id === detail?.taskId);
  const detailCompletion = completions.find((completion) => completion.id === detail?.completionId);
  const rowActions: RowActions = {
    person: currentPerson,
    onOpen: openDetail,
    onTakeOver: takeOverFromRow,
    onToggleItem: toggleInRow,
  };

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
          <DayTile
            day={shown}
            names={names}
            headingRef={dayHeading}
            actions={rowActions}
            onComplete={complete}
          />
          <div class="side-tiles">
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
            <ProgressTile progress={view.progress} current={weekOffset === 0} />
          </div>
          <WeekStrip
            days={view.days}
            chosen={shown.day}
            names={names}
            onChoose={chooseDay}
            onOpen={openDetail}
          />
        </div>
      )}

      <TaskDetailDialog
        task={detailTask && detail ? detailTask : undefined}
        completion={detailCompletion}
        names={names}
        person={currentPerson}
        today={today}
        onClose={closeDetail}
        onToggleItem={toggleInDetail}
        onTakeOver={takeOverFromDetail}
      />
      <TakeOverDialog
        task={takingOver}
        names={names}
        person={currentPerson}
        onConfirm={confirmTakeOver}
        onCancel={cancelTakeOver}
      />
    </>
  );
}

/** What the rows of the tiles can do besides ticking off. */
interface RowActions {
  readonly person: Person;
  readonly onOpen: OpenDetail;
  readonly onTakeOver: (task: Task, from: HTMLElement) => void;
  readonly onToggleItem: (task: Task, itemId: string, checked: boolean) => void;
}

/** "Übernehmen" is offered for what somebody else (or both) is responsible for right now. */
function canTakeOver(task: Task, person: Person): boolean {
  return effectiveAssignee(task) !== person;
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
  return task.kind === "recurring" ? describeRecurrence(task.recurrence) : "einmalig";
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
      </div>
      {open && (takeOver || checklist.length > 0) && (
        <div class="entry__extras">
          {takeOver && (
            <button
              class="btn btn--secondary btn--small"
              type="button"
              aria-label={`Übernehmen: ${task.title}`}
              onClick={(event) => actions.onTakeOver(task, event.currentTarget)}
            >
              Übernehmen
            </button>
          )}
          {checklist.length > 0 && (
            <button
              class="btn btn--secondary btn--small entry__toggle"
              type="button"
              aria-label={`Checkliste: ${task.title}`}
              aria-expanded={itemsShown}
              aria-controls={itemsId}
              onClick={() => setItemsShown(!itemsShown)}
            >
              Checkliste
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
          Überfällig
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
                  {describeOverdue(daysOverdue)} (seit {formatShortDay(task.dueDate)}) ·{" "}
                  {responsibilityOf(task, names)}
                </span>
              </button>
              <div class="overdue__actions">
                <button
                  class="btn btn--warn-action"
                  type="button"
                  aria-label={`Abhaken: ${task.title}`}
                  onClick={() => onComplete(task)}
                >
                  Abhaken
                </button>
                {canTakeOver(task, actions.person) && (
                  <button
                    class="btn btn--warn-action"
                    type="button"
                    aria-label={`Übernehmen: ${task.title}`}
                    onClick={(event) => actions.onTakeOver(task, event.currentTarget)}
                  >
                    Übernehmen
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
                          ? `erledigt von ${names[entry.completion.completedBy]}`
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
