import { expect, type Page, test } from "@playwright/test";
import { FAKE_VAPID_KEY_OVERRIDE } from "../../src/push/fakeHttpPushApi";
import {
  NOTIFICATION_STATUS_TEXTS,
  NOTIFICATION_TEXTS,
  PUSH_FAILURE_TEXTS,
} from "../../src/ui/notificationTexts";
import type { Member } from "./account";
import { expectNoAccessibilityViolations } from "./axe";
import { startLocal, startShared } from "./helpers";
import { mockPush, type PushMock, pushMockState } from "./pushMock";
import { FAKE_SERVER } from "./shared";

// NT-a: the tile "Benachrichtigungen" in the settings, signed in against the fake server, with the
// browser's Push API played by `pushMock.ts`. The fake server records the test notifications
// instead of delivering them (`GET /test/pushes`).

const SETTINGS = "#/einstellungen";
const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

const tileOf = (page: Page) => page.getByRole("region", { name: NOTIFICATION_TEXTS.tileTitle });
const statusOf = (page: Page) => tileOf(page).locator(".sync-status");
const announced = (page: Page) => tileOf(page).getByRole("status");
const button = (page: Page, name: string) => tileOf(page).getByRole("button", { name });
const tileHeading = (page: Page) =>
  tileOf(page).getByRole("heading", { name: NOTIFICATION_TEXTS.tileTitle });

/** The settings of a signed-in member, with the mocked Push API. */
async function openSettings(page: Page, mock: PushMock = {}, items: Record<string, string> = {}) {
  await mockPush(page, mock);
  if (Object.keys(items).length > 0) {
    await page.addInitScript((entries) => {
      for (const [key, value] of Object.entries(entries)) {
        localStorage.setItem(key, value);
      }
    }, items);
  }
  const member = await startShared(page, undefined, SETTINGS);
  // The first page takes no focus (see `goToPage`): its heading being there is enough.
  await expect(page.getByRole("heading", { level: 1, name: "Einstellungen" })).toBeVisible();
  return member;
}

const bearer = (member: Member) => ({ Authorization: `Bearer ${member.token}` });

async function serverDevices(page: Page, member: Member) {
  const response = await page.request.get(`${FAKE_SERVER}/test/push-devices`, {
    headers: bearer(member),
  });
  return ((await response.json()) as { devices: { endpoint: string }[] }).devices;
}

async function serverPushes(page: Page, member: Member) {
  const response = await page.request.get(`${FAKE_SERVER}/test/pushes`, {
    headers: bearer(member),
  });
  return ((await response.json()) as { pushes: unknown[] }).pushes;
}

test.describe("NT-a Benachrichtigungen", () => {
  test("NT-a Einschalten nur per Knopf, Testbenachrichtigung kommt beim Server an, Ausschalten", async ({
    page,
  }) => {
    const member = await openSettings(page);

    await expect(statusOf(page)).toHaveText(NOTIFICATION_STATUS_TEXTS.off);
    await expect(tileOf(page)).toContainText(NOTIFICATION_TEXTS.testOnly);
    // Nothing asked on its own, nothing registered.
    expect((await pushMockState(page)).asked).toBe(0);
    expect(await serverDevices(page, member)).toEqual([]);
    await expectNoAccessibilityViolations(page);

    await button(page, NOTIFICATION_TEXTS.enable).click();

    await expect(statusOf(page)).toHaveText(NOTIFICATION_STATUS_TEXTS.active);
    await expect(announced(page)).toHaveText(NOTIFICATION_TEXTS.enabled);
    await expect(tileHeading(page)).toBeFocused();
    const state = await pushMockState(page);
    expect(state.asked).toBe(1);
    expect(await serverDevices(page, member)).toEqual([
      expect.objectContaining({ endpoint: state.subscription?.endpoint }),
    ]);
    await expectNoAccessibilityViolations(page);

    await button(page, NOTIFICATION_TEXTS.sendTest).click();
    await expect(announced(page)).toHaveText(NOTIFICATION_TEXTS.testSent);
    expect(await serverPushes(page, member)).toEqual([
      expect.objectContaining({ payload: { v: 1, k: "test" } }),
    ]);
    // One per minute.
    await button(page, NOTIFICATION_TEXTS.sendTest).click();
    await expect(tileOf(page).getByRole("alert")).toContainText(PUSH_FAILURE_TEXTS.testWait);
    expect(await serverPushes(page, member)).toHaveLength(1);

    // Still on after a reload.
    await page.reload();
    await expect(statusOf(page)).toHaveText(NOTIFICATION_STATUS_TEXTS.active);

    await button(page, NOTIFICATION_TEXTS.disable).click();
    await expect(statusOf(page)).toHaveText(NOTIFICATION_STATUS_TEXTS.off);
    await expect(announced(page)).toHaveText(NOTIFICATION_TEXTS.turnedOff);
    await expect(tileHeading(page)).toBeFocused();
    expect((await pushMockState(page)).subscription).toBeNull();
    expect(await serverDevices(page, member)).toEqual([]);
  });

  test("NT-a Blockiert: Status mit Anleitung für diesen Browser", async ({ page }) => {
    await openSettings(page, { permission: "denied" });

    await expect(statusOf(page)).toHaveText(NOTIFICATION_STATUS_TEXTS.blocked);
    await expect(button(page, NOTIFICATION_TEXTS.enable)).toHaveCount(0);
    await tileOf(page).getByText(NOTIFICATION_TEXTS.blockedGuide).click();
    await expect(tileOf(page)).toContainText("„Zulassen“");
    await expectNoAccessibilityViolations(page);
  });

  test("NT-a Frage geschlossen: Hinweis, der Knopf bleibt mit dem Fokus", async ({ page }) => {
    await openSettings(page, { answer: "default" });

    await button(page, NOTIFICATION_TEXTS.enable).click();

    await expect(announced(page)).toHaveText(NOTIFICATION_TEXTS.notAsked);
    await expect(statusOf(page)).toHaveText(NOTIFICATION_STATUS_TEXTS.off);
    await expect(button(page, NOTIFICATION_TEXTS.enable)).toBeFocused();
  });

  test("NT-a Frage abgelehnt: Status wechselt auf blockiert und wird angesagt", async ({
    page,
  }) => {
    await openSettings(page, { answer: "denied" });

    await button(page, NOTIFICATION_TEXTS.enable).click();

    await expect(statusOf(page)).toHaveText(NOTIFICATION_STATUS_TEXTS.blocked);
    await expect(announced(page)).toHaveText(NOTIFICATION_STATUS_TEXTS.blocked);
    await expect(tileHeading(page)).toBeFocused();
  });

  test("NT-a Ohne Push-API: nicht unterstützt, ohne Knöpfe", async ({ page }) => {
    await openSettings(page, { supported: false });

    await expect(statusOf(page)).toHaveText(NOTIFICATION_STATUS_TEXTS.unsupported);
    await expect(tileOf(page).getByRole("button")).toHaveCount(0);
  });

  test("NT-a Ohne öffentlichen Schlüssel im Build: „nicht eingerichtet“, nichts bricht", async ({
    page,
  }) => {
    await openSettings(page, {}, { [FAKE_VAPID_KEY_OVERRIDE]: "" });

    await expect(statusOf(page)).toHaveText(NOTIFICATION_STATUS_TEXTS.notConfigured);
    await expect(tileOf(page).getByRole("button")).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Darstellung" })).toBeVisible();
    expect((await pushMockState(page)).asked).toBe(0);
  });

  test("NT-a Push-Dienst kennt das Gerät nicht mehr (410): Hinweis, danach wieder aus", async ({
    page,
  }) => {
    const member = await openSettings(page);
    await button(page, NOTIFICATION_TEXTS.enable).click();
    await expect(statusOf(page)).toHaveText(NOTIFICATION_STATUS_TEXTS.active);
    await page.request.post(`${FAKE_SERVER}/test/push-answer`, {
      headers: bearer(member),
      data: { status: 410 },
    });

    await button(page, NOTIFICATION_TEXTS.sendTest).click();

    await expect(tileOf(page).getByRole("alert")).toContainText(PUSH_FAILURE_TEXTS.deviceGone);
    await expect(statusOf(page)).toHaveText(NOTIFICATION_STATUS_TEXTS.off);
    expect(await serverDevices(page, member)).toEqual([]);
    await expectNoAccessibilityViolations(page);
  });

  test("NT-a Server ohne Schlüssel: klarer Hinweis beim Test", async ({ page }) => {
    const member = await openSettings(page);
    await button(page, NOTIFICATION_TEXTS.enable).click();
    await page.request.post(`${FAKE_SERVER}/test/push-answer`, {
      headers: bearer(member),
      data: { status: 503 },
    });

    await button(page, NOTIFICATION_TEXTS.sendTest).click();

    await expect(tileOf(page).getByRole("alert")).toContainText(PUSH_FAILURE_TEXTS.notConfigured);
    await expect(statusOf(page)).toHaveText(NOTIFICATION_STATUS_TEXTS.active);
  });

  test("NT-a Tastatur und Handy (360 px): alles erreichbar, nichts ragt heraus", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    const member = await openSettings(page);

    await button(page, NOTIFICATION_TEXTS.enable).focus();
    await page.keyboard.press("Enter");
    await expect(tileHeading(page)).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(button(page, NOTIFICATION_TEXTS.sendTest)).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(announced(page)).toHaveText(NOTIFICATION_TEXTS.testSent);
    expect(await serverPushes(page, member)).toHaveLength(1);
    await page.keyboard.press("Tab");
    await expect(button(page, NOTIFICATION_TEXTS.disable)).toBeFocused();

    for (const name of [NOTIFICATION_TEXTS.sendTest, NOTIFICATION_TEXTS.disable]) {
      const box = await button(page, name).boundingBox();
      expect(box?.height ?? 0, name).toBeGreaterThanOrEqual(44);
    }
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await expectNoAccessibilityViolations(page);
  });
});

test.describe("NT-a Benachrichtigungen am iPhone in Safari", () => {
  test.use({ userAgent: IPHONE_SAFARI });

  test("NT-a iPhone ohne Home-Bildschirm: Hinweis mit Anleitung zum Hinzufügen", async ({
    page,
  }) => {
    await openSettings(page, { supported: false });

    await expect(statusOf(page)).toHaveText(NOTIFICATION_STATUS_TEXTS.iosHomeScreen);
    await tileOf(page).getByText(NOTIFICATION_TEXTS.iosGuide).click();
    await expect(tileOf(page)).toContainText("Zum Home-Bildschirm");
    await expect(tileOf(page).getByRole("button")).toHaveCount(0);
    await expectNoAccessibilityViolations(page);
  });
});

test.describe("NT-a Benachrichtigungen ohne Anmeldung", () => {
  test("NT-a Modus local: die Kachel erklärt, dass es Benachrichtigungen nur mit Anmeldung gibt", async ({
    page,
  }) => {
    await startLocal(page, undefined, SETTINGS);
    await expect(page.getByRole("heading", { level: 1, name: "Einstellungen" })).toBeVisible();

    await expect(statusOf(page)).toHaveText(NOTIFICATION_STATUS_TEXTS.unavailable);
    await expect(tileOf(page).getByRole("button")).toHaveCount(0);
  });

  test("NT-a Service Worker: ein Push zeigt „Testbenachrichtigung von Krümel“, Kaputtes eine allgemeine Meldung", async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "Nur Chromium zeigt Service Worker in Playwright");
    await page.goto("./");
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));

    // The browser of the tests may not show notifications at all (headless): the real worker gets
    // real push events, only the drawing on the screen is caught.
    const shown = await worker.evaluate(async () => {
      const scope = self as unknown as ServiceWorkerGlobalScope;
      const caught: string[] = [];
      Object.defineProperty(scope.registration, "showNotification", {
        value: async (title: string, options: NotificationOptions) => {
          caught.push(`${title}: ${options.body} (${options.tag}, ${options.lang})`);
        },
      });
      for (const data of [JSON.stringify({ v: 1, k: "test" }), "kein JSON"]) {
        scope.dispatchEvent(new PushEvent("push", { data }));
      }
      await new Promise((resolve) => setTimeout(resolve, 200));
      return caught;
    });

    expect(shown).toEqual([
      "Krümel: Testbenachrichtigung von Krümel (test, de)",
      "Krümel: Neues in Krümel. (kruemel, de)",
    ]);
  });
});
