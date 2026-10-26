import { Download, Upload } from "lucide-preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { CalendarDay } from "../../domain/date";
import { t } from "../../i18n";
import type { AppData } from "../../storage/appData";
import {
  autoBackupFileName,
  exportData,
  exportFileName,
  importData,
  importTooBig,
} from "../../storage/exportImport";
import { downloadTextFile } from "../download";
import { errorText } from "../errorText";
import { describeContents, exportNotice, importNotice } from "../format";
import { SHARED_TEXTS } from "../householdTexts";
import { ErrorAlert, ErrorDetails } from "./Alert";
import { ConfirmDialog } from "./ConfirmDialog";

interface BackupTileProps {
  /** Everything the app keeps; this is what the backup file holds. */
  readonly data: AppData;
  readonly today: CalendarDay;
  /**
   * The household's shared data (stage 2): downloading works offline (from the device's copy),
   * putting a backup in place replaces the data for both and only works online.
   */
  readonly shared?: boolean;
  /** Replaces all data; rejects with an `Error` whose message is shown. */
  readonly onImport: (data: AppData) => Promise<void>;
}

/** A backup file that was read and checked, waiting for the user's answer to the question. */
interface PendingImport {
  readonly data: AppData;
  readonly fileName: string;
}

/**
 * A text chosen now and read when it is drawn, so a switch of the language changes a message
 * that is already on the screen.
 */
type Later = () => string;

/** Why a file was not taken: a sentence, plus where exactly it is wrong. */
interface ImportProblem {
  readonly title: Later;
  readonly message: Later;
  readonly details: readonly string[];
}

function contentsOf(data: AppData): string {
  return describeContents(data.tasks.length, data.completions.length);
}

/**
 * "Sicherung" (F7): all data as a file, and back from such a file. Putting a backup in place
 * replaces everything, so the file is checked first, then the user is asked, and a copy of the
 * current data is downloaded before anything is replaced. A file with errors changes nothing.
 */
export function BackupTile({ data, today, shared = false, onImport }: BackupTileProps) {
  /** Says that nothing was changed: the first thing to know after a failed import. */
  const unchanged = (reason: Later): Later => {
    return () => `${reason()} ${shared ? SHARED_TEXTS.unchanged : t().backup.unchanged}`;
  };
  const importFailed: Later = () => t().backup.importFailed;
  const [status, setStatus] = useState<{ readonly text: Later }>();
  const [problem, setProblem] = useState<ImportProblem>();
  const [pending, setPending] = useState<PendingImport>();
  const [returnFocusCount, setReturnFocusCount] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  /** The button that started the import; it gets the focus back (Safari does not focus clicked buttons). */
  const importButton = useRef<HTMLButtonElement | null>(null);

  // After the question closes, the focus goes back to the button that led to it. Runs after the
  // dialog has closed, so it wins over the browser's own attempt.
  useEffect(() => {
    if (returnFocusCount > 0) {
      importButton.current?.focus();
    }
  }, [returnFocusCount]);

  function download() {
    const fileName = exportFileName(today);
    setProblem(undefined);
    try {
      downloadTextFile(fileName, exportData(data), "application/json");
      setStatus({ text: () => exportNotice(fileName) });
    } catch (error) {
      setStatus(undefined);
      setProblem({
        title: () => t().backup.downloadFailed,
        message: () => errorText(error),
        details: [],
      });
    }
  }

  function chooseFile(button: HTMLButtonElement) {
    importButton.current = button;
    if (shared && !navigator.onLine) {
      setStatus(undefined);
      setProblem({
        title: importFailed,
        message: unchanged(() => SHARED_TEXTS.importOffline),
        details: [],
      });
      return;
    }
    fileInput.current?.click();
  }

  async function readFile(input: HTMLInputElement) {
    const file = input.files?.[0];
    // The same file may be chosen again later.
    const reset = () => {
      input.value = "";
    };
    if (file === undefined) {
      return;
    }
    setStatus(undefined);
    setProblem(undefined);
    if (importTooBig(file.size)) {
      setProblem({
        title: importFailed,
        message: unchanged(() => t().backup.tooBig),
        details: [],
      });
      reset();
      return;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      setProblem({
        title: importFailed,
        message: unchanged(() => t().backup.unreadable),
        details: [],
      });
      reset();
      return;
    }
    reset();
    const result = importData(text);
    if (result.ok) {
      setPending({ data: result.data, fileName: file.name });
    } else {
      setProblem({
        title: importFailed,
        message: unchanged(() => t().backup.notABackup),
        details: result.errors,
      });
    }
  }

  function cancel() {
    setPending(undefined);
    setReturnFocusCount((count) => count + 1);
  }

  async function confirm() {
    const chosen = pending;
    if (chosen === undefined) {
      return;
    }
    setPending(undefined);
    // The copy of the current data comes first: once the data is replaced it would be gone.
    const backupName = autoBackupFileName(today);
    try {
      downloadTextFile(backupName, exportData(data), "application/json");
      await onImport(chosen.data);
      setStatus({ text: () => importNotice(contentsOf(chosen.data), backupName) });
    } catch (error) {
      setProblem({
        title: importFailed,
        message: unchanged(() => errorText(error)),
        details: [],
      });
    } finally {
      // Last: the download and the new data must not take the focus away again.
      setReturnFocusCount((count) => count + 1);
    }
  }

  const words = t().backup;
  return (
    <section class="tile tile--narrow form" aria-labelledby="sicherung">
      <h2 class="tile__title" id="sicherung">
        {words.title}
      </h2>
      <p class="muted">
        {shared ? SHARED_TEXTS.backupIntro : words.intro} {words.deviceNote}
      </p>

      <div class="backup__block">
        <h3 class="backup__title">{words.downloadTitle}</h3>
        <p>{words.nowOnDevice(contentsOf(data))}</p>
        <div class="button-row">
          <button class="btn btn--primary" type="button" onClick={download}>
            <Download size={20} />
            {words.download}
          </button>
        </div>
      </div>

      <div class="backup__block">
        <h3 class="backup__title">{words.importTitle}</h3>
        <p>{shared ? SHARED_TEXTS.importIntro : words.importIntro}</p>
        <div class="button-row">
          <button
            class="btn btn--secondary"
            type="button"
            onClick={(event) => chooseFile(event.currentTarget)}
          >
            <Upload size={20} />
            {words.importButton}
          </button>
        </div>
        {/* Opened by the button above; hidden, so the button is the one control to find and focus. */}
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          tabIndex={-1}
          onChange={(event) => void readFile(event.currentTarget)}
        />
      </div>

      {problem && (
        <ErrorAlert title={problem.title()}>
          <p>{problem.message()}</p>
          <ErrorDetails details={problem.details} />
        </ErrorAlert>
      )}
      <p class="form-status" role="status">
        {status?.text() ?? ""}
      </p>

      <ConfirmDialog
        open={pending !== undefined}
        title={words.question}
        confirmLabel={words.confirm}
        onConfirm={() => void confirm()}
        onCancel={cancel}
      >
        {pending && (
          <>
            <p>{words.fileContains(pending.fileName, contentsOf(pending.data))}</p>
            <p>
              {shared
                ? SHARED_TEXTS.importReplaces(contentsOf(data))
                : words.replaces(contentsOf(data))}
            </p>
            <p>{words.autoCopy(autoBackupFileName(today))}</p>
          </>
        )}
      </ConfirmDialog>
    </section>
  );
}
