import { expect, type Page, test } from "@playwright/test";
import { NOTIFICATION_STATUS_TEXTS, NOTIFICATION_TEXTS } from "../../src/ui/notificationTexts";
import { SETTINGS_GROUP_TITLES, SETTINGS_TEXTS } from "../../src/ui/settingsTexts";
import { expectNoAccessibilityViolations } from "./axe";
import {
  goToPage,
  openSettings,
  openWeek,
  type SettingsGroup,
  startLocal,
  startShared,
} from "./helpers";
import { mockPush } from "./pushMock";

// UX-a: "Einstellungen" is an overview with five rows (one per group) and a page for each group.
// The tiles inside the groups are tested where they always were (household, backup, install …).

const STATUS = SETTINGS_TEXTS.status;
const GROUPS: readonly { title: SettingsGroup; hash: string }[] = [
  { title: SETTINGS_GROUP_TITLES.account, hash: "#/einstellungen/konto" },
  { title: SETTINGS_GROUP_TITLES.notifications, hash: "#/einstellungen/benachrichtigungen" },
  { title: SETTINGS_GROUP_TITLES.appearance, hash: "#/einstellungen/darstellung" },
  { title: SETTINGS_GROUP_TITLES.data, hash: "#/einstellungen/daten" },
  { title: SETTINGS_GROUP_TITLES.legal, hash: "#/einstellungen/rechtliches" },
];

const rows = (page: Page) =>
  page.getByRole("list", { name: SETTINGS_TEXTS.listLabel }).getByRole("link");
const row = (page: Page, group: SettingsGroup) =>
  page.getByRole("link", { name: new RegExp(`^${group}\\b`) });
const backLink = (page: Page) => page.getByRole("link", { name: SETTINGS_TEXTS.backLabel });
const heading = (page: Page, name: string) => page.getByRole("heading", { level: 1, name });

/** The name of a row is its title and its status (so the status is no matter of looks alone). */
async function expectStatus(page: Page, group: SettingsGroup, status: string | RegExp) {
  const name =
    typeof status === "string"
      ? `${group} ${status}`
      : new RegExp(`^${group} ${status.source}`, status.flags);
  await expect(row(page, group)).toHaveAccessibleName(name);
}

test.describe("UX-a Übersicht", () => {
  test("UX-a Fünf Gruppen in fester Reihenfolge, jede mit ihrem Stand", async ({ page }) => {
    await mockPush(page);
    await openWeek(page);
    await openSettings(page);

    await expect(heading(page, "Einstellungen")).toBeFocused();
    await expect(page).toHaveTitle("Einstellungen – Krümel");
    await expect(rows(page)).toHaveCount(5);
    for (const [index, { title }] of GROUPS.entries()) {
      await expect(rows(page).nth(index)).toHaveAccessibleName(new RegExp(`^${title}\\b`));
    }
    await expectStatus(page, "Konto und Haushalt", /.*, 2 Personen/);
    await expectStatus(page, "Benachrichtigungen", STATUS.notificationsOff);
    await expectStatus(page, "Darstellung", STATUS.motion(true));
    await expectStatus(page, "Daten", STATUS.allSent);
    await expectStatus(page, "Rechtliches", STATUS.legal);
    await expectNoAccessibilityViolations(page);
  });

  test("UX-a Darstellung: Der Stand folgt dem Schalter „Krümel bewegt sich“", async ({ page }) => {
    await openWeek(page);
    await openSettings(page, "Darstellung");
    await page.getByRole("switch", { name: "Krümel bewegt sich" }).uncheck();

    await backLink(page).click();
    await expectStatus(page, "Darstellung", STATUS.motion(false));
  });

  test("UX-a Benachrichtigungen: blockiert, nicht unterstützt und aktiv", async ({ page }) => {
    await mockPush(page, { permission: "denied" });
    await openWeek(page);
    await openSettings(page);
    await expectStatus(page, "Benachrichtigungen", STATUS.notificationsBlocked);
  });

  test("UX-a Benachrichtigungen: ein Browser ohne Push-Schnittstelle", async ({ page }) => {
    await mockPush(page, { supported: false });
    await openWeek(page);
    await openSettings(page);
    await expectStatus(page, "Benachrichtigungen", STATUS.notificationsUnsupported);
  });

  test("UX-a Benachrichtigungen: aktiv nach dem Einschalten, der Stand steht in der Übersicht", async ({
    page,
  }) => {
    await mockPush(page);
    await openWeek(page);
    await openSettings(page, "Benachrichtigungen");
    await page.getByRole("button", { name: NOTIFICATION_TEXTS.enable }).click();
    await expect(page.locator(".sync-status").first()).toHaveText(NOTIFICATION_STATUS_TEXTS.active);

    await backLink(page).click();
    await expectStatus(page, "Benachrichtigungen", STATUS.notificationsActive);
  });

  test("UX-a Ohne Anmeldung (Modus local): nur auf diesem Gerät, Benachrichtigungen nicht eingerichtet", async ({
    page,
  }) => {
    await startLocal(page);
    await openSettings(page);

    await expectStatus(page, "Konto und Haushalt", STATUS.deviceOnly);
    await expectStatus(page, "Benachrichtigungen", STATUS.notificationsNotConfigured);
    await expectStatus(page, "Daten", STATUS.deviceOnly);
    await expectNoAccessibilityViolations(page);
  });

  test("UX-a Offline: Daten sagen „Offline“, mit Netz „Alles übertragen“", async ({ page }) => {
    await openWeek(page);
    const tick = page.getByRole("button", { name: /^Abhaken: / }).first();
    await expect(tick).toBeVisible();

    await page.context().setOffline(true);
    await tick.click();
    await openSettings(page);
    await expectStatus(page, "Daten", STATUS.offline);

    await page.context().setOffline(false);
    await expectStatus(page, "Daten", STATUS.allSent);
  });
});

test.describe("UX-a Gruppenseiten", () => {
  for (const { title, hash } of GROUPS) {
    test(`UX-a Direktaufruf ${hash}: Überschrift, Tab-Titel, Zurück-Link, aktueller Eintrag`, async ({
      page,
    }) => {
      await startShared(page, undefined, hash);

      await expect(heading(page, title)).toBeVisible();
      await expect(page).toHaveTitle(`${title} – Krümel`);
      await expect(backLink(page)).toHaveText(SETTINGS_TEXTS.title);
      await expect(backLink(page)).toHaveAttribute("href", "#/einstellungen");
      await expect(
        page.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("link", {
          name: "Einstellungen",
          exact: true,
        }),
      ).toHaveAttribute("aria-current", "true");
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expectNoAccessibilityViolations(page);
    });
  }

  test("UX-a Die alte Adresse #/einstellungen zeigt die Übersicht", async ({ page }) => {
    await startShared(page, undefined, "#/einstellungen");

    await expect(heading(page, "Einstellungen")).toBeVisible();
    await expect(rows(page)).toHaveCount(5);
  });

  test("UX-a Hin und zurück: Gruppe öffnen, Zurück-Link, Fokus auf der Zeile", async ({ page }) => {
    await openWeek(page);
    await openSettings(page);

    await row(page, "Daten").click();
    await expect(heading(page, "Daten")).toBeFocused();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    await backLink(page).click();
    await expect(heading(page, "Einstellungen")).toBeVisible();
    await expect(row(page, "Daten")).toBeFocused();
    await expect(page).toHaveURL(/#\/einstellungen$/);
  });

  test("UX-a Browser-Zurück und -Vor: Gruppe, Übersicht (Fokus auf der Zeile), Woche", async ({
    page,
  }) => {
    await openWeek(page);
    await openSettings(page, "Rechtliches");

    await page.goBack();
    await expect(heading(page, "Einstellungen")).toBeVisible();
    await expect(row(page, "Rechtliches")).toBeFocused();

    await page.goBack();
    await expect(heading(page, "Diese Woche")).toBeVisible();

    await page.goForward();
    await expect(heading(page, "Einstellungen")).toBeVisible();
    await page.goForward();
    await expect(heading(page, "Rechtliches")).toBeFocused();
  });

  test("UX-a „Einstellungen“ in der Navigation führt aus jeder Gruppe zur Übersicht", async ({
    page,
  }) => {
    await openWeek(page);
    await openSettings(page, "Konto und Haushalt");

    await page
      .getByRole("navigation", { name: "Hauptnavigation" })
      .getByRole("link", { name: "Einstellungen", exact: true })
      .click();

    await expect(heading(page, "Einstellungen")).toBeVisible();
    await expect(rows(page)).toHaveCount(5);
  });

  test("UX-a Aus Rechtliches zum Impressum und zurück, auch mit Browser-Zurück", async ({
    page,
  }) => {
    await openWeek(page);
    await openSettings(page, "Rechtliches");

    await page.getByRole("link", { name: "Impressum", exact: true }).click();
    await expect(heading(page, "Impressum")).toBeFocused();
    await page.getByRole("button", { name: "Zurück", exact: true }).click();
    await expect(heading(page, "Rechtliches")).toBeFocused();

    await page.getByRole("link", { name: "Datenschutzerklärung", exact: true }).click();
    await expect(heading(page, "Datenschutzerklärung")).toBeFocused();
    await page.goBack();
    await expect(heading(page, "Rechtliches")).toBeFocused();
  });

  test("UX-a Tastatur: Tab erreicht die Zeilen, Enter öffnet die Gruppe", async ({
    page,
    isMobile,
    browserName,
  }) => {
    test.skip(isMobile, "Tastaturbedienung wird am Desktop geprüft");
    test.skip(browserName === "webkit", "Safari überspringt Links beim Tabulator");
    await openWeek(page);
    await goToPage(page, "Einstellungen");

    for (const { title } of GROUPS) {
      await page.keyboard.press("Tab");
      await expect(row(page, title)).toBeFocused();
    }
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Shift+Tab");
    await expect(row(page, "Benachrichtigungen")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(heading(page, "Benachrichtigungen")).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(backLink(page)).toBeFocused();
  });

  test("UX-a Am Handy (360 px): ohne Seitwärtsrollen, Zeilen mindestens 64 px hoch, kein Scrollen nötig", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await openWeek(page);
    await openSettings(page);

    for (const { title } of GROUPS) {
      const box = await row(page, title).boundingBox();
      expect(box?.height ?? 0, title).toBeGreaterThanOrEqual(64);
      expect((box?.y ?? 0) + (box?.height ?? 0), title).toBeLessThanOrEqual(640);
    }
    const overflow = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
    expect(await overflow()).toBeLessThanOrEqual(0);
    await expectNoAccessibilityViolations(page);

    await row(page, "Konto und Haushalt").click();
    await expect(heading(page, "Konto und Haushalt")).toBeFocused();
    expect(await overflow()).toBeLessThanOrEqual(0);
    const back = await backLink(page).boundingBox();
    expect(back?.height ?? 0).toBeGreaterThanOrEqual(44);
    await expectNoAccessibilityViolations(page);
  });
});
