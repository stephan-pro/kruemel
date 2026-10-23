import { QrCode as QrCodeIcon } from "lucide-preact";
import { useId, useState } from "preact/hooks";
import { QrCode } from "./QrCode";

interface OtherDeviceTileProps {
  /** The app's address, the content of the code. */
  readonly address: string;
  /** The data are the household's shared data: signing in there brings them, a backup would not. */
  readonly shared?: boolean;
}

/**
 * "Auf anderem Gerät öffnen": a QR code with the app's address, for the camera of a phone. Hidden
 * until asked for, so the settings stay short.
 */
export function OtherDeviceTile({ address, shared = false }: OtherDeviceTileProps) {
  const [shown, setShown] = useState(false);
  const codeId = useId();

  return (
    <section class="tile tile--narrow form" aria-labelledby="anderes-geraet">
      <h2 class="tile__title" id="anderes-geraet">
        Auf anderem Gerät öffnen
      </h2>
      {shared ? (
        <p class="muted">
          Den QR-Code mit der Kamera eines Handys scannen, um Krümel dort zu öffnen. Melde dich dort
          mit derselben E-Mail-Adresse an, dann sind eure Daten da.
        </p>
      ) : (
        <p class="muted">
          Den QR-Code mit der Kamera eines Handys scannen, um Krümel dort zu öffnen. Die Daten
          kommen nicht mit: Jedes Gerät hat seine eigenen. Übertragen lassen sie sich mit
          „Sicherung“.
        </p>
      )}
      <div class="button-row">
        <button
          class="btn btn--secondary"
          type="button"
          aria-expanded={shown}
          aria-controls={codeId}
          onClick={() => setShown(!shown)}
        >
          <QrCodeIcon size={20} />
          {shown ? "QR-Code ausblenden" : "QR-Code zeigen"}
        </button>
      </div>
      <div class="qr" id={codeId} hidden={!shown}>
        {shown && <QrCode content={address} label={`QR-Code mit der Adresse ${address}`} />}
        <p class="qr__address">{address}</p>
      </div>
    </section>
  );
}
