// The texts of the tile "Benachrichtigungen" in the settings (NT-a), in one place so a later
// English version only has to replace this file. The texts of the messages themselves are in
// `src/push/messageTexts.ts` (the service worker may not share a file with the page).

import type { PushFailure } from "../../supabase/functions/push/rules";

/** How the tile says where the notifications of this device stand. */
export const NOTIFICATION_STATUS_TEXTS = {
  checking: "Wird geprüft …",
  unavailable:
    "Benachrichtigungen gibt es nur in der gemeinsamen Version von Krümel, mit Anmeldung.",
  notConfigured:
    "Benachrichtigungen sind noch nicht eingerichtet. Sobald sie es sind, kannst du sie hier aktivieren.",
  unsupported: "Dieser Browser kann keine Benachrichtigungen empfangen.",
  iosHomeScreen:
    "Auf dem iPhone gibt es Benachrichtigungen nur in der Krümel-App vom Home-Bildschirm. Füge Krümel zuerst zum Home-Bildschirm hinzu, öffne es von dort und aktiviere die Benachrichtigungen dann hier.",
  blocked: "Blockiert: Dieser Browser darf Krümel keine Benachrichtigungen schicken.",
  off: "Auf diesem Gerät nicht aktiviert.",
  lost: "Dieses Gerät ist abgemeldet: Der Browser oder der Server hat die Benachrichtigungen beendet, zum Beispiel weil das Gerät lange nicht benutzt wurde. Schalte sie wieder ein, dann kommen sie wieder an.",
  active: "Auf diesem Gerät aktiv.",
} as const;

export const NOTIFICATION_TEXTS = {
  tileTitle: "Benachrichtigungen",
  intro:
    "Krümel kann dir Nachrichten auf dieses Gerät schicken, auch wenn die App geschlossen ist. Der Browser fragt erst, wenn du auf „Aktivieren“ tippst.",
  /** Only in the test build (mode `e2e`): nothing reaches a real device there. */
  testOnly: "Testumgebung: Testbenachrichtigungen werden nur aufgezeichnet, nicht zugestellt.",
  enable: "Aktivieren",
  /** For a device that was switched on before and got lost. */
  reenable: "Neu einschalten",
  sendTest: "Testbenachrichtigung senden",
  disable: "Auf diesem Gerät ausschalten",
  busy: "Einen Moment …",
  enabled: "Aktiviert. Probier es mit einer Testbenachrichtigung aus.",
  testSent: "Gesendet. Die Testbenachrichtigung sollte in wenigen Sekunden erscheinen.",
  turnedOff: "Ausgeschaltet. Du kannst Benachrichtigungen jederzeit wieder aktivieren.",
  notAsked: "Du hast die Frage des Browsers geschlossen. Tippe noch einmal auf „Aktivieren“.",
  enableFailed: "Nicht aktiviert",
  testFailed: "Nicht gesendet",
  disableFailed: "Nicht ausgeschaltet",
  blockedGuide: "So erlaubst du Benachrichtigungen wieder",
  blockedAfter: "Danach diese Seite neu laden.",
  iosGuide: "So kommt Krümel auf den Home-Bildschirm",
  /** In the question before signing out, while notifications are on here. */
  signOutNote: "Benachrichtigungen auf diesem Gerät werden ausgeschaltet.",
} as const;

/** Monday first, as the bit mask of the settings counts (`dailyDays`); short and full name. */
export const WEEKDAYS: readonly { readonly short: string; readonly full: string }[] = [
  { short: "Mo", full: "Montag" },
  { short: "Di", full: "Dienstag" },
  { short: "Mi", full: "Mittwoch" },
  { short: "Do", full: "Donnerstag" },
  { short: "Fr", full: "Freitag" },
  { short: "Sa", full: "Samstag" },
  { short: "So", full: "Sonntag" },
];

/** The settings of a device (NT-b), shown while notifications are on. */
export const NOTIFICATION_SETTINGS_TEXTS = {
  title: "Einstellungen für dieses Gerät",
  intro:
    "Diese Einstellungen gelten nur für dieses Gerät. Auf einem anderen Gerät kannst du es anders wählen.",
  loading: "Die Einstellungen werden geladen …",
  unreachable:
    "Der Server ist gerade nicht erreichbar. Die Einstellungen erscheinen, sobald du wieder online bist.",
  retry: "Erneut versuchen",
  /** Said in the tile when nothing about the settings could be read. */
  loadFailed: "Einstellungen nicht geladen",
  dailyLabel: "Tagesüberblick",
  dailyHint:
    "Morgens eine Nachricht, was heute für dich ansteht. Steht nichts an, kommt auch keine.",
  dailyTimeLabel: "Uhrzeit des Tagesüberblicks",
  dailyDaysLegend: "An diesen Tagen",
  partnerLabel: (name: string) => `Wenn ${name} etwas für dich erledigt oder übernimmt`,
  partnerHint: "Eine Nachricht, kurz nachdem es passiert ist. Mehrere werden zusammengefasst.",
  /** Instead of the other person's name when the household does not tell it. */
  otherPerson: "die andere Person",
  householdLabel: "Wenn jemand dem Haushalt beitritt",
  quietLabel: "Ruhezeit",
  quietHint:
    "In dieser Zeit warten Nachrichten über die andere Person und über den Haushalt. Sie kommen gesammelt danach. Der Tagesüberblick kommt immer zur gewählten Uhrzeit.",
  quietFromLabel: "Ruhezeit von",
  quietToLabel: "Ruhezeit bis",
  save: "Speichern",
  saving: "Wird gespeichert …",
  saved: "Gespeichert.",
  /** Chosen on this device, the server has no news yet. */
  pending:
    "Gespeichert, aber noch nicht übertragen. Sobald du wieder online bist, wird es gesendet.",
  pendingNote: "Noch nicht übertragen.",
  nowSent: "Jetzt übertragen.",
  saveFailed: "Nicht gespeichert",
  /** Beside the fields when a value is wrong (`pushSettingsProblems`). */
  problems: {
    dailyTime: "Bitte gib eine Uhrzeit an, zum Beispiel 07:30.",
    dailyDays: "Wähle mindestens einen Tag.",
    quietFrom: "Bitte gib an, wann die Ruhezeit beginnt, zum Beispiel 21:00.",
    quietTo: "Bitte gib an, wann die Ruhezeit endet, zum Beispiel 07:00.",
    quietSame: "Beginn und Ende der Ruhezeit dürfen nicht gleich sein.",
  },
} as const;

/** Why a step failed, in words for the person. */
export const PUSH_FAILURE_TEXTS: Readonly<Record<PushFailure, string>> = {
  notSignedIn: "Deine Anmeldung ist abgelaufen. Bitte melde dich neu an.",
  notConfigured:
    "Benachrichtigungen sind auf dem Server noch nicht eingerichtet. Bitte versuch es später noch einmal.",
  badRequest: "Das hat nicht geklappt. Bitte schalte Benachrichtigungen aus und wieder ein.",
  deviceUnknown:
    "Dieses Gerät ist für Benachrichtigungen nicht mehr angemeldet. Bitte aktiviere sie neu.",
  deviceGone:
    "Der Browser hat die Benachrichtigungen für dieses Gerät beendet. Bitte aktiviere sie neu.",
  testWait: "Bitte warte eine Minute bis zur nächsten Testbenachrichtigung.",
  testToday: "Für heute sind genug Testbenachrichtigungen verschickt. Morgen geht es wieder.",
  keyChanged:
    "Die Benachrichtigungen wurden neu eingerichtet. Bitte schalte sie auf diesem Gerät aus und wieder ein.",
  endpointInvalid: "Dieser Browser wird für Benachrichtigungen nicht unterstützt.",
  settingsInvalid:
    "Diese Einstellungen sind nicht möglich. Bitte prüfe die Uhrzeiten und die Tage und versuch es noch einmal.",
  pushFailed:
    "Der Benachrichtigungsdienst des Browsers ist gerade nicht erreichbar. Bitte versuch es in ein paar Minuten noch einmal.",
  pushRejected:
    "Der Benachrichtigungsdienst des Browsers hat die Nachricht abgelehnt. Das liegt an der Einrichtung auf dem Server, nicht an deinem Gerät; ein neuer Versuch hilft erst, wenn sie behoben ist.",
  notFound: "Das hat nicht geklappt. Bitte lade die App neu.",
  offline: "Ohne Internet geht das nicht. Bitte versuch es mit Verbindung noch einmal.",
  noWorker: "Krümel ist auf diesem Gerät noch nicht fertig geladen. Bitte lade die Seite neu.",
  unknown: "Das hat nicht geklappt. Bitte versuch es später noch einmal.",
};

/** Where a browser keeps its permission for notifications (`notificationWay`). */
export type NotificationWay = "ios" | "firefoxAndroid" | "other";

/** How to allow notifications again, for the browser at hand. */
export const BLOCKED_STEPS: Readonly<Record<NotificationWay, readonly string[]>> = {
  ios: [
    "Öffne die Einstellungen-App des iPhones.",
    "Tippe auf „Mitteilungen“ und dann auf „Krümel“.",
    "Schalte „Mitteilungen erlauben“ ein.",
  ],
  firefoxAndroid: [
    "In Firefox das Menü ⋮ öffnen, dann Einstellungen → Website-Berechtigungen → Benachrichtigungen.",
    "Die Adresse von Krümel wählen und „Erlauben“ einstellen.",
    "In den Android-Einstellungen unter Apps → Firefox → Benachrichtigungen einschalten.",
    "Auf Handys von Xiaomi, Redmi und POCO außerdem: Apps → Firefox → Akku → „Keine Einschränkungen“ und Autostart einschalten.",
  ],
  other: [
    "Auf das Symbol links neben der Adresse klicken oder tippen.",
    "„Berechtigungen“ oder „Website-Einstellungen“ öffnen und bei „Benachrichtigungen“ „Zulassen“ wählen.",
    "Unter Windows zusätzlich: Einstellungen → System → Benachrichtigungen → den Browser einschalten und „Nicht stören“ ausschalten.",
  ],
};
