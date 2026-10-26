import { AUTH_MESSAGES, AuthError } from "../auth/auth";
import { t } from "../i18n";
import { StorageError } from "../storage/storage";

/**
 * A failure kept in the state of a page while it is shown. The sentence is made when the page
 * draws (`errorText(failure.cause)`), not when the failure happens, so a switch of the language
 * changes it. Wrapped, so any cause (also `undefined`) is a failure.
 */
export interface Failure {
  readonly cause: unknown;
}

export function failureOf(cause: unknown): Failure {
  return { cause };
}

/** Said when something failed for a reason the app has no words of its own for. */
export function unexpectedErrorText(): string {
  return t().errors.unexpected;
}

/**
 * The text for a failure shown to the person (K2b): the app's own messages (storage, sign-in), in
 * the language set now, never the raw and often English text of the browser or a library. An
 * unknown failure gets one general sentence. Keep the failure (not this text) while it is on the
 * screen and call this when drawing, so a switch of the language changes what is shown.
 */
export function errorText(error: unknown): string {
  if (error instanceof StorageError) {
    return t().errors.storage[error.failure];
  }
  if (error instanceof AuthError) {
    return AUTH_MESSAGES[error.failure];
  }
  return unexpectedErrorText();
}
