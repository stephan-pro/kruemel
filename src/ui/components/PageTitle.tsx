import { useEffect, useRef } from "preact/hooks";

export const APP_NAME = "Putzplan";

/**
 * Whether a page heading was shown before. The first one needs no focus: the browser starts at the
 * top of a freshly opened page, where the "Zum Inhalt springen" link is the first stop.
 */
let headingShown = false;

interface PageTitleProps {
  /** Name of the page: title of the browser tab and, unless `heading` is set, the heading. */
  readonly title: string;
  /**
   * What the heading says when it changes within the page (the week view: "Nächste Woche").
   * Changing it neither renames the tab nor moves the focus.
   */
  readonly heading?: string;
}

/**
 * The one h1 of a page. Showing a new page sets the browser tab title and moves the focus to this
 * heading, so keyboard and screen reader users start at the top of the new content. (Not for the
 * very first page after loading, see `headingShown`.)
 */
export function PageTitle({ title, heading }: PageTitleProps) {
  const element = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.title = `${title} – ${APP_NAME}`;
    if (headingShown) {
      element.current?.focus();
    }
    headingShown = true;
  }, [title]);
  return (
    <h1 class="page-title" ref={element} tabIndex={-1}>
      {heading ?? title}
    </h1>
  );
}
