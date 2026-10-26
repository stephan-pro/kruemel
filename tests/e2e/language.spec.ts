import { expect, type Page, test } from "@playwright/test";
import { demoData } from "../../src/demo/demoData";
import { expectNoAccessibilityViolations } from "./axe";
import { expectPageShown, FROZEN_TODAY, freezeClock, goToPage, startShared } from "./helpers";
import { E2E_APP } from "./shared";

// EN-a: German and English, the switch, and that it is kept on the device. The other tests run in
// German (the browser of the tests asks for "de-DE"); here the browser asks for English where the
// test says so.

const LANGUAGE_KEY = "kruemel:language";
const SIGN_IN_FRIEND = `${E2E_APP}#/freunde/abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG`;

const htmlLang = (page: Page) => page.evaluate(() => document.documentElement.lang);
const switchGroup = (page: Page) => page.getByRole("group", { name: "Sprache / Language" });
const german = (page: Page) => page.getByRole("button", { name: "Deutsch" });
const english = (page: Page) => page.getByRole("button", { name: "English" });

/** The week of the frozen day for Alex, in the browser's own language (no choice made yet). */
async function openApp(page: Page, hash: string) {
  await freezeClock(page);
  await startShared(page, demoData(FROZEN_TODAY), hash);
}

/** Texts or boxes that stick out of their box or the page: what a longer text would break. */
async function overflowing(page: Page): Promise<string[]> {
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

test.describe("EN-a Sprachumschalter auf der Anmeldeseite", () => {
  test("EN-a Ohne Konto: Deutsch ist Standard, English umschaltbar, bleibt nach Neuladen", async ({
    page,
  }) => {
    await page.goto(E2E_APP);
    await expect(page.getByRole("heading", { level: 1, name: "Anmelden" })).toBeVisible();
    expect(await htmlLang(page)).toBe("de");
    await expect(german(page)).toHaveAttribute("aria-pressed", "true");
    await expect(english(page)).toHaveAttribute("aria-pressed", "false");
    // Each name is in its own language.
    await expect(german(page)).toHaveAttribute("lang", "de");
    await expect(english(page)).toHaveAttribute("lang", "en");

    await english(page).click();
    await expect(english(page)).toHaveAttribute("aria-pressed", "true");
    await expect(german(page)).toHaveAttribute("aria-pressed", "false");
    expect(await htmlLang(page)).toBe("en");
    // The page itself stays where it was: no reload, no lost input, the focus stays on the button.
    await expect(english(page)).toBeFocused();

    await page.reload();
    await expect(english(page)).toHaveAttribute("aria-pressed", "true");
    expect(await htmlLang(page)).toBe("en");
    expect(await page.evaluate((key) => localStorage.getItem(key), LANGUAGE_KEY)).toBe("en");

    await german(page).click();
    expect(await htmlLang(page)).toBe("de");
    await page.reload();
    await expect(german(page)).toHaveAttribute("aria-pressed", "true");
  });

  test("EN-a Auch auf der Seite eines Freundeslinks; eingegebene Adresse bleibt beim Wechsel", async ({
    page,
  }) => {
    await page.goto(SIGN_IN_FRIEND);
    await expect(switchGroup(page)).toBeVisible();
    const field = page.getByLabel(/E-Mail/);
    await field.fill("alex@example.org");
    await english(page).click();
    await expect(english(page)).toHaveAttribute("aria-pressed", "true");
    await expect(field).toHaveValue("alex@example.org");
  });

  test("EN-a Mit der Tastatur bedienbar, Fokus sichtbar", async ({ page }) => {
    await page.goto(E2E_APP);
    await expect(german(page)).toBeVisible();
    await german(page).focus();
    await page.keyboard.press("Tab");
    await expect(english(page)).toBeFocused();
    const outline = await english(page).evaluate((element) => {
      const style = getComputedStyle(element);
      return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
    });
    expect(outline.style).not.toBe("none");
    expect(outline.width).toBeGreaterThan(0);
    await page.keyboard.press("Enter");
    expect(await htmlLang(page)).toBe("en");
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Space");
    expect(await htmlLang(page)).toBe("de");
  });

  test("EN-a Zielgröße mindestens 44 px, auch am Handy (360 px), ohne Überlauf", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(E2E_APP);
    await expect(german(page)).toBeVisible();
    for (const button of [german(page), english(page)]) {
      const box = await button.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
      expect(box?.width).toBeGreaterThanOrEqual(44);
    }
    await english(page).click();
    expect(await overflowing(page)).toEqual([]);
  });

  test("EN-a axe hell und dunkel in beiden Sprachen", async ({ page }) => {
    await page.goto(E2E_APP);
    await expect(german(page)).toBeVisible();
    await expectNoAccessibilityViolations(page);
    await english(page).click();
    await expectNoAccessibilityViolations(page);
  });
});

test.describe("EN-a Standard nach Browsersprache", () => {
  test.describe("Browser auf Englisch", () => {
    test.use({ locale: "en-GB" });

    test("EN-a en → Englisch; eine bewusste Wahl überschreibt den Standard", async ({ page }) => {
      await page.goto(E2E_APP);
      await expect(english(page)).toHaveAttribute("aria-pressed", "true");
      expect(await htmlLang(page)).toBe("en");
      await german(page).click();
      await page.reload();
      await expect(german(page)).toHaveAttribute("aria-pressed", "true");
      expect(await htmlLang(page)).toBe("de");
    });
  });

  test.describe("Browser auf Französisch", () => {
    test.use({ locale: "fr-FR" });

    test("EN-a Alles andere → Deutsch", async ({ page }) => {
      await page.goto(E2E_APP);
      await expect(german(page)).toHaveAttribute("aria-pressed", "true");
      expect(await htmlLang(page)).toBe("de");
    });
  });
});

test.describe("EN-a Kernoberfläche auf Englisch", () => {
  test.use({ locale: "en-GB" });

  test("EN-a Darstellung: umschalten wirkt sofort, Navigation und Titel folgen, bleibt nach Neuladen", async ({
    page,
  }) => {
    await openApp(page, "#/einstellungen/darstellung");
    const group = page.getByRole("group", { name: "Language" });
    await expect(group).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Appearance" })).toBeVisible();
    await expect(page).toHaveTitle("Appearance – Krümel");

    await german(page).click();
    await expect(page.getByRole("heading", { level: 1, name: "Darstellung" })).toBeVisible();
    await expect(page).toHaveTitle("Darstellung – Krümel");
    await expect(page.getByRole("navigation", { name: "Hauptnavigation" })).toBeVisible();
    await expect(german(page)).toBeFocused();

    await english(page).click();
    await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
    for (const name of ["Today", "Week", "Statistics", "Settings"]) {
      await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
    }
    await expect(page.getByRole("link", { name: "Back to settings" })).toBeVisible();
    await expect(english(page)).toBeFocused();

    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Appearance" })).toBeVisible();

    // The overview names the language in the status of the row.
    await page.getByRole("link", { name: "Back to settings" }).click();
    await expect(
      page.getByRole("link", { name: /^Appearance English · Krümel moves: on/ }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: "Account and household" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
    await expectNoAccessibilityViolations(page);
  });

  test("EN-a Woche und Heute: Wochentage, Zahlen, Erledigen mit Rückgängig", async ({ page }) => {
    await openApp(page, "#/heute");
    await expect(page.getByRole("heading", { level: 1, name: "Hello, Alex!" })).toBeVisible();
    await expect(page.getByText("Wednesday, 21 October")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Your week" }).first()).toBeVisible();
    await expectNoAccessibilityViolations(page);

    await goToPage(page, "Week", "This week");
    await expect(page.getByText(/^Week 43 · 19–25 October$/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Today · Wed, 21 Oct" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Tasks", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Done", exact: true })).toBeVisible();
    await expectNoAccessibilityViolations(page);

    const tick = page.getByRole("button", { name: /^Mark as done: / }).first();
    await tick.click();
    const notice = page.getByRole("region", { name: "Notice" });
    await expect(notice).toContainText(/is done/);
    await notice.getByRole("button", { name: "Undo" }).click();
    await expect(notice).toContainText(/Undone: /);
    await page
      .getByRole("button", { name: /^Mark as done: / })
      .first()
      .click();
    await expect(notice).toContainText(/is done/);
  });

  test("EN-a Aufgaben, Formular, Erledigt und Statistik auf Englisch, axe hell und dunkel", async ({
    page,
  }) => {
    await openApp(page, "#/woche");
    await goToPage(page, "Tasks", "Tasks");
    await expect(page.getByRole("heading", { name: "Recurring tasks" })).toBeVisible();
    await expect(page.getByText("Repeats").first()).toBeVisible();
    await expectNoAccessibilityViolations(page);

    await page.getByRole("link", { name: "New task" }).click();
    await expectPageShown(page, "New task");
    await expect(page.getByRole("button", { name: "Add task" })).toBeVisible();
    await expect(page.getByLabel("Title")).toBeVisible();
    await expect(page.getByText("Checklist (optional)")).toBeVisible();
    await expectNoAccessibilityViolations(page);

    await page.evaluate(() => {
      location.hash = "#/erledigt";
    });
    await expectPageShown(page, "Done");
    await expect(page.getByRole("heading", { name: "Completed tasks" })).toBeVisible();
    await expectNoAccessibilityViolations(page);

    await goToPage(page, "Statistics", "Your summary");
    await expect(page.getByRole("button", { name: "Month" })).toBeVisible();
    await expectNoAccessibilityViolations(page);
  });

  test("EN-a Handy 360 px: die längeren englischen Texte laufen nirgends über", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await openApp(page, "#/heute");
    await expect(page.getByRole("heading", { level: 1, name: "Hello, Alex!" })).toBeVisible();
    expect(await overflowing(page)).toEqual([]);

    for (const [hash, heading] of [
      ["#/woche", "This week"],
      ["#/aufgaben", "Tasks"],
      ["#/aufgaben/neu", "New task"],
      ["#/erledigt", "Done"],
      ["#/statistik", "Your summary"],
      ["#/einstellungen", "Settings"],
      ["#/einstellungen/darstellung", "Appearance"],
    ] as const) {
      await page.evaluate((target) => {
        location.hash = target;
      }, hash);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      expect(await overflowing(page), hash).toEqual([]);
    }

    for (const button of [german(page), english(page)]) {
      const box = await button.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });
});
