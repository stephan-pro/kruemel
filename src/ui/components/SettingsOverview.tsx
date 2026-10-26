import {
  Bell,
  ChevronRight,
  Database,
  type LucideIcon,
  Palette,
  Scale,
  UsersRound,
} from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import { t } from "../../i18n";
import type { Notifications } from "../../push/notifications";
import { routeHash, routeInfo, type SettingsRoute } from "../route";
import { type SettingsState, settingsStatus } from "../settingsStatus";
import { PageTitle } from "./PageTitle";

interface Row {
  readonly route: SettingsRoute;
  readonly key: keyof ReturnType<typeof settingsStatus>;
  readonly Icon: LucideIcon;
}

/** The five groups, in this order. */
const ROWS: readonly Row[] = [
  { route: "settingsAccount", key: "account", Icon: UsersRound },
  { route: "settingsNotifications", key: "notifications", Icon: Bell },
  { route: "settingsAppearance", key: "appearance", Icon: Palette },
  { route: "settingsData", key: "data", Icon: Database },
  { route: "settingsLegal", key: "legal", Icon: Scale },
];

interface SettingsOverviewProps extends Omit<SettingsState, "notifications"> {
  /** Missing where there are no notifications (the mode `local`, without sign-in). */
  readonly notifications?: Notifications | undefined;
  /** The group page the person comes back from: its row takes the focus instead of the heading. */
  readonly cameFrom?: SettingsRoute | undefined;
}

/** Where notifications stand on this device, read now and whenever the app comes back. */
function useNotificationStatus(notifications: Notifications | undefined) {
  const [status, setStatus] = useState<SettingsState["notifications"]>(
    notifications ? "checking" : "unavailable",
  );
  useEffect(() => {
    if (notifications === undefined) {
      setStatus("unavailable");
      return;
    }
    let current = true;
    const read = () => {
      if (document.visibilityState === "visible") {
        void notifications.status().then((next) => current && setStatus(next));
      }
    };
    read();
    document.addEventListener("visibilitychange", read);
    return () => {
      current = false;
      document.removeEventListener("visibilitychange", read);
    };
  }, [notifications]);
  return status;
}

/**
 * "Einstellungen" (UX-a): five rows, one per group, each with its status. A row is a link to the
 * group page; coming back from a group, the focus is on that group's row.
 */
export function SettingsOverview({ notifications, cameFrom, ...state }: SettingsOverviewProps) {
  const status = settingsStatus({
    ...state,
    notifications: useNotificationStatus(notifications),
  });
  useEffect(() => {
    window.scrollTo(0, 0);
    if (cameFrom !== undefined) {
      document.querySelector<HTMLElement>(`[data-settings-row="${cameFrom}"]`)?.focus();
    }
  }, [cameFrom]);
  return (
    <>
      <PageTitle title={t().settings.title} takeFocus={cameFrom === undefined} />
      <ul class="settings-list" aria-label={t().settings.listLabel}>
        {ROWS.map(({ route, key, Icon }) => (
          <li key={route}>
            {/* The name is the text itself (title and status, two blocks): no state by looks alone. */}
            <a class="settings-row" href={routeHash(route)} data-settings-row={route}>
              <span class="settings-row__icon" aria-hidden="true">
                <Icon size={24} />
              </span>
              <span class="settings-row__text">
                <span class="settings-row__title">{routeInfo(route).title}</span>
                <span class="settings-row__status">{status[key]}</span>
              </span>
              <ChevronRight class="settings-row__arrow" size={24} aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}
