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
    `${changesAre(count)} noch nicht übertragen, weil die Verbindung fehlt. Beim Abmelden gehen sie auf diesem Gerät verloren. Deshalb lädt die App vorher eine Sicherungsdatei mit allen Daten herunter.`,
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
