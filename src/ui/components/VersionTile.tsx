import { RefreshCw } from "lucide-preact";
import { t } from "../../i18n";
import { APP_BUILD, formatBuild } from "../appInfo";

/**
 * "Version": which build this device runs, and how a new one arrives. The button reloads the
 * page; an installed app has no reload of its own, and the page always asks the server first.
 */
export function VersionTile() {
  const words = t().version;
  return (
    <section class="tile tile--narrow form" aria-labelledby="version">
      <h2 class="tile__title" id="version">
        {words.title}
      </h2>
      <p>
        {words.build} <span data-build>{formatBuild(APP_BUILD)}</span>
      </p>
      <p class="muted">{words.hint}</p>
      <div class="button-row">
        <button class="btn btn--secondary" type="button" onClick={() => location.reload()}>
          <RefreshCw size={20} />
          {words.reload}
        </button>
      </div>
    </section>
  );
}
