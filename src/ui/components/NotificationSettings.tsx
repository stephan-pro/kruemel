import { useEffect, useRef, useState } from "preact/hooks";
import {
  type PushSettings,
  type PushSettingsProblem,
  pushSettingsProblems,
} from "../../../supabase/functions/push/rules";
import type { Notifications } from "../../push/notifications";
import { PushError } from "../../push/pushApi";
import { unexpectedErrorText } from "../errorText";
import {
  PUSH_FAILURE_TEXTS,
  NOTIFICATION_SETTINGS_TEXTS as TEXTS,
  WEEKDAYS,
} from "../notificationTexts";
import { ErrorAlert } from "./Alert";
import { ErrorMessage, errorId, TextField, useFieldErrorFocus } from "./fields";

interface NotificationSettingsProps {
  readonly notifications: Notifications;
  /** The other person's name, for "Wenn … etwas für dich erledigt"; missing: a general wording. */
  readonly otherName?: string | undefined;
  /** The server forgot the device while the settings were read or saved: the tile reads again. */
  readonly onStatusChange: () => void;
}

type Phase = "loading" | "ready" | "unreachable";

/** The field that takes the focus for a wrong value. */
const FIELD_OF: Readonly<Record<PushSettingsProblem, string>> = {
  dailyTime: "push-tagesueberblick-zeit",
  dailyDays: "push-tag-0",
  quietFrom: "push-ruhezeit-von",
  quietTo: "push-ruhezeit-bis",
  quietSame: "push-ruhezeit-bis",
};

const sameSettings = (a: PushSettings, b: PushSettings) => JSON.stringify(a) === JSON.stringify(b);

function failureText(error: unknown): string {
  return error instanceof PushError ? PUSH_FAILURE_TEXTS[error.failure] : unexpectedErrorText();
}

function Switch({
  id,
  label,
  hint,
  checked,
  onChange,
}: {
  readonly id: string;
  readonly label: string;
  readonly hint?: string;
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
}) {
  const hintId = `${id}-hinweis`;
  return (
    <>
      <div class="choice">
        <input
          class="choice__input choice__input--switch"
          type="checkbox"
          role="switch"
          id={id}
          checked={checked}
          aria-checked={checked}
          aria-describedby={hint ? hintId : undefined}
          onChange={(event) => onChange(event.currentTarget.checked)}
        />
        <label class="choice__label" for={id}>
          {label}
        </label>
      </div>
      {hint && (
        <p class="muted" id={hintId}>
          {hint}
        </p>
      )}
    </>
  );
}

/**
 * The settings of this device (NT-b), under the status "aktiv": which notifications come, when
 * the daily overview comes and the quiet hours. "Speichern" keeps them on the device and sends
 * them; without internet they say "noch nicht übertragen" and go out later by themselves. Wrong
 * values are named at their field.
 */
export function NotificationSettings({
  notifications,
  otherName,
  onStatusChange,
}: NotificationSettingsProps) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [saved, setSaved] = useState<{ settings: PushSettings; pending: boolean }>();
  const [draft, setDraft] = useState<PushSettings>();
  const [errors, setErrors] = useState<Partial<Record<PushSettingsProblem, string>>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [failed, setFailed] = useState<{ title: string; message: string }>();
  const { report, status } = useFieldErrorFocus();
  // What the form shows now, for the callbacks of events (online) that outlive a render.
  const latest = useRef({ draft, saved, phase });
  latest.current = { draft, saved, phase };

  async function load(announce = false) {
    try {
      const state = await notifications.loadSettings();
      const wasPending = latest.current.saved?.pending === true;
      const edited =
        latest.current.draft !== undefined &&
        latest.current.saved !== undefined &&
        !sameSettings(latest.current.draft, latest.current.saved.settings);
      setSaved(state);
      // What the person is typing is not overwritten by what the server says.
      if (!edited) {
        setDraft(state.settings);
      }
      setPhase("ready");
      setFailed(undefined);
      if (announce && wasPending && !state.pending) {
        setMessage(TEXTS.nowSent);
      }
    } catch (error) {
      if (error instanceof PushError && error.failure === "deviceUnknown") {
        onStatusChange();
        return;
      }
      if (latest.current.phase !== "ready") {
        setPhase("unreachable");
      }
      if (!(error instanceof PushError && error.failure === "offline")) {
        setFailed({ title: TEXTS.loadFailed, message: failureText(error) });
      }
    }
  }

  // Read now, and again when the internet is back (what waited is sent, what failed is retried).
  useEffect(() => {
    void load();
    const again = () => void load(true);
    window.addEventListener("online", again);
    return () => window.removeEventListener("online", again);
  }, [notifications]);

  function change(next: Partial<PushSettings>) {
    setDraft((current) => (current === undefined ? current : { ...current, ...next }));
    setErrors({});
    setMessage(undefined);
  }

  function toggleDay(index: number, on: boolean) {
    const days = draft?.dailyDays ?? 0;
    change({ dailyDays: on ? days | (1 << index) : days & ~(1 << index) });
  }

  async function save(event: Event) {
    event.preventDefault();
    if (busy || draft === undefined) {
      return;
    }
    const problems = pushSettingsProblems(draft);
    const first = problems[0];
    if (first !== undefined) {
      const found: Partial<Record<PushSettingsProblem, string>> = {};
      for (const problem of problems) {
        found[problem] = TEXTS.problems[problem];
      }
      setErrors(found);
      setMessage(undefined);
      report(FIELD_OF[first], TEXTS.problems[first]);
      return;
    }
    setBusy(true);
    setFailed(undefined);
    setMessage(undefined);
    try {
      const result = await notifications.saveSettings(draft);
      setSaved({ settings: draft, pending: result === "pending" });
      setMessage(result === "pending" ? TEXTS.pending : TEXTS.saved);
    } catch (error) {
      setFailed({ title: TEXTS.saveFailed, message: failureText(error) });
      if (error instanceof PushError && error.failure === "deviceUnknown") {
        onStatusChange();
      }
    } finally {
      setBusy(false);
    }
  }

  const name = otherName ?? TEXTS.otherPerson;
  const daysError = errors.dailyDays;

  return (
    <div class="form">
      <h3 class="tile__subtitle" id="benachrichtigungen-einstellungen">
        {TEXTS.title}
      </h3>
      {phase === "loading" && <p class="muted">{TEXTS.loading}</p>}
      {phase === "unreachable" && (
        <>
          <p class="sync-status" role="status">
            {TEXTS.unreachable}
          </p>
          <div class="button-row">
            <button class="btn btn--secondary" type="button" onClick={() => void load()}>
              {TEXTS.retry}
            </button>
          </div>
        </>
      )}
      {failed && <ErrorAlert title={failed.title}>{failed.message}</ErrorAlert>}
      {phase === "ready" && draft !== undefined && (
        <form class="form" noValidate onSubmit={(event) => void save(event)}>
          <p class="muted">{TEXTS.intro}</p>
          <Switch
            id="push-tagesueberblick"
            label={TEXTS.dailyLabel}
            hint={TEXTS.dailyHint}
            checked={draft.dailyEnabled}
            onChange={(dailyEnabled) => change({ dailyEnabled })}
          />
          {draft.dailyEnabled && (
            <>
              <TextField
                id="push-tagesueberblick-zeit"
                label={TEXTS.dailyTimeLabel}
                type="time"
                narrow
                value={draft.dailyTime}
                error={errors.dailyTime}
                onInput={(dailyTime) => change({ dailyTime })}
              />
              <fieldset
                class="choices"
                aria-describedby={daysError ? errorId("push-tage") : undefined}
              >
                <legend class="field__label">{TEXTS.dailyDaysLegend}</legend>
                {daysError && <ErrorMessage id={errorId("push-tage")} message={daysError} />}
                <div class="choices__list choices__list--inline">
                  {WEEKDAYS.map((day, index) => (
                    <div class="choice choice--compact" key={day.short}>
                      <input
                        class="choice__input choice__input--box"
                        type="checkbox"
                        id={`push-tag-${index}`}
                        aria-label={day.full}
                        checked={((draft.dailyDays >> index) & 1) === 1}
                        onChange={(event) => toggleDay(index, event.currentTarget.checked)}
                      />
                      <label class="choice__label" for={`push-tag-${index}`} aria-hidden="true">
                        {day.short}
                      </label>
                    </div>
                  ))}
                </div>
              </fieldset>
            </>
          )}
          <Switch
            id="push-partner"
            label={TEXTS.partnerLabel(name)}
            hint={TEXTS.partnerHint}
            checked={draft.partnerEnabled}
            onChange={(partnerEnabled) => change({ partnerEnabled })}
          />
          <Switch
            id="push-haushalt"
            label={TEXTS.householdLabel}
            checked={draft.householdEnabled}
            onChange={(householdEnabled) => change({ householdEnabled })}
          />
          <Switch
            id="push-ruhezeit"
            label={TEXTS.quietLabel}
            hint={TEXTS.quietHint}
            checked={draft.quietEnabled}
            onChange={(quietEnabled) => change({ quietEnabled })}
          />
          {draft.quietEnabled && (
            <div class="field-row">
              <TextField
                id="push-ruhezeit-von"
                label={TEXTS.quietFromLabel}
                type="time"
                narrow
                value={draft.quietFrom}
                error={errors.quietFrom}
                onInput={(quietFrom) => change({ quietFrom })}
              />
              <TextField
                id="push-ruhezeit-bis"
                label={TEXTS.quietToLabel}
                type="time"
                narrow
                value={draft.quietTo}
                error={errors.quietTo ?? errors.quietSame}
                onInput={(quietTo) => change({ quietTo })}
              />
            </div>
          )}
          <div class="button-row">
            <button class="btn btn--primary" type="submit" aria-disabled={busy}>
              {TEXTS.save}
            </button>
          </div>
          {saved?.pending === true && <p class="sync-status">{TEXTS.pendingNote}</p>}
          <p class="form-status" role="status">
            {busy ? TEXTS.saving : (message ?? "")}
          </p>
          {status}
        </form>
      )}
    </div>
  );
}
