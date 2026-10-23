// The texts of signing in and out (stage 2), in one place so a later English version only has to
// replace this file. The messages for refused steps come from `AUTH_MESSAGES` (`src/auth/auth.ts`).

import { CODE_MINUTES } from "../auth/auth";

/** How many digits the code in the mail has (as set in the real project and the fakes). */
export const CODE_DIGITS = 6;

/** How long after a code a new one may be asked for (the service refuses earlier ones). */
export const RESEND_AFTER_SECONDS = 60;

export const ACCOUNT_TEXTS = {
  /** Header next to the app name: who is signed in, or whom this device belongs to. */
  signedInAs: "Angemeldet als",
  thisDevice: "Dieses Gerät:",

  signInTitle: "Anmelden",
  signInIntro:
    "Melde dich mit deiner E-Mail-Adresse an. Wir schicken dir einen Code, ein Passwort brauchst du nicht.",
  emailLabel: "E-Mail-Adresse",
  sendCode: "Code schicken",

  codeTitle: "Code eingeben",
  codeIntro: (email: string) =>
    `Wir haben dir einen Code an ${email} geschickt. Er gilt ${CODE_MINUTES} Minuten.`,
  codeLabel: "Code aus der E-Mail",
  codeHint: `${CODE_DIGITS} Ziffern`,
  codeFormat: `Bitte gib die ${CODE_DIGITS} Ziffern aus der E-Mail ein.`,
  verifyCode: "Anmelden",
  resendWait:
    "Kein Code da? Schau auch im Spam-Ordner nach. In einer Minute kannst du einen neuen anfordern.",
  resendCode: "Code erneut senden",
  codeResent: "Wir haben dir einen neuen Code geschickt.",
  otherEmail: "Andere E-Mail-Adresse",
  busy: "Einen Moment …",

  accountTile: "Anmeldung",
  accountSignedIn: (email: string) => `Du bist angemeldet als ${email}.`,
  signOut: "Abmelden",
  signOutQuestion: "Abmelden?",
  signOutExplained:
    "Deine Aufgaben bleiben auf diesem Gerät. Zum Weitermachen meldest du dich wieder mit einem Code an.",
  signOutFailed: "Abmelden hat nicht geklappt",
} as const;

/** The word to type before the account is deleted (upper or lower case does not matter). */
export const DELETE_WORD = "löschen";

/** Deleting one's account (E2-5a): what goes, what stays, no way back by oneself. */
export const DELETE_ACCOUNT_TEXTS = {
  open: "Konto löschen …",
  intro: "Löscht dein Konto bei Krümel endgültig. Das geht nur mit Internet.",
  question: "Konto endgültig löschen?",
  goes: "Das wird gelöscht: dein Konto mit deiner E-Mail-Adresse, deine Mitgliedschaft im Haushalt und die Daten von Krümel auf diesem Gerät.",
  stays: (other: string) =>
    `Das bleibt: alle Aufgaben und Erledigungen im Haushalt, auch deine. ${other} kann weitermachen und jemanden neu einladen.`,
  staysNothing:
    "Du bist die letzte Person im Haushalt. Deshalb wird auch der Haushalt mit allen Aufgaben und Erledigungen gelöscht. Die App lädt vorher automatisch eine Sicherung herunter.",
  noUndo: "Das lässt sich nicht rückgängig machen.",
  wayBack:
    "Selbst kannst du dich danach nicht wieder anmelden: Neue Konten legt bei Krümel gerade nur die Person an, die die App betreibt. Willst du später wieder mitmachen, bitte sie darum und lass dich neu einladen.",
  wordLabel: `Zum Bestätigen „${DELETE_WORD}“ eintippen`,
  wordMissing: `Bitte tippe „${DELETE_WORD}“ ein, wenn du dein Konto wirklich löschen willst.`,
  confirm: "Konto endgültig löschen",
  failed: "Konto nicht gelöscht",
  /** On the sign-in page afterwards. */
  deleted: "Dein Konto ist gelöscht. Die Daten von Krümel auf diesem Gerät sind entfernt.",
} as const;
