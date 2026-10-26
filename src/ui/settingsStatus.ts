// The short status line of each group in the settings overview (UX-a), found out from the real
// state of the app. Pure, so it is tested without a page.

import { t } from "../i18n";
import { getLanguage, LANGUAGE_NAMES } from "../i18n/language";
import type { NotificationStatus } from "../push/notifications";
import type { SyncStatus } from "../storage/storage";

/** What the overview knows about the app. */
export interface SettingsState {
  /** Signed in (stage 2); `false` in the mode `local`. */
  readonly signedIn: boolean;
  /** The household of the signed-in person, if there is one. */
  readonly household?: { readonly name: string | null; readonly people: number };
  /** "Krümel bewegt sich". */
  readonly logoMotion: boolean;
  /** Notifications on this device; `unavailable` without sign-in. */
  readonly notifications: NotificationStatus | "checking" | "unavailable";
  /** The shared data's transfer; missing without shared data. */
  readonly sync?: { readonly status: SyncStatus; readonly rejected: number };
}

export function accountStatus(state: SettingsState): string {
  const STATUS = t().settings.status;
  if (state.household !== undefined) {
    return STATUS.household(state.household.name, state.household.people);
  }
  return state.signedIn ? STATUS.noHousehold : STATUS.deviceOnly;
}

export function notificationsStatus(status: SettingsState["notifications"]): string {
  const STATUS = t().settings.status;
  switch (status) {
    case "checking":
      return STATUS.notificationsChecking;
    case "active":
      return STATUS.notificationsActive;
    case "off":
    case "lost":
      return STATUS.notificationsOff;
    case "blocked":
      return STATUS.notificationsBlocked;
    case "notConfigured":
    case "unavailable":
      return STATUS.notificationsNotConfigured;
    case "iosHomeScreen":
      return STATUS.notificationsAppOnly;
    case "unsupported":
      return STATUS.notificationsUnsupported;
  }
}

export function dataStatus(sync: SettingsState["sync"]): string {
  const STATUS = t().settings.status;
  if (sync === undefined) {
    return STATUS.deviceOnly;
  }
  const { status, rejected } = sync;
  if (status.state === "offline") {
    return STATUS.offline;
  }
  if (rejected > 0) {
    return STATUS.someRefused;
  }
  switch (status.state) {
    case "synced":
      return STATUS.allSent;
    case "syncing":
      return status.pending > 0 ? STATUS.notSent : STATUS.sending;
    case "unreachable":
      return status.pending > 0 ? STATUS.notSent : STATUS.unreachable;
  }
}

/** The status lines of all five groups. */
export function settingsStatus(state: SettingsState) {
  const STATUS = t().settings.status;
  return {
    account: accountStatus(state),
    notifications: notificationsStatus(state.notifications),
    appearance: STATUS.appearance(LANGUAGE_NAMES[getLanguage()], state.logoMotion),
    data: dataStatus(state.sync),
    legal: STATUS.legal,
  } as const;
}
