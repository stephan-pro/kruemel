// The texts of "Impressum" and "Datenschutzerklärung" (E2-5c), in one place so a later English
// version only has to replace this file.
//
// DRAFT, no legal advice: the texts are a draft and have to be checked legally (see
// `docs/ETAPPE2.md`, E2-5c). The repository is public, so the personal details below stay
// placeholders in square brackets until the owner replaces them (`LEGAL_CONTACT`).

/** Date of both texts; change it with every change of the wording. */
export const LEGAL_DATE = "24. Oktober 2026";

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
  /** Stable name for the anchor and for tests. */
  readonly id: string;
  readonly title: string;
  readonly blocks: readonly LegalBlock[];
}

const text = (value: string): LegalBlock => ({ kind: "text", text: value });
const list = (...items: string[]): LegalBlock => ({ kind: "list", items });

export const LEGAL_TEXTS = {
  back: "Zurück",
  stateLabel: (date: string) => `Stand: ${date}`,
  /** The links to both pages, on the sign-in pages and in the settings. */
  linksLabel: "Rechtliches",
  imprintLink: "Impressum",
  privacyLink: "Datenschutzerklärung",
  settingsTitle: "Rechtliches",
  settingsIntro: "Wer hinter Krümel steht und wie wir mit deinen Daten umgehen.",
  imprintTitle: "Impressum",
  privacyTitle: "Datenschutzerklärung",
  /** Said at the top of both pages. */
  intro:
    "Krümel ist eine private Haushalts-App für wenige Personen, ohne Werbung und ohne Gewinnabsicht.",
};

export const IMPRINT_SECTIONS: readonly LegalSection[] = [
  {
    id: "anbieter",
    title: "Angaben nach § 5 DDG",
    blocks: [text(LEGAL_CONTACT.name), text(LEGAL_CONTACT.addressLines.join(", "))],
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
];

/**
 * The paragraph about the sender of the sign-in mails. The provider is going to change: replace
 * the text of this one section (and nothing else) when it does. `docs/SUPABASE.md` says where.
 */
export const MAIL_PROVIDER_SECTION: LegalSection = {
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

export const PRIVACY_SECTIONS: readonly LegalSection[] = [
  {
    id: "verantwortlich",
    title: "Wer ist verantwortlich?",
    blocks: [
      text(
        `${LEGAL_CONTACT.name}, ${LEGAL_CONTACT.addressLines.join(", ")}. E-Mail: ${LEGAL_CONTACT.email}. Das ist auch die Stelle für alle Fragen zum Datenschutz.`,
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
  MAIL_PROVIDER_SECTION,
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
];
