import { QrCode } from "lucide-preact";
import { useEffect, useId, useState } from "preact/hooks";
import type { QrPicture } from "../qrCode";
import { ErrorAlert } from "./Alert";

/** Modules of light margin around the code; scanners need it (QR standard: 4). */
const QUIET_ZONE = 4;

interface OtherDeviceTileProps {
  /** The app's address, the content of the code. */
  readonly address: string;
}

/**
 * "Auf anderem Gerät öffnen": a QR code with the app's address, for the camera of a phone. Hidden
 * until asked for, so the settings stay short.
 */
export function OtherDeviceTile({ address }: OtherDeviceTileProps) {
  const [shown, setShown] = useState(false);
  const [picture, setPicture] = useState<QrPicture>();
  const [failed, setFailed] = useState(false);
  const codeId = useId();

  // The QR encoder is loaded only when the code is asked for (about 15 KB less for every start).
  // The service worker keeps that file too, so it works without internet.
  useEffect(() => {
    if (!shown || picture !== undefined) {
      return;
    }
    let current = true;
    setFailed(false);
    import("../qrCode").then(
      ({ qrPicture }) => {
        if (current) {
          setPicture(qrPicture(address));
        }
      },
      () => {
        // An old version still open after an update asks for a file the new one replaced.
        if (current) {
          setFailed(true);
        }
      },
    );
    return () => {
      current = false;
    };
  }, [shown, picture, address]);
  const box = picture === undefined ? 0 : picture.size + 2 * QUIET_ZONE;

  return (
    <section class="tile tile--narrow form" aria-labelledby="anderes-geraet">
      <h2 class="tile__title" id="anderes-geraet">
        Auf anderem Gerät öffnen
      </h2>
      <p class="muted">
        Den Code mit der Kamera eines Handys scannen, um Putzplan dort zu öffnen. Die Daten kommen
        nicht mit: Jedes Gerät hat seine eigenen. Übertragen lassen sie sich mit „Sicherung“.
      </p>
      <div class="button-row">
        <button
          class="btn btn--secondary"
          type="button"
          aria-expanded={shown}
          aria-controls={codeId}
          onClick={() => setShown(!shown)}
        >
          <QrCode size={20} />
          {shown ? "QR-Code ausblenden" : "QR-Code zeigen"}
        </button>
      </div>
      <div class="qr" id={codeId} hidden={!shown}>
        {shown && picture && (
          <svg
            class="qr__code"
            viewBox={`${-QUIET_ZONE} ${-QUIET_ZONE} ${box} ${box}`}
            role="img"
            aria-label={`QR-Code mit der Adresse ${address}`}
            data-address={address}
          >
            <rect class="qr__light" x={-QUIET_ZONE} y={-QUIET_ZONE} width={box} height={box} />
            <path class="qr__dark" d={picture.path} />
          </svg>
        )}
        {shown && failed && (
          <ErrorAlert title="QR-Code nicht geladen">
            Mit Internet unter „Version“ auf „Neu laden“ tippen und es noch einmal versuchen.
          </ErrorAlert>
        )}
        <p class="qr__address">{address}</p>
      </div>
    </section>
  );
}
