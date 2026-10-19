import { expect, test } from "@playwright/test";
import { expectNoAccessibilityViolations } from "./axe";

test("Erster Start zeigt die Ersteinrichtung unter dem Titel „Putzplan“", async ({ page }) => {
  await page.goto("./");
  await expect(page).toHaveTitle("Ersteinrichtung – Putzplan");
  await expect(page.getByRole("heading", { level: 1, name: "Ersteinrichtung" })).toBeVisible();
  await expect(page.getByText("Putzplan", { exact: true })).toBeVisible();
});

test("Erster Start hat keine Barrierefreiheitsverstöße (axe, hell und dunkel)", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoAccessibilityViolations(page);
});
