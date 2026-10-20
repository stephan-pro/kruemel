import { expect, type Locator, type Page } from "@playwright/test";
import { demoData } from "../../src/demo/demoData";
import { calendarDay, dayFromDate } from "../../src/domain/date";
import type { AppData } from "../../src/storage/appData";

// Minimal Node typing instead of @types/node (N7: avoid a dependency for one line), as in
// playwright.config.ts. `never` fits every place that expects a Buffer.
declare const Buffer: { from(text: string, encoding: "utf8"): never };

// The real app (production build). Its data lives in the browser storage under these keys.
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
 * Puts values into the browser storage before the app reads it, then opens the app (at `hash`,
 * "" for the start page).
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

/** A configured app on the week view: names set, this device belongs to the first person. */
export async function startConfigured(
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

/** The week view of the demo data (or `data`) on the frozen day, for the given person's device. */
export async function openWeek(
  page: Page,
  data: AppData = demoData(FROZEN_TODAY),
  person: "personA" | "personB" = "personA",
) {
  await freezeClock(page);
  await store(
    page,
    {
      [dataKey]: JSON.stringify(data),
      [deviceKey]: JSON.stringify({ currentPerson: person }),
    },
    WEEK_HASH,
  );
  await expect(page.getByRole("heading", { level: 1, name: "Diese Woche" })).toBeVisible();
}

/**
 * "Heute" for the demo data (or `data`) on the frozen day, for the given person's device. The clock
 * stands at noon, so the greeting is "Hallo, …!".
 */
export async function openToday(
  page: Page,
  data: AppData = demoData(FROZEN_TODAY),
  person: "personA" | "personB" = "personA",
) {
  await freezeClock(page);
  await store(
    page,
    {
      [dataKey]: JSON.stringify(data),
      [deviceKey]: JSON.stringify({ currentPerson: person }),
    },
    "#/heute",
  );
  await expect(page.getByRole("heading", { level: 1, name: /^Hallo, / })).toBeVisible();
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

/** Pages that are not in the navigation: reached from "Woche" and the settings (see `app.spec.ts`). */
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

/** A file for a file chooser, made from text: `chooser.setFiles(textFile("sicherung.json", "{}"))`. */
export function textFile(name: string, text: string) {
  return { name, mimeType: "application/json", buffer: Buffer.from(text, "utf8") };
}

/** What the app has stored right now, as the app would read it back. */
export async function storedData(page: Page): Promise<AppData> {
  const text = await page.evaluate((key) => localStorage.getItem(key), dataKey);
  return JSON.parse(text ?? "null") as AppData;
}
