import type { ComponentChildren } from "preact";
import { useId } from "preact/hooks";
import { t } from "../../i18n";
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
  // The focus starts on a button: without this, a screen reader would read the title and
  // "Abbrechen" only, not what the question is about.
  const bodyId = useId();
  return (
    <Modal
      open={open}
      title={title}
      onCancel={onCancel}
      descriptionId={bodyId}
      {...(initialFocusId === undefined ? {} : { initialFocusId })}
    >
      <div class="dialog__body" id={bodyId}>
        {children}
      </div>
      <div class="button-row">
        <button
          class="btn btn--secondary"
          type="button"
          autofocus={initialFocusId === undefined}
          onClick={onCancel}
        >
          {t().common.cancel}
        </button>
        <button class={`btn btn--${tone}`} type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
