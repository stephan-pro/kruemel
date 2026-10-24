import { Bell, BellOff, Send } from "lucide-preact";
import { useEffect, useRef, useState } from "preact/hooks";
import {
  type NotificationStatus,
  type Notifications,
  notificationWay,
} from "../../push/notifications";
import { PushError } from "../../push/pushApi";
import { UNEXPECTED_ERROR } from "../errorText";
import {
  BLOCKED_STEPS,
  NOTIFICATION_STATUS_TEXTS,
  NOTIFICATION_TEXTS,
  PUSH_FAILURE_TEXTS,
} from "../notificationTexts";
import { ErrorAlert } from "./Alert";
import { InstallSteps } from "./InstallSteps";
import { NotificationSettings } from "./NotificationSettings";

interface NotificationTileProps {
  /** Missing where there are no notifications (the mode `local`, without sign-in). */
  readonly notifications?: Notifications | undefined;
  /** The test build: nothing reaches a real device (a hint says so). */
  readonly testOnly?: boolean;
  /** The other person's name, for the settings; missing without a household. */
  readonly otherName?: string | undefined;
}

type Shown = NotificationStatus | "checking" | "unavailable";

function failureText(error: unknown): string {
  return error instanceof PushError ? PUSH_FAILURE_TEXTS[error.failure] : UNEXPECTED_ERROR;
}

/**
 * "Benachrichtigungen" in the settings (NT-a, NT-b): where they stand on this device, switching
 * them on (the browser asks only after the tap on "Aktivieren"), the settings of the device while
 * they are on, a test notification and switching them off. Blocked: how to allow them again in
 * this browser; iPhone in Safari: how to put Krümel on the home screen first; lost (the server or
 * the browser ended them): "Neu einschalten". Messages go to a status line; when a button goes
 * away with the focus in it, the focus goes to the heading of the tile.
 */
export function NotificationTile({
  notifications,
  testOnly = false,
  otherName,
}: NotificationTileProps) {
  const [status, setStatus] = useState<Shown>(notifications ? "checking" : "unavailable");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [failed, setFailed] = useState<{ title: string; message: string }>();
  const heading = useRef<HTMLHeadingElement>(null);
  const way = notificationWay(navigator);

  // Read now and whenever the app comes back (the permission may have changed in the settings).
  useEffect(() => {
    if (notifications === undefined) {
      setStatus("unavailable");
      return;
    }
    let current = true;
    const read = () => {
      if (document.visibilityState === "visible") {
        // `sync` mends what the browser or the server changed; the app started it already.
        void notifications
          .sync()
          .then(() => notifications.status())
          .then((next) => current && setStatus(next));
      }
    };
    read();
    document.addEventListener("visibilitychange", read);
    return () => {
      current = false;
      document.removeEventListener("visibilitychange", read);
    };
  }, [notifications]);

  /** The settings found out that the server forgot this device. */
  function refresh() {
    if (notifications !== undefined) {
      void notifications.status().then(setStatus);
    }
  }

  async function run(title: string, action: (n: Notifications) => Promise<void>) {
    if (busy || notifications === undefined) {
      return;
    }
    setBusy(true);
    setFailed(undefined);
    setMessage(undefined);
    try {
      await action(notifications);
    } catch (error) {
      setFailed({ title, message: failureText(error) });
      setStatus(await notifications.status());
    } finally {
      setBusy(false);
    }
  }

  function enable() {
    void run(NOTIFICATION_TEXTS.enableFailed, async (n) => {
      const next = await n.enable();
      setStatus(next);
      if (next === "off") {
        // The question was closed: the button stays, with the focus on it.
        setMessage(NOTIFICATION_TEXTS.notAsked);
        return;
      }
      setMessage(next === "active" ? NOTIFICATION_TEXTS.enabled : NOTIFICATION_STATUS_TEXTS[next]);
      heading.current?.focus();
    });
  }

  function sendTest() {
    void run(NOTIFICATION_TEXTS.testFailed, async (n) => {
      await n.sendTest();
      setMessage(NOTIFICATION_TEXTS.testSent);
    });
  }

  function disable() {
    void run(NOTIFICATION_TEXTS.disableFailed, async (n) => {
      setStatus(await n.disable());
      setMessage(NOTIFICATION_TEXTS.turnedOff);
      heading.current?.focus();
    });
  }

  return (
    <section class="tile tile--narrow form" aria-labelledby="benachrichtigungen">
      <h2 class="tile__title" id="benachrichtigungen" tabIndex={-1} ref={heading}>
        {NOTIFICATION_TEXTS.tileTitle}
      </h2>
      <p class="muted">{NOTIFICATION_TEXTS.intro}</p>
      {testOnly && <p class="muted">{NOTIFICATION_TEXTS.testOnly}</p>}
      <p class="sync-status" data-status={status}>
        {NOTIFICATION_STATUS_TEXTS[status]}
      </p>
      {status === "blocked" && (
        <details class="tile-guide">
          <summary>{NOTIFICATION_TEXTS.blockedGuide}</summary>
          <ol class="bullet-list">
            {BLOCKED_STEPS[way].map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <p>{NOTIFICATION_TEXTS.blockedAfter}</p>
        </details>
      )}
      {status === "iosHomeScreen" && (
        <details class="tile-guide">
          <summary>{NOTIFICATION_TEXTS.iosGuide}</summary>
          <InstallSteps way="ios" shared />
        </details>
      )}
      {failed && <ErrorAlert title={failed.title}>{failed.message}</ErrorAlert>}
      {(status === "off" || status === "lost") && (
        <div class="button-row">
          <button class="btn btn--primary" type="button" onClick={enable}>
            <Bell size={20} />
            {status === "lost" ? NOTIFICATION_TEXTS.reenable : NOTIFICATION_TEXTS.enable}
          </button>
        </div>
      )}
      {status === "active" && notifications !== undefined && (
        <NotificationSettings
          notifications={notifications}
          otherName={otherName}
          onStatusChange={refresh}
        />
      )}
      {status === "active" && (
        <div class="button-row">
          <button class="btn btn--secondary" type="button" onClick={sendTest}>
            <Send size={20} />
            {NOTIFICATION_TEXTS.sendTest}
          </button>
          <button class="btn btn--quiet" type="button" onClick={disable}>
            <BellOff size={20} />
            {NOTIFICATION_TEXTS.disable}
          </button>
        </div>
      )}
      <p class="form-status" role="status">
        {busy ? NOTIFICATION_TEXTS.busy : (message ?? "")}
      </p>
    </section>
  );
}
