import { AUTH_MESSAGES, AuthError } from "../auth/auth";
import { StorageError } from "../storage/storage";

/** Said when something failed for a reason the app has no words of its own for. */
export const UNEXPECTED_ERROR =
  "Das hat nicht geklappt. Versuch es noch einmal. Hilft das nicht, lade die App neu.";

/**
 * The text for a failure shown to the person (K2b): the app's own messages (storage, sign-in),
 * never the raw and often English text of the browser or a library.
 */
export function errorText(error: unknown): string {
  if (error instanceof StorageError) {
    return error.message;
  }
  if (error instanceof AuthError) {
    return AUTH_MESSAGES[error.failure];
  }
  return UNEXPECTED_ERROR;
}
