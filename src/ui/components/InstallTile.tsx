import { Smartphone } from "lucide-preact";
import { useRef } from "preact/hooks";
import type { InstallWay } from "../install";
import { InstallSteps } from "./InstallSteps";

interface InstallTileProps {
  readonly way: InstallWay;
  /** Asks the browser's own install question (`prompt`). */
  readonly onInstall: () => Promise<boolean>;
}

/** "Als App installieren" in the settings: always there, whatever happened to the week's hint. */
export function InstallTile({ way, onInstall }: InstallTileProps) {
  const heading = useRef<HTMLHeadingElement>(null);

  async function install() {
    await onInstall();
    // The button is gone either way (installed, or the browser's question is used up).
    heading.current?.focus();
  }

  return (
    <section class="tile tile--narrow form" aria-labelledby="installieren">
      <h2 class="tile__title" id="installieren" tabIndex={-1} ref={heading}>
        Als App installieren
      </h2>
      {way === "installed" ? (
        <p>Putzplan ist auf diesem Gerät als App installiert.</p>
      ) : (
        <>
          <p class="muted">
            Vom Home-Bildschirm startet Putzplan wie eine App: ohne Adressleiste und auch ohne
            Internet.
          </p>
          {way === "prompt" ? (
            <div class="button-row">
              <button class="btn btn--primary" type="button" onClick={() => void install()}>
                <Smartphone size={20} />
                App installieren
              </button>
            </div>
          ) : (
            <InstallSteps way={way} />
          )}
        </>
      )}
    </section>
  );
}
