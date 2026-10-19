import { expect, type Locator, type Page } from "@playwright/test";
import { demoData } from "../../src/demo/demoData";
import { calendarDay, dayFromDate } from "../../src/domain/date";
import type { AppData } from "../../src/storage/appData";

// The real app (production build). Its data lives in the browser storage under these keys.
export const dataKey = "putzplan:data";
export const deviceKey = "putzplan:device";

/** Today as the app sees it (the browser of the test and the test run on the same clock). */
export function today() {
  return dayFromDate(new Date());
}

/** Puts values into the browser storage before the app reads it. */
export async function store(page: Page, items: Record<string, string>) {
  await page.goto("./");
  await page.evaluate((entries) => {
    for (const [key, value] of Object.entries(entries)) {
      localStorage.setItem(key, value);
    }
  }, items);
  await page.goto("./");
}

/** A configured app: names set, this device belongs to the first person. */
export async function startConfigured(page: Page, data: AppData = demoData(today())) {
  await store(page, {
    [dataKey]: JSON.stringify(data),
    [deviceKey]: JSON.stringify({ currentPerson: "personA" }),
  });
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
  await store(page, {
    [dataKey]: JSON.stringify(data),
    [deviceKey]: JSON.stringify({ currentPerson: person }),
  });
  await expect(page.getByRole("heading", { level: 1, name: "Diese Woche" })).toBeVisible();
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

/** Shows a day of "Woche im Überblick" in the day tile, e.g. `chooseDay(page, "Do 22.", "Do, 22.10.")`. */
export async function chooseDay(page: Page, day: string, heading: string) {
  await page.getByRole("button", { name: new RegExp(`^${day.replace(".", "\\.")} `) }).click();
  await expect(page.getByRole("heading", { level: 2, name: heading })).toBeVisible();
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
export async function expectPageShown(page: Page, title: string) {
  await expect(page.getByRole("heading", { level: 1, name: title })).toBeFocused();
}

/** Follows a link of the navigation and waits for the page it leads to. */
export async function goToPage(page: Page, link: string, title: string = link) {
  await page.getByRole("link", { name: link, exact: true }).click();
  await expectPageShown(page, title);
}

/** What the app has stored right now, as the app would read it back. */
export async function storedData(page: Page): Promise<AppData> {
  const text = await page.evaluate((key) => localStorage.getItem(key), dataKey);
  return JSON.parse(text ?? "null") as AppData;
}
