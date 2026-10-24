// Push addresses that may and may not be stored (NT-a). Pure data: Vitest checks them against
// `isPushEndpoint` (rules.test.ts), the job `db` against the database (supabase/tests/push.test.ts),
// so the two allow lists cannot drift apart.

export const ALLOWED_ENDPOINTS: readonly string[] = [
  "https://fcm.googleapis.com/fcm/send/dQw4w9WgXcQ:APA91bH-abc_DEF",
  "https://fcm.googleapis.com/wp/abc123",
  "https://updates.push.services.mozilla.com/wpush/v2/gAAAAABk-abc",
  "https://web.push.apple.com/QGq9hVyTzT0-abc",
  "https://api.push.apple.com/3/device/abc",
  "https://wns2-par02p.notify.windows.com/w/?token=BQYAAAB%2bx",
  "https://fcm.googleapis.com:443/fcm/send/abc",
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
