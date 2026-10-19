import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/** Q7: the page as it is right now must have no WCAG 2.1 A/AA violations. */
export async function expectNoAccessibilityViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
}
