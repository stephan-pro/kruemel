import { useState } from "preact/hooks";
import { dayFromDate } from "../../domain/date";
import { t } from "../../i18n";
import { rawDataFileName } from "../../storage/exportImport";
import type { StorageFailure } from "../../storage/storage";
import { ErrorAlert, ErrorDetails } from "../components/Alert";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PageTitle } from "../components/PageTitle";
import { downloadTextFile } from "../download";
import { errorText, type Failure, failureOf } from "../errorText";
import { SHARED_TEXTS } from "../householdTexts";

interface StorageProblemPageProps {
  /**
   * What the storage reported (see `StorageError`), or `loadFailed` for a failure the app has no
   * words for. The sentence is read when drawing, so it follows the language.
   */
  readonly reason: StorageFailure | "loadFailed";
  readonly details: readonly string[];
  /** The stored text as it is; missing if there is nothing to rescue or it cannot be read. */
  readonly rawData: string | undefined;
  /** The device's copy of the household's shared data (stage 2): it comes anew from the server. */
  readonly shared?: boolean;
  /** Deletes the stored data; rejects with an `Error` whose message is shown. */
  readonly onDiscard: () => Promise<void>;
  readonly onRetry: () => void;
}

/**
 * Shown instead of the app when the stored data cannot be used. The app never overwrites such
 * data by itself: the user first saves a copy (for a later repair) and then decides, after a
 * question, to start over.
 */
export function StorageProblemPage({
  reason,
  details,
  rawData,
  shared = false,
  onDiscard,
  onRetry,
}: StorageProblemPageProps) {
  const [downloaded, setDownloaded] = useState(false);
  const [asking, setAsking] = useState(false);
  const [discardError, setDiscardError] = useState<Failure>();
  const canRescue = rawData !== undefined;
  const words = t().storageProblem;

  function download() {
    if (rawData === undefined) {
      return;
    }
    downloadTextFile(rawDataFileName(dayFromDate(new Date())), rawData, "application/json");
    setDownloaded(true);
  }

  async function discard() {
    setAsking(false);
    try {
      await onDiscard();
    } catch (error) {
      setDiscardError(failureOf(error));
    }
  }

  return (
    <>
      <PageTitle title={canRescue ? words.titleRescue : words.titleNone} />
      <div class="page-stack page-stack--narrow">
        <ErrorAlert title={words.alertTitle}>
          <p>{reason === "loadFailed" ? t().errors.loadFailed : t().errors.storage[reason]}</p>
          <ErrorDetails details={details} />
        </ErrorAlert>

        {canRescue ? (
          <>
            <p>{shared ? SHARED_TEXTS.problemIntro : words.intro}</p>
            <section class="tile form" aria-labelledby="schritt-1">
              <h2 class="tile__title" id="schritt-1">
                {words.step1}
              </h2>
              <div class="button-row">
                <button class="btn btn--primary" type="button" onClick={download}>
                  {words.downloadRaw}
                </button>
              </div>
              <p class="form-status" role="status">
                {downloaded ? words.rawDownloaded : ""}
              </p>
            </section>
            {downloaded && (
              <section class="tile form" aria-labelledby="schritt-2">
                <h2 class="tile__title" id="schritt-2">
                  {shared ? SHARED_TEXTS.fromServerTitle : words.step2}
                </h2>
                <p>{shared ? SHARED_TEXTS.fromServerText : words.step2Text}</p>
                {discardError && (
                  <ErrorAlert title={t().common.notDeleted}>
                    {errorText(discardError.cause)}
                  </ErrorAlert>
                )}
                <div class="button-row">
                  <button class="btn btn--secondary" type="button" onClick={() => setAsking(true)}>
                    {shared ? SHARED_TEXTS.fromServer : words.startOver}
                  </button>
                </div>
              </section>
            )}
          </>
        ) : (
          <p>{words.cannotRead}</p>
        )}

        <div class="button-row">
          <button class="btn btn--quiet" type="button" onClick={onRetry}>
            {words.retry}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={asking}
        title={shared ? SHARED_TEXTS.fromServerQuestion : words.question}
        confirmLabel={shared ? SHARED_TEXTS.fromServerConfirm : words.confirm}
        onConfirm={discard}
        onCancel={() => setAsking(false)}
      >
        <p>{shared ? SHARED_TEXTS.fromServerDialog : words.dialog}</p>
      </ConfirmDialog>
    </>
  );
}
