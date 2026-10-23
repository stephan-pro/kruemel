import { Copy, QrCode as QrCodeIcon, Share2 } from "lucide-preact";
import { useEffect, useId, useState } from "preact/hooks";
import { formatInviteEnd, HOUSEHOLD_TEXTS } from "../householdTexts";
import { QrCode } from "./QrCode";

interface InviteLinkShareProps {
  /** The whole link, e.g. "https://…/kruemel/#/einladung/abc…". */
  readonly link: string;
  /** ISO time until when the link works. */
  readonly expiresAt: string;
  /** The id of the field that shows the link. */
  readonly fieldId: string;
  readonly fieldLabel: string;
  /** What the phone's share menu passes on with the link. */
  readonly shareTitle: string;
  readonly shareText: string;
  readonly qrLabel: string;
}

/**
 * An invite link to pass on (household invite E2-2d, friend invite E2-5b): the link in a field,
 * copy (with "Kopiert." for eyes and screen readers), the phone's share menu where there is one,
 * and a QR code to scan from the screen. A new link takes the focus, so a screen reader reads it
 * with its hint.
 */
export function InviteLinkShare({
  link,
  expiresAt,
  fieldId,
  fieldLabel,
  shareTitle,
  shareText,
  qrLabel,
}: InviteLinkShareProps) {
  /** What the status line says after copying, and how often it was said (read out each time). */
  const [copied, setCopied] = useState<{ text: string; count: number }>();
  const [qrShown, setQrShown] = useState(false);
  const qrId = useId();
  const canShare = typeof navigator.share === "function";

  useEffect(() => {
    setCopied(undefined);
    document.getElementById(fieldId)?.focus();
  }, [link]);

  async function copy() {
    let text: string = HOUSEHOLD_TEXTS.copied;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      text = HOUSEHOLD_TEXTS.copyFailed;
      document.getElementById(fieldId)?.focus();
    }
    setCopied((before) => ({ text, count: (before?.count ?? 0) + 1 }));
  }

  async function share() {
    try {
      await navigator.share({ title: shareTitle, text: shareText, url: link });
    } catch {
      // Closed without sharing, or the browser refused: the link is still there to copy.
    }
  }

  return (
    <>
      <div class="field">
        <label class="field__label" for={fieldId}>
          {fieldLabel}
        </label>
        <span class="field__hint" id={`${fieldId}-hinweis`}>
          {HOUSEHOLD_TEXTS.validUntil(formatInviteEnd(expiresAt))}
        </span>
        <input
          class="input"
          id={fieldId}
          type="text"
          readOnly
          value={link}
          aria-describedby={`${fieldId}-hinweis`}
          onFocus={(event) => event.currentTarget.select()}
        />
      </div>
      <div class="button-row">
        <button class="btn btn--primary" type="button" onClick={() => void copy()}>
          <Copy size={20} />
          {HOUSEHOLD_TEXTS.copy}
        </button>
        {canShare && (
          <button class="btn btn--secondary" type="button" onClick={() => void share()}>
            <Share2 size={20} />
            {HOUSEHOLD_TEXTS.share}
          </button>
        )}
        <button
          class="btn btn--secondary"
          type="button"
          aria-expanded={qrShown}
          aria-controls={qrId}
          onClick={() => setQrShown(!qrShown)}
        >
          <QrCodeIcon size={20} />
          {qrShown ? HOUSEHOLD_TEXTS.hideQr : HOUSEHOLD_TEXTS.showQr}
        </button>
      </div>
      <p class="form-status" role="status">
        {copied && <span key={copied.count}>{copied.text}</span>}
      </p>
      <div class="qr" id={qrId} hidden={!qrShown}>
        {qrShown && <QrCode content={link} label={qrLabel} />}
      </div>
    </>
  );
}
