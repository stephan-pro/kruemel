import { useEffect, useRef, useState } from "preact/hooks";
import { effectiveAssignee, type TakeOverMode } from "../domain/assignment";
import type { CalendarDay } from "../domain/date";
import type { Completion, Person, Task } from "../domain/task";
import type { WeekEntry } from "../domain/week";
import type { PersonNames } from "../storage/appData";
import { ErrorAlert } from "./components/Alert";
import { TakeOverDialog } from "./components/TakeOverDialog";
import { TaskDetailDialog } from "./components/TaskDetailDialog";
import { completionNotice, takeOverNotice, undoNotice } from "./format";

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
export type OpenDetail = (target: DetailTarget, from: HTMLElement) => void;

/** What the rows of a page can do besides ticking off. */
export interface RowActions {
  readonly person: Person;
  readonly onOpen: OpenDetail;
  readonly onTakeOver: (task: Task, from: HTMLElement) => void;
  readonly onToggleItem: (task: Task, itemId: string, checked: boolean) => void;
}

/** "Übernehmen" is offered for what somebody else (or both) is responsible for right now. */
export function canTakeOver(task: Task, person: Person): boolean {
  return effectiveAssignee(task) !== person;
}

/** Opening a done task shows it with its completion, an open one without. */
export function targetOf(entry: WeekEntry): DetailTarget {
  return {
    taskId: entry.task.id,
    completionId: entry.kind === "done" ? entry.completion.id : undefined,
  };
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

interface TaskActionsInput {
  readonly tasks: readonly Task[];
  readonly completions: readonly Completion[];
  readonly names: PersonNames;
  /** "Ich bin": decides who is noted as having done a task and who takes over. */
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
  /** Where the focus goes when the button that opened a dialog is gone. */
  readonly fallbackFocus: { readonly current: HTMLElement | null };
}

/**
 * Everything a page of tasks does with them: ticking off with "Rückgängig", the details, the checklist
 * and "Übernehmen" (F2, F4, F5, F6). The page draws `messages` above its tasks and `dialogs`
 * anywhere, and hands `rowActions` to its rows.
 */
export function useTaskActions(input: TaskActionsInput) {
  const { tasks, completions, names, currentPerson, today, fallbackFocus } = input;
  const [notice, setNotice] = useState<Notice>();
  const [noticeCount, setNoticeCount] = useState(0);
  const [detail, setDetail] = useState<DetailTarget>();
  const [takingOver, setTakingOver] = useState<Task>();
  const [returnFocusCount, setReturnFocusCount] = useState(0);
  const [error, setError] = useState<string>();
  const noticeBox = useRef<HTMLElement>(null);
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
    (target || fallbackFocus.current)?.focus();
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
      const result = await input.onComplete(task.id);
      return {
        text: completionNotice(task.title, result.completion),
        undo: { completionId: result.completion.id, title: task.title },
      };
    });

  const undo = ({ completionId, title }: { completionId: string; title: string }) =>
    run(async () => {
      const task = await input.onUndo(completionId);
      return { text: undoNotice(title, task.dueDate) };
    });

  /** Saves the takeover and says what happened; rejects if it could not be saved. */
  async function takeOverNow(task: Task, mode: TakeOverMode): Promise<Notice> {
    await input.onTakeOver(task.id, mode);
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
      await input.onChecklistItem(task.id, itemId, checked);
    } catch (failure) {
      setError(messageOf(failure));
    }
  }

  async function toggleInDetail(task: Task, itemId: string, checked: boolean) {
    await input.onChecklistItem(task.id, itemId, checked);
  }

  const openDetail: OpenDetail = (target, from) => {
    opener.current = { element: from, taskId: target.taskId };
    setDetail(target);
  };

  function closeDetail() {
    setDetail(undefined);
    setReturnFocusCount((count) => count + 1);
  }

  const detailTask = tasks.find((task) => task.id === detail?.taskId);
  const detailCompletion = completions.find((completion) => completion.id === detail?.completionId);
  const rowActions: RowActions = {
    person: currentPerson,
    onOpen: openDetail,
    onTakeOver: takeOverFromRow,
    onToggleItem: toggleInRow,
  };

  const messages = (
    <>
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
    </>
  );

  const dialogs = (
    <>
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

  return { complete, rowActions, messages, dialogs };
}
