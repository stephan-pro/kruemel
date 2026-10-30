import { CircleAlert } from "lucide-preact";
import type { ComponentChildren } from "preact";
import { t } from "../../i18n";

interface ErrorAlertProps {
  /** Short statement of what failed ("Nicht gespeichert"). */
  readonly title: string;
  /** The explanation; a text becomes a paragraph. */
  readonly children: ComponentChildren;
  /** On phones: sits above the navigation bar, in sight wherever the list is scrolled to. */
  readonly floating?: boolean;
}

/** A finding with the place it refers to ("tasks[0].assignee: …", "Kopie: …"). */
const PLACED = /^[\w.[\]]+: /;

/**
 * The findings of a check: sentences for the person stay in sight (a newer version, not a
 * backup); where exactly a file or the stored data are wrong is for whoever helps and is folded
 * away under "Details für die Fehlersuche" (K2b).
 */
export function ErrorDetails({ details }: { readonly details: readonly string[] }) {
  const plain = details.filter((detail) => !PLACED.test(detail));
  const placed = details.filter((detail) => PLACED.test(detail));
  return (
    <>
      {plain.length > 0 && (
        <ul class="bullet-list">
          {plain.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      )}
      {placed.length > 0 && (
        <details class="error-details">
          <summary>{t().errors.details}</summary>
          <ul class="bullet-list">
            {placed.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

/** A problem the user should know about right away; announced by screen readers (`role="alert"`). */
export function ErrorAlert({ title, children, floating }: ErrorAlertProps) {
  return (
    <div class={floating ? "alert alert--floating" : "alert"} role="alert">
      <CircleAlert class="alert__icon" size={22} />
      <div class="alert__body">
        <p class="alert__title">{title}</p>
        {typeof children === "string" ? <p>{children}</p> : children}
      </div>
    </div>
  );
}
