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
