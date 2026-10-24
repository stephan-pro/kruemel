import { expect, type Page, test } from "@playwright/test";
import { FAKE_VAPID_KEY_OVERRIDE } from "../../src/push/fakeHttpPushApi";
import { ACCOUNT_TEXTS } from "../../src/ui/accountTexts";
import {
  NOTIFICATION_STATUS_TEXTS,
  NOTIFICATION_TEXTS,
  PUSH_FAILURE_TEXTS,
  NOTIFICATION_SETTINGS_TEXTS as SETTINGS_TEXTS,
  WEEKDAYS,
} from "../../src/ui/notificationTexts";
import type { Member } from "./account";
import { expectNoAccessibilityViolations } from "./axe";
import { expectPageShown, startLocal, startShared } from "./helpers";
import { mockPush, type PushMock, pushMockState } from "./pushMock";
import { FAKE_SERVER } from "./shared";

// NT-a, NT-b: the tile "Benachrichtigungen" in the settings, signed in against the fake server,
// with the browser's Push API played by `pushMock.ts`. The fake server records the test
// notifications instead of delivering them (`GET /test/pushes`).

const SETTINGS = "#/einstellungen";
const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

const tileOf = (page: Page) => page.getByRole("region", { name: NOTIFICATION_TEXTS.tileTitle });
const statusOf = (page: Page) => tileOf(page).locator(".sync-status").first();
/** The status line of the tile itself (the settings have their own below). */
const announced = (page: Page) => tileOf(page).locator(":scope > .form-status");
/** The status line of the settings form. */
const settingsAnnounced = (page: Page) => tileOf(page).locator("form .form-status");
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
  return (
    (await response.json()) as {
      devices: { deviceId: string; endpoint: string; timeZone: string }[];
    }
  ).devices;
}

/** The settings the server holds for the person's (only) device. */
async function serverSettings(page: Page, member: Member) {
  const device = (await serverDevices(page, member))[0];
  const response = await page.request.post(`${FAKE_SERVER}/push/settings`, {
    headers: bearer(member),
    data: { deviceId: device?.deviceId },
  });
  return ((await response.json()) as { settings: Record<string, unknown> | null }).settings;
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

  test("NT-b Push-Dienst kennt das Gerät nicht mehr (410): Hinweis, danach „abgemeldet“ mit „Neu einschalten“", async ({
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
    await expect(statusOf(page)).toHaveText(NOTIFICATION_STATUS_TEXTS.lost);
    await expect(button(page, NOTIFICATION_TEXTS.enable)).toHaveCount(0);
    expect(await serverDevices(page, member)).toEqual([]);
    await expectNoAccessibilityViolations(page);

    // Still "abgemeldet" after a reload, until it is switched on again.
    await page.request.post(`${FAKE_SERVER}/test/push-answer`, {
      headers: bearer(member),
      data: { status: 201 },
    });
    await page.reload();
    await expect(statusOf(page)).toHaveText(NOTIFICATION_STATUS_TEXTS.lost);
    await button(page, NOTIFICATION_TEXTS.reenable).click();
    await expect(statusOf(page)).toHaveText(NOTIFICATION_STATUS_TEXTS.active);
    await expect(tileHeading(page)).toBeFocused();
    expect(await serverDevices(page, member)).toHaveLength(1);
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

  test("NT-a Push-Dienst lehnt ab (413): Hinweis auf die Einrichtung, nicht „nicht erreichbar“", async ({
    page,
  }) => {
    const member = await openSettings(page);
    await button(page, NOTIFICATION_TEXTS.enable).click();
    await expect(statusOf(page)).toHaveText(NOTIFICATION_STATUS_TEXTS.active);
    await page.request.post(`${FAKE_SERVER}/test/push-answer`, {
      headers: bearer(member),
      data: { status: 413 },
    });

    await button(page, NOTIFICATION_TEXTS.sendTest).click();

    const alert = tileOf(page).getByRole("alert");
    await expect(alert).toContainText(PUSH_FAILURE_TEXTS.pushRejected);
    await expect(alert).not.toContainText(PUSH_FAILURE_TEXTS.pushFailed);
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
    // The settings come first, the buttons for the test and for switching off after them.
    await page.keyboard.press("Tab");
    await expect(
      tileOf(page).getByRole("switch", { name: SETTINGS_TEXTS.dailyLabel }),
    ).toBeFocused();
    await button(page, NOTIFICATION_TEXTS.sendTest).focus();
    await page.keyboard.press("Enter");
    await expect(announced(page)).toHaveText(NOTIFICATION_TEXTS.testSent);
    expect(await serverPushes(page, member)).toHaveLength(1);
    await page.keyboard.press("Tab");
    await expect(button(page, NOTIFICATION_TEXTS.disable)).toBeFocused();

    for (const name of [
      NOTIFICATION_TEXTS.sendTest,
      NOTIFICATION_TEXTS.disable,
      SETTINGS_TEXTS.save,
    ]) {
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

const DEFAULTS = {
  dailyEnabled: true,
  dailyTime: "07:30",
  dailyDays: 127,
  partnerEnabled: true,
  householdEnabled: true,
  quietEnabled: true,
  quietFrom: "21:00",
  quietTo: "07:00",
};

const field = (page: Page, label: string) => tileOf(page).getByLabel(label, { exact: true });
const switchOf = (page: Page, name: string) =>
  tileOf(page).getByRole("switch", { name, exact: true });
const day = (page: Page, index: number) =>
  tileOf(page).getByRole("checkbox", { name: WEEKDAYS[index]?.full ?? "", exact: true });
const PARTNER = SETTINGS_TEXTS.partnerLabel("Robin");

/** Switches notifications on and waits for the settings. */
async function enable(page: Page) {
  await button(page, NOTIFICATION_TEXTS.enable).click();
  await expect(statusOf(page)).toHaveText(NOTIFICATION_STATUS_TEXTS.active);
  await expect(switchOf(page, SETTINGS_TEXTS.dailyLabel)).toBeVisible();
}

test.describe("NT-b Einstellungen pro Gerät", () => {
  test("NT-b Nur bei aktivem Gerät sichtbar; Standardwerte: alles an, 07:30, alle Tage, Ruhezeit 21 bis 7 Uhr", async ({
    page,
  }) => {
    await openSettings(page);
    await expect(tileOf(page).getByRole("switch")).toHaveCount(0);

    await enable(page);

    await expect(tileOf(page).getByRole("heading", { name: SETTINGS_TEXTS.title })).toBeVisible();
    await expect(switchOf(page, SETTINGS_TEXTS.dailyLabel)).toBeChecked();
    await expect(field(page, SETTINGS_TEXTS.dailyTimeLabel)).toHaveValue("07:30");
    for (const index of WEEKDAYS.keys()) {
      await expect(day(page, index)).toBeChecked();
    }
    await expect(switchOf(page, PARTNER)).toBeChecked();
    await expect(switchOf(page, SETTINGS_TEXTS.householdLabel)).toBeChecked();
    await expect(switchOf(page, SETTINGS_TEXTS.quietLabel)).toBeChecked();
    await expect(field(page, SETTINGS_TEXTS.quietFromLabel)).toHaveValue("21:00");
    await expect(field(page, SETTINGS_TEXTS.quietToLabel)).toHaveValue("07:00");
    await expectNoAccessibilityViolations(page);

    await button(page, NOTIFICATION_TEXTS.disable).click();
    await expect(tileOf(page).getByRole("switch")).toHaveCount(0);
  });

  test("NT-b Speichern: der Server hat die Werte, nach dem Neuladen sind sie wieder da; Aus blendet die Felder aus", async ({
    page,
  }) => {
    const member = await openSettings(page);
    await enable(page);
    expect(await serverSettings(page, member)).toEqual(DEFAULTS);

    await field(page, SETTINGS_TEXTS.dailyTimeLabel).fill("06:45");
    await day(page, 5).uncheck();
    await day(page, 6).uncheck();
    await switchOf(page, PARTNER).uncheck();
    await field(page, SETTINGS_TEXTS.quietFromLabel).fill("22:00");
    await field(page, SETTINGS_TEXTS.quietToLabel).fill("06:30");
    await button(page, SETTINGS_TEXTS.save).click();

    await expect(settingsAnnounced(page)).toHaveText(SETTINGS_TEXTS.saved);
    const chosen = {
      ...DEFAULTS,
      dailyTime: "06:45",
      dailyDays: 0b0011111,
      partnerEnabled: false,
      quietFrom: "22:00",
      quietTo: "06:30",
    };
    expect(await serverSettings(page, member)).toEqual(chosen);
    await expectNoAccessibilityViolations(page);

    await page.reload();
    await expect(field(page, SETTINGS_TEXTS.dailyTimeLabel)).toHaveValue("06:45");
    await expect(switchOf(page, PARTNER)).not.toBeChecked();
    await expect(day(page, 4)).toBeChecked();
    await expect(day(page, 5)).not.toBeChecked();
    await expect(field(page, SETTINGS_TEXTS.quietToLabel)).toHaveValue("06:30");

    // Off: the fields that belong to it go away; saved, the server keeps the times.
    await switchOf(page, SETTINGS_TEXTS.dailyLabel).uncheck();
    await switchOf(page, SETTINGS_TEXTS.quietLabel).uncheck();
    await expect(field(page, SETTINGS_TEXTS.dailyTimeLabel)).toHaveCount(0);
    await expect(field(page, SETTINGS_TEXTS.quietFromLabel)).toHaveCount(0);
    await button(page, SETTINGS_TEXTS.save).click();
    await expect(settingsAnnounced(page)).toHaveText(SETTINGS_TEXTS.saved);
    expect(await serverSettings(page, member)).toEqual({
      ...chosen,
      dailyEnabled: false,
      quietEnabled: false,
    });
  });

  test("NT-b Falsche Werte werden am Feld genannt, der Fokus springt dorthin, nichts wird gespeichert", async ({
    page,
  }) => {
    const member = await openSettings(page);
    await enable(page);

    await field(page, SETTINGS_TEXTS.dailyTimeLabel).fill("");
    await button(page, SETTINGS_TEXTS.save).click();
    await expect(tileOf(page)).toContainText(SETTINGS_TEXTS.problems.dailyTime);
    await expect(field(page, SETTINGS_TEXTS.dailyTimeLabel)).toBeFocused();
    await expect(field(page, SETTINGS_TEXTS.dailyTimeLabel)).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await expectNoAccessibilityViolations(page);

    await field(page, SETTINGS_TEXTS.dailyTimeLabel).fill("07:30");
    for (const index of WEEKDAYS.keys()) {
      await day(page, index).uncheck();
    }
    await button(page, SETTINGS_TEXTS.save).click();
    await expect(tileOf(page)).toContainText(SETTINGS_TEXTS.problems.dailyDays);
    await expect(day(page, 0)).toBeFocused();

    await day(page, 0).check();
    await field(page, SETTINGS_TEXTS.quietToLabel).fill("21:00");
    await button(page, SETTINGS_TEXTS.save).click();
    await expect(tileOf(page)).toContainText(SETTINGS_TEXTS.problems.quietSame);
    await expect(field(page, SETTINGS_TEXTS.quietToLabel)).toBeFocused();
    expect(await serverSettings(page, member)).toEqual(DEFAULTS);

    await field(page, SETTINGS_TEXTS.quietToLabel).fill("06:00");
    await button(page, SETTINGS_TEXTS.save).click();
    await expect(settingsAnnounced(page)).toHaveText(SETTINGS_TEXTS.saved);
    await expect(tileOf(page)).not.toContainText(SETTINGS_TEXTS.problems.quietSame);
  });

  test("NT-b Ohne Internet: „noch nicht übertragen“, und sobald es wieder da ist, geht es von selbst hinaus", async ({
    page,
    context,
  }) => {
    const member = await openSettings(page);
    await enable(page);

    await context.setOffline(true);
    await switchOf(page, SETTINGS_TEXTS.householdLabel).uncheck();
    await field(page, SETTINGS_TEXTS.dailyTimeLabel).fill("08:15");
    await button(page, SETTINGS_TEXTS.save).click();

    await expect(settingsAnnounced(page)).toHaveText(SETTINGS_TEXTS.pending);
    const note = tileOf(page).getByText(SETTINGS_TEXTS.pendingNote, { exact: true });
    await expect(note).toBeVisible();
    await expectNoAccessibilityViolations(page);

    await context.setOffline(false);
    await expect(settingsAnnounced(page)).toHaveText(SETTINGS_TEXTS.nowSent);
    await expect(note).toHaveCount(0);
    expect(await serverSettings(page, member)).toEqual({
      ...DEFAULTS,
      dailyTime: "08:15",
      householdEnabled: false,
    });
  });

  test("NT-b Server nicht erreichbar: Hinweis mit „Erneut versuchen“, danach die Einstellungen", async ({
    page,
  }) => {
    await openSettings(page);
    const settings = `${FAKE_SERVER}/push/settings`;
    await page.route(settings, (route) => route.abort());

    await button(page, NOTIFICATION_TEXTS.enable).click();

    await expect(statusOf(page)).toHaveText(NOTIFICATION_STATUS_TEXTS.active);
    await expect(tileOf(page).getByText(SETTINGS_TEXTS.unreachable)).toBeVisible();
    await expect(tileOf(page).getByRole("switch")).toHaveCount(0);
    await expectNoAccessibilityViolations(page);

    await page.unroute(settings);
    await button(page, SETTINGS_TEXTS.retry).click();
    await expect(switchOf(page, SETTINGS_TEXTS.dailyLabel)).toBeVisible();
    await expect(tileOf(page).getByText(SETTINGS_TEXTS.unreachable)).toHaveCount(0);
  });

  test("NT-b Tastatur: Schalter mit Leertaste, Reihenfolge der Felder, Fokus bleibt auf dem Schalter", async ({
    page,
  }) => {
    await openSettings(page);
    await enable(page);

    await switchOf(page, SETTINGS_TEXTS.dailyLabel).focus();
    await page.keyboard.press("Space");
    await expect(switchOf(page, SETTINGS_TEXTS.dailyLabel)).not.toBeChecked();
    await expect(switchOf(page, SETTINGS_TEXTS.dailyLabel)).toBeFocused();
    await expect(field(page, SETTINGS_TEXTS.dailyTimeLabel)).toHaveCount(0);
    await page.keyboard.press("Space");
    await expect(field(page, SETTINGS_TEXTS.dailyTimeLabel)).toBeVisible();

    await page.keyboard.press("Tab");
    await expect(field(page, SETTINGS_TEXTS.dailyTimeLabel)).toBeFocused();
    // The browser's time field has a stop for the hours and one for the minutes.
    const isFocused = (target: ReturnType<typeof day>) =>
      target.evaluate((element) => element === document.activeElement);
    for (let stops = 0; stops < 4 && !(await isFocused(day(page, 0))); stops++) {
      await page.keyboard.press("Tab");
    }
    await expect(day(page, 0)).toBeFocused();
    for (let index = 0; index < 7; index++) {
      await page.keyboard.press("Tab");
    }
    await expect(switchOf(page, PARTNER)).toBeFocused();
  });

  test("NT-b Handy (360 px): nichts ragt heraus, Felder und Tage groß genug zum Tippen", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await openSettings(page);
    await enable(page);

    for (const target of [
      field(page, SETTINGS_TEXTS.dailyTimeLabel),
      field(page, SETTINGS_TEXTS.quietFromLabel),
      button(page, SETTINGS_TEXTS.save),
    ]) {
      const box = await target.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    // A switch and a weekday are tapped on their whole row/chip (the box itself is small).
    for (const name of [SETTINGS_TEXTS.dailyLabel, PARTNER]) {
      const row = await switchOf(page, name).locator("xpath=..").boundingBox();
      expect(row?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
    // The tap area of a weekday is its whole chip.
    const chip = await tileOf(page).locator(".choice--compact").first().boundingBox();
    expect(chip?.height ?? 0).toBeGreaterThanOrEqual(44);
    expect(chip?.width ?? 0).toBeGreaterThanOrEqual(44);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await expectNoAccessibilityViolations(page);
  });
});

test.describe("NT-b Gerät abmelden, ersetzte Adresse, Zeitzone", () => {
  test("NT-b Hat der Server das Gerät vergessen (lange nicht benutzt), steht dort „abgemeldet“; „Neu einschalten“ holt es zurück", async ({
    page,
  }) => {
    const member = await openSettings(page);
    await enable(page);
    const device = (await serverDevices(page, member))[0];
    await page.request.post(`${FAKE_SERVER}/push/unregister`, {
      headers: bearer(member),
      data: { deviceId: device?.deviceId },
    });

    await page.reload();

    await expect(statusOf(page)).toHaveText(NOTIFICATION_STATUS_TEXTS.lost);
    await expect(tileOf(page).getByRole("switch")).toHaveCount(0);
    await expect(tileOf(page).getByRole("alert")).toHaveCount(0);
    await expectNoAccessibilityViolations(page);
    await button(page, NOTIFICATION_TEXTS.reenable).click();
    await expect(statusOf(page)).toHaveText(NOTIFICATION_STATUS_TEXTS.active);
    await expect(switchOf(page, SETTINGS_TEXTS.dailyLabel)).toBeVisible();
    expect(await serverDevices(page, member)).toHaveLength(1);
  });

  test("NT-b Ersetzt der Browser die Push-Adresse, meldet die App beim nächsten Start die neue an; die Einstellungen bleiben", async ({
    page,
  }) => {
    const member = await openSettings(page);
    await enable(page);
    await switchOf(page, SETTINGS_TEXTS.householdLabel).uncheck();
    await button(page, SETTINGS_TEXTS.save).click();
    await expect(settingsAnnounced(page)).toHaveText(SETTINGS_TEXTS.saved);
    const before = (await serverDevices(page, member))[0]?.endpoint;
    const replaced = "https://fcm.googleapis.com/fcm/send/e2e-vom-browser-ersetzt";
    await page.evaluate((endpoint) => {
      const state = JSON.parse(sessionStorage.getItem("e2e-push-mock") ?? "{}");
      state.subscription.endpoint = endpoint;
      sessionStorage.setItem("e2e-push-mock", JSON.stringify(state));
    }, replaced);

    await page.reload();

    await expect(statusOf(page)).toHaveText(NOTIFICATION_STATUS_TEXTS.active);
    await expect.poll(async () => (await serverDevices(page, member))[0]?.endpoint).toBe(replaced);
    expect(before).not.toBe(replaced);
    expect(await serverDevices(page, member)).toHaveLength(1);
    expect(await serverSettings(page, member)).toEqual({ ...DEFAULTS, householdEnabled: false });
  });

  test("NT-b Die Zeitzone kommt vom Gerät und wird bei jedem Start nachgeführt (Reise)", async ({
    page,
  }) => {
    // The page's time zone can be changed only by a new browser; the test lets the page tell
    // another one from the next start on.
    await page.addInitScript(() => {
      const original = Intl.DateTimeFormat.prototype.resolvedOptions;
      Intl.DateTimeFormat.prototype.resolvedOptions = function resolvedOptions() {
        const options = original.call(this);
        const zone = sessionStorage.getItem("e2e-zone");
        return zone ? { ...options, timeZone: zone } : options;
      };
    });
    const member = await openSettings(page);
    await enable(page);
    const first = (await serverDevices(page, member))[0]?.timeZone;
    expect(first).toBeTruthy();

    await page.evaluate(() => sessionStorage.setItem("e2e-zone", "Pacific/Auckland"));
    await page.reload();

    await expect(statusOf(page)).toHaveText(NOTIFICATION_STATUS_TEXTS.active);
    await expect
      .poll(async () => (await serverDevices(page, member))[0]?.timeZone)
      .toBe("Pacific/Auckland");
  });

  test("NT-b Abmelden nennt die Benachrichtigungen in der Rückfrage und schaltet sie auf dem Gerät aus", async ({
    page,
  }) => {
    const member = await openSettings(page);
    let unregisters = 0;
    page.on("request", (request) => {
      if (request.url().endsWith("/push/unregister")) {
        unregisters++;
      }
    });
    const account = page.getByRole("region", { name: ACCOUNT_TEXTS.accountTile });
    const dialog = page.getByRole("dialog", { name: ACCOUNT_TEXTS.signOutQuestion });

    // Not on here: nothing to say about it.
    await account.getByRole("button", { name: ACCOUNT_TEXTS.signOut }).first().click();
    await expect(dialog).toBeVisible();
    await expect(dialog).not.toContainText(NOTIFICATION_TEXTS.signOutNote);
    await dialog.getByRole("button", { name: "Abbrechen" }).click();

    await enable(page);
    expect(await serverDevices(page, member)).toHaveLength(1);
    await account.getByRole("button", { name: ACCOUNT_TEXTS.signOut }).first().click();
    await expect(dialog).toContainText(NOTIFICATION_TEXTS.signOutNote);
    await dialog.getByRole("button", { name: ACCOUNT_TEXTS.signOut }).click();

    await expectPageShown(page, ACCOUNT_TEXTS.signInTitle);
    // The browser's address is gone, and the server heard of it (otherwise the device would hold
    // a note to tell it at the next start: `unregisterFor`).
    expect((await pushMockState(page)).subscription).toBeNull();
    const remembered = await page.evaluate(() => localStorage.getItem("kruemel:push-device"));
    expect(Object.keys(JSON.parse(remembered ?? "{}"))).toEqual(["deviceId"]);
    expect(unregisters).toBe(1);
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
