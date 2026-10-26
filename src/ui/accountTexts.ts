// The texts of signing in and out (stage 2). They live in the language files (`account`,
// `deleteAccount` in `src/i18n/`); the objects here read from the language that is set at the moment
// of reading, so a text shown after a switch of the language is the new one. The messages for
// refused steps come from `AUTH_MESSAGES` (`src/auth/auth.ts`).

import { t } from "../i18n";
import { liveObject } from "../i18n/live";

export { CODE_DIGITS } from "../auth/limits";

/** How long after a code a new one may be asked for (the service refuses earlier ones). */
export const RESEND_AFTER_SECONDS = 60;

export const ACCOUNT_TEXTS = liveObject(() => t().account);

/** Deleting one's account (E2-5a): what goes, what stays, no way back by oneself. */
export const DELETE_ACCOUNT_TEXTS = liveObject(() => t().deleteAccount);
