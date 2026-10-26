import { Smartphone, X } from "lucide-preact";
import { useEffect, useId, useRef, useState } from "preact/hooks";
import { t } from "../../i18n";
import type { InstallWay } from "../install";
import { InstallSteps } from "./InstallSteps";
import { Modal } from "./Modal";

interface InstallHintProps {
  /** `prompt`, `ios` or `firefoxAndroid` (`offersInstallHint`). */
  readonly way: InstallWay;
  /** Asks the browser's own install question (`prompt`). */
  readonly onInstall: () => void;
  /** "Hinweis schließen": the hint does not come back on this device. */
  readonly onDismiss: () => void;
  /** The data are the household's shared data (`InstallSteps`). */
  readonly shared?: boolean;
}

/**
 * A quiet hint at the end of the week view: Krümel can live on the home screen. One button
 * installs (where the browser can) or shows how; the cross closes it for good. Never in the way:
 * it stands below the tiles and does not take the focus.
 */
export function InstallHint({ way, onInstall, onDismiss, shared = false }: InstallHintProps) {
  const titleId = useId();
  const [guideOpen, setGuideOpen] = useState(false);
  const [returnFocusCount, setReturnFocusCount] = useState(0);
  const opener = useRef<HTMLElement | undefined>(undefined);

  // Back to the button after the guide closes (Safari does not focus clicked buttons by itself).
  useEffect(() => {
    if (returnFocusCount > 0) {
      opener.current?.focus();
    }
  }, [returnFocusCount]);

  function closeGuide() {
    setGuideOpen(false);
    setReturnFocusCount((count) => count + 1);
  }

  return (
    <section class="install-hint" aria-labelledby={titleId}>
      <span class="install-hint__icon" aria-hidden="true">
        <Smartphone size={22} />
      </span>
      <div class="install-hint__body">
        <h2 class="install-hint__title" id={titleId}>
          {t().install.hintTitle}
        </h2>
        <p>{t().install.hintText}</p>
        <div class="button-row">
          {way === "prompt" ? (
            <button class="btn btn--primary btn--small" type="button" onClick={onInstall}>
              {t().install.install}
            </button>
          ) : (
            <button
              class="btn btn--secondary btn--small"
              type="button"
              aria-haspopup="dialog"
              onClick={(event) => {
                opener.current = event.currentTarget;
                setGuideOpen(true);
              }}
            >
              {t().install.showGuide}
            </button>
          )}
        </div>
      </div>
      <button
        class="icon-btn install-hint__close"
        type="button"
        aria-label={t().install.dismiss}
        onClick={onDismiss}
      >
        <X size={22} />
      </button>
      {(way === "ios" || way === "firefoxAndroid") && (
        <Modal open={guideOpen} title={t().install.guideTitle} onCancel={closeGuide} focusTitle>
          <div class="dialog__body">
            <InstallSteps way={way} shared={shared} />
          </div>
          <div class="button-row">
            <button class="btn btn--secondary" type="button" onClick={closeGuide}>
              {t().common.close}
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
