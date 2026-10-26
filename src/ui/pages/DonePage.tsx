import { Undo2 } from "lucide-preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { doneEntries } from "../../domain/done";
import type { Completion, Task } from "../../domain/task";
import { t } from "../../i18n";
import type { PersonNames } from "../../storage/appData";
import { ErrorAlert } from "../components/Alert";
import { PageTitle } from "../components/PageTitle";
import { TaskSymbol } from "../components/TaskSymbol";
import { errorText } from "../errorText";
import { countEntries, describeCompletedBy, undoNotice } from "../format";
import { routeInfo } from "../route";

interface DonePageProps {
  readonly tasks: readonly Task[];
  readonly completions: readonly Completion[];
  readonly names: PersonNames;
  /** Takes the completion back and gives the task as it is now; rejects with an `Error` whose message is shown. */
  readonly onUndo: (completionId: string) => Promise<Task>;
}

/**
 * "Erledigt": every completed one-off task and every completed pass of a recurring task, newest
 * first (F3). The last completion of a task can be taken back from here at any time (F2).
 */
export function DonePage({ tasks, completions, names, onUndo }: DonePageProps) {
  const [notice, setNotice] = useState<string>();
  const [noticeCount, setNoticeCount] = useState(0);
  const [error, setError] = useState<string>();
  const noticeBox = useRef<HTMLElement>(null);
  const busy = useRef(false);
  const entries = doneEntries(tasks, completions);

  // The button that was pressed is gone with its row, so the focus goes to the message: it is read
  // out there, and the next stop is the list again.
  useEffect(() => {
    if (noticeCount > 0) {
      noticeBox.current?.focus();
    }
  }, [noticeCount]);

  async function undo(completionId: string, title: string) {
    if (busy.current) {
      return;
    }
    busy.current = true;
    try {
      setError(undefined);
      const task = await onUndo(completionId);
      setNotice(undoNotice(title, task.dueDate));
      setNoticeCount((count) => count + 1);
    } catch (failure) {
      setError(errorText(failure));
    } finally {
      busy.current = false;
    }
  }

  return (
    <>
      <PageTitle title={routeInfo("done").title} />
      {notice && (
        <section class="snackbar" aria-label={t().common.notice} tabIndex={-1} ref={noticeBox}>
          <p>{notice}</p>
        </section>
      )}
      <div class="page-stack">
        {error && <ErrorAlert title={t().common.notSaved}>{error}</ErrorAlert>}

        <section class="tile" aria-labelledby="erledigt-liste">
          <div class="tile__head">
            <h2 class="tile__title" id="erledigt-liste">
              {t().doneList.title}
            </h2>
            <span class="tile__aside">{countEntries(entries.length)}</span>
          </div>
          {entries.length === 0 ? (
            <p class="muted">{t().doneList.empty}</p>
          ) : (
            <>
              <p class="muted">{t().doneList.undoHint}</p>
              <ul class="entries">
                {entries.map(({ completion, task, canUndo }) => (
                  <li class="entry" key={completion.id}>
                    <div class="done-row">
                      <TaskSymbol symbol={task.symbol} />
                      <span class="entry__text">
                        <span class="entry__title">{task.title}</span>
                        <span class="entry__meta">{describeCompletedBy(completion, names)}</span>
                      </span>
                      {canUndo && (
                        <button
                          class="btn btn--secondary btn--small done-row__undo"
                          type="button"
                          aria-label={t().common.undoTask(task.title)}
                          onClick={() => undo(completion.id, task.title)}
                        >
                          <Undo2 size={18} />
                          {t().common.undo}
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </>
  );
}
