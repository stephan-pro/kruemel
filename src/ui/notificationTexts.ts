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
  active: "Auf diesem Gerät aktiv.",
} as const;

export const NOTIFICATION_TEXTS = {
  tileTitle: "Benachrichtigungen",
  intro:
    "Krümel kann dir Nachrichten auf dieses Gerät schicken, auch wenn die App geschlossen ist. Der Browser fragt erst, wenn du auf „Aktivieren“ tippst.",
  /** Only in the test build (mode `e2e`): nothing reaches a real device there. */
  testOnly: "Testumgebung: Testbenachrichtigungen werden nur aufgezeichnet, nicht zugestellt.",
  enable: "Aktivieren",
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
