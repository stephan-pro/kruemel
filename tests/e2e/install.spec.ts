import { expect, type Page, test } from "@playwright/test";
import { expectNoAccessibilityViolations } from "./axe";
import { deviceKey, expectPageShown, goToPage, openWeek } from "./helpers";

// Package 13: help with installing (N3). A test cannot install an app; it plays the browser's
// part: the install question (`beforeinstallprompt`, offered by Chromium browsers), the browser
// seen by its user agent (iPhone, Firefox on Android) and the installed app (`navigator.standalone`).

const IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1";
const FIREFOX_ANDROID = "Mozilla/5.0 (Android 15; Mobile; rv:144.0) Gecko/144.0 Firefox/144.0";
const FIREFOX_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0";

const hint = (page: Page) => page.getByRole("region", { name: "Putzplan als App" });
const guide = (page: Page) => page.getByRole("dialog", { name: "Putzplan installieren" });
const installTile = (page: Page) => page.getByRole("region", { name: "Als App installieren" });

/**
 * The browser offers to install, as Chrome does once the app qualifies. `prompt()` counts the
 * calls in `window.installPrompts`; the answer of the user is `outcome`.
 */
async function offerInstall(page: Page, outcome: "accepted" | "dismissed" = "accepted") {
  await page.evaluate((answer) => {
    const target = window as unknown as { installPrompts: number };
    target.installPrompts = 0;
    const event = new Event("beforeinstallprompt", { cancelable: true });
    Object.assign(event, {
      prompt: async () => {
        target.installPrompts++;
      },
      userChoice: Promise.resolve({ outcome: answer }),
    });
    dispatchEvent(event);
  }, outcome);
}

function installPrompts(page: Page): Promise<number> {
  return page.evaluate(() => (window as unknown as { installPrompts: number }).installPrompts);
}

async function storedDevice(page: Page): Promise<unknown> {
  return JSON.parse((await page.evaluate((key) => localStorage.getItem(key), deviceKey)) ?? "null");
}

test.describe("N3 Knopf „App installieren“, wo der Browser es anbietet", () => {
  test("N3 Der Hinweis steht unter den Kacheln der Woche und installiert mit einem Tipp", async ({
    page,
  }) => {
    await openWeek(page);
    await offerInstall(page, "accepted");

    await expect(hint(page)).toBeVisible();
    await expect(hint(page)).toContainText("ohne Adressleiste und auch ohne Internet");
    // Below the tiles: "Überfällig" and the day stay first (Paket 12).
    const afterBoard = await page.evaluate(() => {
      const board = document.querySelector(".week-board");
      const box = document.querySelector(".install-hint");
      return board !== null && box !== null && Boolean(board.compareDocumentPosition(box) & 4);
    });
    expect(afterBoard).toBe(true);
    await expectNoAccessibilityViolations(page);

    await hint(page).getByRole("button", { name: "App installieren" }).click();

    expect(await installPrompts(page)).toBe(1);
    await expect(hint(page)).toHaveCount(0);
    await expectPageShown(page, "Diese Woche");
    await goToPage(page, "Einstellungen");
    await expect(installTile(page)).toContainText("als App installiert");
  });

  test("N3 Lehnt man im Browser ab, verschwindet der Hinweis; die Einstellungen erklären das Menü", async ({
    page,
  }) => {
    test.skip(test.info().project.name === "webkit-mobile", "iPhone: dort gilt die Anleitung");
    await openWeek(page);
    await offerInstall(page, "dismissed");

    await hint(page).getByRole("button", { name: "App installieren" }).click();

    await expect(hint(page)).toHaveCount(0);
    await goToPage(page, "Einstellungen");
    await expect(installTile(page).getByRole("button")).toHaveCount(0);
    await expect(installTile(page)).toContainText("Zum Startbildschirm hinzufügen");
  });

  test("N3 Die Einstellungen bieten „App installieren“ ebenfalls an", async ({ page }) => {
    await openWeek(page);
    await offerInstall(page);
    await goToPage(page, "Einstellungen");

    await installTile(page).getByRole("button", { name: "App installieren" }).click();

    expect(await installPrompts(page)).toBe(1);
    await expect(installTile(page)).toContainText("als App installiert");
    await expect(page.getByRole("heading", { name: "Als App installieren" })).toBeFocused();
  });
});

test.describe("N3 Hinweis schließen", () => {
  test("N3 „Hinweis schließen“ schließt ihn dauerhaft für dieses Gerät; die Einstellungen behalten ihn", async ({
    page,
  }) => {
    await openWeek(page);
    await offerInstall(page);

    await hint(page).getByRole("button", { name: "Hinweis schließen" }).click();

    await expect(hint(page)).toHaveCount(0);
    await expectPageShown(page, "Diese Woche");
    expect(await storedDevice(page)).toEqual({
      currentPerson: "personA",
      installHintDismissed: true,
    });

    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Diese Woche" })).toBeVisible();
    await offerInstall(page);
    await expect(page.getByRole("heading", { name: "Überfällig" })).toBeVisible();
    await expect(hint(page)).toHaveCount(0);

    await goToPage(page, "Einstellungen");
    await expect(installTile(page).getByRole("button", { name: "App installieren" })).toBeVisible();
  });
});

test.describe("N3 Ohne Weg zur Installation kein Hinweis", () => {
  test.use({ userAgent: FIREFOX_WINDOWS });

  test("N3 Firefox am PC: kein Hinweis in der Woche, in den Einstellungen nur der allgemeine Satz", async ({
    page,
  }) => {
    await openWeek(page);

    await expect(page.getByRole("heading", { name: "Woche im Überblick" })).toBeVisible();
    await expect(hint(page)).toHaveCount(0);
    await goToPage(page, "Einstellungen");
    await expect(installTile(page)).toContainText("Firefox am PC kann keine Apps installieren");
    await expect(installTile(page)).not.toContainText("Xiaomi");
  });
});

test.describe("N3 Als installierte App", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "standalone", { value: true, configurable: true });
    });
  });

  test("N3 Läuft Putzplan schon installiert, gibt es keinen Hinweis und keinen Knopf", async ({
    page,
  }) => {
    await openWeek(page);
    await offerInstall(page);

    await expect(page.getByRole("heading", { name: "Woche im Überblick" })).toBeVisible();
    await expect(hint(page)).toHaveCount(0);
    await goToPage(page, "Einstellungen");
    await expect(installTile(page)).toContainText(
      "Putzplan ist auf diesem Gerät als App installiert.",
    );
    await expect(installTile(page).getByRole("button")).toHaveCount(0);
  });
});

test.describe("N3 iPhone: bebilderte Anleitung", () => {
  test.use({ userAgent: IPHONE });

  test("N3 „Anleitung zeigen“ öffnet die Schritte Teilen, Zum Home-Bildschirm, Hinzufügen mit Bildern", async ({
    page,
  }) => {
    await openWeek(page);
    const opener = hint(page).getByRole("button", { name: "Anleitung zeigen" });

    await opener.click();

    await expect(guide(page)).toBeVisible();
    await expect(guide(page).getByRole("heading", { name: "Putzplan installieren" })).toBeFocused();
    const steps = guide(page).getByRole("listitem");
    await expect(steps).toHaveCount(3);
    await expect(steps.nth(0)).toContainText("Teilen");
    await expect(steps.nth(1)).toContainText("Zum Home-Bildschirm");
    await expect(steps.nth(2)).toContainText("Hinzufügen");
    // Every step has its picture; for screen readers it is decoration.
    await expect(guide(page).locator(".install-steps__picture[aria-hidden='true']")).toHaveCount(3);
    await expect(guide(page)).toContainText("eigene Daten, getrennt von Safari");
    await expectNoAccessibilityViolations(page);

    await page.keyboard.press("Escape");

    await expect(guide(page)).toBeHidden();
    await expect(opener).toBeFocused();

    await opener.click();
    await guide(page).getByRole("button", { name: "Schließen" }).click();
    await expect(guide(page)).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test("N3 Die Einstellungen zeigen dieselbe Anleitung", async ({ page }) => {
    await openWeek(page);
    await goToPage(page, "Einstellungen");

    await expect(installTile(page).getByRole("listitem")).toHaveCount(3);
    await expect(installTile(page)).toContainText("Zum Home-Bildschirm");
    await expectNoAccessibilityViolations(page);
  });
});

test.describe("N3 Firefox auf Android: Browsermenü und Erlaubnis auf Xiaomi-Handys", () => {
  test.use({ userAgent: FIREFOX_ANDROID });

  test("N3 Die Anleitung nennt das Menü ⋮ und die Berechtigung „Startbildschirm-Verknüpfungen“", async ({
    page,
  }) => {
    await openWeek(page);

    await hint(page).getByRole("button", { name: "Anleitung zeigen" }).click();

    await expect(guide(page)).toContainText("Menü ⋮");
    await expect(guide(page)).toContainText("Zum Startbildschirm hinzufügen");
    await expect(guide(page)).toContainText("Xiaomi, Redmi und POCO");
    await expect(guide(page)).toContainText(
      "Apps → Apps verwalten → Firefox → Weitere Berechtigungen → Startbildschirm-Verknüpfungen",
    );
    await expectNoAccessibilityViolations(page);
    await page.keyboard.press("Escape");

    await goToPage(page, "Einstellungen");
    await expect(installTile(page)).toContainText("Startbildschirm-Verknüpfungen");
  });
});

test.describe("N3 Auf anderem Gerät öffnen", () => {
  test("N3 Ein Knopf zeigt den QR-Code mit der Adresse der App und blendet ihn wieder aus", async ({
    page,
  }) => {
    await openWeek(page);
    await goToPage(page, "Einstellungen");
    const tile = page.getByRole("region", { name: "Auf anderem Gerät öffnen" });
    const toggle = tile.getByRole("button", { name: "QR-Code zeigen" });
    const address = new URL("./", page.url()).href;
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(tile.getByRole("img")).toHaveCount(0);

    await toggle.click();

    const code = tile.getByRole("img", { name: `QR-Code mit der Adresse ${address}` });
    await expect(code).toBeVisible();
    await expect(code).toHaveAttribute("data-address", address);
    await expect(tile).toContainText(address);
    await expect(tile).toContainText("Die Daten kommen nicht mit");
    // Big enough for a camera, and dark on light in both colour schemes.
    expect((await code.boundingBox())?.width).toBeGreaterThanOrEqual(150);
    await expectNoAccessibilityViolations(page);

    await tile.getByRole("button", { name: "QR-Code ausblenden" }).click();

    await expect(code).toBeHidden();
    await expect(tile.getByRole("button", { name: "QR-Code zeigen" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });
});

test.describe("Version", () => {
  test("Die Einstellungen nennen den Stand der App und laden sie mit „Neu laden“ neu", async ({
    page,
  }) => {
    await openWeek(page);
    await goToPage(page, "Einstellungen");
    const tile = page.getByRole("region", { name: "Version" });

    await expect(tile).toContainText(/Stand: \d\d\.\d\d\.\d{4}, \d\d:\d\d Uhr \(lokal gebaut\)/);
    await page.evaluate(() => {
      (window as unknown as { beforeReload: boolean }).beforeReload = true;
    });

    await tile.getByRole("button", { name: "Neu laden" }).click();

    await expect.poll(() => page.evaluate(() => "beforeReload" in window)).toBe(false);
    await expect(page.getByRole("heading", { level: 1, name: "Einstellungen" })).toBeVisible();
  });
});
