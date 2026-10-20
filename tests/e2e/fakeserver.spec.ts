import { type APIRequestContext, type Browser, expect, type Page, test } from "@playwright/test";
import { demoData } from "../../src/demo/demoData";
import type { AppData } from "../../src/storage/appData";
import { expectNoAccessibilityViolations } from "./axe";
import { expectPageShown, goToPage, today } from "./helpers";
import { E2E_APP, FAKE_SERVER, FAKE_SESSION_KEY } from "./shared";

// Package E2-0: the first test of the shared storage. Two browsers (two devices) talk to the fake
// server; a change on one shows up on the other, also after work without a connection.

interface Device {
  readonly page: Page;
  readonly close: () => Promise<void>;
}

/** A new household on the fake server, with the secret of each of its two people. */
async function newHousehold(request: APIRequestContext, data: AppData) {
  const response = await request.post(`${FAKE_SERVER}/test/household`, { data: { data } });
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { tokens: { personA: string; personB: string } }).tokens;
}

/**
 * A device of one person, opened on the task list: its own browser storage (so its own copy of
 * the data), like the project's device type (phone or desktop), signed in with the person's secret.
 */
async function openDevice(
  browser: Browser,
  token: string,
  person: "personA" | "personB",
): Promise<Device> {
  const { viewport, userAgent, isMobile, hasTouch, deviceScaleFactor, locale } =
    test.info().project.use;
  const context = await browser.newContext({
    ...(viewport === undefined ? {} : { viewport }),
    ...(userAgent === undefined ? {} : { userAgent }),
    ...(isMobile === undefined ? {} : { isMobile }),
    ...(hasTouch === undefined ? {} : { hasTouch }),
    ...(deviceScaleFactor === undefined ? {} : { deviceScaleFactor }),
    ...(locale === undefined ? {} : { locale }),
  });
  await context.addInitScript(
    ({ sessionKey, secret, who }) => {
      localStorage.setItem(sessionKey, JSON.stringify({ token: secret }));
      if (localStorage.getItem("putzplan:device") === null) {
        localStorage.setItem("putzplan:device", JSON.stringify({ currentPerson: who }));
      }
    },
    { sessionKey: FAKE_SESSION_KEY, secret: token, who: person },
  );
  const page = await context.newPage();
  await page.goto(`${E2E_APP}#/aufgaben`);
  // The first drawing does not take the focus (the skip link stays the first stop).
  await expect(page.getByRole("heading", { level: 1, name: "Aufgaben" })).toBeVisible();
  return { page, close: () => context.close() };
}

async function createTask(page: Page, title: string) {
  await page.getByRole("link", { name: "Neue Aufgabe" }).click();
  await expectPageShown(page, "Neue Aufgabe");
  await page.getByLabel("Titel").fill(title);
  await page.getByRole("button", { name: "Aufgabe anlegen" }).click();
  await expectPageShown(page, "Aufgaben");
}

const article = (page: Page, title: string) => page.getByRole("article", { name: title });

test.describe("E2-0 Gemeinsamer Speicher gegen den Fake-Server", () => {
  test("Die App startet mit den Daten des Haushalts vom Server", async ({ browser, request }) => {
    const tokens = await newHousehold(request, demoData(today()));
    const alex = await openDevice(browser, tokens.personA, "personA");

    await expect(article(alex.page, "Bad putzen")).toBeVisible();
    await expectNoAccessibilityViolations(alex.page);
    await alex.close();
  });

  test("Eine Änderung auf dem ersten Gerät erscheint auf dem zweiten, ohne Neuladen", async ({
    browser,
    request,
  }) => {
    const tokens = await newHousehold(request, demoData(today()));
    const alex = await openDevice(browser, tokens.personA, "personA");
    const robin = await openDevice(browser, tokens.personB, "personB");
    await expect(article(robin.page, "Bad putzen")).toBeVisible();

    await createTask(alex.page, "Balkon fegen");

    await expect(article(alex.page, "Balkon fegen")).toBeVisible();
    await expect(article(robin.page, "Balkon fegen")).toBeVisible();
    await alex.close();
    await robin.close();
  });

  test("Ein Gerät ohne Verbindung arbeitet weiter; nach dem Wiederverbinden sieht das andere alles", async ({
    browser,
    request,
  }) => {
    const tokens = await newHousehold(request, demoData(today()));
    const alex = await openDevice(browser, tokens.personA, "personA");
    const robin = await openDevice(browser, tokens.personB, "personB");
    await expect(article(robin.page, "Bad putzen")).toBeVisible();

    await alex.page.context().setOffline(true);
    await createTask(alex.page, "Fenster im Keller");
    await expect(article(alex.page, "Fenster im Keller")).toBeVisible();
    await robin.page.waitForTimeout(500);
    await expect(article(robin.page, "Fenster im Keller")).toHaveCount(0);

    await alex.page.context().setOffline(false);

    await expect(article(robin.page, "Fenster im Keller")).toBeVisible();
    await alex.close();
    await robin.close();
  });

  test("Nach einem Neuladen sind die Daten des Geräts noch da (lokale Kopie und Abgleich)", async ({
    browser,
    request,
  }) => {
    const tokens = await newHousehold(request, demoData(today()));
    const alex = await openDevice(browser, tokens.personA, "personA");
    await createTask(alex.page, "Balkon fegen");
    await goToPage(alex.page, "Woche", "Diese Woche");

    await alex.page.reload();

    await goToPage(alex.page, "Aufgaben");
    await expect(article(alex.page, "Balkon fegen")).toBeVisible();
    await alex.close();
  });
});
