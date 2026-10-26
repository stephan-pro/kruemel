// The texts of the household, the invite, the shared data and the transfer (stage 2). They live in
// the language files (`household`, `friends`, `shared`, `leave`, `sync` in `src/i18n/`); the objects
// here read from the language that is set at the moment of reading, so a text shown after a switch
// of the language is the new one (like `accountTexts.ts`). The messages for refused steps come from
// `HOUSEHOLD_MESSAGES` (`src/auth/household.ts`).

import type { HouseholdFailure } from "../auth/household";
import { t } from "../i18n";
import { LOCALES } from "../i18n/intl";
import { getLanguage, type Language } from "../i18n/language";
import { liveObject } from "../i18n/live";

/** "Fr., 30.10.2026" / "Fri, 30/10/2026": until when an invite works, in the device's time zone unless one is given. */
export function formatInviteEnd(
  expiresAt: string,
  timeZone?: string,
  language: Language = getLanguage(),
): string {
  return new Intl.DateTimeFormat(LOCALES[language], {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(timeZone === undefined ? {} : { timeZone }),
  }).format(new Date(expiresAt));
}

/** The heading of the page shown when an invite cannot be accepted. */
export const INVITE_FAILURE_TITLES: Partial<Readonly<Record<HouseholdFailure, string>>> =
  liveObject(() => t().household.failureTitles);

export const HOUSEHOLD_TEXTS = liveObject(() => t().household);

/** "Freunde einladen" in the settings (E2-5b): a link for an account and a household of one's own. */
export const FRIEND_TEXTS = liveObject(() => t().friends);

/** The shared data of the household in the app (E2-3b). */
export const SHARED_TEXTS = liveObject(() => t().shared);

/** Removing the other person and leaving the household (E2-5a). */
export const LEAVE_TEXTS = liveObject(() => t().leave);

/** Where the transfer stands and what went wrong (E2-3c). */
export const SYNC_TEXTS = liveObject(() => t().sync);
