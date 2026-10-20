import { RefreshCw } from "lucide-preact";
import { APP_BUILD, formatBuild } from "../appInfo";

/**
 * "Version": which build this device runs, and how a new one arrives. The button reloads the
 * page; an installed app has no reload of its own, and the page always asks the server first.
 */
export function VersionTile() {
  return (
    <section class="tile tile--narrow form" aria-labelledby="version">
      <h2 class="tile__title" id="version">
        Version
      </h2>
      <p>
        Stand: <span data-build>{formatBuild(APP_BUILD)}</span>
      </p>
      <p class="muted">
        Neue Versionen kommen von selbst, wenn Putzplan mit Internet geöffnet wird. Lief die App im
        Hintergrund weiter, bleibt sie bei der alten Version, bis man sie neu lädt oder ganz
        schließt und wieder öffnet.
      </p>
      <div class="button-row">
        <button class="btn btn--secondary" type="button" onClick={() => location.reload()}>
          <RefreshCw size={20} />
          Neu laden
        </button>
      </div>
    </section>
  );
}
