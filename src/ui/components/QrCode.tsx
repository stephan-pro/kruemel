import { useEffect, useState } from "preact/hooks";
import { t } from "../../i18n";
import type { QrPicture } from "../qrCode";
import { ErrorAlert } from "./Alert";

/** Modules of light margin around the code; scanners need it (QR standard: 4). */
const QUIET_ZONE = 4;

interface QrCodeProps {
  /** What the code holds (an address). */
  readonly content: string;
  /** What a screen reader says for the picture. */
  readonly label: string;
}

/**
 * A QR code for the camera of a phone ("Auf anderem Gerät öffnen", the invite link). Draw it only
 * when it is asked for: the QR encoder is loaded then (about 15 KB less for every start). The
 * service worker keeps that file too, so it works without internet.
 */
export function QrCode({ content, label }: QrCodeProps) {
  const [picture, setPicture] = useState<QrPicture>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    setFailed(false);
    import("../qrCode").then(
      ({ qrPicture }) => {
        if (current) {
          setPicture(qrPicture(content));
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
  }, [content]);
  const box = picture === undefined ? 0 : picture.size + 2 * QUIET_ZONE;

  return (
    <>
      {picture && (
        <svg
          class="qr__code"
          viewBox={`${-QUIET_ZONE} ${-QUIET_ZONE} ${box} ${box}`}
          role="img"
          aria-label={label}
          data-address={content}
        >
          <rect class="qr__light" x={-QUIET_ZONE} y={-QUIET_ZONE} width={box} height={box} />
          <path class="qr__dark" d={picture.path} />
        </svg>
      )}
      {failed && (
        <ErrorAlert title={t().otherDevice.codeFailedTitle}>
          {t().otherDevice.codeFailed}
        </ErrorAlert>
      )}
    </>
  );
}
