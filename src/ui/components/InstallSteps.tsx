import { EllipsisVertical, Share, SquarePlus } from "lucide-preact";
import type { ComponentChildren } from "preact";
import type { InstallWay } from "../install";

interface InstallStepsProps {
  /** `ios`, `firefoxAndroid` or `other`; the browser's own question needs no steps. */
  readonly way: Exclude<InstallWay, "installed" | "prompt">;
}

/**
 * How to put Krümel on the home screen by hand, step by step. Each step shows a picture of what
 * to tap, drawn like the browser shows it (decoration: the text says the same).
 */
export function InstallSteps({ way }: InstallStepsProps) {
  if (way === "ios") {
    return (
      <>
        <ol class="install-steps">
          <Step picture={<Share size={24} />}>
            In Safari auf <strong>Teilen</strong> tippen (Quadrat mit Pfeil nach oben, unten in der
            Leiste oder neben der Adresse). Steht dort nur <strong>•••</strong>, erst darauf tippen.
          </Step>
          <Step picture={<SquarePlus size={24} />}>
            In der Liste <strong>Zum Home-Bildschirm</strong> wählen (eventuell weiter nach unten
            wischen oder auf <strong>Mehr</strong> tippen).
          </Step>
          <Step picture={<span class="install-steps__word">Hinzufügen</span>}>
            Oben rechts auf <strong>Hinzufügen</strong> tippen. Krümel liegt jetzt auf dem
            Home-Bildschirm.
          </Step>
        </ol>
        <p class="install-note">
          <strong>Wichtig:</strong> Die App vom Home-Bildschirm hat eigene Daten, getrennt von
          Safari. Was du schon in Safari eingetragen hast, nimmst du über „Sicherung“ mit: hier
          herunterladen, in der App einspielen.
        </p>
      </>
    );
  }
  if (way === "firefoxAndroid") {
    return (
      <>
        <ol class="install-steps">
          <Step picture={<EllipsisVertical size={24} />}>
            In Firefox das <strong>Menü ⋮</strong> öffnen (neben der Adresse).
          </Step>
          <Step picture={<SquarePlus size={24} />}>
            <strong>Zum Startbildschirm hinzufügen</strong> wählen (heißt je nach Version auch{" "}
            <strong>App installieren</strong>) und mit <strong>Hinzufügen</strong> bestätigen.
          </Step>
        </ol>
        <XiaomiNote browser="Firefox" />
      </>
    );
  }
  return (
    <>
      <p>
        Bietet dein Browser es an, steht im Browsermenü <strong>App installieren</strong> oder{" "}
        <strong>Zum Startbildschirm hinzufügen</strong>. Am einfachsten geht es auf dem iPhone in
        Safari und auf Android-Handys in Chrome oder Firefox; Firefox am PC kann keine Apps
        installieren.
      </p>
      {/Android/.test(navigator.userAgent) && <XiaomiNote browser="der Browser" />}
    </>
  );
}

function Step({
  picture,
  children,
}: {
  readonly picture: ComponentChildren;
  readonly children: ComponentChildren;
}) {
  return (
    <li class="install-steps__step">
      <span class="install-steps__picture" aria-hidden="true">
        {picture}
      </span>
      <p>{children}</p>
    </li>
  );
}

/** Seen in the device test: on Xiaomi phones nothing happens without this permission, no message. */
function XiaomiNote({ browser }: { readonly browser: string }) {
  return (
    <p class="install-note">
      <strong>Passiert beim Hinzufügen nichts?</strong> Auf Handys von Xiaomi, Redmi und POCO
      braucht {browser} dafür eine Erlaubnis: in den Einstellungen des Handys{" "}
      <strong>
        Apps → Apps verwalten → {browser === "Firefox" ? "Firefox" : "Name des Browsers"} → Weitere
        Berechtigungen → Startbildschirm-Verknüpfungen
      </strong>{" "}
      erlauben, dann noch einmal versuchen.
    </p>
  );
}
