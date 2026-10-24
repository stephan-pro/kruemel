import { expect, type Page, test } from "@playwright/test";
import { demoData } from "../../src/demo/demoData";
import { APPEARANCE_TEXTS } from "../../src/ui/appearanceTexts";
import { expectNoAccessibilityViolations } from "./axe";
import { deviceKey, goToPage, startConfigured, startShared, storedData, today } from "./helpers";

// Package R1: the own design (N1, DESIGN.md) and the colour scheme setting (N8).

// Minimal Node typing instead of @types/node, as in playwright.config.ts (only to know CI).
declare const process: { env: Record<string, string | undefined> };

// The page background of the two themes (DESIGN.md: --bg).
const LIGHT_BG = "rgb(243, 242, 248)";
const DARK_BG = "rgb(11, 16, 34)";

async function background(page: Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

async function storedDevice(page: Page): Promise<unknown> {
  return JSON.parse((await page.evaluate((key) => localStorage.getItem(key), deviceKey)) ?? "null");
}

const schemeChoice = (page: Page, name: string) =>
  page.getByRole("group", { name: "Farbschema" }).getByRole("radio", { name });

test.describe("N8 Farbschema Hell / Dunkel / Automatisch", () => {
  test("N8 Ohne Auswahl folgt die App dem Gerät („Automatisch“)", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await startConfigured(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    expect(await background(page)).toBe(DARK_BG);
    await page.emulateMedia({ colorScheme: "light" });
    expect(await background(page)).toBe(LIGHT_BG);

    await goToPage(page, "Einstellungen");
    await expect(schemeChoice(page, "Automatisch (wie das Gerät)")).toBeChecked();
  });

  test("N8 „Dunkel“ wirkt sofort, auch auf einem hellen Gerät, und bleibt nach dem Neuladen", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await startConfigured(page);
    await goToPage(page, "Einstellungen");

    await schemeChoice(page, "Dunkel").check();

    expect(await background(page)).toBe(DARK_BG);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await storedDevice(page)).toEqual({ colorScheme: "dark" });
    await expectNoAccessibilityViolations(page);

    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Einstellungen" })).toBeVisible();
    expect(await background(page)).toBe(DARK_BG);
    await expect(schemeChoice(page, "Dunkel")).toBeChecked();
  });

  test("N8 „Hell“ wirkt auch auf einem dunklen Gerät; „Automatisch“ folgt wieder dem Gerät", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await startConfigured(page);
    await goToPage(page, "Einstellungen");

    await schemeChoice(page, "Hell").check();
    expect(await background(page)).toBe(LIGHT_BG);
    await expectNoAccessibilityViolations(page);

    await schemeChoice(page, "Automatisch (wie das Gerät)").check();
    expect(await background(page)).toBe(DARK_BG);
    await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.*/);
    expect(await storedDevice(page)).toEqual({ colorScheme: "auto" });
  });

  test("N8 Kein Aufblitzen: das gewählte Farbschema gilt, bevor die App überhaupt startet", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await startShared(page, demoData(today()), "", { device: { colorScheme: "dark" } });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    // Without the app's script: only the page itself and its stylesheet.
    await page.route("**/assets/*.js", (route) => route.abort());

    await page.reload();

    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await background(page)).toBe(DARK_BG);
  });

  test("N8 Das Farbschema gehört zum Gerät und steht nicht in den Daten der Sicherung", async ({
    page,
  }) => {
    await startConfigured(page);
    await goToPage(page, "Einstellungen");

    await schemeChoice(page, "Dunkel").check();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    expect(JSON.stringify(await storedData(page))).not.toContain("colorScheme");
  });

  test("N8 Die Auswahl hat eine sichtbare Beschriftung und geht mit der Tastatur", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await startConfigured(page);
    await goToPage(page, "Einstellungen");
    await expect(page.locator("legend", { hasText: "Farbschema" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Darstellung" })).toBeVisible();

    await schemeChoice(page, "Hell").focus();
    await page.keyboard.press("ArrowDown");

    await expect(schemeChoice(page, "Dunkel")).toBeChecked();
    expect(await background(page)).toBe(DARK_BG);
  });

  test("N8 Ein voller Speicher wird gemeldet; das Farbschema bleibt dann, wie es war", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "light" });
    await startConfigured(page);
    await goToPage(page, "Einstellungen");
    await page.evaluate(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("voll", "QuotaExceededError");
      };
    });

    // `click`, not `check`: the choice does not stay, which is the point here.
    await schemeChoice(page, "Dunkel").click();

    await expect(page.getByRole("alert")).toContainText("Nicht gespeichert");
    expect(await background(page)).toBe(LIGHT_BG);
    await expect(schemeChoice(page, "Automatisch (wie das Gerät)")).toBeChecked();
  });
});

test.describe("N1 Eigenes Design", () => {
  test("N1 Die Schrift Archivo kommt von der App selbst, nicht von Google Fonts", async ({
    page,
  }) => {
    const requests: string[] = [];
    page.on("request", (request) => requests.push(request.url()));

    await startConfigured(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const loaded = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].some(
        (font) => font.family.includes("Archivo") && font.status === "loaded",
      );
    });

    expect(loaded).toBe(true);
    expect(requests.some((url) => /\/kruemel\/assets\/archivo-.*\.woff2$/.test(url))).toBe(true);
    expect(requests.filter((url) => !url.startsWith("http://localhost:"))).toEqual([]);
  });

  test("N1 Navigation: am Handy eine schwebende Leiste unten, am PC eine Spalte links", async ({
    page,
    isMobile,
  }) => {
    await startConfigured(page);
    const nav = page.getByRole("navigation", { name: "Hauptnavigation" });
    await expect(nav).toBeVisible();

    const box = await nav.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    if (box === null || viewport === null) {
      return;
    }
    if (isMobile) {
      // 16 px Rand links und rechts, 18 px über dem unteren Rand, 68 px hoch (DESIGN.md Abschnitt 7).
      expect(Math.round(box.y + box.height)).toBe(viewport.height - 18);
      expect(Math.round(box.x)).toBe(16);
      expect(Math.round(box.width)).toBe(viewport.width - 32);
      expect(Math.round(box.height)).toBe(68);
    } else {
      expect(box.x).toBeLessThan(40);
      expect(box.width).toBeLessThan(260);
    }
  });

  test("N2 Der Fokus ist in beiden Farbschemata deutlich sichtbar", async ({ page, isMobile }) => {
    test.skip(isMobile, "Tastaturbedienung wird am Desktop geprüft");
    await startConfigured(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    for (const [colorScheme, accent] of [
      ["light", "rgb(85, 48, 217)"],
      ["dark", "rgb(183, 166, 255)"],
    ] as const) {
      await page.emulateMedia({ colorScheme });
      await page.keyboard.press("Tab");
      const skip = page.getByRole("button", { name: "Zum Inhalt springen" });
      await expect(skip).toBeFocused();
      const outline = await skip.evaluate((element) => {
        const style = getComputedStyle(element);
        return `${style.outlineStyle} ${style.outlineWidth} ${style.outlineColor}`;
      });
      expect(outline).toBe(`solid 3px ${accent}`);
      await page.keyboard.press("Shift+Tab");
    }
  });

  test("N2 Tippflächen sind mindestens 44 × 44 Pixel groß", async ({ page }) => {
    await startConfigured(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // K2c: not only the start page; links inside running text are exempt (WCAG 2.5.8).
    for (const link of [undefined, "Statistik", "Einstellungen"]) {
      if (link !== undefined) {
        await goToPage(page, link, link === "Statistik" ? "Eure Bilanz" : link);
      }
      const small = await page.evaluate(() =>
        [...document.querySelectorAll("main button, main a:not(p a), nav a")]
          .filter((element) => (element as HTMLElement).offsetParent !== null)
          .map((element) => {
            const { width, height } = element.getBoundingClientRect();
            return { name: element.textContent?.trim(), width, height };
          })
          .filter(({ width, height }) => width < 44 || height < 44),
      );

      expect(small, link ?? "Woche").toEqual([]);
    }
  });
});

// E2-4c: the Krümel in the header and the switch "Krümel bewegt sich".

const logo = (page: Page) => page.locator(".app-header .kruemel-logo");
const logoSwitch = (page: Page) =>
  page.getByRole("switch", { name: APPEARANCE_TEXTS.logoMotionLabel });

/** How many animations run on the Krümel of the header (the CSS ones count, also while waiting). */
async function logoAnimations(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      document
        .getAnimations()
        .filter((animation) =>
          (animation.effect as KeyframeEffect | null)?.target?.closest(".kruemel-logo"),
        ).length,
  );
}

test.describe("E2-4c Krümel in der Kopfzeile", () => {
  for (const scheme of ["light", "dark"] as const) {
    test(`E2-4c Der Krümel ist Schmuck (stumm), bewegt sich und verschiebt nichts (${scheme})`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await startConfigured(page, undefined, "#/heute");
      await expect(logo(page)).toBeAttached();
      await expect(logo(page)).toHaveAttribute("aria-hidden", "true");
      // The name stays text; the picture adds nothing to the accessibility tree.
      await expect(page.locator(".app-header").getByText("Krümel", { exact: true })).toBeAttached();
      // It starts to move once the app has loaded its settings.
      await expect.poll(() => logoAnimations(page)).toBeGreaterThan(0);

      const layout = () =>
        page.evaluate(() =>
          [".kruemel-logo", ".app-name", "main"].map((selector) => {
            const { x, y, width, height } = (
              document.querySelector(selector) as Element
            ).getBoundingClientRect();
            return [selector, x, y, width, height];
          }),
        );
      const before = await layout();
      await page.waitForTimeout(900);
      expect(await layout()).toEqual(before);
      await expectNoAccessibilityViolations(page);
    });
  }

  test("E2-4c Bei „Bewegung reduzieren“ des Geräts steht der Krümel still", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await startConfigured(page, undefined, "#/heute");
    await expect(logo(page)).toBeAttached();
    expect(await logoAnimations(page)).toBe(0);
  });

  test("E2-4c Der Schalter „Krümel bewegt sich“: per Tastatur aus und an, bleibt nach dem Neuladen", async ({
    page,
    browserName,
  }) => {
    // Known exception, only WebKit on GitHub (Linux): after reloading with the switch off and
    // switching it on again, WebKit there starts no animation, although the class is right (trace).
    // Locally (WebKit on Windows) and in Chromium everywhere the test passes. Cause not found yet:
    // backlog in docs/PLAN.md, "check-full rot (seit 24.10.2026, nur GitHub)".
    test.fixme(
      browserName === "webkit" && Boolean(process.env.CI),
      "WebKit in CI startet die Animation nach dem Wiedereinschalten nicht (Backlog docs/PLAN.md)",
    );
    await startConfigured(page, undefined, "#/heute");
    await expect.poll(() => logoAnimations(page)).toBeGreaterThan(0);
    await goToPage(page, "Einstellungen");

    await expect(logoSwitch(page)).toBeChecked();
    await expect(logoSwitch(page)).toHaveAccessibleDescription(APPEARANCE_TEXTS.logoMotionHint);
    await logoSwitch(page).focus();
    await expect(logoSwitch(page)).toBeFocused();
    await page.keyboard.press("Space");
    await expect(logoSwitch(page)).not.toBeChecked();
    await expect.poll(() => logoAnimations(page)).toBe(0);
    expect(await storedDevice(page)).toMatchObject({ logoMotion: false });

    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Einstellungen" })).toBeVisible();
    await expect(logoSwitch(page)).not.toBeChecked();
    expect(await logoAnimations(page)).toBe(0);

    for (const scheme of ["light", "dark"] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      await expectNoAccessibilityViolations(page);
    }

    await logoSwitch(page).focus();
    await page.keyboard.press("Space");
    await expect(logoSwitch(page)).toBeChecked();
    await expect.poll(() => logoAnimations(page)).toBeGreaterThan(0);
    expect(await storedDevice(page)).not.toHaveProperty("logoMotion");
  });

  test("E2-4c Am Handy ist die Kopfzeile eine schmale Zeile, ohne Umbruch und Querlauf", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await startConfigured(page, undefined, "#/heute");
    await expect(logo(page)).toBeVisible();
    const { height, scrolls } = await page.evaluate(() => ({
      height: document.querySelector(".app-brand")?.getBoundingClientRect().height ?? 0,
      scrolls: document.documentElement.scrollWidth > document.documentElement.clientWidth,
    }));
    expect(height).toBeLessThanOrEqual(40);
    expect(scrolls).toBe(false);
  });
});
