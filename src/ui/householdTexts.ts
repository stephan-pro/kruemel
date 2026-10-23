// The texts of the household and the invite (stage 2), in one place so a later English version
// only has to replace this file (like `accountTexts.ts`). The messages for refused steps come from
// `HOUSEHOLD_MESSAGES` (`src/auth/household.ts`).

import { type HouseholdFailure, INVITE_DAYS } from "../auth/household";

/** "Fr., 30.10.2026": until when an invite works, in the device's time zone unless one is given. */
export function formatInviteEnd(expiresAt: string, timeZone?: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...(timeZone === undefined ? {} : { timeZone }),
  }).format(new Date(expiresAt));
}

/** The heading of the page shown when an invite cannot be accepted. */
export const INVITE_FAILURE_TITLES: Partial<Readonly<Record<HouseholdFailure, string>>> = {
  inviteUnknown: "Einladung nicht gefunden",
  inviteUsed: "Einladung schon benutzt",
  inviteExpired: "Einladung abgelaufen",
  householdFull: "Haushalt ist voll",
  alreadyMember: "Du hast schon einen Haushalt",
};

export const HOUSEHOLD_TEXTS = {
  createTitle: "Haushalt anlegen",
  createIntro: "Lege euren Haushalt an. Danach lädst du die zweite Person mit einem Link ein.",
  ownNameLabel: "Dein Name",
  otherNameLabel: "Name der zweiten Person",
  create: "Haushalt anlegen",
  createFailed: "Haushalt nicht angelegt",

  haveInviteTitle: "Du hast eine Einladung?",
  haveInviteIntro: "Tippe auf den Link in der Nachricht. Oder kopiere ihn und füge ihn hier ein.",
  inviteLinkField: "Einladungslink",
  openInvite: "Einladung öffnen",
  notAnInvite: "Das ist kein Einladungslink. Bitte kopiere den ganzen Link aus der Nachricht.",

  unavailableTitle: "Keine Verbindung",
  retry: "Erneut versuchen",

  acceptTitle: "Einladung annehmen",
  acceptIntro: "Du bist zu einem Haushalt bei Krümel eingeladen.",
  acceptAs: (email: string) =>
    `Du trittst mit ${email} bei. Ist das nicht deine Adresse, melde dich mit einer anderen an.`,
  accept: "Haushalt beitreten",
  notNow: "Nicht jetzt",
  acceptFailed: "Beitreten hat nicht geklappt",
  goOn: "Weiter",

  tileTitle: "Haushalt",
  you: "(du)",
  joined: "dabei",
  notJoined: "noch nicht dabei",
  bothJoined: "Ihr seid beide dabei.",
  namesFixed: "Die Namen kommen aus dem Haushalt. Du kannst sie hier noch nicht ändern.",
  inviteIntro: `Schick der zweiten Person einen Einladungslink, zum Beispiel per Messenger. Er gilt ${INVITE_DAYS} Tage und nur einmal.`,
  createInvite: "Einladungslink erzeugen",
  newInvite: "Neuen Link erzeugen",
  newInviteHint: "Ein neuer Link macht den alten ungültig.",
  inviteFailed: "Kein Link erzeugt",
  validUntil: (end: string) => `Gültig bis ${end}.`,
  copy: "Kopieren",
  copied: "Kopiert.",
  copyFailed: "Kopieren ging nicht. Markiere den Link im Feld und kopiere ihn von Hand.",
  share: "Teilen",
  shareTitle: "Einladung zu Krümel",
  shareText: "Komm in unseren Haushalt bei Krümel. Öffne den Link und melde dich an:",
  showQr: "QR-Code zeigen",
  hideQr: "QR-Code ausblenden",
  qrLabel: "QR-Code mit dem Einladungslink",
} as const;

/** "1 Änderung ist" / "3 Änderungen sind". */
function changesAre(count: number): string {
  return count === 1 ? "1 Änderung ist" : `${count} Änderungen sind`;
}

/** The shared data of the household in the app (E2-3b). */
export const SHARED_TEXTS = {
  notLoadedYet:
    "Eure gemeinsamen Daten sind auf diesem Gerät noch nicht geladen. Dafür braucht die App einmal Internet, danach geht alles auch offline.",

  newVersionLabel: "Neue Version",
  newVersion:
    "Es gibt eine neue Version von Krümel. Lade die App neu, damit deine Änderungen übertragen werden und du alles siehst.",
  reload: "Neu laden",

  signOutExplained:
    "Eure gemeinsamen Daten werden von diesem Gerät gelöscht, im Haushalt bleiben sie erhalten. Zum Weitermachen meldest du dich wieder mit einem Code an.",
  signOutPending: (count: number) =>
    `${changesAre(count)} noch nicht übertragen. Beim Abmelden gehen sie auf diesem Gerät verloren. Deshalb lädt die App sie vorher als Datei herunter.`,
  signOutWithBackup: "Sicherung laden und abmelden",

  backupIntro:
    "Alle Aufgaben, Erledigungen und die Namen eures Haushalts als Datei, zum Aufbewahren. Herunterladen geht auch ohne Internet.",
  importIntro:
    "Ersetzt die Daten für euch beide durch die aus einer Sicherungsdatei. Das geht nur mit Internet. Vorher lädt die App automatisch eine Sicherung der jetzigen Daten herunter.",
  importOffline: "Das Einspielen einer Sicherung geht nur mit Internet.",
  importReplaces: (contents: string) =>
    `In eurem Haushalt sind jetzt ${contents}. Sie werden für euch beide ersetzt; das lässt sich nicht rückgängig machen.`,
  unchanged: "Eure gemeinsamen Daten sind unverändert.",

  problemIntro:
    "Die Krümel-App hat nichts verändert. Sichere die Kopie zuerst als Datei, denn darin stehen auch Änderungen, die noch nicht übertragen waren. Danach holst du die Daten neu vom Server.",
  fromServerTitle: "2. Neu vom Server laden",
  fromServerText:
    "Dabei wird die Kopie auf diesem Gerät gelöscht und neu vom Server geholt. Was noch nicht übertragen war, steht dann nur noch in der heruntergeladenen Datei.",
  fromServer: "Neu vom Server laden …",
  fromServerQuestion: "Daten neu vom Server laden?",
  fromServerConfirm: "Ja, neu laden",
  fromServerDialog:
    "Die Kopie auf diesem Gerät wird gelöscht. Im Haushalt bleiben eure Daten erhalten, die heruntergeladene Datei auch.",
} as const;

/** "1 Änderung wartet" / "3 Änderungen warten". */
function changesWait(count: number): string {
  return count === 1 ? "1 Änderung wartet" : `${count} Änderungen warten`;
}

/** "„Bad putzen“" or, without a title, the fallback. */
function named(title: string | undefined, fallback: string): string {
  return title === undefined ? fallback : `„${title}“`;
}

/** Where the transfer stands and what went wrong (E2-3c). */
export const SYNC_TEXTS = {
  waitingLabel: "Übertragung",
  waitingOffline: (count: number) => `Kein Internet – ${changesWait(count)} auf Verbindung.`,
  waitingUnreachable: (count: number) =>
    `Krümel ist gerade nicht erreichbar – ${changesWait(count)}.`,
  /** Read out once the waiting changes are through. */
  allSent: "Alles übertragen.",

  tileTitle: "Übertragung",
  tileIntro: "Deine Änderungen werden mit dem Haushalt abgeglichen, sobald das Gerät Internet hat.",
  sending: "Wird übertragen …",
  offline: "Kein Internet. Deine Änderungen werden übertragen, sobald du wieder verbunden bist.",
  unreachable: "Krümel ist gerade nicht erreichbar. Die App versucht es später noch einmal.",

  rejectedLabel: "Nicht gespeichert",
  rejected: (count: number) =>
    count === 1
      ? "1 Änderung konnte nicht gespeichert werden. Sie ist beiseitegelegt, alles andere wird weiter übertragen."
      : `${count} Änderungen konnten nicht gespeichert werden. Sie sind beiseitegelegt, alles andere wird weiter übertragen.`,
  rejectedHint: "Lade sie als Datei herunter, wenn du nachsehen willst, was es war.",
  rejectedTile: (count: number) =>
    count === 1
      ? "1 Änderung konnte nicht gespeichert werden (Hinweis oben)."
      : `${count} Änderungen konnten nicht gespeichert werden (Hinweis oben).`,
  download: "Als Datei herunterladen",
  downloaded: "Datei heruntergeladen.",
  discard: "Verwerfen …",
  discardQuestion: (count: number) =>
    count === 1 ? "Änderung verwerfen?" : `${count} Änderungen verwerfen?`,
  discardDialog:
    "Sie werden von diesem Gerät gelöscht und nicht gespeichert. Das lässt sich nicht rückgängig machen.",
  discardConfirm: "Ja, verwerfen",

  conflictLabel: "Hinweise zu deinen Änderungen",
  close: "Hinweis schließen",
  alreadyDone: (title: string | undefined, by: string) =>
    `${named(title, "Die Aufgabe")} hatte ${by} schon abgehakt.`,
  alreadyDoneByMe: (title: string | undefined) =>
    `${named(title, "Die Aufgabe")} hattest du schon auf einem anderen Gerät abgehakt.`,
  taskGone: (title: string | undefined) =>
    `${named(title, "Eine Aufgabe")} wurde inzwischen gelöscht. Deine Änderung daran entfällt.`,
  undoGone: (title: string | undefined) =>
    `${title === undefined ? "" : `„${title}“: `}Rückgängig ging nicht mehr, weil sich die Aufgabe inzwischen geändert hat.`,
} as const;
