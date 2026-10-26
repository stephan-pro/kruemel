import { expect, type Locator, type Page } from "@playwright/test";
import { demoData } from "../../src/demo/demoData";
import { calendarDay, dayFromDate } from "../../src/domain/date";
import type { AppData } from "../../src/storage/appData";
import type { DeviceSettings } from "../../src/storage/storage";
import { viewOf } from "../../src/sync/merge";
import type { SyncState } from "../../src/sync/outbox";
import { FAKE_AUTH_KEY, householdOfTwo, type Member } from "./account";
import { E2E_APP } from "./shared";

// Minimal Node typing instead of @types/node (N7: avoid a dependency for one line), as in
// playwright.config.ts. `never` fits every place that expects a Buffer.
declare const Buffer: { from(text: string, encoding: "utf8"): never };

// Most tests run as in real use since E2-3e: a signed-in member of a household of two, the data
// shared through the fake server (the app in the mode `e2e`, `E2E_APP`). The mode `local` (the
// `baseURL`, production build) keeps the tests of what only it has: first setup, editable names,
// unreadable data of this device, the service worker (`startLocal`, `store`, `localData`).

// The mode `local` keeps its data in the browser storage under these keys; the device settings are
// kept there in every mode.
export const dataKey = "putzplan:data";
export const deviceKey = "putzplan:device";

/** Today as the app sees it (the browser of the test and the test run on the same clock). */
export function today() {
  return dayFromDate(new Date());
}

/** The week view; most tests start there. The start page of the app is "Heute" (`#/heute`). */
export const WEEK_HASH = "#/woche";

/** The heading of "Heute": the greeting of the time of day, by default for anybody ("Hallo, Alex!"). */
export const greetingHeading = (name = ".+") =>
  new RegExp(`^(Guten Morgen|Hallo|Guten Abend), ${name}!$`);

/**
 * Mode `local`: puts values into the browser storage before the app reads it, then opens the app
 * (at `hash`, "" for the start page).
 */
export async function store(page: Page, items: Record<string, string>, hash = "") {
  await page.goto("./");
  await page.evaluate(
    ([entries, target]) => {
      for (const [key, value] of Object.entries(entries as Record<string, string>)) {
        localStorage.setItem(key, value);
      }
      if (target) {
        location.hash = target as string;
      }
    },
    [items, hash],
  );
  await page.reload();
}

/** Who uses the device: `personA` is Alex (made the household), `personB` Robin (joined). */
export type Person = "personA" | "personB";

/**
 * A signed-in member's device on the shared data: a new household of two on the fake server
 * holding `data`, the session of `person` (and `device` settings) put into the browser storage
 * once (a reload after signing out stays signed out), then the app opened at `hash`. Returns the
 * member, for the API of `account.ts`.
 */
export async function startShared(
  page: Page,
  data: AppData = demoData(today()),
  hash: string = WEEK_HASH,
  { person = "personA", device }: { person?: Person; device?: DeviceSettings } = {},
): Promise<Member> {
  const { alex, robin } = await householdOfTwo(page.request, data);
  const member = person === "personA" ? alex : robin;
  const items: Record<string, string> = { [FAKE_AUTH_KEY]: JSON.stringify(member) };
  if (device !== undefined) {
    items[deviceKey] = JSON.stringify(device);
  }
  await page.addInitScript((entries) => {
    if (sessionStorage.getItem("e2e-seeded") === null) {
      sessionStorage.setItem("e2e-seeded", "1");
      for (const [key, value] of Object.entries(entries)) {
        localStorage.setItem(key, value);
      }
    }
  }, items);
  await page.goto(`${E2E_APP}${hash}`);
  return member;
}

/** A signed-in member's device on the week view (Alex, demo data of today). */
export async function startConfigured(
  page: Page,
  data: AppData = demoData(today()),
  hash: string = WEEK_HASH,
) {
  return startShared(page, data, hash);
}

/** Mode `local`: a configured app on the week view, names set, the device is the first person's. */
export async function startLocal(
  page: Page,
  data: AppData = demoData(today()),
  hash: string = WEEK_HASH,
) {
  await store(
    page,
    {
      [dataKey]: JSON.stringify(data),
      [deviceKey]: JSON.stringify({ currentPerson: "personA" }),
    },
    hash,
  );
}

/** The day the week tests stand on: Wednesday 21.10.2026 (see `week.spec.ts` for what falls where). */
export const FROZEN_TODAY = calendarDay("2026-10-21");

/** Stops the browser clock at noon of `FROZEN_TODAY`, so the demo data falls on fixed weekdays. */
export async function freezeClock(page: Page) {
  await page.clock.setFixedTime(new Date(2026, 9, 21, 12, 0, 0));
}

/** The week view of the demo data (or `data`) on the frozen day, on the given person's device. */
export async function openWeek(
  page: Page,
  data: AppData = demoData(FROZEN_TODAY),
  person: Person = "personA",
) {
  await freezeClock(page);
  const member = await startShared(page, data, WEEK_HASH, { person });
  await expect(page.getByRole("heading", { level: 1, name: "Diese Woche" })).toBeVisible();
  return member;
}

/**
 * "Heute" for the demo data (or `data`) on the frozen day, on the given person's device. The clock
 * stands at noon, so the greeting is "Hallo, …!".
 */
export async function openToday(
  page: Page,
  data: AppData = demoData(FROZEN_TODAY),
  person: Person = "personA",
) {
  await freezeClock(page);
  const member = await startShared(page, data, "#/heute", { person });
  await expect(page.getByRole("heading", { level: 1, name: /^Hallo, / })).toBeVisible();
  return member;
}

/** A tile of the week view, found by its heading ("Heute · Mi, 21.10.", "Do, 22.10.", "Überfällig"). */
export const tile = (page: Page, name: string) => page.getByRole("region", { name, exact: true });
export const todayTile = (page: Page) => tile(page, "Heute · Mi, 21.10.");
export const overdueTile = (page: Page) => tile(page, "Überfällig");
/** The message after ticking off or taking over ("Hinweis"). */
export const notice = (page: Page) => page.getByRole("region", { name: "Hinweis" });

/** The button of a task inside a tile; its name starts with the title ("Einkaufen Beide · …"). */
export const taskButton = (scope: Locator, title: string) =>
  scope.getByRole("button", { name: new RegExp(`^${title}(\\s|$)`) });

/**
 * Shows a day of "Woche im Überblick" in the day tile, e.g. `chooseDay(page, "Do 22.", "Do, 22.10.")`.
 * Waits until the heading of the day tile has the focus: the app moves it there a moment after
 * drawing, and a test that focuses a button earlier would lose the focus again.
 */
export async function chooseDay(page: Page, day: string, heading: string) {
  await page.getByRole("button", { name: new RegExp(`^${day.replace(".", "\\.")} `) }).click();
  await expect(page.getByRole("heading", { level: 2, name: heading })).toBeFocused();
}

/** The detail view of a task, found by the title it shows. */
export const detailDialog = (page: Page, title: string) =>
  page.getByRole("dialog", { name: title, exact: true });

/** The text next to a label in the detail view ("Zuständig" → "Beide"). */
export const detailValue = (dialog: Locator, label: string) =>
  dialog.locator(`.details__item:has(dt:text-is("${label}")) > dd`);

/**
 * Waits until a page has fully appeared: its heading has the focus. The app moves the focus there
 * a moment after drawing the page; typing or pressing keys before that would lose the focus
 * again (a person is not that fast).
 */
export async function expectPageShown(page: Page, title: string | RegExp) {
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeFocused();
}

/** Pages that are not in the navigation: reached from "Woche" (see `app.spec.ts`). */
const LIST_PAGES: Record<string, string> = { Aufgaben: "#/aufgaben", Erledigt: "#/erledigt" };

/**
 * Goes to a page and waits for it. The pages of the navigation (Heute, Woche, Statistik,
 * Einstellungen) are reached by its link; "Aufgaben" and "Erledigt" by their address, the links to
 * them are tested on their own.
 */
export async function goToPage(page: Page, link: string, title: string | RegExp = link) {
  const address = LIST_PAGES[link];
  if (address === undefined) {
    await page.getByRole("link", { name: link, exact: true }).click();
  } else {
    // The page the app starts on has to be there first: the first heading takes no focus, so a
    // page opened before it would not take the focus either.
    await expect(page.getByRole("navigation", { name: "Hauptnavigation" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.evaluate((hash) => {
      location.hash = hash;
    }, address);
  }
  await expectPageShown(page, title);
}

/** The groups of the settings overview (UX-a), as the rows and the group pages call them. */
export type SettingsGroup =
  | "Konto und Haushalt"
  | "Benachrichtigungen"
  | "Darstellung"
  | "Daten"
  | "Rechtliches";

/**
 * Opens "Einstellungen" and, with a group, the page of that group: "öffne Einstellungen > Gruppe".
 * Start from another page than the settings (the overview takes the focus only then).
 */
export async function openSettings(page: Page, group?: SettingsGroup) {
  await goToPage(page, "Einstellungen");
  if (group !== undefined) {
    await page.getByRole("link", { name: new RegExp(`^${group}\\b`) }).click();
    await expectPageShown(page, group);
  }
}

/** A file for a file chooser, made from text: `chooser.setFiles(textFile("sicherung.json", "{}"))`. */
export function textFile(name: string, text: string) {
  return { name, mimeType: "application/json", buffer: Buffer.from(text, "utf8") };
}

/**
 * What the signed-in device has stored right now, as the app shows it: its copy of the shared
 * data (`kruemel:<household>:<person>:sync`) with the changes still waiting applied.
 */
export async function storedData(page: Page): Promise<AppData> {
  const text = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((name) => /^kruemel:[^:]+:[^:]+:sync$/.test(name));
    return key === undefined ? null : localStorage.getItem(key);
  });
  const state = JSON.parse(text ?? "null") as SyncState | null;
  return (state === null ? null : viewOf(state.base, state.outbox)) as AppData;
}

/** Texts or boxes that stick out of their box or the page: what a longer text would break. */
export async function overflowing(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const found: string[] = [];
    if (document.documentElement.scrollWidth > document.documentElement.clientWidth) {
      found.push("page scrolls sideways");
    }
    const selector =
      ".btn, .main-nav__link, .segmented__option, .settings-row, h1, h2, .tile__title, .entry__title";
    for (const element of document.querySelectorAll<HTMLElement>(selector)) {
      if (element.offsetParent !== null && element.scrollWidth > element.clientWidth + 1) {
        found.push(`${element.className}: ${element.textContent?.trim().slice(0, 40)}`);
      }
    }
    return found;
  });
}

/** Mode `local`: what the app has stored right now, as the app would read it back. */
export async function localData(page: Page): Promise<AppData> {
  const text = await page.evaluate((key) => localStorage.getItem(key), dataKey);
  return JSON.parse(text ?? "null") as AppData;
}
