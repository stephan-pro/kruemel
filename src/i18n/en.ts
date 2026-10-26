// The English texts. The type `Messages` is the shape of `de.ts`: a missing or extra text, or a text
// with other parameters, is a type error. Short and plain; English has no "du", so the texts speak
// of "you" only where the German does too.

import {
  CODE_DIGITS,
  CODE_MINUTES,
  FRIEND_INVITES_OPEN,
  FRIEND_INVITES_PER_DAY,
  INVITE_DAYS,
  NAME_MAX,
} from "../auth/limits";
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
    imprint: { label: "Imprint", title: "Imprint" },
    privacy: { label: "Privacy", title: "Privacy policy" },
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
    saved: "Saved.",
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

  account: {
    signedInAs: "Signed in as",
    thisDevice: "This device:",

    signInTitle: "Sign in",
    signInIntro: "Sign in with your email address. A code is sent to you; no password is needed.",
    invitedFriend:
      "You have been invited to Krümel. After signing in, you set up your own household.",
    invitedHousehold:
      "You have been invited to a household on Krümel. After signing in, you join that household.",
    emailLabel: "Email address",
    sendCode: "Send code",

    codeTitle: "Enter code",
    codeIntro: (email) =>
      `A code has been sent to ${email}. It is valid for ${CODE_MINUTES} minutes.`,
    codeLabel: "Code from the email",
    codeHint: `${CODE_DIGITS} digits`,
    codeFormat: `Please enter the ${CODE_DIGITS} digits from the email.`,
    verifyCode: "Sign in",
    resendWait: "No code yet? Check the spam folder too. You can ask for a new one in a minute.",
    resendReady: "You can ask for a new code now.",
    resendCode: "Resend code",
    codeResent: "A new code has been sent.",
    otherEmail: "Use another email address",
    busy: "One moment …",

    accountTile: "Account",
    accountSignedIn: (email) => `Signed in as ${email}.`,
    signOut: "Sign out",
    signOutQuestion: "Sign out?",
    signOutExplained: "Your tasks stay on this device. To carry on, sign in again with a code.",
    signOutFailed: "Signing out did not work",
  },

  deleteAccount: {
    word: "delete",
    open: "Delete account …",
    intro: "Permanently deletes your Krümel account. This only works with internet.",
    question: "Delete account permanently?",
    goes: "This will be deleted: your account with your email address, your membership of the household and the Krümel data on this device.",
    stays: (other) =>
      `This stays: all tasks and completions in the household, yours too. ${other} can carry on and invite someone new.`,
    staysNothing:
      "You are the last person in the household, so the household with all its tasks and completions is deleted too. The app downloads a backup first.",
    noUndo: "This cannot be undone.",
    wayBack:
      "You can only get a new account with a new invite. To join again later, ask someone who uses Krümel for an invite link.",
    wordLabel: "Type “delete” to confirm",
    wordMissing: "Please type “delete” if you really want to delete your account.",
    confirm: "Delete account permanently",
    failed: "Account not deleted",
    deleted: "Your account has been deleted. The Krümel data on this device has been removed.",
  },

  household: {
    createTitle: "Create household",
    createIntro: "Set up your household. Then invite the second person with a link.",
    ownNameLabel: "Your name",
    otherNameLabel: "Name of the second person",
    create: "Create household",
    createFailed: "Household not created",

    haveInviteTitle: "Got an invite?",
    haveInviteIntro: "Tap the link in the message. Or copy it and paste it here.",
    inviteLinkField: "Invite link",
    openInvite: "Open invite",
    notAnInvite: "That is not an invite link. Please copy the whole link from the message.",
    friendLinkHere:
      "That is a link for friends, not for a household. Open it directly in the browser, then you can sign in.",

    unavailableTitle: "No connection",
    unavailableAlert: "The household could not be loaded",
    retry: "Try again",

    acceptTitle: "Accept invite",
    acceptIntro: "You have been invited to a household on Krümel.",
    acceptAs: (email) =>
      `You join with ${email}. If that is not your address, sign in with another one.`,
    accept: "Join household",
    notNow: "Not now",
    acceptFailed: "Joining did not work",
    goOn: "Continue",
    failureTitles: {
      inviteUnknown: "Invite not found",
      inviteUsed: "Invite already used",
      inviteExpired: "Invite expired",
      householdFull: "Household is full",
      alreadyMember: "You already have a household",
    },

    tileTitle: "Household",
    you: "(you)",
    joined: "joined",
    notJoined: "not joined yet",
    bothJoined: "You are both in.",
    namesTitle: "Names",
    householdNameLabel: "Household name",
    householdNameHint: "For example “Sunny Lane flat”. Can stay empty. Changing it needs internet.",
    ownNameHint: "This is how everyone in the household sees you.",
    saveNames: "Save names",
    namesSaved: "Saved.",
    householdNameFailed: "Household name not saved",
    ownNameFailed: "Not saved",
    inviteIntro: `Send the second person an invite link, for example by messenger. It works for ${INVITE_DAYS} days and only once.`,
    createInvite: "Create link for the second person",
    secondPersonLinkField: "Invite link for the second person",
    newInvite: "Create new link",
    newInviteHint: "A new link makes the old one invalid.",
    inviteFailed: "No link created",
    validUntil: (end) => `Valid until ${end}.`,
    copy: "Copy",
    copied: "Copied.",
    copyFailed: "Copying did not work. Select the link in the field and copy it by hand.",
    share: "Share",
    shareTitle: "Invitation to Krümel",
    shareText: (householdName) =>
      `Join our household${householdName === null ? "" : ` “${householdName}”`} on Krümel. Open the link and sign in:`,
    showQr: "Show QR code",
    hideQr: "Hide QR code",
    qrLabel: "QR code with the invite link",
  },

  friends: {
    tileTitle: "Invite friends",
    intro: `Know someone who would like to use Krümel too? With an invite link they create their own account and their own household. Your tasks stay separate. The link works for ${INVITE_DAYS} days and only once.`,
    limits: `You can have up to ${FRIEND_INVITES_OPEN} open links and create ${FRIEND_INVITES_PER_DAY} in 24 hours.`,
    create: "Create link for friends",
    createAnother: "Create another link",
    failed: "No link created",
    linkField: "Invite link for friends",
    shareTitle: "Invitation to Krümel",
    shareText:
      "I use Krümel for our household. Try it out and set up your own household. Open the link and sign in:",
    qrLabel: "QR code with the invite link for friends",
    openTitle: "Open links",
    openEntry: (end) => `Valid until ${end}`,
    show: "Show",
    cancel: "Withdraw",
    entryName: (end) => `: link valid until ${end}`,
    cancelled: "Link withdrawn. It no longer works.",
    cancelFailed: "Not withdrawn",
    listFailed: "The open links cannot be loaded right now. Please check your internet.",
  },

  shared: {
    notLoadedYet:
      "Your shared data is not on this device yet. The app needs internet once for this; after that everything also works offline.",

    newVersionLabel: "New version",
    newVersion:
      "There is a new version of Krümel. Reload the app so your changes are sent and you see everything.",
    reload: "Reload",
    appUpdated: "There is a new version of Krümel. Reload the app to use it.",

    signOutExplained:
      "Your shared data is deleted from this device but stays in the household. To carry on, sign in again with a code.",
    signOutPending: (count) =>
      `${plural("en", count, { one: "{n} change is", other: "{n} changes are" })} not sent yet. They would be lost on this device when you sign out, so the app downloads them as a file first.`,
    signOutWithBackup: "Download backup and sign out",

    backupIntro:
      "All tasks, completions and the names of your household as a file, to keep. Downloading also works without internet.",
    importIntro:
      "Replaces the data for both of you with the data from a backup file. This only works with internet. Before that, the app automatically downloads a backup of the current data.",
    importOffline: "Restoring a backup only works with internet.",
    importReplaces: (contents) =>
      `Your household currently has ${contents}. They will be replaced for both of you; this cannot be undone.`,
    unchanged: "Your shared data is unchanged.",

    problemIntro:
      "The Krümel app has changed nothing. First save the copy as a file, because it also holds changes that had not been sent yet. Then fetch the data anew from your household.",
    fromServerTitle: "2. Load anew from the household",
    fromServerText:
      "This deletes the copy on this device and fetches it anew from your household. Anything not sent yet will then only exist in the downloaded file.",
    fromServer: "Load anew from the household …",
    fromServerQuestion: "Load data anew from the household?",
    fromServerConfirm: "Yes, reload",
    fromServerDialog:
      "The copy on this device will be deleted. Your data stays in the household, and so does the downloaded file.",
  },

  leave: {
    needsInternet: "This only works with internet.",

    remove: (name) => `Remove ${name} …`,
    removeQuestion: (name) => `Remove ${name} from the household?`,
    removeDialog: (name) =>
      `${name} will no longer see your tasks. All tasks and completions stay in the household, including those of ${name}. After that you can invite someone new.`,
    removeConfirm: "Yes, remove",
    removed: (name) => `${name} is no longer part of the household.`,
    removeFailed: "Not removed",

    leave: "Leave household …",
    leaveQuestion: "Leave household?",
    leaveDialog: (other) =>
      `You will no longer see the tasks. All tasks and completions stay in the household for ${other}, yours too. The data on this device is deleted. You can only come back with a new invite.`,
    leaveLastDialog:
      "You are the last person in the household. If you leave, the household with all its tasks and completions is deleted. This cannot be undone. The app downloads a backup first.",
    leaveConfirm: "Leave household",
    leaveLastConfirm: "Delete household and leave",
    leaveFailed: "Household not left",

    pending: (count) =>
      `${plural("en", count, { one: "{n} change is", other: "{n} changes are" })} not sent yet. The app downloads them as a file first.`,
    backupOffer: "Want to keep the data yourself? Then download a backup first.",
    backup: "Download backup",
    backupDone: "Backup downloaded.",

    noticeLabel: "Notice",
    youLeft: "You have left the household. You can create a new one or follow a new invite.",
    notMember:
      "You are no longer part of this household: the other person removed you, or you left on another device. You can create a new household or follow a new invite.",
    pendingSaved: "The app downloaded your changes that had not been sent yet as a file.",
  },

  sync: {
    waitingLabel: "Transfer",
    waitingOffline: (count) =>
      `No internet – ${plural("en", count, { one: "{n} change is waiting", other: "{n} changes are waiting" })} for a connection.`,
    waitingUnreachable: (count) =>
      `Krümel cannot be reached right now – ${plural("en", count, { one: "{n} change is waiting", other: "{n} changes are waiting" })}.`,
    allSent: "All sent.",

    tileTitle: "Transfer",
    tileIntro: "Your changes are synced with the household as soon as the device has internet.",
    sending: "Sending …",
    offline: "No internet. Your changes will be sent as soon as you are connected again.",
    unreachable: "Krümel cannot be reached right now. The app will try again later.",

    rejectedLabel: "Not saved",
    rejected: (count) =>
      count === 1
        ? "1 change could not be saved. It has been set aside; everything else is still being sent."
        : `${n(count)} changes could not be saved. They have been set aside; everything else is still being sent.`,
    rejectedHint: "Download them as a file if you want to see what they were.",
    rejectedTile: (count) =>
      count === 1
        ? "1 change could not be saved (see notice above)."
        : `${n(count)} changes could not be saved (see notice above).`,
    download: "Download as file",
    downloaded: "File downloaded.",
    discard: "Discard …",
    discardQuestion: (count) => (count === 1 ? "Discard change?" : `Discard ${n(count)} changes?`),
    discardDialog: "They will be deleted from this device and not saved. This cannot be undone.",
    discardConfirm: "Yes, discard",

    conflictLabel: "Notices about your changes",
    close: "Close notice",
    alreadyDone: (title, by) =>
      `${title === undefined ? "The task" : `“${title}”`} had already been marked as done by ${by}.`,
    alreadyDoneByMe: (title) =>
      `${title === undefined ? "The task" : `“${title}”`} had already been marked as done by you on another device.`,
    taskGone: (title) =>
      `${title === undefined ? "A task" : `“${title}”`} has been deleted in the meantime. Your change to it is dropped.`,
    undoGone: (title) =>
      `${title === undefined ? "" : `“${title}”: `}Undo was no longer possible because the task has changed in the meantime.`,
  },

  errors: {
    unexpected: "That did not work. Try again. If that does not help, reload the app.",
    loadFailed: "An unexpected error occurred while loading.",
    notReady: "The app is not ready yet.",
    details: "Details for troubleshooting",
    storage: {
      unavailable: "The browser storage is not available.",
      full: "Saving is not possible: the browser storage is full or locked. Please download a backup now.",
      blocked: "Deleting is not possible: the browser storage is locked.",
      damaged: "The stored data is damaged.",
      incomplete: "The stored data is incomplete or damaged.",
      copyDamaged: "The local copy of the shared data is damaged.",
      copyIncomplete: "The local copy of the shared data is incomplete or damaged.",
      queueDamaged: "The waiting changes are damaged.",
      rejectedDamaged: "The changes that were not saved are damaged.",
      replaceNotSynced:
        "Restoring only works once all changes have been sent. Check your internet and try again in a moment.",
      replaceOffline: "Restoring a backup only works with internet.",
      replaceNewer:
        "Your data comes from a newer version of the app. Reload the app and try again.",
      sharedNotLoaded:
        "The shared data is not on this device yet, and Krümel cannot be reached right now.",
    },
    auth: {
      invalidEmail: "Please enter a valid email address.",
      wrongCode: "The code is wrong. Please check it and try again.",
      expiredCode: "The code has expired. Please request a new one.",
      tooManyTries: "Too many attempts. Please wait a moment, then request a new code.",
      offline: "No connection to the sign-in service. Please check your internet and try again.",
      notAllowed:
        "Krümel can only be used by invitation at the moment. Ask someone who already uses Krümel for an invite link. Already have an account? Then check your address.",
      inviteInvalid:
        "Your invite link is no longer valid: it has expired, been used or been withdrawn. Ask for a new link. Already have an account? Then check your address.",
      unknown: "Signing in did not work. Please try again later.",
    },
    household: {
      notSignedIn: "Please sign in first.",
      alreadyMember:
        "You already belong to a household. To switch, first leave your household (Settings → Account and household) and then open the link again.",
      noHousehold: "You do not have a household yet.",
      inviteUnknown: "This invite does not exist. Please ask for a new link.",
      inviteUsed: "This invite has already been used. Please ask for a new link.",
      inviteExpired: "This invite has expired. Please ask for a new link.",
      householdFull:
        "This household already has two people. Ask whether someone can make room, then have a new link sent to you.",
      invalidNames: `Please enter both names (at most ${NAME_MAX} characters).`,
      invalidHouseholdName: `The household name can have at most ${NAME_MAX} characters.`,
      invalidMember: "You cannot remove yourself. Use “Leave household” instead.",
      friendInvitesOpen: `You already have ${FRIEND_INVITES_OPEN} open links. Withdraw one or wait until someone uses one.`,
      friendInvitesToday: `You have already created ${FRIEND_INVITES_PER_DAY} links in the last 24 hours. Please try again tomorrow.`,
      offline: "No connection to Krümel. Check your internet and try again.",
      unknown: "That did not work. Please try again later.",
    },
  },

  formErrors: {
    titleEmpty: "Please enter a title.",
    titleTooLong: (limit) => `The title can have at most ${limit} characters.`,
    dateEmpty: "Please enter a date.",
    dateInvalid: "Please enter a valid date.",
    dateOutOfRange: (from, to) => `Please choose a date between ${from} and ${to}.`,
    symbolMissing: "Please choose a symbol.",
    assigneeMissing: "Please choose who is responsible.",
    noteTooLong: (limit) => `The note can have at most ${limit} characters.`,
    checklistTooMany: (limit) => `A checklist can have at most ${limit} items.`,
    checklistItemInvalid: (limit) => `Every item needs text of at most ${limit} characters.`,
    checklistTextEmpty: "Please enter text for the item.",
    checklistTextTooLong: (limit) => `An item can have at most ${limit} characters.`,
    intervalEmpty: "Please enter a number.",
    intervalInvalid: "Please enter a whole number from 1.",
    intervalTooBig: (limit) => `Please enter ${limit} at most.`,
    unitMissing: "Please choose days, weeks or months.",
    nameEmpty: "Please enter a name.",
    nameTooLong: (limit) => `The name can have at most ${limit} characters.`,
    namesEqual: "The two names must differ.",
    personMissing: "Please choose who uses this device.",
  },

  names: {
    firstPerson: "First person",
    secondPerson: "Second person",
    firstName: "Name of the first person",
    secondName: "Name of the second person",
    iAm: "I am",
    setupTitle: "First-time setup",
    setupIntro:
      "Welcome to Krümel. Enter the names of the two people who organise the household together, and choose who uses this device. You can change both later in the settings.",
    setupSubmit: "Let’s go",
    whoTitle: "Who uses this device?",
    whoSubmit: "Continue",
    settingsTile: "Names and “I am”",
  },

  backup: {
    title: "Backup",
    intro: "All tasks, completions and the names as a file, to keep or to transfer.",
    deviceNote: "“I am” and the appearance belong to the device and are not included.",
    downloadTitle: "Download",
    nowOnDevice: (contents) => `Right now on this device: ${contents}.`,
    download: "Download backup",
    importTitle: "Restore",
    importIntro:
      "Replaces all data on this device with the data from a backup file. Before that, the app automatically downloads a backup of the current data.",
    importButton: "Restore backup …",
    unchanged: "Your data on this device is unchanged.",
    downloadFailed: "Backup not downloaded",
    importFailed: "Backup not restored",
    tooBig: "The file is too big for a backup (5 MB at most).",
    unreadable: "The file cannot be read.",
    notABackup: "The file is not a usable backup.",
    question: "Restore backup?",
    confirm: "Yes, replace data",
    fileContains: (fileName, contents) => `The file “${fileName}” contains ${contents}.`,
    replaces: (contents) =>
      `This device currently has ${contents}. All of it will be replaced; this cannot be undone.`,
    autoCopy: (fileName) =>
      `Before that, the app automatically downloads a backup of the current data as “${fileName}”.`,
    exported: (fileName) => `The backup “${fileName}” has been downloaded. Keep the file safe.`,
    imported: (contents, autoBackupName) =>
      `Backup restored: ${contents}. The previous data was downloaded as “${autoBackupName}” first.`,
  },

  install: {
    hintTitle: "Krümel as an app",
    hintText:
      "From the home screen, Krümel starts like an app: without an address bar and even without internet.",
    install: "Install app",
    showGuide: "Show instructions",
    dismiss: "Close notice",
    guideTitle: "Install Krümel",
    tileTitle: "Install as an app",
    installed: "Krümel is installed on this device as an app.",
    iosShare:
      "In Safari, tap **Share** (a square with an arrow pointing up, at the bottom of the bar or next to the address). If you only see **•••**, tap that first.",
    iosAdd:
      "In the list, choose **Add to Home Screen** (you may need to scroll down or tap **More**).",
    iosConfirmWord: "Add",
    iosConfirm: "Tap **Add** at the top right. Krümel is now on the home screen.",
    iosNoteShared:
      "**Important:** The app on the home screen is separate from Safari. Sign in there once with your email address, then your data is there.",
    iosNote:
      "**Important:** The app on the home screen has its own data, separate from Safari. To take along what you have already entered in Safari, use “Backup”: download it here, restore it in the app.",
    firefoxMenu: "In Firefox, open the **menu ⋮** (next to the address).",
    firefoxAdd:
      "Choose **Add to Home screen** (depending on the version also called **Install app**) and confirm with **Add**.",
    other:
      "If your browser offers it, the browser menu has **Install app** or **Add to Home screen**. It is easiest on the iPhone in Safari and on Android phones in Chrome or Firefox; Firefox on a PC cannot install apps.",
    xiaomi: (firefox) =>
      `**Nothing happens when you add it?** On Xiaomi, Redmi and POCO phones ${firefox ? "Firefox" : "the browser"} needs a permission for this: in the phone settings, allow **Apps → Manage apps → ${firefox ? "Firefox" : "name of the browser"} → Other permissions → Home screen shortcuts**, then try again.`,
  },

  otherDevice: {
    title: "Open on another device",
    shared:
      "Scan the QR code with a phone's camera to open Krümel there. Sign in there with the same email address, then your data is there.",
    plain:
      "Scan the QR code with a phone's camera to open Krümel there. The data does not come along: every device has its own. It can be transferred with “Backup”.",
    show: "Show QR code",
    hide: "Hide QR code",
    codeLabel: (address) => `QR code with the address ${address}`,
    codeFailedTitle: "QR code not loaded",
    codeFailed: "With internet, tap “Reload” under “Version” and try again.",
  },

  version: {
    title: "Version",
    build: "Build:",
    builtAt: (date, clock, commit) => `${date}, ${clock} (${commit})`,
    builtLocally: "built locally",
    hint: "New versions arrive by themselves when Krümel is opened with internet. If the app kept running in the background, it stays on the old version until you reload it or close it completely and open it again.",
    reload: "Reload",
  },

  storageProblem: {
    titleRescue: "Stored data cannot be read",
    titleNone: "Storage not available",
    alertTitle: "The data is not shown",
    intro:
      "The Krümel app has changed nothing and does not overwrite the data by itself. First save it as a file so the problem can be repaired later. Then you can start over.",
    step1: "1. Download raw data",
    downloadRaw: "Download raw data",
    rawDownloaded: "The raw data has been downloaded as a file. Keep the file.",
    step2: "2. Start over",
    step2Text:
      "This deletes the stored data in this browser. Tasks and completed items will then only exist in the downloaded file.",
    startOver: "Start over …",
    cannotRead:
      "The browser storage cannot be read right now. Check whether saving website data is allowed (for example, not in a private window), then try again.",
    retry: "Try again",
    question: "Really start over?",
    confirm: "Yes, delete data",
    dialog:
      "The stored data in this browser will be deleted. This cannot be undone. The downloaded file stays.",
  },

  notifications: {
    status: {
      checking: "Checking …",
      unavailable:
        "Notifications are only available in the shared version of Krümel, once you are signed in.",
      notConfigured:
        "Notifications are not set up yet. As soon as they are, you can turn them on here.",
      unsupported: "This browser cannot receive notifications.",
      iosHomeScreen:
        "On the iPhone, notifications only work in the Krümel app from the Home Screen. First add Krümel to your Home Screen, open it from there, and then turn on notifications here.",
      blocked: "Blocked: This browser is not allowed to send Krümel notifications.",
      off: "Not turned on for this device.",
      lost: "This device has been signed off: the browser or the server ended the notifications, for example because the device was not used for a long time. Turn them on again and they will arrive again.",
      active: "Active on this device.",
    },
    tile: {
      tileTitle: "Notifications",
      intro:
        "Krümel can send messages to this device, even when the app is closed. The browser only asks when you tap “Turn on”.",
      testOnly: "Test environment: test notifications are only recorded, not delivered.",
      enable: "Turn on",
      reenable: "Turn on again",
      sendTest: "Send a test notification",
      disable: "Turn off on this device",
      busy: "One moment …",
      enabled: "Turned on. Try it with a test notification.",
      testSent: "Sent. The test notification should appear in a few seconds.",
      turnedOff: "Turned off. You can turn notifications on again at any time.",
      notAsked: "You closed the browser’s question. Tap “Turn on” again.",
      enableFailed: "Not turned on",
      testFailed: "Not sent",
      disableFailed: "Not turned off",
      blockedGuide: "How to allow notifications again",
      blockedAfter: "Then reload this page.",
      iosGuide: "How to put Krümel on your Home Screen",
      signOutNote: "Notifications on this device will be turned off.",
    },
    weekdays: [
      { short: "Mon", full: "Monday" },
      { short: "Tue", full: "Tuesday" },
      { short: "Wed", full: "Wednesday" },
      { short: "Thu", full: "Thursday" },
      { short: "Fri", full: "Friday" },
      { short: "Sat", full: "Saturday" },
      { short: "Sun", full: "Sunday" },
    ],
    settings: {
      title: "Settings for this device",
      intro:
        "These settings only apply to this device. On another device you can choose differently.",
      loading: "Loading the settings …",
      unreachable:
        "The server cannot be reached right now. The settings will appear as soon as you are back online.",
      retry: "Try again",
      loadFailed: "Settings not loaded",
      dailyLabel: "Daily overview",
      dailyHint:
        "A message in the morning about what is due for you today. If nothing is due, no message comes.",
      dailyTimeLabel: "Time of the daily overview",
      dailyDaysLegend: "On these days",
      partnerLabel: (name) => `When ${name} does or takes over something for you`,
      partnerHint: "A message shortly after it happens. Several are combined into one.",
      otherPerson: "the other person",
      householdLabel: "When someone joins the household",
      quietLabel: "Quiet hours",
      quietHint:
        "During this time, messages about the other person and the household wait. They arrive together afterwards. The daily overview always comes at the chosen time.",
      quietFromLabel: "Quiet hours from",
      quietToLabel: "Quiet hours until",
      save: "Save",
      saving: "Saving …",
      saved: "Saved.",
      pending: "Saved, but not sent yet. It will be sent as soon as you are back online.",
      pendingNote: "Not sent yet.",
      nowSent: "Sent now.",
      saveFailed: "Not saved",
      problems: {
        dailyTime: "Please enter a time, for example 07:30.",
        dailyDays: "Choose at least one day.",
        quietFrom: "Please enter when the quiet hours start, for example 21:00.",
        quietTo: "Please enter when the quiet hours end, for example 07:00.",
        quietSame: "The quiet hours cannot start and end at the same time.",
      },
    },
    failures: {
      notSignedIn: "Your sign-in has expired. Please sign in again.",
      notConfigured: "Notifications are not set up on the server yet. Please try again later.",
      badRequest: "That did not work. Please turn notifications off and on again.",
      deviceUnknown:
        "This device is no longer registered for notifications. Please turn them on again.",
      deviceGone: "The browser ended the notifications for this device. Please turn them on again.",
      testWait: "Please wait a minute before the next test notification.",
      testToday: "Enough test notifications have been sent for today. Try again tomorrow.",
      keyChanged:
        "Notifications were set up again. Please turn them off and on again on this device.",
      endpointInvalid: "This browser is not supported for notifications.",
      settingsInvalid:
        "These settings are not possible. Please check the times and days and try again.",
      pushFailed:
        "The browser’s notification service cannot be reached right now. Please try again in a few minutes.",
      pushRejected:
        "The browser’s notification service rejected the message. This is caused by the setup on the server, not by your device; trying again only helps once it is fixed.",
      notFound: "That did not work. Please reload the app.",
      offline: "That does not work without internet. Please try again when you are connected.",
      noWorker: "Krümel has not finished loading on this device yet. Please reload the page.",
      unknown: "That did not work. Please try again later.",
    },
    blockedSteps: {
      ios: [
        "Open the Settings app on your iPhone.",
        "Tap “Notifications” and then “Krümel”.",
        "Turn on “Allow Notifications”.",
      ],
      firefoxAndroid: [
        "In Firefox, open the ⋮ menu, then Settings → Site permissions → Notifications.",
        "Choose the address of Krümel and set it to “Allow”.",
        "In the Android settings, turn on notifications under Apps → Firefox → Notifications.",
        "On Xiaomi, Redmi and POCO phones also: Apps → Firefox → Battery → “No restrictions”, and turn on autostart.",
      ],
      other: [
        "Click or tap the icon to the left of the address.",
        "Open “Permissions” or “Site settings” and choose “Allow” for “Notifications”.",
        "On Windows also: Settings → System → Notifications → turn on the browser and turn off “Do not disturb”.",
      ],
    },
  },

  validation: {
    expectedObject: "expected an object",
    expectedList: "expected a list",
    expectedKind: "expected recurring or oneOff",
    missing: "missing",
    invalid: (expected) => `invalid, expected ${expected}`,
    duplicate: (id) => `the id “${id}” appears more than once`,
    noTask: (id) => `there is no task “${id}”`,
    expected: {
      id: "an id",
      text: "a text",
      bool: "true or false",
      title: "a title",
      symbol: "a symbol from the list",
      assignee: "personA, personB or both",
      date: "a date YYYY-MM-DD",
      recurrence: "unit and interval",
      person: "personA or personB",
      idList: "a list of ids",
      timestamp: "a moment YYYY-MM-DDThh:mm:ssZ",
      name: "a name",
    },
    fileNotObject: "File: expected an object",
    noVersion: "The file is not a Krümel backup (the version is missing).",
    tooNew: "This data comes from a newer version of Krümel. Reload the app and try again.",
    notBackup: "The file is not a Krümel backup.",
    copy: "Copy",
    copyCursor: "Copy.cursor: expected text or nothing",
    copyQueue: "Copy.outbox: expected a list of changes",
    copyRejected: "Copy.rejected: expected a list of rejected changes",
  },

  demo: {
    label: "Demo mode notice",
    text: (tasks, completions) =>
      `Demo mode: ${n(tasks)} sample tasks and ${n(completions)} completions are in this browser's demo storage. Real data stays untouched.`,
    reload: "Reload sample data",
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
