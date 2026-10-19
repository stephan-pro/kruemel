import { useState } from "preact/hooks";
import { dayFromDate } from "../../domain/date";
import { rawDataFileName } from "../../storage/exportImport";
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
      <div class="stack">
        <div class="kern-alert kern-alert--danger" role="alert">
          <div class="kern-alert__header">
            <span class="kern-icon kern-icon--danger" aria-hidden="true" />
            <span class="kern-title">Die Daten werden nicht angezeigt</span>
          </div>
          <div class="kern-alert__body">
            <p class="kern-body">{message}</p>
            {details.length > 0 && (
              <ul class="kern-list kern-list--bullet">
                {details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {canRescue ? (
          <>
            <p class="kern-body">
              Die Putzplan-App hat nichts verändert und überschreibt die Daten nicht von selbst.
              Sichern Sie sie zuerst als Datei, damit sich der Fehler später reparieren lässt.
              Danach können Sie neu beginnen.
            </p>
            <section class="stack" aria-labelledby="schritt-1">
              <h2 class="kern-title" id="schritt-1">
                1. Rohdaten herunterladen
              </h2>
              <div>
                <button class="kern-btn kern-btn--primary" type="button" onClick={download}>
                  <span class="kern-label">Rohdaten herunterladen</span>
                </button>
              </div>
              <p class="kern-body" role="status">
                {downloaded
                  ? "Die Rohdaten wurden als Datei heruntergeladen. Bewahren Sie die Datei auf."
                  : ""}
              </p>
            </section>
            {downloaded && (
              <section class="stack" aria-labelledby="schritt-2">
                <h2 class="kern-title" id="schritt-2">
                  2. Neu beginnen
                </h2>
                <p class="kern-body">
                  Dabei werden die gespeicherten Daten in diesem Browser gelöscht. Aufgaben und
                  Erledigtes sind dann nur noch in der heruntergeladenen Datei vorhanden.
                </p>
                {discardError && (
                  <div class="kern-alert kern-alert--danger" role="alert">
                    <div class="kern-alert__header">
                      <span class="kern-icon kern-icon--danger" aria-hidden="true" />
                      <span class="kern-title">Nicht gelöscht</span>
                    </div>
                    <div class="kern-alert__body">
                      <p class="kern-body">{discardError}</p>
                    </div>
                  </div>
                )}
                <div>
                  <button
                    class="kern-btn kern-btn--secondary"
                    type="button"
                    onClick={() => setAsking(true)}
                  >
                    <span class="kern-label">Neu beginnen …</span>
                  </button>
                </div>
              </section>
            )}
          </>
        ) : (
          <p class="kern-body">
            Der Browser-Speicher lässt sich gerade nicht lesen. Prüfen Sie, ob das Speichern von
            Website-Daten erlaubt ist (z. B. nicht im privaten Fenster), und versuchen Sie es dann
            erneut.
          </p>
        )}

        <div>
          <button class="kern-btn kern-btn--tertiary" type="button" onClick={onRetry}>
            <span class="kern-label">Erneut versuchen</span>
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
        <p class="kern-body">
          Die gespeicherten Daten in diesem Browser werden gelöscht. Das lässt sich nicht rückgängig
          machen. Die heruntergeladene Datei bleibt erhalten.
        </p>
      </ConfirmDialog>
    </>
  );
}
