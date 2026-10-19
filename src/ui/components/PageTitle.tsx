import { useEffect, useRef } from "preact/hooks";

export const APP_NAME = "Putzplan";

/**
 * Whether a page heading was shown before. The first one needs no focus: the browser starts at the
 * top of a freshly opened page, where the "Zum Inhalt springen" link is the first stop.
 */
let headingShown = false;

interface PageTitleProps {
  readonly title: string;
}

/**
 * The one h1 of a page. Showing a new page sets the browser tab title and moves the focus to this
 * heading, so keyboard and screen reader users start at the top of the new content. (Not for the
 * very first page after loading, see `headingShown`.)
 */
export function PageTitle({ title }: PageTitleProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.title = `${title} – ${APP_NAME}`;
    if (headingShown) {
      heading.current?.focus();
    }
    headingShown = true;
  }, [title]);
  return (
    <h1 class="kern-title kern-title--large page-title" ref={heading} tabIndex={-1}>
      {title}
    </h1>
  );
}
