// The texts of the household and the invite (stage 2), in one place so a later English version
// only has to replace this file (like `accountTexts.ts`). The messages for refused steps come from
// `HOUSEHOLD_MESSAGES` (`src/auth/household.ts`).

import {
  FRIEND_INVITES_OPEN,
  FRIEND_INVITES_PER_DAY,
  type HouseholdFailure,
  INVITE_DAYS,
} from "../auth/household";

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
  namesTitle: "Namen",
  householdNameLabel: "Name des Haushalts",
  householdNameHint:
    "Zum Beispiel „WG Sonnenweg“. Darf leer bleiben. Ändern geht nur mit Internet.",
  ownNameHint: "So sehen dich alle im Haushalt.",
  saveNames: "Namen speichern",
  namesSaved: "Gespeichert.",
  householdNameFailed: "Name des Haushalts nicht gespeichert",
  ownNameFailed: "Nicht gespeichert",
  inviteIntro: `Schick der zweiten Person einen Einladungslink, zum Beispiel per Messenger. Er gilt ${INVITE_DAYS} Tage und nur einmal.`,
  createInvite: "Link für die zweite Person erzeugen",
  /** The field with the new link; "Einladungslink" alone would read like the one for friends. */
  secondPersonLinkField: "Einladungslink für die zweite Person",
  newInvite: "Neuen Link erzeugen",
  newInviteHint: "Ein neuer Link macht den alten ungültig.",
  inviteFailed: "Kein Link erzeugt",
  validUntil: (end: string) => `Gültig bis ${end}.`,
  copy: "Kopieren",
  copied: "Kopiert.",
  copyFailed: "Kopieren ging nicht. Markiere den Link im Feld und kopiere ihn von Hand.",
  share: "Teilen",
  shareTitle: "Einladung zu Krümel",
  shareText: (householdName: string | null) =>
    `Komm in unseren Haushalt${householdName === null ? "" : ` „${householdName}“`} bei Krümel. Öffne den Link und melde dich an:`,
  showQr: "QR-Code zeigen",
  hideQr: "QR-Code ausblenden",
  qrLabel: "QR-Code mit dem Einladungslink",
} as const;

/** "Freunde einladen" in the settings (E2-5b): a link for an account and a household of one's own. */
export const FRIEND_TEXTS = {
  tileTitle: "Freunde einladen",
  intro: `Kennst du jemanden, der Krümel auch nutzen möchte? Mit einem Einladungslink legt die Person ein eigenes Konto und einen eigenen Haushalt an. Eure Aufgaben bleiben getrennt. Der Link gilt ${INVITE_DAYS} Tage und nur einmal.`,
  limits: `Du kannst bis zu ${FRIEND_INVITES_OPEN} offene Links haben und ${FRIEND_INVITES_PER_DAY} am Tag erzeugen.`,
  create: "Link für Freunde erzeugen",
  createAnother: "Noch einen Link erzeugen",
  failed: "Kein Link erzeugt",
  linkField: "Einladungslink für Freunde",
  shareTitle: "Einladung zu Krümel",
  shareText:
    "Ich nutze Krümel für unseren Haushalt. Probier es aus und leg deinen eigenen Haushalt an. Öffne den Link und melde dich an:",
  qrLabel: "QR-Code mit dem Einladungslink für Freunde",
  openTitle: "Offene Links",
  openEntry: (end: string) => `Gültig bis ${end}`,
  show: "Zeigen",
  cancel: "Zurückziehen",
  /** Completes the button names for screen readers: "Zeigen: Link gültig bis …". */
  entryName: (end: string) => `: Link gültig bis ${end}`,
  cancelled: "Link zurückgezogen. Er funktioniert nicht mehr.",
  cancelFailed: "Nicht zurückgezogen",
  listFailed: "Die offenen Links lassen sich gerade nicht laden. Bitte Internet prüfen.",
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
  /** A new build of the app is installed while this page still runs the old one. */
  appUpdated: "Es gibt eine neue Version von Krümel. Lade die App neu, um sie zu nutzen.",

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

/** Removing the other person and leaving the household (E2-5a). */
export const LEAVE_TEXTS = {
  needsInternet: "Das geht nur mit Internet.",

  remove: (name: string) => `${name} entfernen …`,
  removeQuestion: (name: string) => `${name} aus dem Haushalt entfernen?`,
  removeDialog: (name: string) =>
    `${name} sieht eure Aufgaben danach nicht mehr. Alle Aufgaben und Erledigungen bleiben im Haushalt, auch die von ${name}. Danach kannst du jemanden neu einladen.`,
  removeConfirm: "Ja, entfernen",
  removed: (name: string) => `${name} gehört nicht mehr zum Haushalt.`,
  removeFailed: "Nicht entfernt",

  leave: "Haushalt verlassen …",
  leaveQuestion: "Haushalt verlassen?",
  leaveDialog: (other: string) =>
    `Du siehst die Aufgaben danach nicht mehr. Alle Aufgaben und Erledigungen bleiben für ${other} im Haushalt, auch deine. Die Daten auf diesem Gerät werden gelöscht. Zurück kommst du nur mit einer neuen Einladung.`,
  leaveLastDialog:
    "Du bist die letzte Person im Haushalt. Wenn du gehst, wird der Haushalt mit allen Aufgaben und Erledigungen gelöscht. Das lässt sich nicht rückgängig machen. Die App lädt vorher automatisch eine Sicherung herunter.",
  leaveConfirm: "Haushalt verlassen",
  leaveLastConfirm: "Haushalt löschen und gehen",
  leaveFailed: "Haushalt nicht verlassen",

  pending: (count: number) =>
    `${changesAre(count)} noch nicht übertragen. Die App lädt sie vorher als Datei herunter.`,
  backupOffer: "Willst du die Daten selbst behalten? Dann lade vorher eine Sicherung herunter.",
  backup: "Sicherung herunterladen",
  backupDone: "Sicherung heruntergeladen.",

  /** On "Haushalt anlegen" afterwards. */
  noticeLabel: "Hinweis",
  youLeft:
    "Du hast den Haushalt verlassen. Du kannst einen neuen anlegen oder einer neuen Einladung folgen.",
  notMember:
    "Du gehörst nicht mehr zu diesem Haushalt: Die andere Person hat dich entfernt, oder du bist auf einem anderen Gerät gegangen. Du kannst einen neuen Haushalt anlegen oder einer neuen Einladung folgen.",
  pendingSaved: "Deine noch nicht übertragenen Änderungen hat die App als Datei heruntergeladen.",
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
