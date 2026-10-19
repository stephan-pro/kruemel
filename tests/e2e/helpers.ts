import { expect, type Page } from "@playwright/test";
import { demoData } from "../../src/demo/demoData";
import { dayFromDate } from "../../src/domain/date";
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
