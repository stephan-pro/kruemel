// The English texts. The type `Messages` is the shape of `de.ts`: a missing or extra text, or a text
// with other parameters, is a type error. Short and plain; English has no "du", so the texts speak
// of "you" only where the German does too.

import type { Messages, SummaryParts } from "./de";
import { formatNumber, plural } from "./intl";

const n = (count: number) => formatNumber("en", count);

export const en: Messages = {
  app: {
    skipLink: "Skip to content",
    loading: "Loading …",
  },

  routes: {
    today: { label: "Today", title: "Today" },
    week: { label: "Week", title: "Week overview" },
    tasks: { label: "Tasks", title: "Tasks" },
    done: { label: "Done", title: "Done" },
    statistics: { label: "Statistics", title: "Statistics" },
    settings: { label: "Settings", title: "Settings" },
    settingsAccount: { label: "Account and household", title: "Account and household" },
    settingsNotifications: { label: "Notifications", title: "Notifications" },
    settingsAppearance: { label: "Appearance", title: "Appearance" },
    settingsData: { label: "Data", title: "Data" },
    settingsLegal: { label: "Legal", title: "Legal" },
    // Still German: the legal pages are translated in EN-b.
    imprint: { label: "Impressum", title: "Impressum" },
    privacy: { label: "Datenschutz", title: "Datenschutzerklärung" },
    taskNew: { label: "New task", title: "New task" },
    taskEdit: { label: "Edit task", title: "Edit task" },
  },

  nav: {
    main: "Main navigation",
    newTask: "New task",
  },

  common: {
    cancel: "Cancel",
    close: "Close",
    save: "Save",
    notSaved: "Not saved",
    notDeleted: "Not deleted",
    notice: "Notice",
    edit: "Edit",
    delete: "Delete",
    undo: "Undo",
    takeOver: "Take over",
    tickOff: "Done",
    all: "All",
    both: "Both",
    oneOff: "one-off",
    filterTasks: "Filter tasks",
    changeWeek: "Change week",
    previousWeek: "Previous week",
    nextWeek: "Next week",
    thisWeek: "This week",
    noTasksYet: "There are no tasks yet.",
    createFirstTask: "Add the first task",
    xOfY: (x, y) => `${n(x)} of ${n(y)}`,
    tickOffTask: (title) => `Mark as done: ${title}`,
    takeOverTask: (title) => `Take over: ${title}`,
    checklistOfTask: (title) => `Checklist: ${title}`,
    editTask: (title) => `Edit: ${title}`,
    deleteTask: (title) => `Delete: ${title}`,
    undoTask: (title) => `Undo: ${title}`,
  },

  format: {
    weekdaysShort: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
    monthsShort: [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ],
    day: (weekday, date, month, year) => `${weekday}, ${date} ${EN_MONTHS[month - 1]} ${year}`,
    shortDay: (weekday, date, month) => `${weekday}, ${date} ${EN_MONTHS[month - 1]}`,
    longDay: (weekday, date, month) => `${weekday}, ${date} ${month}`,
    dayOfMonthLabel: (date) => `${date}`,
    weekNumber: (week) => `Week ${week}`,
    weekRange: (start, end) => {
      const to = `${end.date} ${end.month}${end.year === undefined ? "" : ` ${end.year}`}`;
      if (start.month === undefined) {
        return `${start.date}–${to}`;
      }
      return `${start.date} ${start.month}${start.year === undefined ? "" : ` ${start.year}`} – ${to}`;
    },
    weekTitle: (offset) => {
      if (offset === 0) {
        return "This week";
      }
      if (offset === 1) {
        return "Next week";
      }
      if (offset === -1) {
        return "Last week";
      }
      return offset > 0
        ? `In ${plural("en", offset, { one: "{n} week", other: "{n} weeks" })}`
        : `${plural("en", -offset, { one: "{n} week", other: "{n} weeks" })} ago`;
    },
    countTasks: (count) =>
      plural("en", count, { zero: "no tasks", one: "{n} task", other: "{n} tasks" }),
    countCompletions: (count) =>
      plural("en", count, {
        zero: "no completions",
        one: "{n} completion",
        other: "{n} completions",
      }),
    countEntries: (count) => plural("en", count, { one: "{n} entry", other: "{n} entries" }),
    contents: (tasks, completions) => `${tasks} and ${completions}`,
    checklistProgress: (done, total) => `${n(done)} of ${n(total)} ticked`,
    recurrenceSingle: { day: "daily", week: "weekly", month: "monthly" },
    recurrenceEvery: (interval, unit) =>
      `every ${n(interval)} ${plural("en", interval, EN_UNIT_WORDS[unit])}`,
    overdue: (days) => plural("en", days, { one: "{n} day overdue", other: "{n} days overdue" }),
    completedBy: (name, day) => `Done by ${name} on ${day}`,
    doneAt: (by, time) =>
      `done${by === undefined ? "" : ` by ${by}`}${time === undefined ? "" : ` at ${time}`}`,
    doneBy: (name) => `done by ${name}`,
    takenOver: (by, usually) => `${by} (taken over this time only; usually ${usually})`,
  },

  notices: {
    completed: (title) => `“${title}” is done and now listed under “Done”.`,
    completedNext: (title, next) => `“${title}” is done. Next due: ${next}.`,
    undone: (title, due) => `Undone: “${title}” is open again, due ${due}.`,
    takenOverOneOff: (title, name) => `“${title}” now belongs to ${name}.`,
    takenOverOnce: (title, name) => `“${title}” now belongs to ${name}, this time only.`,
    takenOverForGood: (title, name) => `“${title}” now belongs to ${name} for good.`,
    created: (title) => `Task “${title}” added.`,
    changed: (title) => `Task “${title}” saved.`,
    deleted: (title) => `Task “${title}” deleted.`,
  },

  today: {
    greeting: {
      morning: (name) => `Good morning, ${name}!`,
      hello: (name) => `Hello, ${name}!`,
      evening: (name) => `Good evening, ${name}!`,
    },
    summary: {
      nothing: ["There is ", "nothing", " on for you today."] as SummaryParts,
      allDone: ["Today, ", "everything is done", ". Well done!"] as SummaryParts,
      open: (open, overdue): SummaryParts => {
        const lead: [string, string] =
          open === 1 ? ["There is ", "1 task"] : ["There are ", `${n(open)} tasks`];
        let rest = " on for you today.";
        if (overdue > 0) {
          if (open === 1) {
            rest += " It is overdue.";
          } else if (overdue === open) {
            rest += " All of them are overdue.";
          } else {
            rest +=
              overdue === 1 ? " One of them is overdue." : ` ${n(overdue)} of them are overdue.`;
          }
        }
        return [lead[0], lead[1], rest];
      },
    },
    yourWeek: "Your week",
    tasksDone: "tasks done",
    together: "Together",
    togetherText: (done, due, current) =>
      `${n(done)} of ${n(due)} ${current ? "this week" : "in this week"}`,
    ringLabel: (done, due) => `Together ${n(done)} of ${n(due)} done`,
    filterMine: "Mine",
    filterAll: "All",
    today: "Today",
    listTitle: (day, mine) => `${day} · ${mine ? "for you" : "for both of you"}`,
    nothingThatDay: "Nothing is on for this day.",
    done: "Done",
    dayFree: (name, isToday) => `${name}${isToday ? ", today" : ""}, free`,
    dayToday: (name, done, due) => `${name}, today, ${n(done)} of ${n(due)} done`,
    dayAllDone: (name) => `${name}, all done`,
    dayOpen: (name, open, done) =>
      `${name}, ${plural("en", open, { one: "{n} task", other: "{n} tasks" })}${done > 0 ? ` open, ${n(done)} done` : ""}`,
  },

  week: {
    lists: "Lists",
    filterMine: "Mine only",
    doneCount: (count) => `${n(count)} done`,
    openCount: (count) => `${n(count)} open`,
    todayDay: (day) => `Today · ${day}`,
    noTasksDay: "No tasks.",
    checklist: "Checklist",
    overdue: "Overdue",
    overdueMeta: (overdue, since, who) => `${overdue} (since ${since}) · ${who}`,
    showMore: (count) => `+ ${n(count)} more`,
    showLess: "Show less",
    progress: "Progress",
    progressCurrent: "done this week",
    progressOther: "done in this week",
    overview: "Week at a glance",
  },

  tasks: {
    noTasks: "There are no tasks yet. Add the first one.",
    recurringGroup: "Recurring tasks",
    oneOffGroup: "One-off tasks",
    rhythm: "Repeats",
    nextDate: "Next due",
    dueOn: "Due on",
    assignee: "Responsible",
    note: "Note",
    kind: "Type",
    oneOffTask: "One-off task",
    missingTitle: "Task not found",
    missingText: "This task does not exist (any more). It may have been deleted.",
    backToTasks: "Back to the tasks",
  },

  taskForm: {
    kindLegend: "Type of task",
    recurring: "Recurring (e.g. clean the bathroom)",
    oneOff: "One-off (e.g. pick up a parcel)",
    kindFixed: (recurring): SummaryParts => [
      "Type of task: ",
      recurring ? "Recurring" : "One-off",
      " (cannot be changed)",
    ],
    title: "Title",
    symbol: "Symbol",
    chosenSymbol: (name) => `Chosen: ${name}`,
    rhythm: "Repeats",
    interval: "Interval (number)",
    intervalHint: "Example: 2 and “weeks” make “every 2 weeks”.",
    unit: "Unit",
    units: { day: "Days", week: "Weeks", month: "Months" },
    firstDate: "First due date",
    nextDate: "Next due",
    dueOn: "Due on",
    dateHint: "After that the rhythm counts from the day the task is ticked off.",
    assignee: "Responsible",
    note: "Note (optional)",
    create: "Add task",
    deleteTask: "Delete task …",
  },

  checklist: {
    legend: "Checklist (optional)",
    hint: "For example the steps of a task or a shopping list. The items can be ticked in the week overview.",
    newItem: "New item",
    add: "Add",
    added: (text) => `Item “${text}” added.`,
    removed: (text) => `Item “${text}” deleted.`,
    removeItem: (text) => `Delete item: ${text}`,
    title: "Checklist",
  },

  symbols: {
    standard: "Standard (house)",
    broom: "Broom",
    cleaner: "Spray bottle",
    bath: "Bathtub",
    shower: "Shower",
    laundry: "Washing machine",
    clothes: "Shirt",
    bed: "Bed",
    cooking: "Cooking pot",
    dishes: "Cutlery",
    fridge: "Fridge",
    trash: "Bin",
    recycling: "Recycling",
    plant: "Plant",
    pet: "Paw",
    shopping: "Shopping cart",
    parcel: "Parcel",
    gift: "Gift",
    phone: "Phone",
    car: "Car",
    tools: "Tools",
  },

  deleteTask: {
    title: (task) => `Delete task “${task}”?`,
    confirm: "Yes, delete task",
    text: (consequence) => `The task will be deleted. ${consequence} This cannot be undone.`,
    consequence: (count) =>
      count === 0
        ? "It has no entries in “Done” yet."
        : count === 1
          ? "Its 1 entry in “Done” goes too."
          : `Its ${n(count)} entries in “Done” go too.`,
  },

  takeOver: {
    title: (task) => `Take over task “${task}”?`,
    confirm: "Take over",
    legend: "For how long?",
    once: (after) => `This time only (${after})`,
    permanently: (name) => `For good (from now on ${name} is responsible)`,
    afterBoth: "after that both are responsible again",
    afterOne: (name) => `after that ${name} is responsible again`,
  },

  detail: {
    done: "Done",
  },

  doneList: {
    title: "Completed tasks",
    empty: "Nothing done yet. Tasks you tick off appear here.",
    undoHint: "Only the latest completion of a task can be undone.",
  },

  statistics: {
    heading: "Your summary",
    period: "Period",
    periods: { week: "Week", month: "Month", year: "Year" },
    totalLabel: (period) => `Done together · ${period}`,
    before: { week: "the week before", month: "the month before", year: "the year before" },
    same: (before) => `the same as ${before}`,
    more: (difference, before) => `${n(difference)} more than ${before}`,
    fewer: (difference, before) => `${n(difference)} fewer than ${before}`,
    streakOne: "1 week all done",
    streak: (weeks) => `${n(weeks)} weeks in a row`,
    teamwork: "Your teamwork",
    teamworkPart: (name, count) =>
      `${name} ${plural("en", count, { one: "{n} task", other: "{n} tasks" })}`,
    takenOverNone: "So far nobody has taken over for the other person.",
    takenOver: (count) =>
      `You took over for each other ${plural("en", count, { one: "once", other: "{n} times" })}.`,
    top: "Done most often",
    topEmpty: "Nothing has been done in this period yet.",
    topCount: (count) => `done ${plural("en", count, { one: "once", other: "{n} times" })}`,
    chart: (per, parts) => `Done per ${per}: ${parts}`,
  },

  settings: {
    title: "Settings",
    backLabel: "Back to settings",
    listLabel: "Settings sections",
    status: {
      deviceOnly: "On this device only",
      noHousehold: "No household yet",
      household: (name, people) =>
        `${name ?? "Household"}, ${plural("en", people, { one: "{n} person", other: "{n} people" })}`,
      notificationsChecking: "Checking …",
      notificationsActive: "On",
      notificationsOff: "Off",
      notificationsBlocked: "Blocked",
      notificationsNotConfigured: "Not set up",
      notificationsUnsupported: "Not supported",
      notificationsAppOnly: "Installed app only",
      appearance: (language, moving) => `${language} · Krümel moves: ${moving ? "on" : "off"}`,
      allSent: "All sent",
      sending: "Sending …",
      notSent: "Not sent yet",
      offline: "Offline",
      unreachable: "Server not reachable",
      someRefused: "Not everything sent",
      legal: "Imprint, privacy",
    },
  },

  appearance: {
    title: "Appearance",
    scope: "Applies to this device only and takes effect at once.",
    schemeLegend: "Colour scheme",
    light: "Light",
    dark: "Dark",
    auto: "Automatic (like the device)",
    logoMotionLabel: "Krümel moves",
    logoMotionHint:
      "The little Krümel at the top waves and blinks. Turn this off if movement bothers you.",
  },

  language: {
    title: "Language",
    label: "Sprache / Language",
    hint: "Applies to this device only and takes effect at once.",
  },
};

const EN_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

const EN_UNIT_WORDS = {
  day: { one: "day", other: "days" },
  week: { one: "week", other: "weeks" },
  month: { one: "month", other: "months" },
} as const;
