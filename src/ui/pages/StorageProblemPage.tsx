import { useState } from "preact/hooks";
import { dayFromDate } from "../../domain/date";
import { rawDataFileName } from "../../storage/exportImport";
import { ErrorAlert } from "../components/Alert";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PageTitle } from "../components/PageTitle";
import { downloadTextFile } from "../download";

interface StorageProblemPageProps {
  /** What the storage reported (see `StorageError`). */
  readonly message: string;
  readonly details: readonly string[];
  /** The stored text as it is; missing if there is nothing to rescue or it cannot be read. */
  readonly rawData: string | undefined;
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
              Die Krümel-App hat nichts verändert und überschreibt die Daten nicht von selbst.
              Sichern Sie sie zuerst als Datei, damit sich der Fehler später reparieren lässt.
              Danach können Sie neu beginnen.
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
                  ? "Die Rohdaten wurden als Datei heruntergeladen. Bewahren Sie die Datei auf."
                  : ""}
              </p>
            </section>
            {downloaded && (
              <section class="tile form" aria-labelledby="schritt-2">
                <h2 class="tile__title" id="schritt-2">
                  2. Neu beginnen
                </h2>
                <p>
                  Dabei werden die gespeicherten Daten in diesem Browser gelöscht. Aufgaben und
                  Erledigtes sind dann nur noch in der heruntergeladenen Datei vorhanden.
                </p>
                {discardError && <ErrorAlert title="Nicht gelöscht">{discardError}</ErrorAlert>}
                <div class="button-row">
                  <button class="btn btn--secondary" type="button" onClick={() => setAsking(true)}>
                    Neu beginnen …
                  </button>
                </div>
              </section>
            )}
          </>
        ) : (
          <p>
            Der Browser-Speicher lässt sich gerade nicht lesen. Prüfen Sie, ob das Speichern von
            Website-Daten erlaubt ist (z. B. nicht im privaten Fenster), und versuchen Sie es dann
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
        title="Wirklich neu beginnen?"
        confirmLabel="Ja, Daten löschen"
        onConfirm={discard}
        onCancel={() => setAsking(false)}
      >
        <p>
          Die gespeicherten Daten in diesem Browser werden gelöscht. Das lässt sich nicht rückgängig
          machen. Die heruntergeladene Datei bleibt erhalten.
        </p>
      </ConfirmDialog>
    </>
  );
}
