import { expect, type Page, test } from "@playwright/test";
import { expectPageShown, goToPage, notice, openWeek } from "./helpers";

// Package 13: the final check of N2 – the whole way through the app with the keyboard alone, and
// the Windows contrast themes (`forced-colors`), where the browser replaces all colours. Both only
// in Chromium: Safari skips buttons and links on Tab, and only Chromium emulates contrast themes.

test.skip(({ browserName }) => browserName !== "chromium", "nur Chromium (siehe oben)");

/** Presses Tab until the element is focused, like a person looking for it; fails after 80 stops. */
async function tabTo(page: Page, role: "link" | "button" | "textbox", name: string) {
  const target = page.getByRole(role, { name, exact: true });
  for (let stop = 0; stop < 80; stop++) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((element) => element === document.activeElement)) {
      return;
    }
  }
  throw new Error(`„${name}“ ist mit Tab nicht erreichbar`);
}

test.describe("N2 Tastatur", () => {
  test("N2 Nur mit der Tastatur: Aufgabe anlegen, in der Woche abhaken und rückgängig machen", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Tastatur: am PC");
    await openWeek(page);

    await tabTo(page, "link", "Neue Aufgabe");
    await page.keyboard.press("Enter");
    await expectPageShown(page, "Neue Aufgabe");
    await tabTo(page, "textbox", "Titel");
    await page.keyboard.type("Fenster putzen");
    await tabTo(page, "button", "Aufgabe anlegen");
    await page.keyboard.press("Enter");
    await expectPageShown(page, "Aufgaben");
    await expect(page.getByRole("status").filter({ hasText: "angelegt" })).toBeVisible();

    await tabTo(page, "link", "Woche");
    await page.keyboard.press("Enter");
    await expectPageShown(page, "Diese Woche");
    await tabTo(page, "button", "Abhaken: Fenster putzen");
    await page.keyboard.press("Enter");
    await expect(notice(page)).toBeFocused();
    await expect(notice(page)).toContainText("„Fenster putzen“ ist abgehakt");

    await page.keyboard.press("Tab");
    await expect(notice(page).getByRole("button", { name: "Rückgängig" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(notice(page)).toContainText("Rückgängig gemacht");
    await expect(page.getByRole("button", { name: "Abhaken: Fenster putzen" })).toBeVisible();
  });

  test("K2a Am Handy verschwindet der Fokus beim Tabben nie unter der schwebenden Leiste", async ({
    page,
  }) => {
    // A narrow window like a phone with a keyboard, or a PC at 200 % zoom (WCAG 2.4.11).
    await page.setViewportSize({ width: 390, height: 640 });
    await openWeek(page);
    await goToPage(page, "Einstellungen");
    const bar = await page.locator(".main-nav").boundingBox();
    expect(bar).not.toBeNull();
    const barTop = bar?.y ?? 0;

    let checked = 0;
    for (let stop = 0; stop < 40; stop++) {
      await page.keyboard.press("Tab");
      const bottom = await page.evaluate(() => {
        const element = document.activeElement;
        if (!element || element.closest(".main-nav") || !element.closest("main")) {
          return null;
        }
        return element.getBoundingClientRect().bottom;
      });
      if (bottom !== null) {
        expect(bottom, `Tab-Stopp ${stop + 1}`).toBeLessThanOrEqual(barTop);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(10);
  });
});

test.describe("N2 Windows-Kontrastmodus", () => {
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ forcedColors: "active" });
    await openWeek(page);
  });

  test("N2 Kontrastmodus: Knöpfe und Kacheln behalten einen sichtbaren Rahmen", async ({
    page,
  }) => {
    const borders = await page.evaluate(() =>
      [".btn", ".icon-btn", ".segmented__option", ".day-button", ".tile", ".tick"].map(
        (selector) => {
          const element = document.querySelector(selector);
          const style = element && getComputedStyle(element);
          return {
            selector,
            visible:
              style !== null &&
              style.borderTopStyle !== "none" &&
              Number.parseFloat(style.borderTopWidth) >= 1,
          };
        },
      ),
    );

    for (const { selector, visible } of borders) {
      expect(visible, selector).toBe(true);
    }
  });

  test("N2 Kontrastmodus: Gewählter Filter, gewählter Tag und aktuelle Seite bleiben erkennbar", async ({
    page,
  }) => {
    const looks = await page.evaluate(() => {
      const background = (selector: string) => {
        const element = document.querySelector(selector);
        return element ? getComputedStyle(element).backgroundColor : "fehlt";
      };
      const current = document.querySelector(".main-nav__link[aria-current]");
      return {
        filterChosen: background('.segmented__option[aria-pressed="true"]'),
        filterOther: background('.segmented__option[aria-pressed="false"]'),
        dayChosen: background('.day-button[aria-pressed="true"]'),
        dayOther: background('.day-button[aria-pressed="false"]'),
        currentPage: current ? getComputedStyle(current).textDecorationLine : "fehlt",
      };
    });

    expect(looks.filterChosen).not.toBe(looks.filterOther);
    expect(looks.dayChosen).not.toBe(looks.dayOther);
    expect(looks.currentPage).toBe("underline");
  });

  test("N2 Kontrastmodus: Der Fokusrahmen bleibt sichtbar", async ({ page }) => {
    await tabTo(page, "button", "Nächste Woche");

    const outline = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement as Element);
      return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
    });
    expect(outline.style).not.toBe("none");
    expect(outline.width).toBeGreaterThanOrEqual(2);
  });
});
