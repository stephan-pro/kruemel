// The texts of "Impressum" and "Datenschutzerklärung" (E2-5c, English: EN-c), in one place, in both
// languages. The German text is the authoritative one; the English one is a translation of it and
// says so at its top (`translationNote`). Both have the same sections in the same order, so a
// change to one is made to the other (`legalTexts.test.ts` checks the shape).
//
// DRAFT, no legal advice: the texts are a draft and have to be checked legally (see
// `docs/ETAPPE2.md`, E2-5c); the English translation has not been checked legally either. The
// repository is public, so the personal details below stay placeholders in square brackets until the
// owner replaces them (`LEGAL_CONTACT`, one place for both languages).

import { getLanguage, type Language } from "../i18n/language";
import { liveObject } from "../i18n/live";

/**
 * Who runs the app. Placeholders on purpose: the owner enters the real details here (and in no
 * test); the tests only look for the placeholders' shape.
 */
export const LEGAL_CONTACT = {
  name: "[Vorname Nachname]",
  addressLines: ["[Straße und Hausnummer]", "[PLZ Ort]"],
  email: "[E-Mail-Adresse]",
} as const;

/** One paragraph of text, or a list of short points. */
export type LegalBlock =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "list"; readonly items: readonly string[] };

export interface LegalSection {
  /** Stable name for the anchor and for tests; the same in both languages. */
  readonly id: string;
  readonly title: string;
  readonly blocks: readonly LegalBlock[];
}

const text = (value: string): LegalBlock => ({ kind: "text", text: value });
const list = (...items: string[]): LegalBlock => ({ kind: "list", items });

/** The words around the sections (links, buttons, the line with the date). */
export interface LegalWords {
  readonly back: string;
  readonly stateLabel: (date: string) => string;
  /** The links to both pages, on the sign-in pages and in the settings. */
  readonly linksLabel: string;
  readonly imprintLink: string;
  readonly privacyLink: string;
  readonly settingsTitle: string;
  readonly settingsIntro: string;
  readonly imprintTitle: string;
  readonly privacyTitle: string;
  /** Said at the top of both pages. */
  readonly intro: string;
  /** The first line of a translation; the authoritative text has none. */
  readonly translationNote?: string;
}

/** Everything one language says on the two pages. */
export interface LegalContent {
  /** Date of both texts; change it with every change of the wording (in both languages). */
  readonly date: string;
  readonly words: LegalWords;
  readonly imprint: readonly LegalSection[];
  /**
   * The paragraph about the sender of the sign-in mails. The provider is going to change: replace
   * the text of this one section (and nothing else) when it does. `docs/SUPABASE.md` says where.
   */
  readonly mailProvider: LegalSection;
  readonly privacy: readonly LegalSection[];
}

const address = LEGAL_CONTACT.addressLines.join(", ");

const GERMAN_MAIL_PROVIDER: LegalSection = {
  id: "mailversand",
  title: "Versand der Anmelde-Mails",
  blocks: [
    text(
      "Den Code für die Anmeldung schickt Supabase in unserem Auftrag per E-Mail. Dafür nutzen wir derzeit das E-Mail-Postfach eines Google-Kontos (Gmail, Google Ireland Limited, Irland, und Google LLC, USA). Dabei erfährt der Anbieter deine E-Mail-Adresse und den Zeitpunkt der Mail. Der Inhalt der Mail ist nur der Code.",
    ),
    text(
      "Wir wechseln diesen Anbieter in nächster Zeit zu einem Dienst, mit dem wir einen Vertrag zur Auftragsverarbeitung schließen. Dann ändern wir diesen Abschnitt und das Datum oben.",
    ),
  ],
};

const ENGLISH_MAIL_PROVIDER: LegalSection = {
  id: "mailversand",
  title: "Sending the sign-in emails",
  blocks: [
    text(
      "Supabase sends the sign-in code by email on our behalf. For this we currently use the mailbox of a Google account (Gmail, Google Ireland Limited, Ireland, and Google LLC, USA). The provider learns your email address and the time of the email. The content of the email is only the code.",
    ),
    text(
      "We will switch this provider soon to a service with which we conclude a data processing agreement. Then we will change this section and the date above.",
    ),
  ],
};

const GERMAN: LegalContent = {
  date: "24. Oktober 2026",
  words: {
    back: "Zurück",
    stateLabel: (date) => `Stand: ${date}`,
    linksLabel: "Rechtliches",
    imprintLink: "Impressum",
    privacyLink: "Datenschutzerklärung",
    settingsTitle: "Rechtliches",
    settingsIntro: "Wer hinter Krümel steht und wie wir mit deinen Daten umgehen.",
    imprintTitle: "Impressum",
    privacyTitle: "Datenschutzerklärung",
    intro:
      "Krümel ist eine private Haushalts-App für wenige Personen, ohne Werbung und ohne Gewinnabsicht.",
  },
  imprint: [
    {
      id: "anbieter",
      title: "Angaben nach § 5 DDG",
      blocks: [text(LEGAL_CONTACT.name), text(address)],
    },
    {
      id: "kontakt",
      title: "Kontakt",
      blocks: [text(`E-Mail: ${LEGAL_CONTACT.email}`)],
    },
    {
      id: "verantwortlich",
      title: "Verantwortlich für den Inhalt",
      blocks: [
        text(
          `${LEGAL_CONTACT.name}, Anschrift wie oben. Die App ist ein privates Angebot ohne Gewinnabsicht; dieses Impressum steht vorsorglich hier.`,
        ),
      ],
    },
  ],
  mailProvider: GERMAN_MAIL_PROVIDER,
  privacy: [
    {
      id: "verantwortlich",
      title: "Wer ist verantwortlich?",
      blocks: [
        text(
          `${LEGAL_CONTACT.name}, ${address}. E-Mail: ${LEGAL_CONTACT.email}. Das ist auch die Stelle für alle Fragen zum Datenschutz.`,
        ),
      ],
    },
    {
      id: "daten",
      title: "Welche Daten verarbeiten wir?",
      blocks: [
        list(
          "Deine E-Mail-Adresse. Sie gehört zu deinem Konto und dient nur der Anmeldung.",
          "Die Namen der beiden Personen im Haushalt (höchstens 30 Zeichen) und, wenn du magst, ein Name für den Haushalt.",
          "Aufgaben mit Notizen und Checklisten, dazu die Erledigungen: wer hat was wann abgehakt.",
          "Einladungen: wer sie erstellt hat und wann. Die E-Mail-Adresse der eingeladenen Person gehört nicht dazu.",
          "Technische Daten bei der Anmeldung und beim Abruf: Zeitpunkt und IP-Adresse (in den Protokollen von Supabase und GitHub).",
          "Auf deinem Gerät, im lokalen Speicher des Browsers: die Anmeldung (Sitzung), eine Kopie deiner Aufgaben, Änderungen, die noch auf die Übertragung warten, und Einstellungen wie das Farbschema. Wenn du Benachrichtigungen einschaltest, kommen eine zufällige Kennung des Geräts und Einstellungen dazu, die noch nicht übertragen sind.",
          "Nur wenn du Benachrichtigungen auf einem Gerät einschaltest: die Push-Adresse dieses Geräts (eine geheime Internetadresse beim Benachrichtigungsdienst deines Browsers, dazu zwei Schlüssel), eine zufällige Kennung des Geräts, seine Zeitzone und Sprache, deine Einstellungen dafür (welche Benachrichtigungen, Uhrzeit, Tage, Ruhezeit) und die Zeitpunkte, wann das Gerät zuletzt benutzt wurde und wann zuletzt eine Benachrichtigung dorthin ging. Mehr dazu im Abschnitt „Benachrichtigungen“.",
        ),
      ],
    },
    {
      id: "zwecke",
      title: "Wofür und auf welcher Grundlage?",
      blocks: [
        text(
          "Wir verarbeiten die Daten, damit du dich anmelden und den Haushalt gemeinsam mit der anderen Person führen kannst. Rechtsgrundlage ist die Bereitstellung der App für dich (Art. 6 Abs. 1 Buchst. b DSGVO).",
        ),
        text(
          "Die technischen Daten in den Protokollen dienen der Sicherheit und dem stabilen Betrieb (Art. 6 Abs. 1 Buchst. f DSGVO, berechtigtes Interesse).",
        ),
        text(
          "Der Speicher auf deinem Gerät wird nur für das gebraucht, was du ausdrücklich nutzt: angemeldet bleiben, offline arbeiten, Einstellungen merken. Er ist technisch erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG).",
        ),
      ],
    },
    {
      id: "orte",
      title: "Wo liegen die Daten?",
      blocks: [
        list(
          "Konto und Haushaltsdaten: Supabase, Rechenzentrum in Paris (Frankreich, EU). Supabase ist ein Unternehmen mit Sitz in den USA; es gilt der Vertrag zur Auftragsverarbeitung von Supabase.",
          "Die App-Dateien liefert GitHub Pages aus (GitHub, Microsoft, USA). Beim Aufruf der Seite sieht GitHub deine IP-Adresse.",
          "Auf deinem Gerät: der lokale Speicher des Browsers. Dort bleiben die Daten, bis du dich abmeldest oder die Website-Daten löschst.",
          "Benachrichtigungen (nur wenn du sie einschaltest): der Benachrichtigungsdienst deines Browsers. Mehr dazu im Abschnitt „Benachrichtigungen“.",
        ),
      ],
    },
    {
      id: "benachrichtigungen",
      title: "Benachrichtigungen",
      blocks: [
        text(
          "Benachrichtigungen sind freiwillig. Sie sind aus, bis du sie auf einem Gerät selbst einschaltest. Erst dann verarbeiten wir dafür Daten, und nur für dieses Gerät.",
        ),
        list(
          "Welche Daten: die Push-Adresse des Geräts mit zwei Schlüsseln (die Adresse ist ein Geheimnis des Geräts und gilt als personenbezogenes Datum), eine zufällige Kennung des Geräts, Zeitzone und Sprache, deine Einstellungen (welche Benachrichtigungen, Uhrzeit, Tage, Ruhezeit) und die Zeitpunkte der letzten Nutzung und der letzten Zustellung. Für die Meldungen über die andere Person merkt sich der Server, wer wann eine Aufgabe für wen erledigt oder übernommen hat und wer dem Haushalt beigetreten ist (nur die Kennung der Aufgabe, nicht ihr Inhalt), und für den Tagesüberblick, an welchem Tag dein Gerät ihn zuletzt bekommen hat.",
          "Wofür und auf welcher Grundlage: für Benachrichtigungen, die du ausdrücklich eingeschaltet hast (Art. 6 Abs. 1 Buchst. b DSGVO). Die Erlaubnis dafür holt dein Browser ein. Die zufällige Kennung auf deinem Gerät ist technisch erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG).",
          "Wer bekommt sie: Den Versand übernimmt der Benachrichtigungsdienst deines Browsers. Das ist Google (Chrome, Firefox auf Android; Google LLC, USA), Mozilla (Firefox; USA), Apple (Safari und iPhone; USA) oder Microsoft (Edge; USA). Welcher es ist, bestimmt dein Browser. Dieser Dienst sieht die Adresse des Geräts sowie Zeitpunkt und Größe jeder Nachricht, aber nicht den Inhalt, denn der ist verschlüsselt.",
          "Was drinsteht: nie Titel, Notizen oder Checklisten deiner Aufgaben, sondern nur Zahlen und den Namen der anderen Person, zum Beispiel „Heute 3 Aufgaben für dich“. So steht auf dem Sperrbildschirm nichts, was dort nicht hingehört.",
          "Wie lange: bis du Benachrichtigungen auf dem Gerät ausschaltest, dich abmeldest, das Konto löschst oder das Gerät 90 Tage lang nicht benutzt hast. Eine Adresse, die der Benachrichtigungsdienst nicht mehr kennt, löschen wir sofort. Benachrichtigungen, die noch auf ihren Versand warten, und die Angaben, wer was für wen erledigt oder übernommen hat, höchstens 7 Tage; den Tag des letzten Tagesüberblicks 8 Tage, auch wenn du die Benachrichtigungen vorher ausschaltest (sonst käme nach dem Wiedereinschalten am selben Tag ein zweiter).",
          "Haushalt verlassen: Verlässt du den Haushalt oder wirst du entfernt, bekommst du dazu keine Benachrichtigungen mehr; was noch auf den Versand wartet, von dir und über dich, wird gelöscht. Dein Gerät und seine Einstellungen gehören zu deinem Konto und bleiben dort, bis du sie ausschaltest.",
        ),
      ],
    },
    GERMAN_MAIL_PROVIDER,
    {
      id: "keine-werbung",
      title: "Keine Werbung, kein Tracking, keine Cookies",
      blocks: [
        text(
          "Krümel setzt keine Werbung, keine Analyse und keine Tracking-Werkzeuge ein und bindet nichts von fremden Servern ein. Auch die Schriften liegen in der App selbst. Es gibt keine Cookies. Deshalb gibt es auch kein Banner, das du wegklicken musst.",
        ),
      ],
    },
    {
      id: "dauer",
      title: "Wie lange speichern wir?",
      blocks: [
        list(
          "Dein Konto und die Daten des Haushalts, bis du das Konto oder den Haushalt löschst.",
          "Gelöschte Aufgaben bleiben noch als leerer Eintrag ohne Inhalt, damit beide Geräte das Löschen mitbekommen.",
          "Zwischenspeicher für Änderungen: 60 Tage.",
          "Einladungen: Freundes-Einladungen 30 Tage; Einladungen in einen Haushalt, bis die nächste erstellt oder der Haushalt gelöscht wird.",
          "Protokolle bei Supabase und GitHub: nach deren Vorgaben.",
          "Lokaler Speicher auf deinem Gerät: bis du dich abmeldest oder die Website-Daten löschst.",
          "Push-Adresse und Einstellungen eines Geräts für Benachrichtigungen: bis du sie ausschaltest, dich abmeldest, das Konto löschst oder das Gerät 90 Tage nicht benutzt hast.",
          "Für Benachrichtigungen, wer was für wen erledigt oder übernommen hat: 7 Tage; der Tag des letzten Tagesüberblicks eines Geräts: 8 Tage.",
        ),
      ],
    },
    {
      id: "loeschen",
      title: "Löschen und mitnehmen",
      blocks: [
        list(
          "Konto löschen: Einstellungen, Kachel „Konto“. Das Konto verschwindet mit allen Geräten für Benachrichtigungen; geht die letzte Person, wird der Haushalt mit allen Daten gelöscht.",
          "Haushalt verlassen oder eine Person entfernen: Einstellungen, Kachel „Haushalt“. Aufgaben und Erledigungen bleiben im Haushalt; Benachrichtigungen zu diesem Haushalt hören auf.",
          "Abmelden löscht die Kopie auf dem Gerät und schaltet die Benachrichtigungen auf diesem Gerät aus.",
          "Benachrichtigungen ausschalten: Einstellungen, Kachel „Benachrichtigungen“, „Auf diesem Gerät ausschalten“. Dann wird die Push-Adresse dieses Geräts gelöscht.",
          "Sicherung herunterladen: Einstellungen, Kachel „Sicherung“. Die Datei enthält alle Daten des Haushalts in einem gängigen Format und dient als Auskunft und zum Mitnehmen.",
        ),
      ],
    },
    {
      id: "rechte",
      title: "Deine Rechte",
      blocks: [
        text(
          "Du hast das Recht auf Auskunft, Berichtigung (Namen änderst du selbst in der App), Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Schreib uns dazu an die E-Mail-Adresse oben.",
        ),
      ],
    },
    {
      id: "beschwerde",
      title: "Beschwerde bei der Aufsichtsbehörde",
      blocks: [
        text(
          "Du kannst dich bei einer Datenschutz-Aufsichtsbehörde beschweren. Zuständig für Nordrhein-Westfalen ist die Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen, Kavalleriestraße 2–4, 40213 Düsseldorf (Postfach 20 04 44, 40102 Düsseldorf), www.ldi.nrw.de.",
        ),
      ],
    },
    {
      id: "einladungen",
      title: "Einladungen und E-Mail-Adressen",
      blocks: [
        text(
          "Eine Einladung ist ein Link. Wer ihn öffnet, meldet sich mit der eigenen E-Mail-Adresse an. Wir speichern die Adresse der eingeladenen Person nicht vorab. E-Mail-Adressen verwenden wir nur für die Anmeldung, nicht für Werbung und nicht für andere Mails.",
        ),
      ],
    },
    {
      id: "aenderungen",
      title: "Änderungen",
      blocks: [
        text(
          "Ändert sich die App oder die Rechtslage, passen wir diesen Text an und ändern das Datum oben.",
        ),
      ],
    },
  ],
};

const ENGLISH: LegalContent = {
  date: "24 October 2026",
  words: {
    back: "Back",
    stateLabel: (date) => `As of: ${date}`,
    linksLabel: "Legal",
    imprintLink: "Imprint",
    privacyLink: "Privacy policy",
    settingsTitle: "Legal",
    settingsIntro: "Who is behind Krümel and how we handle your data.",
    imprintTitle: "Imprint",
    privacyTitle: "Privacy policy",
    intro:
      "Krümel is a private household app for a few people, without advertising and not run for profit.",
    translationNote: "This is a translation. The German version is authoritative.",
  },
  imprint: [
    {
      id: "anbieter",
      title: "Information under § 5 DDG (Digitale-Dienste-Gesetz)",
      blocks: [text(LEGAL_CONTACT.name), text(address)],
    },
    {
      id: "kontakt",
      title: "Contact",
      blocks: [text(`Email: ${LEGAL_CONTACT.email}`)],
    },
    {
      id: "verantwortlich",
      title: "Responsible for the content",
      blocks: [
        text(
          `${LEGAL_CONTACT.name}, address as above. The app is a private offering and not run for profit; this imprint is placed here as a precaution.`,
        ),
      ],
    },
  ],
  mailProvider: ENGLISH_MAIL_PROVIDER,
  privacy: [
    {
      id: "verantwortlich",
      title: "Who is responsible?",
      blocks: [
        text(
          `${LEGAL_CONTACT.name}, ${address}. Email: ${LEGAL_CONTACT.email}. This is also the contact for all questions about data protection.`,
        ),
      ],
    },
    {
      id: "daten",
      title: "Which data do we process?",
      blocks: [
        list(
          "Your email address. It belongs to your account and is used only for signing in.",
          "The names of the two people in the household (at most 30 characters) and, if you like, a name for the household.",
          "Tasks with notes and checklists, plus the completions: who ticked off what and when.",
          "Invitations: who created them and when. The email address of the invited person is not part of it.",
          "Technical data when signing in and when the app is loaded: time and IP address (in the logs of Supabase and GitHub).",
          "On your device, in the browser's local storage: the sign-in (session), a copy of your tasks, changes that are still waiting to be transferred, and settings such as the colour scheme. If you turn on notifications, a random identifier of the device and settings that have not been transferred yet are added.",
          "Only if you turn on notifications on a device: the push address of this device (a secret internet address at your browser's notification service, plus two keys), a random identifier of the device, its time zone and language, your settings for it (which notifications, time, days, quiet hours) and the times when the device was last used and when a notification was last sent to it. More on this in the section “Notifications”.",
        ),
      ],
    },
    {
      id: "zwecke",
      title: "For what purpose and on what legal basis?",
      blocks: [
        text(
          "We process the data so that you can sign in and run the household together with the other person. The legal basis is providing the app to you (Art. 6(1)(b) GDPR).",
        ),
        text(
          "The technical data in the logs serve security and stable operation (Art. 6(1)(f) GDPR, legitimate interest).",
        ),
        text(
          "The storage on your device is used only for what you explicitly use: staying signed in, working offline, remembering settings. It is technically necessary (§ 25(2) no. 2 TDDDG).",
        ),
      ],
    },
    {
      id: "orte",
      title: "Where is the data stored?",
      blocks: [
        list(
          "Account and household data: Supabase, data centre in Paris (France, EU). Supabase is a company based in the USA; Supabase's data processing agreement applies.",
          "The app files are delivered by GitHub Pages (GitHub, Microsoft, USA). When you open the page, GitHub sees your IP address.",
          "On your device: the browser's local storage. The data stays there until you sign out or delete the website data.",
          "Notifications (only if you turn them on): your browser's notification service. More on this in the section “Notifications”.",
        ),
      ],
    },
    {
      id: "benachrichtigungen",
      title: "Notifications",
      blocks: [
        text(
          "Notifications are voluntary. They are off until you turn them on yourself on a device. Only then do we process data for them, and only for that device.",
        ),
        list(
          "Which data: the push address of the device with two keys (the address is a secret of the device and counts as personal data), a random identifier of the device, time zone and language, your settings (which notifications, time, days, quiet hours) and the times of the last use and the last delivery. For the messages about the other person, the server remembers who ticked off or took over a task for whom and when, and who joined the household (only the identifier of the task, not its content), and for the daily overview, on which day your device last received it.",
          "For what and on what legal basis: for notifications you have explicitly turned on (Art. 6(1)(b) GDPR). Your browser asks for the permission. The random identifier on your device is technically necessary (§ 25(2) no. 2 TDDDG).",
          "Who receives them: Your browser's notification service delivers them. This is Google (Chrome, Firefox on Android; Google LLC, USA), Mozilla (Firefox; USA), Apple (Safari and iPhone; USA) or Microsoft (Edge; USA). Your browser decides which one. This service sees the address of the device and the time and size of each message, but not the content, because it is encrypted.",
          "What they say: never titles, notes or checklists of your tasks, only numbers and the name of the other person, for example “3 tasks for you today”. So nothing appears on the lock screen that does not belong there.",
          "How long: until you turn off notifications on the device, sign out, delete the account or have not used the device for 90 days. An address that the notification service no longer knows is deleted immediately. Notifications still waiting to be sent, and the records of who did or took over what for whom, for at most 7 days; the day of the last daily overview for 8 days, even if you turn notifications off earlier (otherwise a second one would arrive after turning them on again on the same day).",
          "Leaving the household: If you leave the household or are removed, you receive no more notifications about it; what is still waiting to be sent, from you and about you, is deleted. Your device and its settings belong to your account and stay there until you turn them off.",
        ),
      ],
    },
    ENGLISH_MAIL_PROVIDER,
    {
      id: "keine-werbung",
      title: "No advertising, no tracking, no cookies",
      blocks: [
        text(
          "Krümel uses no advertising, no analytics and no tracking tools, and loads nothing from third-party servers. The fonts are in the app itself, too. There are no cookies. So there is no banner you would have to click away.",
        ),
      ],
    },
    {
      id: "dauer",
      title: "How long do we store data?",
      blocks: [
        list(
          "Your account and the household's data: until you delete the account or the household.",
          "Deleted tasks remain as an empty entry without content, so that both devices notice the deletion.",
          "Buffer for changes: 60 days.",
          "Invitations: invitations for friends 30 days; invitations into a household until the next one is created or the household is deleted.",
          "Logs at Supabase and GitHub: according to their policies.",
          "Local storage on your device: until you sign out or delete the website data.",
          "Push address and settings of a device for notifications: until you turn them off, sign out, delete the account or have not used the device for 90 days.",
          "For notifications, who did or took over what for whom: 7 days; the day of a device's last daily overview: 8 days.",
        ),
      ],
    },
    {
      id: "loeschen",
      title: "Deleting and taking your data with you",
      blocks: [
        list(
          "Delete account: Settings, tile “Account”. The account disappears together with all devices for notifications; when the last person goes, the household is deleted with all its data.",
          "Leave the household or remove a person: Settings, tile “Household”. Tasks and completions stay in the household; notifications about this household stop.",
          "Signing out deletes the copy on the device and turns off notifications on this device.",
          "Turn off notifications: Settings, tile “Notifications”, “Turn off on this device”. Then the push address of this device is deleted.",
          "Download a backup: Settings, tile “Backup”. The file contains all data of the household in a common format and serves as information and for taking it with you.",
        ),
      ],
    },
    {
      id: "rechte",
      title: "Your rights",
      blocks: [
        text(
          "You have the right of access, rectification (you change names yourself in the app), erasure, restriction of processing, data portability and objection. Write to us at the email address above.",
        ),
      ],
    },
    {
      id: "beschwerde",
      title: "Complaint to the supervisory authority",
      blocks: [
        text(
          "You can lodge a complaint with a data protection supervisory authority. The authority responsible for North Rhine-Westphalia is the State Commissioner for Data Protection and Freedom of Information of North Rhine-Westphalia (Landesbeauftragte für Datenschutz und Informationsfreiheit Nordrhein-Westfalen), Kavalleriestraße 2–4, 40213 Düsseldorf (P.O. Box 20 04 44, 40102 Düsseldorf), www.ldi.nrw.de.",
        ),
      ],
    },
    {
      id: "einladungen",
      title: "Invitations and email addresses",
      blocks: [
        text(
          "An invitation is a link. Whoever opens it signs in with their own email address. We do not store the address of the invited person in advance. We use email addresses only for signing in, not for advertising and not for other emails.",
        ),
      ],
    },
    {
      id: "aenderungen",
      title: "Changes",
      blocks: [
        text(
          "If the app or the legal situation changes, we adapt this text and change the date above.",
        ),
      ],
    },
  ],
};

/** The texts of both languages. */
export const LEGAL_CONTENT: Readonly<Record<Language, LegalContent>> = {
  de: GERMAN,
  en: ENGLISH,
};

/** The texts in the language that is set. */
export function legalContent(): LegalContent {
  return LEGAL_CONTENT[getLanguage()];
}

/** The words around the sections, in the language set at the moment of reading. */
export const LEGAL_TEXTS = liveObject(() => legalContent().words);

// The German texts under their old names (the authoritative version; the tests of the German app
// use them). The pages read `legalContent()`.
export const LEGAL_DATE = GERMAN.date;
export const IMPRINT_SECTIONS: readonly LegalSection[] = GERMAN.imprint;
export const MAIL_PROVIDER_SECTION: LegalSection = GERMAN.mailProvider;
export const PRIVACY_SECTIONS: readonly LegalSection[] = GERMAN.privacy;
