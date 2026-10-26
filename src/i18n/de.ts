// The German texts: the reference for the others. `en.ts` must have exactly this shape (its type is
// `Messages`), so a text missing in a language is a type error in `npm run check`. Texts with
// numbers or names are functions that return a whole sentence, so every language can put the
// parts where its own word order wants them; counts go through `plural`.
//
// Not here yet (EN-b/EN-c): account, household, invites, notifications, legal texts, the form
// errors of the domain, storage and sign-in messages, the loading picture, the server's messages
// and the e-mails. They stay German in both languages until then.

import { formatNumber, plural } from "./intl";

/** The sentence under the greeting in three parts, so the count can be set in bold. */
export type SummaryParts = readonly [before: string, emphasis: string, after: string];

const n = (count: number) => formatNumber("de", count);
const two = (value: number) => String(value).padStart(2, "0");

export const de = {
  app: {
    skipLink: "Zum Inhalt springen",
    loading: "Wird geladen …",
  },

  /** Name and tab title of every page; a page below a section is named with it. */
  routes: {
    today: { label: "Heute", title: "Heute" },
    week: { label: "Woche", title: "Wochenübersicht" },
    tasks: { label: "Aufgaben", title: "Aufgaben" },
    done: { label: "Erledigt", title: "Erledigt" },
    statistics: { label: "Statistik", title: "Statistik" },
    settings: { label: "Einstellungen", title: "Einstellungen" },
    settingsAccount: { label: "Konto und Haushalt", title: "Konto und Haushalt" },
    settingsNotifications: { label: "Benachrichtigungen", title: "Benachrichtigungen" },
    settingsAppearance: { label: "Darstellung", title: "Darstellung" },
    settingsData: { label: "Daten", title: "Daten" },
    settingsLegal: { label: "Rechtliches", title: "Rechtliches" },
    // The legal pages keep their German names until their texts are translated (EN-b).
    imprint: { label: "Impressum", title: "Impressum" },
    privacy: { label: "Datenschutz", title: "Datenschutzerklärung" },
    taskNew: { label: "Neue Aufgabe", title: "Neue Aufgabe" },
    taskEdit: { label: "Aufgabe bearbeiten", title: "Aufgabe bearbeiten" },
  },

  nav: {
    main: "Hauptnavigation",
    newTask: "Neue Aufgabe",
  },

  common: {
    cancel: "Abbrechen",
    close: "Schließen",
    save: "Speichern",
    notSaved: "Nicht gespeichert",
    notDeleted: "Nicht gelöscht",
    notice: "Hinweis",
    edit: "Bearbeiten",
    delete: "Löschen",
    undo: "Rückgängig",
    takeOver: "Übernehmen",
    tickOff: "Abhaken",
    all: "Alle",
    both: "Beide",
    oneOff: "einmalig",
    filterTasks: "Aufgaben filtern",
    changeWeek: "Woche wechseln",
    previousWeek: "Vorherige Woche",
    nextWeek: "Nächste Woche",
    thisWeek: "Diese Woche",
    noTasksYet: "Es gibt noch keine Aufgaben.",
    createFirstTask: "Erste Aufgabe anlegen",
    /** "3 von 5", for a screen reader beside the figures "3 / 5". */
    xOfY: (x: number, y: number) => `${n(x)} von ${n(y)}`,
    /** The name of a button that acts on a task, e.g. "Abhaken: Bad putzen". */
    tickOffTask: (title: string) => `Abhaken: ${title}`,
    takeOverTask: (title: string) => `Übernehmen: ${title}`,
    checklistOfTask: (title: string) => `Checkliste: ${title}`,
    editTask: (title: string) => `Bearbeiten: ${title}`,
    deleteTask: (title: string) => `Löschen: ${title}`,
    undoTask: (title: string) => `Rückgängig: ${title}`,
  },

  /** Dates, counts and short phrases used on several pages. */
  format: {
    /** Abbreviated weekdays, Monday first, and months, January first. */
    weekdaysShort: ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"],
    monthsShort: [
      "Jan",
      "Feb",
      "Mär",
      "Apr",
      "Mai",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Okt",
      "Nov",
      "Dez",
    ],
    /** "Mo, 19.10.2026" */
    day: (weekday: string, date: number, month: number, year: number) =>
      `${weekday}, ${two(date)}.${two(month)}.${year}`,
    /** "Mo, 19.10." – where the week already says which year it is. */
    shortDay: (weekday: string, date: number, month: number) =>
      `${weekday}, ${two(date)}.${two(month)}.`,
    /** "Dienstag, 20. Oktober" */
    longDay: (weekday: string, date: number, month: string) => `${weekday}, ${date}. ${month}`,
    /** "5." – the label of a bar of a month's chart. */
    dayOfMonthLabel: (date: number) => `${date}.`,
    /** "KW 43" */
    weekNumber: (week: number) => `KW ${week}`,
    /**
     * The days of a week: "19.–25. Oktober", "26. Oktober – 1. November". The start has a month
     * only if the week spans two, a year only if it spans two years; the end has a year when the
     * year is to be shown.
     */
    weekRange: (
      start: { date: number; month?: string; year?: string },
      end: { date: number; month: string; year?: string },
    ) => {
      const from =
        start.month === undefined
          ? `${start.date}.–`
          : `${start.date}. ${start.month}${start.year === undefined ? "" : ` ${start.year}`} – `;
      return `${from}${end.date}. ${end.month}${end.year === undefined ? "" : ` ${end.year}`}`;
    },
    /** "Diese Woche", "Nächste Woche", "Vor 3 Wochen" … for a week `offset` weeks from this one. */
    weekTitle: (offset: number) => {
      if (offset === 0) {
        return "Diese Woche";
      }
      if (offset === 1) {
        return "Nächste Woche";
      }
      if (offset === -1) {
        return "Letzte Woche";
      }
      return offset > 0 ? `In ${n(offset)} Wochen` : `Vor ${n(-offset)} Wochen`;
    },
    countTasks: (count: number) =>
      plural("de", count, { zero: "keine Aufgaben", one: "{n} Aufgabe", other: "{n} Aufgaben" }),
    countCompletions: (count: number) =>
      plural("de", count, {
        zero: "keine Erledigungen",
        one: "{n} Erledigung",
        other: "{n} Erledigungen",
      }),
    countEntries: (count: number) =>
      plural("de", count, { one: "{n} Eintrag", other: "{n} Einträge" }),
    /** What a set of data holds: "4 Aufgaben und 12 Erledigungen". */
    contents: (tasks: string, completions: string) => `${tasks} und ${completions}`,
    checklistProgress: (done: number, total: number) => `${n(done)} von ${n(total)} abgehakt`,
    /** "täglich", "wöchentlich", "monatlich" */
    recurrenceSingle: { day: "täglich", week: "wöchentlich", month: "monatlich" },
    /** "alle 2 Wochen" */
    recurrenceEvery: (interval: number, unit: "day" | "week" | "month") =>
      `alle ${n(interval)} ${plural("de", interval, UNIT_WORDS[unit])}`,
    overdue: (days: number) =>
      plural("de", days, { one: "{n} Tag überfällig", other: "{n} Tage überfällig" }),
    /** "Erledigt von Alex am Mi, 14.10.2026" */
    completedBy: (name: string, day: string) => `Erledigt von ${name} am ${day}`,
    /** "erledigt um 08:12", or "erledigt von Robin um 08:12" when somebody else did it. */
    doneAt: (by: string | undefined, time: string | undefined) =>
      `erledigt${by === undefined ? "" : ` von ${by}`}${time === undefined ? "" : ` um ${time}`}`,
    doneBy: (name: string) => `erledigt von ${name}`,
    /** "Robin (nur dieses Mal übernommen; sonst Alex)" */
    takenOver: (by: string, usually: string) =>
      `${by} (nur dieses Mal übernommen; sonst ${usually})`,
  },

  /** The sentences after an action (shown in the snackbar). */
  notices: {
    completed: (title: string) => `„${title}“ ist abgehakt und steht jetzt unter „Erledigt“.`,
    completedNext: (title: string, next: string) =>
      `„${title}“ ist abgehakt. Nächster Termin: ${next}.`,
    undone: (title: string, due: string) =>
      `Rückgängig gemacht: „${title}“ ist wieder offen, fällig am ${due}.`,
    takenOverOneOff: (title: string, name: string) => `„${title}“ ist jetzt bei ${name}.`,
    takenOverOnce: (title: string, name: string) =>
      `„${title}“ ist jetzt bei ${name}, nur dieses Mal.`,
    takenOverForGood: (title: string, name: string) => `„${title}“ gehört jetzt dauerhaft ${name}.`,
    created: (title: string) => `Aufgabe „${title}“ angelegt.`,
    changed: (title: string) => `Aufgabe „${title}“ gespeichert.`,
    deleted: (title: string) => `Aufgabe „${title}“ gelöscht.`,
  },

  today: {
    greeting: {
      morning: (name: string) => `Guten Morgen, ${name}!`,
      hello: (name: string) => `Hallo, ${name}!`,
      evening: (name: string) => `Guten Abend, ${name}!`,
    },
    /** The sentence under the greeting: [before, emphasised, after]. */
    summary: {
      nothing: ["Heute steht ", "nichts", " für dich an."] as SummaryParts,
      allDone: ["Heute ist ", "alles erledigt", ". Gut gemacht!"] as SummaryParts,
      open: (open: number, overdue: number): SummaryParts => {
        const lead: [string, string] =
          open === 1 ? ["Heute steht ", "1 Aufgabe"] : ["Heute stehen ", `${n(open)} Aufgaben`];
        let rest = " für dich an.";
        if (overdue > 0) {
          if (open === 1) {
            rest += " Sie ist überfällig.";
          } else if (overdue === open) {
            rest += " Alle sind überfällig.";
          } else {
            rest +=
              overdue === 1
                ? " Eine davon ist überfällig."
                : ` ${n(overdue)} davon sind überfällig.`;
          }
        }
        return [lead[0], lead[1], rest];
      },
    },
    yourWeek: "Deine Woche",
    tasksDone: "Aufgaben geschafft",
    together: "Gemeinsam",
    togetherText: (done: number, due: number, current: boolean) =>
      `${n(done)} von ${n(due)} ${current ? "diese Woche" : "in dieser Woche"}`,
    ringLabel: (done: number, due: number) => `Gemeinsam ${n(done)} von ${n(due)} erledigt`,
    filterMine: "Meine",
    filterAll: "Alle",
    today: "Heute",
    /** The heading of the list: "Heute für dich", "Mo, 19.10. für euch". */
    listTitle: (day: string, mine: boolean) => `${day} ${mine ? "für dich" : "für euch"}`,
    nothingThatDay: "Für diesen Tag steht nichts an.",
    done: "Erledigt",
    /** The label of a day field: "Dienstag, heute, 1 von 3 erledigt". */
    dayFree: (name: string, isToday: boolean) => `${name}${isToday ? ", heute" : ""}, frei`,
    dayToday: (name: string, done: number, due: number) =>
      `${name}, heute, ${n(done)} von ${n(due)} erledigt`,
    dayAllDone: (name: string) => `${name}, alles erledigt`,
    dayOpen: (name: string, open: number, done: number) =>
      `${name}, ${plural("de", open, { one: "{n} Aufgabe", other: "{n} Aufgaben" })}${done > 0 ? ` offen, ${n(done)} erledigt` : ""}`,
  },

  week: {
    lists: "Listen",
    filterMine: "Nur meine",
    doneCount: (count: number) => `${n(count)} erledigt`,
    openCount: (count: number) => `${n(count)} offen`,
    todayDay: (day: string) => `Heute · ${day}`,
    noTasksDay: "Keine Aufgaben.",
    checklist: "Checkliste",
    overdue: "Überfällig",
    /** "3 Tage überfällig (seit Mo, 19.10.) · Alex" */
    overdueMeta: (overdue: string, since: string, who: string) =>
      `${overdue} (seit ${since}) · ${who}`,
    showMore: (count: number) => `+ ${n(count)} weitere anzeigen`,
    showLess: "Weniger anzeigen",
    progress: "Stand",
    progressCurrent: "diese Woche erledigt",
    progressOther: "in dieser Woche erledigt",
    overview: "Woche im Überblick",
  },

  tasks: {
    noTasks: "Es gibt noch keine Aufgaben. Leg die erste an.",
    recurringGroup: "Wiederkehrende Aufgaben",
    oneOffGroup: "Einmalige Aufgaben",
    rhythm: "Rhythmus",
    nextDate: "Nächster Termin",
    dueOn: "Fällig am",
    assignee: "Zuständig",
    note: "Notiz",
    kind: "Art",
    oneOffTask: "Einmalige Aufgabe",
    missingTitle: "Aufgabe nicht gefunden",
    missingText: "Diese Aufgabe gibt es nicht (mehr). Vielleicht wurde sie gelöscht.",
    backToTasks: "Zurück zu den Aufgaben",
  },

  taskForm: {
    kindLegend: "Art der Aufgabe",
    recurring: "Wiederkehrend (z. B. Bad putzen)",
    oneOff: "Einmalig (z. B. Paket abholen)",
    /** [before, emphasised, after]: the kind is set in bold. */
    kindFixed: (recurring: boolean): SummaryParts => [
      "Art der Aufgabe: ",
      recurring ? "Wiederkehrend" : "Einmalig",
      " (lässt sich nicht ändern)",
    ],
    title: "Titel",
    symbol: "Symbol",
    chosenSymbol: (name: string) => `Gewählt: ${name}`,
    rhythm: "Rhythmus",
    interval: "Abstand (Anzahl)",
    intervalHint: "Beispiel: 2 und „Wochen“ ergeben „alle 2 Wochen“.",
    unit: "Einheit",
    units: { day: "Tage", week: "Wochen", month: "Monate" },
    firstDate: "Erster Termin",
    nextDate: "Nächster Termin",
    dueOn: "Fällig am",
    dateHint: "Danach zählt der Rhythmus ab dem Tag, an dem die Aufgabe abgehakt wird.",
    assignee: "Zuständig",
    note: "Notiz (optional)",
    create: "Aufgabe anlegen",
    deleteTask: "Aufgabe löschen …",
  },

  checklist: {
    legend: "Checkliste (optional)",
    hint: "Zum Beispiel die Schritte einer Aufgabe oder eine Einkaufsliste. Die Einträge lassen sich in der Wochenübersicht abhaken.",
    newItem: "Neuer Eintrag",
    add: "Hinzufügen",
    added: (text: string) => `Eintrag „${text}“ hinzugefügt.`,
    removed: (text: string) => `Eintrag „${text}“ gelöscht.`,
    removeItem: (text: string) => `Eintrag löschen: ${text}`,
    title: "Checkliste",
  },

  symbols: {
    standard: "Standard (Haus)",
    broom: "Besen",
    cleaner: "Sprühflasche",
    bath: "Badewanne",
    shower: "Dusche",
    laundry: "Waschmaschine",
    clothes: "Hemd",
    bed: "Bett",
    cooking: "Kochtopf",
    dishes: "Besteck",
    fridge: "Kühlschrank",
    trash: "Mülleimer",
    recycling: "Recycling",
    plant: "Pflanze",
    pet: "Pfote",
    shopping: "Einkaufswagen",
    parcel: "Paket",
    gift: "Geschenk",
    phone: "Telefon",
    car: "Auto",
    tools: "Werkzeug",
  },

  deleteTask: {
    title: (task: string) => `Aufgabe „${task}“ löschen?`,
    confirm: "Ja, Aufgabe löschen",
    text: (consequence: string) =>
      `Die Aufgabe wird gelöscht. ${consequence} Das lässt sich nicht rückgängig machen.`,
    consequence: (count: number) =>
      count === 0
        ? "Sie hat noch keine Einträge in „Erledigt“."
        : count === 1
          ? "Auch ihr 1 Eintrag in „Erledigt“ verschwindet."
          : `Auch ihre ${n(count)} Einträge in „Erledigt“ verschwinden.`,
  },

  takeOver: {
    title: (task: string) => `Aufgabe „${task}“ übernehmen?`,
    confirm: "Übernehmen",
    legend: "Wie lange?",
    once: (after: string) => `Nur dieses Mal (${after})`,
    permanently: (name: string) => `Dauerhaft (ab jetzt ist ${name} zuständig)`,
    afterBoth: "danach sind wieder beide zuständig",
    afterOne: (name: string) => `danach ist wieder ${name} zuständig`,
  },

  detail: {
    done: "Erledigt",
  },

  doneList: {
    title: "Erledigte Aufgaben",
    empty: "Noch nichts erledigt. Abgehakte Aufgaben stehen hier.",
    undoHint: "Rückgängig machen lässt sich nur das letzte Abhaken einer Aufgabe.",
  },

  statistics: {
    heading: "Eure Bilanz",
    period: "Zeitraum",
    periods: { week: "Woche", month: "Monat", year: "Jahr" },
    /** "Gemeinsam erledigt · KW 43" */
    totalLabel: (period: string) => `Gemeinsam erledigt · ${period}`,
    before: { week: "in der Vorwoche", month: "im Vormonat", year: "im Vorjahr" },
    same: (before: string) => `so viele wie ${before}`,
    more: (difference: number, before: string) => `${n(difference)} mehr als ${before}`,
    fewer: (difference: number, before: string) => `${n(difference)} weniger als ${before}`,
    streakOne: "1 Woche alles erledigt",
    streak: (weeks: number) => `${n(weeks)} Wochen in Folge`,
    teamwork: "Euer Teamwork",
    teamworkPart: (name: string, count: number) =>
      `${name} ${plural("de", count, { one: "{n} Aufgabe", other: "{n} Aufgaben" })}`,
    takenOverNone: "Bisher hat niemand für die andere Person übernommen.",
    takenOver: (count: number) => `${n(count)}-mal habt ihr füreinander übernommen.`,
    top: "Am häufigsten erledigt",
    topEmpty: "In diesem Zeitraum wurde noch nichts erledigt.",
    topCount: (count: number) => `${n(count)}-mal erledigt`,
    /** "Erledigt pro Tag: Montag 7, Dienstag 5, …" */
    chart: (per: "day" | "month", parts: string) =>
      `Erledigt pro ${per === "month" ? "Monat" : "Tag"}: ${parts}`,
  },

  settings: {
    title: "Einstellungen",
    backLabel: "Zurück zu Einstellungen",
    listLabel: "Bereiche der Einstellungen",
    status: {
      deviceOnly: "Nur auf diesem Gerät",
      noHousehold: "Noch kein Haushalt",
      /** "Familie Muster, 2 Personen"; a household without a name says "Haushalt". */
      household: (name: string | null, people: number) =>
        `${name ?? "Haushalt"}, ${plural("de", people, { one: "{n} Person", other: "{n} Personen" })}`,
      notificationsChecking: "Wird geprüft …",
      notificationsActive: "Aktiv",
      notificationsOff: "Aus",
      notificationsBlocked: "Blockiert",
      notificationsNotConfigured: "Nicht eingerichtet",
      notificationsUnsupported: "Nicht unterstützt",
      notificationsAppOnly: "Nur als installierte App",
      /** "Deutsch · Krümel bewegt sich: an" */
      appearance: (language: string, moving: boolean) =>
        `${language} · Krümel bewegt sich: ${moving ? "an" : "aus"}`,
      allSent: "Alles übertragen",
      sending: "Wird übertragen …",
      notSent: "Noch nicht übertragen",
      offline: "Offline",
      unreachable: "Server nicht erreichbar",
      someRefused: "Nicht alles übertragen",
      legal: "Impressum, Datenschutz",
    },
  },

  appearance: {
    title: "Darstellung",
    scope: "Gilt nur für dieses Gerät und wirkt sofort.",
    schemeLegend: "Farbschema",
    light: "Hell",
    dark: "Dunkel",
    auto: "Automatisch (wie das Gerät)",
    logoMotionLabel: "Krümel bewegt sich",
    logoMotionHint:
      "Der kleine Krümel oben winkt und blinzelt. Mach das aus, wenn dich Bewegung stört.",
  },

  language: {
    /** Heading of the tile in "Darstellung". */
    title: "Sprache",
    /** The label of the switch on pages without an account (sign-in, invite): both languages. */
    label: "Sprache / Language",
    hint: "Gilt nur für dieses Gerät und wirkt sofort.",
  },
};

const UNIT_WORDS = {
  day: { one: "Tag", other: "Tage" },
  week: { one: "Woche", other: "Wochen" },
  month: { one: "Monat", other: "Monate" },
} as const;

/** The shape every language has: the texts of `de` with the same keys and parameter lists. */
export type Messages = typeof de;
