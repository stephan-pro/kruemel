import type { ComponentChildren } from "preact";
import { useEffect, useId, useRef } from "preact/hooks";

interface ConfirmDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly confirmLabel: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly children: ComponentChildren;
}

/**
 * A question the user has to answer, in a native modal `<dialog>`: the browser keeps the focus
 * inside, closes it on Escape and gives the focus back afterwards. "Abbrechen" has the focus first,
 * so a quick Enter never confirms by accident.
 */
export function ConfirmDialog({
  open,
  title,
  confirmLabel,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (element === null) {
      return;
    }
    if (open && !element.open) {
      element.showModal();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  return (
    <dialog
      class="kern-dialog"
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Escape: let the page decide, so its state and the dialog never disagree.
        event.preventDefault();
        onCancel();
      }}
    >
      <div class="kern-dialog__header">
        <h2 class="kern-title" id={titleId}>
          {title}
        </h2>
      </div>
      <div class="kern-dialog__body">{children}</div>
      <div class="kern-dialog__footer">
        <button class="kern-btn kern-btn--secondary" type="button" autofocus onClick={onCancel}>
          <span class="kern-label">Abbrechen</span>
        </button>
        <button class="kern-btn kern-btn--primary" type="button" onClick={onConfirm}>
          <span class="kern-label">{confirmLabel}</span>
        </button>
      </div>
    </dialog>
  );
}
