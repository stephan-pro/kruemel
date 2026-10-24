// Push addresses that may and may not be stored (NT-a). Pure data: Vitest checks them against
// `isPushEndpoint` (rules.test.ts), the job `db` against the database (supabase/tests/push.test.ts),
// so the two allow lists cannot drift apart. The same goes for the settings of a device (NT-b).

import { DEFAULT_PUSH_SETTINGS, type PushSettings, type PushSettingsProblem } from "./rules";

export const ALLOWED_ENDPOINTS: readonly string[] = [
  "https://fcm.googleapis.com/fcm/send/dQw4w9WgXcQ:APA91bH-abc_DEF",
  "https://fcm.googleapis.com/wp/abc123",
  "https://updates.push.services.mozilla.com/wpush/v2/gAAAAABk-abc",
  "https://web.push.apple.com/QGq9hVyTzT0-abc",
  "https://api.push.apple.com/3/device/abc",
  "https://wns2-par02p.notify.windows.com/w/?token=BQYAAAB%2bx",
  "https://fcm.googleapis.com:443/fcm/send/abc",
];

/** Settings the database and `pushSettingsProblems` both accept (NT-b). */
export const VALID_SETTINGS: readonly PushSettings[] = [
  DEFAULT_PUSH_SETTINGS,
  {
    ...DEFAULT_PUSH_SETTINGS,
    dailyTime: "00:00",
    dailyDays: 1,
    quietFrom: "23:59",
    quietTo: "00:00",
  },
  { ...DEFAULT_PUSH_SETTINGS, dailyEnabled: false, dailyDays: 0, partnerEnabled: false },
  { ...DEFAULT_PUSH_SETTINGS, quietEnabled: false, quietFrom: "08:00", quietTo: "08:00" },
  {
    ...DEFAULT_PUSH_SETTINGS,
    dailyTime: "23:59",
    householdEnabled: false,
    quietFrom: "07:00",
    quietTo: "21:00",
  },
];

/** Settings both refuse, with what `pushSettingsProblems` names. */
export const INVALID_SETTINGS: readonly {
  readonly settings: PushSettings;
  readonly problems: readonly PushSettingsProblem[];
}[] = [
  { settings: { ...DEFAULT_PUSH_SETTINGS, dailyTime: "24:00" }, problems: ["dailyTime"] },
  { settings: { ...DEFAULT_PUSH_SETTINGS, dailyTime: "7:30" }, problems: ["dailyTime"] },
  { settings: { ...DEFAULT_PUSH_SETTINGS, dailyTime: "07:60" }, problems: ["dailyTime"] },
  { settings: { ...DEFAULT_PUSH_SETTINGS, dailyTime: "07:30:00" }, problems: ["dailyTime"] },
  { settings: { ...DEFAULT_PUSH_SETTINGS, dailyTime: "" }, problems: ["dailyTime"] },
  { settings: { ...DEFAULT_PUSH_SETTINGS, dailyDays: 128 }, problems: ["dailyDays"] },
  { settings: { ...DEFAULT_PUSH_SETTINGS, dailyDays: -1 }, problems: ["dailyDays"] },
  { settings: { ...DEFAULT_PUSH_SETTINGS, dailyDays: 0 }, problems: ["dailyDays"] },
  { settings: { ...DEFAULT_PUSH_SETTINGS, quietFrom: "25:00" }, problems: ["quietFrom"] },
  { settings: { ...DEFAULT_PUSH_SETTINGS, quietTo: "ab:cd" }, problems: ["quietTo"] },
  {
    settings: { ...DEFAULT_PUSH_SETTINGS, quietFrom: "21:00", quietTo: "21:00" },
    problems: ["quietSame"],
  },
  {
    settings: { ...DEFAULT_PUSH_SETTINGS, dailyTime: "x", dailyDays: 0, quietFrom: "y" },
    problems: ["dailyTime", "dailyDays", "quietFrom"],
  },
];

export const REFUSED_ENDPOINTS: readonly string[] = [
  "http://fcm.googleapis.com/fcm/send/abc",
  "https://fcm.googleapis.com.example.com/fcm/send/abc",
  "https://example.com/fcm.googleapis.com/abc",
  "https://user@fcm.googleapis.com/fcm/send/abc",
  "https://fcm.googleapis.com:8443/fcm/send/abc",
  "https://localhost/push",
  "https://127.0.0.1/push",
  "https://push.apple.com.evil.example/abc",
  "https://evilpush.apple.com/abc",
  "https://notify.windows.com/abc",
  "https://FCM.googleapis.com/fcm/send/abc",
  "https://fcm.googleapis.com/fcm/send/a b",
  "https://fcm.googleapis.com",
  `https://fcm.googleapis.com/${"a".repeat(1000)}`,
  "",
];
