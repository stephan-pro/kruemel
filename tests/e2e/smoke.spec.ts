import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("Startseite zeigt die Überschrift „Putzplan“", async ({ page }) => {
  await page.goto("./");
  await expect(page).toHaveTitle("Putzplan");
  await expect(page.getByRole("heading", { level: 1, name: "Putzplan" })).toBeVisible();
});

test("Startseite hat keine Barrierefreiheitsverstöße (axe)", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations).toEqual([]);
});
