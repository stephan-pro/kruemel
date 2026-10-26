import { QrCode as QrCodeIcon } from "lucide-preact";
import { useId, useState } from "preact/hooks";
import { t } from "../../i18n";
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
  const words = t().otherDevice;

  return (
    <section class="tile tile--narrow form" aria-labelledby="anderes-geraet">
      <h2 class="tile__title" id="anderes-geraet">
        {words.title}
      </h2>
      <p class="muted">{shared ? words.shared : words.plain}</p>
      <div class="button-row">
        <button
          class="btn btn--secondary"
          type="button"
          aria-expanded={shown}
          aria-controls={codeId}
          onClick={() => setShown(!shown)}
        >
          <QrCodeIcon size={20} />
          {shown ? words.hide : words.show}
        </button>
      </div>
      <div class="qr" id={codeId} hidden={!shown}>
        {shown && <QrCode content={address} label={words.codeLabel(address)} />}
        <p class="qr__address">{address}</p>
      </div>
    </section>
  );
}
