import { expect, test } from "@playwright/test";
import { expectNoAccessibilityViolations } from "./axe";
import { goToPage, greetingHeading, startConfigured } from "./helpers";

test("Erster Start zeigt die Ersteinrichtung unter dem Titel „Krümel“", async ({ page }) => {
  await page.goto("./");
  await expect(page).toHaveTitle("Ersteinrichtung – Krümel");
  await expect(page.getByRole("heading", { level: 1, name: "Ersteinrichtung" })).toBeVisible();
  await expect(page.getByText("Krümel", { exact: true })).toBeVisible();
});

test("Erster Start hat keine Barrierefreiheitsverstöße (axe, hell und dunkel)", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expectNoAccessibilityViolations(page);
});

// Runs in every browser and size of `npm run check:full` (see playwright.config.ts): the main pages
// must open and pass axe everywhere, not only in Chromium on the desktop.
test("Die Hauptseiten öffnen sich und haben keine Barrierefreiheitsverstöße (axe, hell und dunkel)", async ({
  page,
}) => {
  await startConfigured(page);
  await expect(page.getByRole("heading", { level: 1, name: "Diese Woche" })).toBeVisible();
  await expectNoAccessibilityViolations(page);
  await goToPage(page, "Heute", greetingHeading());
  await expectNoAccessibilityViolations(page);
  for (const title of ["Statistik", "Aufgaben", "Erledigt", "Einstellungen"]) {
    await goToPage(page, title);
    await expectNoAccessibilityViolations(page);
  }
});
