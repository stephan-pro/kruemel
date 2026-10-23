import type { ComponentChildren } from "preact";
import { useEffect, useId, useLayoutEffect, useRef } from "preact/hooks";

interface ModalProps {
  readonly open: boolean;
  readonly title: string;
  /** Decoration in front of the title (a symbol); read by nobody, so it must be `aria-hidden`. */
  readonly titlePrefix?: ComponentChildren;
  /** Escape was pressed: the page decides what happens, so its state and the dialog never disagree. */
  readonly onCancel: () => void;
  /** Puts the focus on the title when the dialog opens; without it the browser picks the `autofocus` one. */
  readonly focusTitle?: boolean;
  /** Puts the focus on the element with this id instead (the first field of a question). */
  readonly initialFocusId?: string;
  /** Id of the explanation, read out with the title when the dialog opens (`aria-describedby`). */
  readonly descriptionId?: string;
  readonly children: ComponentChildren;
}

/**
 * A native modal `<dialog>` with a title: the browser keeps the focus inside, closes it on Escape
 * (here: asks `onCancel`) and makes everything behind it inert. Dialogs may be stacked; Escape then
 * closes the top one only.
 */
export function Modal({
  open,
  title,
  titlePrefix,
  onCancel,
  focusTitle,
  initialFocusId,
  descriptionId,
  children,
}: ModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (element === null) {
      return;
    }
    if (open && !element.open) {
      element.showModal();
      if (initialFocusId !== undefined) {
        document.getElementById(initialFocusId)?.focus();
      } else if (focusTitle) {
        heading.current?.focus();
      }
    }
  }, [open, focusTitle, initialFocusId]);

  // Closed before the effects of the page run: a page that then moves the focus behind the dialog
  // (the notice after "Übernehmen") would otherwise try it while everything there is still inert.
  useLayoutEffect(() => {
    if (!open && dialog.current?.open) {
      dialog.current.close();
    }
  }, [open]);

  return (
    <dialog
      class="dialog"
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      {titlePrefix === undefined ? (
        <h2 class="dialog__title" id={titleId} tabIndex={-1} ref={heading}>
          {title}
        </h2>
      ) : (
        <div class="dialog__head">
          {titlePrefix}
          <h2 class="dialog__title" id={titleId} tabIndex={-1} ref={heading}>
            {title}
          </h2>
        </div>
      )}
      {children}
    </dialog>
  );
}
