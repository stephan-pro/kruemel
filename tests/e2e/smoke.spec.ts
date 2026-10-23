import { expect, test } from "@playwright/test";
import { expectNoAccessibilityViolations } from "./axe";
import { goToPage, greetingHeading, startConfigured } from "./helpers";
import { E2E_APP } from "./shared";

// Runs in every browser and size of `npm run check:full` (see playwright.config.ts). As in real use
// (E2-3e): the first start asks for a sign-in, a member sees the shared data. The first setup of
// the mode `local` and its axe check are in `app.spec.ts`.

test("Erster Start zeigt die Anmeldung unter dem Titel „Krümel“, ohne Barrierefreiheitsverstöße", async ({
  page,
}) => {
  await page.goto(E2E_APP);
  await expect(page).toHaveTitle("Anmelden – Krümel");
  await expect(page.getByRole("heading", { level: 1, name: "Anmelden" })).toBeVisible();
  await expect(page.getByText("Krümel", { exact: true })).toBeVisible();
  await expectNoAccessibilityViolations(page);
});

// The main pages must open and pass axe everywhere, not only in Chromium on the desktop.
test("Die Hauptseiten öffnen sich und haben keine Barrierefreiheitsverstöße (axe, hell und dunkel)", async ({
  page,
}) => {
  await startConfigured(page);
  await expect(page.getByRole("heading", { level: 1, name: "Diese Woche" })).toBeVisible();
  await expectNoAccessibilityViolations(page);
  await goToPage(page, "Heute", greetingHeading());
  await expectNoAccessibilityViolations(page);
  await goToPage(page, "Statistik", "Eure Bilanz");
  await expectNoAccessibilityViolations(page);
  for (const title of ["Aufgaben", "Erledigt", "Einstellungen"]) {
    await goToPage(page, title);
    await expectNoAccessibilityViolations(page);
  }
});
