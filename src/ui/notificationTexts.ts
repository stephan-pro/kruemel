// The texts of the tile "Benachrichtigungen" in the settings (NT-a, NT-b). They live in the language
// files (`notifications` in `src/i18n/`); the objects here read from the language that is set at
// the moment of reading, so a text shown after a switch of the language is the new one. The texts
// of the messages themselves are in `src/push/messageTexts.ts` (the service worker may not share a
// file with the page).

import type { PushFailure } from "../../supabase/functions/push/rules";
import { t } from "../i18n";
import { liveObject } from "../i18n/live";

/** How the tile says where the notifications of this device stand. */
export const NOTIFICATION_STATUS_TEXTS = liveObject(() => t().notifications.status);

export const NOTIFICATION_TEXTS = liveObject(() => t().notifications.tile);

/** Monday first, as the bit mask of the settings counts (`dailyDays`); short and full name. */
export const WEEKDAYS: readonly { readonly short: string; readonly full: string }[] = liveObject(
  () => t().notifications.weekdays,
);

/** The settings of a device (NT-b), shown while notifications are on. */
export const NOTIFICATION_SETTINGS_TEXTS = liveObject(() => t().notifications.settings);

/** Why a step failed, in words for the person. */
export const PUSH_FAILURE_TEXTS: Readonly<Record<PushFailure, string>> = liveObject(
  () => t().notifications.failures,
);

/** Where a browser keeps its permission for notifications (`notificationWay`). */
export type NotificationWay = "ios" | "firefoxAndroid" | "other";

/** How to allow notifications again, for the browser at hand. */
export const BLOCKED_STEPS: Readonly<Record<NotificationWay, readonly string[]>> = liveObject(
  () => t().notifications.blockedSteps,
);
