// The texts of the settings overview and its group pages (UX-a), in one place so a later English
// version only has to replace this file. The tiles inside the groups keep their own text files.

/** The titles of the five groups: rows of the overview, headings and tab titles of the pages. */
export const SETTINGS_GROUP_TITLES = {
  account: "Konto und Haushalt",
  notifications: "Benachrichtigungen",
  appearance: "Darstellung",
  data: "Daten",
  legal: "Rechtliches",
} as const;

export const SETTINGS_TEXTS = {
  /** Heading of the overview and the label of the way back from a group page. */
  title: "Einstellungen",
  /** Name of the way back for screen readers; the button shows only "Einstellungen". */
  backLabel: "Zurück zu Einstellungen",
  /** Label of the list of groups. */
  listLabel: "Bereiche der Einstellungen",
  /** Between the title and the status in the name of a row. */
  status: {
    /** No household and no account, or the data stay on this device. */
    deviceOnly: "Nur auf diesem Gerät",
    noHousehold: "Noch kein Haushalt",
    /** "Familie Muster, 2 Personen"; a household without a name says "Haushalt". */
    household: (name: string | null, people: number) =>
      `${name ?? "Haushalt"}, ${people === 1 ? "1 Person" : `${people} Personen`}`,
    notificationsChecking: "Wird geprüft …",
    notificationsActive: "Aktiv",
    notificationsOff: "Aus",
    notificationsBlocked: "Blockiert",
    notificationsNotConfigured: "Nicht eingerichtet",
    notificationsUnsupported: "Nicht unterstützt",
    /** iPhone in Safari: only the app from the home screen can. */
    notificationsAppOnly: "Nur als installierte App",
    motion: (moving: boolean) => `Krümel bewegt sich: ${moving ? "an" : "aus"}`,
    allSent: "Alles übertragen",
    sending: "Wird übertragen …",
    notSent: "Noch nicht übertragen",
    offline: "Offline",
    unreachable: "Server nicht erreichbar",
    someRefused: "Nicht alles übertragen",
    legal: "Impressum, Datenschutz",
  },
} as const;
