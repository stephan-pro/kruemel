// The German texts: the reference for the others. `en.ts` must have exactly this shape (its type is
// `Messages`), so a text missing in a language is a type error in `npm run check`. Texts with
// numbers or names are functions that return a whole sentence, so every language can put the
// parts where its own word order wants them; counts go through `plural`.
//
// Not in this file, because they cannot import it: the texts of the messages the service worker shows
// (`src/push/messageTexts.ts`, both languages in one file), the loading picture and the title in
// `index.html`, the e-mail template (`supabase/templates/code.html`) and the long legal texts, which
// have both languages side by side in `src/ui/legalTexts.ts`.

import type { PushFailure } from "../../supabase/functions/push/rules";
import {
  CODE_DIGITS,
  CODE_MINUTES,
  FRIEND_INVITES_OPEN,
  FRIEND_INVITES_PER_DAY,
  INVITE_DAYS,
  NAME_MAX,
} from "../auth/limits";
import type { NotificationWay } from "../ui/notificationTexts";
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
    saved: "Gespeichert.",
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

  /** Signing in and out (stage 2). */
  account: {
    /** Header next to the app name: who is signed in, or whom this device belongs to. */
    signedInAs: "Angemeldet als",
    thisDevice: "Dieses Gerät:",

    signInTitle: "Anmelden",
    signInIntro:
      "Melde dich mit deiner E-Mail-Adresse an. Wir schicken dir einen Code, ein Passwort brauchst du nicht.",
    /** Above the form when an invite link was opened (E2-5b). */
    invitedFriend:
      "Du bist zu Krümel eingeladen. Nach der Anmeldung legst du deinen eigenen Haushalt an.",
    invitedHousehold:
      "Du bist zu einem Haushalt bei Krümel eingeladen. Nach der Anmeldung trittst du dem Haushalt bei.",
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
    resendReady: "Du kannst jetzt einen neuen Code anfordern.",
    resendCode: "Code erneut senden",
    codeResent: "Wir haben dir einen neuen Code geschickt.",
    otherEmail: "Andere E-Mail-Adresse",
    busy: "Einen Moment …",

    accountTile: "Konto",
    accountSignedIn: (email: string) => `Du bist angemeldet als ${email}.`,
    signOut: "Abmelden",
    signOutQuestion: "Abmelden?",
    signOutExplained:
      "Deine Aufgaben bleiben auf diesem Gerät. Zum Weitermachen meldest du dich wieder mit einem Code an.",
    signOutFailed: "Abmelden hat nicht geklappt",
  },

  /** Deleting one's account (E2-5a): what goes, what stays, no way back by oneself. */
  deleteAccount: {
    /** The word to type before the account is deleted (upper or lower case does not matter). */
    word: "löschen",
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
      "Ein neues Konto bekommst du danach nur mit einer neuen Einladung. Willst du später wieder mitmachen, bitte jemanden, der Krümel nutzt, um einen Einladungslink.",
    wordLabel: "Zum Bestätigen „löschen“ eintippen",
    wordMissing: "Bitte tippe „löschen“ ein, wenn du dein Konto wirklich löschen willst.",
    confirm: "Konto endgültig löschen",
    failed: "Konto nicht gelöscht",
    /** On the sign-in page afterwards. */
    deleted: "Dein Konto ist gelöscht. Die Daten von Krümel auf diesem Gerät sind entfernt.",
  },

  /** The household and the invite (stage 2). */
  household: {
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
    friendLinkHere:
      "Das ist ein Link für Freunde, nicht für einen Haushalt. Öffne ihn direkt im Browser, dann kannst du dich anmelden.",

    unavailableTitle: "Keine Verbindung",
    unavailableAlert: "Der Haushalt konnte nicht geladen werden",
    retry: "Erneut versuchen",

    acceptTitle: "Einladung annehmen",
    acceptIntro: "Du bist zu einem Haushalt bei Krümel eingeladen.",
    acceptAs: (email: string) =>
      `Du trittst mit ${email} bei. Ist das nicht deine Adresse, melde dich mit einer anderen an.`,
    accept: "Haushalt beitreten",
    notNow: "Nicht jetzt",
    acceptFailed: "Beitreten hat nicht geklappt",
    goOn: "Weiter",
    /** The heading of the page shown when an invite cannot be accepted. */
    failureTitles: {
      inviteUnknown: "Einladung nicht gefunden",
      inviteUsed: "Einladung schon benutzt",
      inviteExpired: "Einladung abgelaufen",
      householdFull: "Haushalt ist voll",
      alreadyMember: "Du hast schon einen Haushalt",
    },

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
  },

  /** "Freunde einladen" in the settings (E2-5b): a link for an account and a household of one's own. */
  friends: {
    tileTitle: "Freunde einladen",
    intro: `Kennst du jemanden, der Krümel auch nutzen möchte? Mit einem Einladungslink legt die Person ein eigenes Konto und einen eigenen Haushalt an. Eure Aufgaben bleiben getrennt. Der Link gilt ${INVITE_DAYS} Tage und nur einmal.`,
    limits: `Du kannst bis zu ${FRIEND_INVITES_OPEN} offene Links haben und ${FRIEND_INVITES_PER_DAY} in 24 Stunden erzeugen.`,
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
  },

  /** The shared data of the household in the app (E2-3b). */
  shared: {
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
      `${plural("de", count, { one: "{n} Änderung ist", other: "{n} Änderungen sind" })} noch nicht übertragen. Beim Abmelden gehen sie auf diesem Gerät verloren. Deshalb lädt die App sie vorher als Datei herunter.`,
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
      "Die Krümel-App hat nichts verändert. Sichere die Kopie zuerst als Datei, denn darin stehen auch Änderungen, die noch nicht übertragen waren. Danach holst du die Daten neu aus eurem Haushalt.",
    fromServerTitle: "2. Neu aus dem Haushalt laden",
    fromServerText:
      "Dabei wird die Kopie auf diesem Gerät gelöscht und neu aus eurem Haushalt geholt. Was noch nicht übertragen war, steht dann nur noch in der heruntergeladenen Datei.",
    fromServer: "Neu aus dem Haushalt laden …",
    fromServerQuestion: "Daten neu aus dem Haushalt laden?",
    fromServerConfirm: "Ja, neu laden",
    fromServerDialog:
      "Die Kopie auf diesem Gerät wird gelöscht. Im Haushalt bleiben eure Daten erhalten, die heruntergeladene Datei auch.",
  },

  /** Removing the other person and leaving the household (E2-5a). */
  leave: {
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
      `${plural("de", count, { one: "{n} Änderung ist", other: "{n} Änderungen sind" })} noch nicht übertragen. Die App lädt sie vorher als Datei herunter.`,
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
  },

  /** Where the transfer stands and what went wrong (E2-3c). */
  sync: {
    waitingLabel: "Übertragung",
    waitingOffline: (count: number) =>
      `Kein Internet – ${plural("de", count, { one: "{n} Änderung wartet", other: "{n} Änderungen warten" })} auf Verbindung.`,
    waitingUnreachable: (count: number) =>
      `Krümel ist gerade nicht erreichbar – ${plural("de", count, { one: "{n} Änderung wartet", other: "{n} Änderungen warten" })}.`,
    /** Read out once the waiting changes are through. */
    allSent: "Alles übertragen.",

    tileTitle: "Übertragung",
    tileIntro:
      "Deine Änderungen werden mit dem Haushalt abgeglichen, sobald das Gerät Internet hat.",
    sending: "Wird übertragen …",
    offline: "Kein Internet. Deine Änderungen werden übertragen, sobald du wieder verbunden bist.",
    unreachable: "Krümel ist gerade nicht erreichbar. Die App versucht es später noch einmal.",

    rejectedLabel: "Nicht gespeichert",
    rejected: (count: number) =>
      count === 1
        ? "1 Änderung konnte nicht gespeichert werden. Sie ist beiseitegelegt, alles andere wird weiter übertragen."
        : `${n(count)} Änderungen konnten nicht gespeichert werden. Sie sind beiseitegelegt, alles andere wird weiter übertragen.`,
    rejectedHint: "Lade sie als Datei herunter, wenn du nachsehen willst, was es war.",
    rejectedTile: (count: number) =>
      count === 1
        ? "1 Änderung konnte nicht gespeichert werden (Hinweis oben)."
        : `${n(count)} Änderungen konnten nicht gespeichert werden (Hinweis oben).`,
    download: "Als Datei herunterladen",
    downloaded: "Datei heruntergeladen.",
    discard: "Verwerfen …",
    discardQuestion: (count: number) =>
      count === 1 ? "Änderung verwerfen?" : `${n(count)} Änderungen verwerfen?`,
    discardDialog:
      "Sie werden von diesem Gerät gelöscht und nicht gespeichert. Das lässt sich nicht rückgängig machen.",
    discardConfirm: "Ja, verwerfen",

    conflictLabel: "Hinweise zu deinen Änderungen",
    close: "Hinweis schließen",
    /** `title` is missing when the task is not known any more. */
    alreadyDone: (title: string | undefined, by: string) =>
      `${title === undefined ? "Die Aufgabe" : `„${title}“`} hatte ${by} schon abgehakt.`,
    alreadyDoneByMe: (title: string | undefined) =>
      `${title === undefined ? "Die Aufgabe" : `„${title}“`} hattest du schon auf einem anderen Gerät abgehakt.`,
    taskGone: (title: string | undefined) =>
      `${title === undefined ? "Eine Aufgabe" : `„${title}“`} wurde inzwischen gelöscht. Deine Änderung daran entfällt.`,
    undoGone: (title: string | undefined) =>
      `${title === undefined ? "" : `„${title}“: `}Rückgängig ging nicht mehr, weil sich die Aufgabe inzwischen geändert hat.`,
  },

  /** Messages for failures: what the person is told (the code of a failure is kept, see `errorText`). */
  errors: {
    /** Said when something failed for a reason the app has no words of its own for. */
    unexpected:
      "Das hat nicht geklappt. Versuch es noch einmal. Hilft das nicht, lade die App neu.",
    loadFailed: "Beim Laden ist ein unerwarteter Fehler aufgetreten.",
    notReady: "Die App ist noch nicht bereit.",
    /** The folded list of places in a file or the storage that are wrong. */
    details: "Details für die Fehlersuche",
    storage: {
      unavailable: "Der Browser-Speicher ist nicht verfügbar.",
      full: "Speichern nicht möglich: Der Browser-Speicher ist voll oder gesperrt. Bitte jetzt eine Sicherung herunterladen.",
      blocked: "Löschen nicht möglich: Der Browser-Speicher ist gesperrt.",
      damaged: "Die gespeicherten Daten sind beschädigt.",
      incomplete: "Die gespeicherten Daten sind unvollständig oder beschädigt.",
      copyDamaged: "Die lokale Kopie der gemeinsamen Daten ist beschädigt.",
      copyIncomplete: "Die lokale Kopie der gemeinsamen Daten ist unvollständig oder beschädigt.",
      queueDamaged: "Die wartenden Änderungen sind beschädigt.",
      rejectedDamaged: "Die nicht gespeicherten Änderungen sind beschädigt.",
      replaceNotSynced:
        "Einspielen geht erst, wenn alle Änderungen übertragen sind. Prüf dein Internet und versuch es gleich noch einmal.",
      replaceOffline: "Das Einspielen einer Sicherung geht nur mit Internet.",
      replaceNewer:
        "Eure Daten stammen aus einer neueren Version der App. Lade die App neu und versuche es dann noch einmal.",
      sharedNotLoaded:
        "Die gemeinsamen Daten sind auf diesem Gerät noch nicht da, und Krümel ist gerade nicht erreichbar.",
    },
    auth: {
      invalidEmail: "Bitte eine gültige E-Mail-Adresse eingeben.",
      wrongCode: "Der Code stimmt nicht. Bitte prüfen und erneut eingeben.",
      expiredCode: "Der Code ist abgelaufen. Bitte einen neuen anfordern.",
      tooManyTries: "Zu viele Versuche. Bitte kurz warten und dann einen neuen Code anfordern.",
      offline: "Keine Verbindung zum Anmeldedienst. Bitte Internet prüfen und erneut versuchen.",
      notAllowed:
        "Krümel ist gerade nur mit Einladung nutzbar. Frag jemanden, der Krümel schon nutzt, nach einem Einladungslink. Hast du schon ein Konto? Dann prüf deine Adresse.",
      inviteInvalid:
        "Dein Einladungslink gilt nicht mehr: Er ist abgelaufen, schon benutzt oder zurückgezogen. Frag nach einem neuen Link. Hast du schon ein Konto? Dann prüf deine Adresse.",
      unknown: "Die Anmeldung hat nicht geklappt. Bitte später erneut versuchen.",
    },
    household: {
      notSignedIn: "Bitte zuerst anmelden.",
      alreadyMember:
        "Du gehörst schon zu einem Haushalt. Willst du wechseln, verlass zuerst deinen Haushalt (Einstellungen → Haushalt) und öffne den Link dann noch einmal.",
      noHousehold: "Du hast noch keinen Haushalt.",
      inviteUnknown: "Diese Einladung gibt es nicht. Bitte nach einem neuen Link fragen.",
      inviteUsed: "Diese Einladung wurde schon benutzt. Bitte nach einem neuen Link fragen.",
      inviteExpired: "Diese Einladung ist abgelaufen. Bitte nach einem neuen Link fragen.",
      householdFull:
        "In diesem Haushalt sind schon zwei Personen. Frag nach, ob jemand Platz macht, und lass dir dann einen neuen Link schicken.",
      invalidNames: `Bitte beide Namen eingeben (höchstens ${NAME_MAX} Zeichen).`,
      invalidHouseholdName: `Der Name des Haushalts darf höchstens ${NAME_MAX} Zeichen lang sein.`,
      invalidMember: "Dich selbst kannst du nicht entfernen. Nimm dafür „Haushalt verlassen“.",
      friendInvitesOpen: `Du hast schon ${FRIEND_INVITES_OPEN} offene Links. Zieh einen zurück oder warte, bis jemand einen benutzt.`,
      friendInvitesToday: `Du hast in den letzten 24 Stunden schon ${FRIEND_INVITES_PER_DAY} Links erzeugt. Bitte versuch es morgen wieder.`,
      offline: "Keine Verbindung zu Krümel. Prüf dein Internet und versuch es noch einmal.",
      unknown: "Das hat nicht geklappt. Versuch es später noch einmal.",
    },
  },

  /** What is wrong in a form field; `limit` is the number the sentence speaks of. */
  formErrors: {
    titleEmpty: "Bitte einen Titel eingeben.",
    titleTooLong: (limit: number) => `Der Titel darf höchstens ${limit} Zeichen lang sein.`,
    dateEmpty: "Bitte ein Datum angeben.",
    dateInvalid: "Bitte ein gültiges Datum angeben.",
    dateOutOfRange: (from: string, to: string) =>
      `Bitte ein Datum zwischen ${from} und ${to} wählen.`,
    symbolMissing: "Bitte ein Symbol auswählen.",
    assigneeMissing: "Bitte auswählen, wer zuständig ist.",
    noteTooLong: (limit: number) => `Die Notiz darf höchstens ${limit} Zeichen lang sein.`,
    checklistTooMany: (limit: number) => `Eine Checkliste darf höchstens ${limit} Einträge haben.`,
    checklistItemInvalid: (limit: number) =>
      `Jeder Eintrag braucht einen Text mit höchstens ${limit} Zeichen.`,
    checklistTextEmpty: "Bitte einen Text für den Eintrag eingeben.",
    checklistTextTooLong: (limit: number) =>
      `Ein Eintrag darf höchstens ${limit} Zeichen lang sein.`,
    intervalEmpty: "Bitte eine Zahl eingeben.",
    intervalInvalid: "Bitte eine ganze Zahl ab 1 eingeben.",
    intervalTooBig: (limit: number) => `Bitte höchstens ${limit} eingeben.`,
    unitMissing: "Bitte Tage, Wochen oder Monate auswählen.",
    nameEmpty: "Bitte einen Namen eingeben.",
    nameTooLong: (limit: number) => `Der Name darf höchstens ${limit} Zeichen lang sein.`,
    namesEqual: "Die beiden Namen müssen sich unterscheiden.",
    personMissing: "Bitte auswählen, wer dieses Gerät benutzt.",
  },

  /** The names of the two people, "Ich bin", first setup (F5). */
  names: {
    firstPerson: "Erste Person",
    secondPerson: "Zweite Person",
    firstName: "Name der ersten Person",
    secondName: "Name der zweiten Person",
    iAm: "Ich bin",
    setupTitle: "Ersteinrichtung",
    setupIntro:
      "Willkommen bei Krümel. Trag die Namen der beiden Personen ein, die den Haushalt gemeinsam organisieren, und wähle, wer dieses Gerät benutzt. Beides kannst du später in den Einstellungen ändern.",
    setupSubmit: "Los geht’s",
    whoTitle: "Wer benutzt dieses Gerät?",
    whoSubmit: "Weiter",
    settingsTile: "Namen und „Ich bin“",
  },

  /** "Sicherung" (F7) in the settings. */
  backup: {
    title: "Sicherung",
    intro:
      "Alle Aufgaben, Erledigungen und die Namen als Datei, zum Aufbewahren oder zum Übertragen.",
    deviceNote: "„Ich bin“ und die Darstellung gehören zum Gerät und stehen nicht darin.",
    downloadTitle: "Herunterladen",
    nowOnDevice: (contents: string) => `Jetzt auf diesem Gerät: ${contents}.`,
    download: "Sicherung herunterladen",
    importTitle: "Einspielen",
    importIntro:
      "Ersetzt alle Daten auf diesem Gerät durch die aus einer Sicherungsdatei. Vorher lädt die App automatisch eine Sicherung der jetzigen Daten herunter.",
    importButton: "Sicherung einspielen …",
    unchanged: "Deine Daten auf diesem Gerät sind unverändert.",
    downloadFailed: "Sicherung nicht heruntergeladen",
    importFailed: "Sicherung nicht eingespielt",
    tooBig: "Die Datei ist zu groß für eine Sicherung (höchstens 5 MB).",
    unreadable: "Die Datei lässt sich nicht lesen.",
    notABackup: "Die Datei ist keine brauchbare Sicherung.",
    question: "Sicherung einspielen?",
    confirm: "Ja, Daten ersetzen",
    fileContains: (fileName: string, contents: string) =>
      `Die Datei „${fileName}“ enthält ${contents}.`,
    replaces: (contents: string) =>
      `Auf diesem Gerät sind jetzt ${contents}. Sie werden alle ersetzt; das lässt sich nicht rückgängig machen.`,
    autoCopy: (fileName: string) =>
      `Vorher lädt die App automatisch eine Sicherung der jetzigen Daten als „${fileName}“ herunter.`,
    /** What the settings say after a backup was downloaded (F7). */
    exported: (fileName: string) =>
      `Die Sicherung „${fileName}“ wurde heruntergeladen. Bewahre die Datei sicher auf.`,
    /** What the settings say after a backup was put in place (F7): what it holds and where the old data is. */
    imported: (contents: string, autoBackupName: string) =>
      `Sicherung eingespielt: ${contents}. Die bisherigen Daten wurden vorher als „${autoBackupName}“ heruntergeladen.`,
  },

  /**
   * Installing the app, the QR code and the version (P12, P13). In the steps, `**x**` is set in
   * bold (see `Rich`).
   */
  install: {
    hintTitle: "Krümel als App",
    hintText:
      "Vom Home-Bildschirm startet Krümel wie eine App: ohne Adressleiste und auch ohne Internet.",
    install: "App installieren",
    showGuide: "Anleitung zeigen",
    dismiss: "Hinweis schließen",
    guideTitle: "Krümel installieren",
    tileTitle: "Als App installieren",
    installed: "Krümel ist auf diesem Gerät als App installiert.",
    iosShare:
      "In Safari auf **Teilen** tippen (Quadrat mit Pfeil nach oben, unten in der Leiste oder neben der Adresse). Steht dort nur **•••**, erst darauf tippen.",
    iosAdd:
      "In der Liste **Zum Home-Bildschirm** wählen (eventuell weiter nach unten wischen oder auf **Mehr** tippen).",
    iosConfirmWord: "Hinzufügen",
    iosConfirm:
      "Oben rechts auf **Hinzufügen** tippen. Krümel liegt jetzt auf dem Home-Bildschirm.",
    iosNoteShared:
      "**Wichtig:** Die App vom Home-Bildschirm ist von Safari getrennt. Melde dich dort einmal mit deiner E-Mail-Adresse an, dann sind eure Daten da.",
    iosNote:
      "**Wichtig:** Die App vom Home-Bildschirm hat eigene Daten, getrennt von Safari. Was du schon in Safari eingetragen hast, nimmst du über „Sicherung“ mit: hier herunterladen, in der App einspielen.",
    firefoxMenu: "In Firefox das **Menü ⋮** öffnen (neben der Adresse).",
    firefoxAdd:
      "**Zum Startbildschirm hinzufügen** wählen (heißt je nach Version auch **App installieren**) und mit **Hinzufügen** bestätigen.",
    other:
      "Bietet dein Browser es an, steht im Browsermenü **App installieren** oder **Zum Startbildschirm hinzufügen**. Am einfachsten geht es auf dem iPhone in Safari und auf Android-Handys in Chrome oder Firefox; Firefox am PC kann keine Apps installieren.",
    /** On Xiaomi phones nothing happens without this permission (seen in the device test). */
    xiaomi: (firefox: boolean) =>
      `**Passiert beim Hinzufügen nichts?** Auf Handys von Xiaomi, Redmi und POCO braucht ${firefox ? "Firefox" : "der Browser"} dafür eine Erlaubnis: in den Einstellungen des Handys **Apps → Apps verwalten → ${firefox ? "Firefox" : "Name des Browsers"} → Weitere Berechtigungen → Startbildschirm-Verknüpfungen** erlauben, dann noch einmal versuchen.`,
  },

  otherDevice: {
    title: "Auf anderem Gerät öffnen",
    shared:
      "Den QR-Code mit der Kamera eines Handys scannen, um Krümel dort zu öffnen. Melde dich dort mit derselben E-Mail-Adresse an, dann sind eure Daten da.",
    plain:
      "Den QR-Code mit der Kamera eines Handys scannen, um Krümel dort zu öffnen. Die Daten kommen nicht mit: Jedes Gerät hat seine eigenen. Übertragen lassen sie sich mit „Sicherung“.",
    show: "QR-Code zeigen",
    hide: "QR-Code ausblenden",
    codeLabel: (address: string) => `QR-Code mit der Adresse ${address}`,
    codeFailedTitle: "QR-Code nicht geladen",
    codeFailed: "Mit Internet unter „Version“ auf „Neu laden“ tippen und es noch einmal versuchen.",
  },

  version: {
    title: "Version",
    build: "Stand:",
    /** "20.10.2026, 14:32 Uhr (a1b2c3d)" */
    builtAt: (date: string, clock: string, commit: string) => `${date}, ${clock} Uhr (${commit})`,
    builtLocally: "lokal gebaut",
    hint: "Neue Versionen kommen von selbst, wenn Krümel mit Internet geöffnet wird. Lief die App im Hintergrund weiter, bleibt sie bei der alten Version, bis du sie neu lädst oder ganz schließt und wieder öffnest.",
    reload: "Neu laden",
  },

  /** Shown instead of the app when the stored data cannot be used. */
  storageProblem: {
    titleRescue: "Gespeicherte Daten nicht lesbar",
    titleNone: "Speicher nicht verfügbar",
    alertTitle: "Die Daten werden nicht angezeigt",
    intro:
      "Die Krümel-App hat nichts verändert und überschreibt die Daten nicht von selbst. Sichere sie zuerst als Datei, damit sich der Fehler später reparieren lässt. Danach kannst du neu beginnen.",
    step1: "1. Rohdaten herunterladen",
    downloadRaw: "Rohdaten herunterladen",
    rawDownloaded: "Die Rohdaten wurden als Datei heruntergeladen. Bewahre die Datei auf.",
    step2: "2. Neu beginnen",
    step2Text:
      "Dabei werden die gespeicherten Daten in diesem Browser gelöscht. Aufgaben und Erledigtes sind dann nur noch in der heruntergeladenen Datei vorhanden.",
    startOver: "Neu beginnen …",
    cannotRead:
      "Der Browser-Speicher lässt sich gerade nicht lesen. Prüfe, ob das Speichern von Website-Daten erlaubt ist (z. B. nicht im privaten Fenster), und versuche es dann erneut.",
    retry: "Erneut versuchen",
    question: "Wirklich neu beginnen?",
    confirm: "Ja, Daten löschen",
    dialog:
      "Die gespeicherten Daten in diesem Browser werden gelöscht. Das lässt sich nicht rückgängig machen. Die heruntergeladene Datei bleibt erhalten.",
  },

  /**
   * The tile "Benachrichtigungen" and its settings (NT-a, NT-b). The texts of the messages
   * themselves are in `src/push/messageTexts.ts`: the service worker may not import this file.
   */
  notifications: {
    /** Where the notifications of this device stand. */
    status: {
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
      lost: "Dieses Gerät ist abgemeldet: Der Browser oder der Server hat die Benachrichtigungen beendet, zum Beispiel weil das Gerät lange nicht benutzt wurde. Schalte sie wieder ein, dann kommen sie wieder an.",
      active: "Auf diesem Gerät aktiv.",
    },
    tile: {
      tileTitle: "Benachrichtigungen",
      intro:
        "Krümel kann dir Nachrichten auf dieses Gerät schicken, auch wenn die App geschlossen ist. Der Browser fragt erst, wenn du auf „Aktivieren“ tippst.",
      /** Only in the test build (mode `e2e`): nothing reaches a real device there. */
      testOnly: "Testumgebung: Testbenachrichtigungen werden nur aufgezeichnet, nicht zugestellt.",
      enable: "Aktivieren",
      /** For a device that was switched on before and got lost. */
      reenable: "Neu einschalten",
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
      /** In the question before signing out, while notifications are on here. */
      signOutNote: "Benachrichtigungen auf diesem Gerät werden ausgeschaltet.",
    },
    /** Monday first, as the bit mask of the settings counts (`dailyDays`); short and full name. */
    weekdays: [
      { short: "Mo", full: "Montag" },
      { short: "Di", full: "Dienstag" },
      { short: "Mi", full: "Mittwoch" },
      { short: "Do", full: "Donnerstag" },
      { short: "Fr", full: "Freitag" },
      { short: "Sa", full: "Samstag" },
      { short: "So", full: "Sonntag" },
    ] as { short: string; full: string }[],
    /** The settings of a device (NT-b), shown while notifications are on. */
    settings: {
      title: "Einstellungen für dieses Gerät",
      intro:
        "Diese Einstellungen gelten nur für dieses Gerät. Auf einem anderen Gerät kannst du es anders wählen.",
      loading: "Die Einstellungen werden geladen …",
      unreachable:
        "Der Server ist gerade nicht erreichbar. Die Einstellungen erscheinen, sobald du wieder online bist.",
      retry: "Erneut versuchen",
      /** Said in the tile when nothing about the settings could be read. */
      loadFailed: "Einstellungen nicht geladen",
      dailyLabel: "Tagesüberblick",
      dailyHint:
        "Morgens eine Nachricht, was heute für dich ansteht. Steht nichts an, kommt auch keine.",
      dailyTimeLabel: "Uhrzeit des Tagesüberblicks",
      dailyDaysLegend: "An diesen Tagen",
      partnerLabel: (name: string) => `Wenn ${name} etwas für dich erledigt oder übernimmt`,
      partnerHint: "Eine Nachricht, kurz nachdem es passiert ist. Mehrere werden zusammengefasst.",
      /** Instead of the other person's name when the household does not tell it. */
      otherPerson: "die andere Person",
      householdLabel: "Wenn jemand dem Haushalt beitritt",
      quietLabel: "Ruhezeit",
      quietHint:
        "In dieser Zeit warten Nachrichten über die andere Person und über den Haushalt. Sie kommen gesammelt danach. Der Tagesüberblick kommt immer zur gewählten Uhrzeit.",
      quietFromLabel: "Ruhezeit von",
      quietToLabel: "Ruhezeit bis",
      save: "Speichern",
      saving: "Wird gespeichert …",
      saved: "Gespeichert.",
      /** Chosen on this device, the server has no news yet. */
      pending:
        "Gespeichert, aber noch nicht übertragen. Sobald du wieder online bist, wird es gesendet.",
      pendingNote: "Noch nicht übertragen.",
      nowSent: "Jetzt übertragen.",
      saveFailed: "Nicht gespeichert",
      /** Beside the fields when a value is wrong (`pushSettingsProblems`). */
      problems: {
        dailyTime: "Bitte gib eine Uhrzeit an, zum Beispiel 07:30.",
        dailyDays: "Wähle mindestens einen Tag.",
        quietFrom: "Bitte gib an, wann die Ruhezeit beginnt, zum Beispiel 21:00.",
        quietTo: "Bitte gib an, wann die Ruhezeit endet, zum Beispiel 07:00.",
        quietSame: "Beginn und Ende der Ruhezeit dürfen nicht gleich sein.",
      },
    },
    /** Why a step failed, in words for the person (one per `PushFailure`). */
    failures: {
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
      settingsInvalid:
        "Diese Einstellungen sind nicht möglich. Bitte prüfe die Uhrzeiten und die Tage und versuch es noch einmal.",
      pushFailed:
        "Der Benachrichtigungsdienst des Browsers ist gerade nicht erreichbar. Bitte versuch es in ein paar Minuten noch einmal.",
      pushRejected:
        "Der Benachrichtigungsdienst des Browsers hat die Nachricht abgelehnt. Das liegt an der Einrichtung auf dem Server, nicht an deinem Gerät; ein neuer Versuch hilft erst, wenn sie behoben ist.",
      notFound: "Das hat nicht geklappt. Bitte lade die App neu.",
      offline: "Ohne Internet geht das nicht. Bitte versuch es mit Verbindung noch einmal.",
      noWorker: "Krümel ist auf diesem Gerät noch nicht fertig geladen. Bitte lade die Seite neu.",
      unknown: "Das hat nicht geklappt. Bitte versuch es später noch einmal.",
    } satisfies Record<PushFailure, string>,
    /** How to allow notifications again, for the browser at hand (`NotificationWay`). */
    blockedSteps: {
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
    } as Record<NotificationWay, string[]>,
  },

  /**
   * The places found wrong in a backup file or in the stored data ("tasks[0].title: fehlt"). Shown
   * folded, as details for troubleshooting (`ErrorDetails`); the paths in front stay as they are.
   */
  validation: {
    expectedObject: "erwartet ein Objekt",
    expectedList: "erwartet eine Liste",
    expectedKind: "erwartet recurring oder oneOff",
    missing: "fehlt",
    invalid: (expected: string) => `ungültig, erwartet ${expected}`,
    duplicate: (id: string) => `die Kennung „${id}“ kommt mehrfach vor`,
    noTask: (id: string) => `es gibt keine Aufgabe „${id}“`,
    /** What a field should have been; after "ungültig, erwartet". */
    expected: {
      id: "eine Kennung",
      text: "einen Text",
      bool: "wahr oder falsch",
      title: "einen Titel",
      symbol: "ein Symbol aus der Liste",
      assignee: "personA, personB oder both",
      date: "ein Datum JJJJ-MM-TT",
      recurrence: "unit und interval",
      person: "personA oder personB",
      idList: "eine Liste von Kennungen",
      timestamp: "einen Zeitpunkt JJJJ-MM-TTThh:mm:ssZ",
      name: "einen Namen",
    },
    fileNotObject: "Datei: erwartet ein Objekt",
    noVersion: "Die Datei ist keine Krümel-Sicherung (die Angabe der Version fehlt).",
    tooNew:
      "Die Daten stammen aus einer neueren Version von Krümel. Lade die App neu und versuch es dann noch einmal.",
    notBackup: "Die Datei ist keine Krümel-Sicherung.",
    /** In front of the places found wrong in the local copy of the shared data. */
    copy: "Kopie",
    copyCursor: "Kopie.cursor: erwartet Text oder nichts",
    copyQueue: "Kopie.outbox: erwartet eine Liste von Änderungen",
    copyRejected: "Kopie.rejected: erwartet eine Liste abgelehnter Änderungen",
  },

  /** The hint of the demo mode (`npm run demo`). */
  demo: {
    label: "Hinweis zum Demo-Modus",
    text: (tasks: number, completions: number) =>
      `Demo-Modus: ${n(tasks)} Beispielaufgaben und ${n(completions)} Erledigungen liegen im Demo-Speicher dieses Browsers. Echte Daten bleiben unberührt.`,
    reload: "Beispieldaten neu laden",
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
