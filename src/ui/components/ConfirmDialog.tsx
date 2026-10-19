import type { ComponentChildren } from "preact";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
  readonly open: boolean;
  readonly title: string;
  readonly confirmLabel: string;
  /** `warn` (orange) for what cannot be undone, `primary` (blue) for an ordinary decision. */
  readonly tone?: "warn" | "primary";
  /**
   * The element (by id) that takes the focus first, e.g. the choice the question is about.
   * Without it "Abbrechen" does, so a quick Enter never confirms by accident.
   */
  readonly initialFocusId?: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly children: ComponentChildren;
}

/**
 * A question the user has to answer, in a native modal `<dialog>`: the browser keeps the focus
 * inside, closes it on Escape and gives the focus back afterwards. "Abbrechen" has the focus first,
 * so a quick Enter never confirms by accident. The confirming button is orange by default: it
 * deletes.
 */
export function ConfirmDialog({
  open,
  title,
  confirmLabel,
  tone = "warn",
  initialFocusId,
  onConfirm,
  onCancel,
  children,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      title={title}
      onCancel={onCancel}
      {...(initialFocusId === undefined ? {} : { initialFocusId })}
    >
      <div class="dialog__body">{children}</div>
      <div class="button-row">
        <button
          class="btn btn--secondary"
          type="button"
          autofocus={initialFocusId === undefined}
          onClick={onCancel}
        >
          Abbrechen
        </button>
        <button class={`btn btn--${tone}`} type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
