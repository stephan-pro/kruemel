import { useState } from "preact/hooks";
import { dayFromDate } from "../../domain/date";
import { rawDataFileName } from "../../storage/exportImport";
import { ErrorAlert } from "../components/Alert";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PageTitle } from "../components/PageTitle";
import { downloadTextFile } from "../download";
import { SHARED_TEXTS } from "../householdTexts";

interface StorageProblemPageProps {
  /** What the storage reported (see `StorageError`). */
  readonly message: string;
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
  message,
  details,
  rawData,
  shared = false,
  onDiscard,
  onRetry,
}: StorageProblemPageProps) {
  const [downloaded, setDownloaded] = useState(false);
  const [asking, setAsking] = useState(false);
  const [discardError, setDiscardError] = useState<string>();
  const canRescue = rawData !== undefined;

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
      setDiscardError(error instanceof Error ? error.message : String(error));
    }
  }

  return (
    <>
      <PageTitle
        title={canRescue ? "Gespeicherte Daten nicht lesbar" : "Speicher nicht verfügbar"}
      />
      <div class="page-stack page-stack--narrow">
        <ErrorAlert title="Die Daten werden nicht angezeigt">
          <p>{message}</p>
          {details.length > 0 && (
            <ul class="bullet-list">
              {details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          )}
        </ErrorAlert>

        {canRescue ? (
          <>
            <p>
              {shared
                ? SHARED_TEXTS.problemIntro
                : "Die Krümel-App hat nichts verändert und überschreibt die Daten nicht von selbst. Sichere sie zuerst als Datei, damit sich der Fehler später reparieren lässt. Danach kannst du neu beginnen."}
            </p>
            <section class="tile form" aria-labelledby="schritt-1">
              <h2 class="tile__title" id="schritt-1">
                1. Rohdaten herunterladen
              </h2>
              <div class="button-row">
                <button class="btn btn--primary" type="button" onClick={download}>
                  Rohdaten herunterladen
                </button>
              </div>
              <p class="form-status" role="status">
                {downloaded
                  ? "Die Rohdaten wurden als Datei heruntergeladen. Bewahre die Datei auf."
                  : ""}
              </p>
            </section>
            {downloaded && (
              <section class="tile form" aria-labelledby="schritt-2">
                <h2 class="tile__title" id="schritt-2">
                  {shared ? SHARED_TEXTS.fromServerTitle : "2. Neu beginnen"}
                </h2>
                <p>
                  {shared
                    ? SHARED_TEXTS.fromServerText
                    : "Dabei werden die gespeicherten Daten in diesem Browser gelöscht. Aufgaben und Erledigtes sind dann nur noch in der heruntergeladenen Datei vorhanden."}
                </p>
                {discardError && <ErrorAlert title="Nicht gelöscht">{discardError}</ErrorAlert>}
                <div class="button-row">
                  <button class="btn btn--secondary" type="button" onClick={() => setAsking(true)}>
                    {shared ? SHARED_TEXTS.fromServer : "Neu beginnen …"}
                  </button>
                </div>
              </section>
            )}
          </>
        ) : (
          <p>
            Der Browser-Speicher lässt sich gerade nicht lesen. Prüfe, ob das Speichern von
            Website-Daten erlaubt ist (z. B. nicht im privaten Fenster), und versuche es dann
            erneut.
          </p>
        )}

        <div class="button-row">
          <button class="btn btn--quiet" type="button" onClick={onRetry}>
            Erneut versuchen
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={asking}
        title={shared ? SHARED_TEXTS.fromServerQuestion : "Wirklich neu beginnen?"}
        confirmLabel={shared ? SHARED_TEXTS.fromServerConfirm : "Ja, Daten löschen"}
        onConfirm={discard}
        onCancel={() => setAsking(false)}
      >
        <p>
          {shared
            ? SHARED_TEXTS.fromServerDialog
            : "Die gespeicherten Daten in diesem Browser werden gelöscht. Das lässt sich nicht rückgängig machen. Die heruntergeladene Datei bleibt erhalten."}
        </p>
      </ConfirmDialog>
    </>
  );
}
