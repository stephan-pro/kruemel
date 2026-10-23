import { CircleAlert, CloudOff, Download, Info, X } from "lucide-preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { Person } from "../../domain/task";
import type { PersonNames } from "../../storage/appData";
import type { StorageUpdate, SyncStatus } from "../../storage/storage";
import { SYNC_TEXTS } from "../householdTexts";
import { ConfirmDialog } from "./ConfirmDialog";

/** A conflict the server decided against this device, as said to the person. */
export interface ConflictNotice {
  readonly id: number;
  readonly text: string;
}

interface SyncNoticesProps {
  readonly status: SyncStatus;
  /** How many changes the server refused for good. */
  readonly rejected: number;
  readonly conflicts: readonly ConflictNotice[];
  /** "Als Datei herunterladen": the refused changes as a file; they stay until discarded. */
  readonly onDownload: () => void;
  /** "Verwerfen" after the question. */
  readonly onDiscard: () => Promise<void>;
  readonly onCloseConflict: (id: number) => void;
}

/** What a conflict reported by the storage says to the person on this device (`me`). */
export function conflictText(
  conflict: Extract<StorageUpdate, { type: "conflict" }>,
  names: PersonNames,
  me: Person,
): string {
  switch (conflict.reason) {
    case "alreadyDone":
      return conflict.by === undefined || conflict.by === me
        ? SYNC_TEXTS.alreadyDoneByMe(conflict.title)
        : SYNC_TEXTS.alreadyDone(conflict.title, names[conflict.by]);
    case "taskGone":
      return SYNC_TEXTS.taskGone(conflict.title);
    case "notLast":
    case "completionGone":
      return SYNC_TEXTS.undoGone(conflict.title);
  }
}

/** "Kein Internet – 2 Änderungen warten auf Verbindung." or nothing when nothing waits. */
export function waitingText(status: SyncStatus): string | undefined {
  if (status.state === "offline" && status.pending > 0) {
    return SYNC_TEXTS.waitingOffline(status.pending);
  }
  if (status.state === "unreachable" && status.pending > 0) {
    return SYNC_TEXTS.waitingUnreachable(status.pending);
  }
  return undefined;
}

/** After something on the page vanished with the focus in it: back to the top of the page. */
function focusPageHeading() {
  document.querySelector<HTMLElement>("main h1")?.focus();
}

/**
 * The hints above the page about the shared data (E2-3c): changes waiting for a connection,
 * changes the server refused for good (with "Als Datei herunterladen" and "Verwerfen") and
 * conflicts (with ×). A hidden status line reads out what they say without taking the focus; the
 * hints themselves carry an icon and a text, never only a colour.
 */
export function SyncNotices({
  status,
  rejected,
  conflicts,
  onDownload,
  onDiscard,
  onCloseConflict,
}: SyncNoticesProps) {
  const waiting = waitingText(status);
  /** Something waited and now went through: "Alles übertragen." is read out once. */
  const [cleared, setCleared] = useState(false);
  const waited = useRef(false);
  const [asking, setAsking] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const opener = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (waiting !== undefined) {
      waited.current = true;
      setCleared(false);
    } else if (waited.current && status.state === "synced") {
      waited.current = false;
      setCleared(true);
    }
  }, [waiting, status.state]);

  useEffect(() => {
    if (rejected === 0) {
      setDownloaded(false);
    }
  }, [rejected]);

  // What the hints say now, by kind; the waiting hint is one kind whatever its number.
  const messages: (readonly [string, string])[] = [];
  if (waiting !== undefined) {
    messages.push(["waiting", waiting]);
  } else if (cleared) {
    messages.push(["cleared", SYNC_TEXTS.allSent]);
  }
  if (rejected > 0) {
    messages.push([`rejected-${rejected}`, SYNC_TEXTS.rejected(rejected)]);
    if (downloaded) {
      messages.push(["downloaded", SYNC_TEXTS.downloaded]);
    }
  }
  for (const conflict of conflicts) {
    messages.push([`conflict-${conflict.id}`, conflict.text]);
  }
  // The status line holds one entry per kind with the text it had when it came (K2b): a new entry
  // is read out, an entry already there is not read again (`aria-atomic="false"`), so going offline
  // is said once and not with every further change that waits.
  const said = useRef(new Map<string, string>());
  const announced = new Map<string, string>();
  for (const [kind, text] of messages) {
    announced.set(kind, said.current.get(kind) ?? text);
  }
  said.current = announced;

  function cancel() {
    setAsking(false);
    opener.current?.focus();
  }

  async function discard() {
    setAsking(false);
    await onDiscard();
    focusPageHeading();
  }

  function close(id: number) {
    onCloseConflict(id);
    focusPageHeading();
  }

  return (
    <>
      <p class="visually-hidden" role="status" aria-atomic="false">
        {[...announced].map(([kind, text]) => (
          <span key={kind}>{text} </span>
        ))}
      </p>
      {waiting !== undefined && (
        <aside class="demo-hint sync-hint" aria-label={SYNC_TEXTS.waitingLabel}>
          <CloudOff class="sync-hint__icon" size={20} aria-hidden="true" />
          <p class="sync-hint__text">{waiting}</p>
        </aside>
      )}
      {rejected > 0 && (
        <aside class="alert sync-alert" aria-label={SYNC_TEXTS.rejectedLabel}>
          <CircleAlert class="alert__icon" size={22} aria-hidden="true" />
          <div class="alert__body">
            <p class="alert__title">{SYNC_TEXTS.rejectedLabel}</p>
            <p>{SYNC_TEXTS.rejected(rejected)}</p>
            <p>{SYNC_TEXTS.rejectedHint}</p>
            <div class="button-row">
              <button
                class="btn btn--primary btn--small"
                type="button"
                onClick={() => {
                  onDownload();
                  setDownloaded(true);
                }}
              >
                <Download size={20} aria-hidden="true" />
                {SYNC_TEXTS.download}
              </button>
              <button
                class="btn btn--secondary btn--small"
                type="button"
                aria-haspopup="dialog"
                onClick={(event) => {
                  opener.current = event.currentTarget;
                  setAsking(true);
                }}
              >
                {SYNC_TEXTS.discard}
              </button>
            </div>
            {downloaded && <p class="muted">{SYNC_TEXTS.downloaded}</p>}
          </div>
        </aside>
      )}
      {conflicts.length > 0 && (
        <aside aria-label={SYNC_TEXTS.conflictLabel}>
          <ul class="sync-conflicts">
            {conflicts.map((conflict) => (
              <li key={conflict.id} class="demo-hint sync-hint">
                <Info class="sync-hint__icon" size={20} aria-hidden="true" />
                <p class="sync-hint__text">{conflict.text}</p>
                <button
                  class="icon-btn sync-hint__close"
                  type="button"
                  aria-label={SYNC_TEXTS.close}
                  onClick={() => close(conflict.id)}
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </aside>
      )}
      <ConfirmDialog
        open={asking}
        title={SYNC_TEXTS.discardQuestion(rejected)}
        confirmLabel={SYNC_TEXTS.discardConfirm}
        onConfirm={() => void discard()}
        onCancel={cancel}
      >
        <p>{SYNC_TEXTS.discardDialog}</p>
      </ConfirmDialog>
    </>
  );
}
