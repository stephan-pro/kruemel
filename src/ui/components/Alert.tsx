import { CircleAlert } from "lucide-preact";
import type { ComponentChildren } from "preact";

interface ErrorAlertProps {
  /** Short statement of what failed ("Nicht gespeichert"). */
  readonly title: string;
  /** The explanation; a text becomes a paragraph. */
  readonly children: ComponentChildren;
}

/** A problem the user should know about right away; announced by screen readers (`role="alert"`). */
export function ErrorAlert({ title, children }: ErrorAlertProps) {
  return (
    <div class="alert" role="alert">
      <CircleAlert class="alert__icon" size={22} />
      <div class="alert__body">
        <p class="alert__title">{title}</p>
        {typeof children === "string" ? <p>{children}</p> : children}
      </div>
    </div>
  );
}
