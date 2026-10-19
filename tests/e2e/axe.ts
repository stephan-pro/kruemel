import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

const SCHEMES = ["light", "dark"] as const;

/**
 * Q7: the page as it is right now must have no WCAG 2.1 A/AA violations, in the light and in the
 * dark colour scheme (N8). The scheme is switched the way a device does it (`prefers-color-scheme`);
 * a scheme chosen in the settings would win, so tests that choose one check that one only.
 * Animations are off while checking, so no colour is caught halfway.
 */
export async function expectNoAccessibilityViolations(page: Page): Promise<void> {
  const wasDark = await page.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const colorScheme of SCHEMES) {
    await page.emulateMedia({ colorScheme });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations, `Farbschema ${colorScheme}`).toEqual([]);
  }
  await page.emulateMedia({ colorScheme: wasDark ? "dark" : "light", reducedMotion: null });
}
