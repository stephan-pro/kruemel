import { type Browser, expect, type Page, test } from "@playwright/test";
import { ACCOUNT_TEXTS } from "../../src/ui/accountTexts";
import { HOUSEHOLD_TEXTS } from "../../src/ui/householdTexts";
import {
  IMPRINT_SECTIONS,
  LEGAL_CONTACT,
  LEGAL_DATE,
  LEGAL_TEXTS,
  MAIL_PROVIDER_SECTION,
  PRIVACY_SECTIONS,
} from "../../src/ui/legalTexts";
import { createHousehold, newAddress, signInWithCode } from "./account";
import { expectNoAccessibilityViolations } from "./axe";
import { expectPageShown, goToPage, greetingHeading } from "./helpers";
import { E2E_APP } from "./shared";

// Package E2-5c: Impressum and Datenschutzerklärung. Both open without signing in, are linked
// from the sign-in, invite and household pages and from the settings, and work without a
// connection. The personal details are placeholders in square brackets (the repository is public).

const imprintLink = (page: Page) =>
  page.getByRole("link", { name: LEGAL_TEXTS.imprintLink, exact: true });
const privacyLink = (page: Page) =>
  page.getByRole("link", { name: LEGAL_TEXTS.privacyLink, exact: true });
const backButton = (page: Page) =>
  page.getByRole("button", { name: LEGAL_TEXTS.back, exact: true });

async function newDevice(browser: Browser): Promise<Page> {
  const context = await browser.newContext();
  return context.newPage();
}

test.describe("E2-5c Impressum und Datenschutzerklärung", () => {
  test("ohne Anmeldung erreichbar: Link von der Anmeldeseite, Überschrift mit Fokus, Zurück", async ({
    page,
  }) => {
    await page.goto(E2E_APP);
    await expectSignIn(page);

    await imprintLink(page).click();
    await expectPageShown(page, "Impressum");
    await expect(page).toHaveTitle(/^Impressum – Krümel$/);
    await expect(page).toHaveURL(/#\/impressum$/);
    await expect(page.getByText(LEGAL_TEXTS.stateLabel(LEGAL_DATE))).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Hauptnavigation" })).toHaveCount(0);

    await backButton(page).click();
    await expectSignIn(page);

    await privacyLink(page).click();
    await expectPageShown(page, "Datenschutzerklärung");
    await expect(page).toHaveTitle(/^Datenschutzerklärung – Krümel$/);
    await page.goBack();
    await expectSignIn(page);
  });

  test("Adresse direkt geöffnet: Inhalt, Platzhalter statt persönlicher Angaben, eigener Abschnitt zum Mailanbieter", async ({
    page,
  }) => {
    await page.goto(`${E2E_APP}#/datenschutz`);
    await expect(
      page.getByRole("heading", { level: 1, name: "Datenschutzerklärung" }),
    ).toBeVisible();
    for (const section of PRIVACY_SECTIONS) {
      await expect(page.getByRole("heading", { level: 2, name: section.title })).toBeVisible();
    }
    // The part about the mail provider is a section of its own.
    await expect(page.getByRole("region", { name: MAIL_PROVIDER_SECTION.title })).toContainText(
      "Google",
    );
    await expect(page.getByText("Kavalleriestraße 2–4, 40213 Düsseldorf")).toBeVisible();
    await expect(page.getByText("www.ldi.nrw.de")).toBeVisible();
    // No external addresses are loaded: only the app's own and the Landesbeauftragte's name.
    await expect(page.locator("a[href^='http']")).toHaveCount(0);

    await imprintLink(page).click();
    for (const section of IMPRINT_SECTIONS) {
      await expect(page.getByRole("heading", { level: 2, name: section.title })).toBeVisible();
    }
    await expect(page.getByText(LEGAL_CONTACT.email).first()).toBeVisible();
    await expect(page.getByText(LEGAL_CONTACT.name).first()).toBeVisible();
  });

  test("Tastatur: Links erreichbar, Zurück mit Enter", async ({ page }) => {
    await page.goto(E2E_APP);
    await expectSignIn(page);
    await imprintLink(page).focus();
    await page.keyboard.press("Enter");
    await expectPageShown(page, "Impressum");

    await page.keyboard.press("Tab");
    await expect(backButton(page)).toBeFocused();
    await page.keyboard.press("Enter");
    await expectSignIn(page);
  });

  test("Hell und Dunkel ohne axe-Verstöße, am Handy (360 px) ohne Seitwärtsrollen", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    for (const hash of ["#/impressum", "#/datenschutz"]) {
      await page.goto(`${E2E_APP}${hash}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoAccessibilityViolations(page);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
      await expect(backButton(page)).toBeVisible();
    }
  });

  test("Die Anmeldeseite mit Links besteht die axe-Prüfung", async ({ page }) => {
    await page.goto(E2E_APP);
    await expectSignIn(page);
    await expectNoAccessibilityViolations(page);
  });

  test("Links auch von „Haushalt anlegen“, der Einladungsseite und den Einstellungen; ohne Netz", async ({
    browser,
  }) => {
    const alex = await newDevice(browser);
    await alex.goto(E2E_APP);
    await signInWithCode(alex, newAddress());
    await expectPageShown(alex, HOUSEHOLD_TEXTS.createTitle);

    await expect(imprintLink(alex)).toBeVisible();
    await privacyLink(alex).click();
    await expectPageShown(alex, "Datenschutzerklärung");
    await backButton(alex).click();
    await expectPageShown(alex, HOUSEHOLD_TEXTS.createTitle);

    await createHousehold(alex, "Alex", "Dilan");
    await expectPageShown(alex, greetingHeading("Alex"));
    await goToPage(alex, "Einstellungen");
    const tile = alex.locator('section[aria-labelledby="rechtliches"]');
    await expect(tile.getByRole("heading", { name: LEGAL_TEXTS.settingsTitle })).toBeVisible();

    // Signed in, the navigation stays and "Einstellungen" is the current entry.
    await alex.context().setOffline(true);
    await tile.getByRole("link", { name: LEGAL_TEXTS.privacyLink }).click();
    await expectPageShown(alex, "Datenschutzerklärung");
    await expect(alex.getByRole("navigation", { name: "Hauptnavigation" })).toBeVisible();
    await expect(
      alex.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("link", {
        name: "Einstellungen",
      }),
    ).toHaveAttribute("aria-current", "true");
    await backButton(alex).click();
    await expectPageShown(alex, "Einstellungen");
    await alex.context().setOffline(false);
  });

  test("Die Einladungsseite verlinkt beides", async ({ browser }) => {
    const host = await newDevice(browser);
    await host.goto(E2E_APP);
    await signInWithCode(host, newAddress());
    await createHousehold(host, "Alex", "Dilan");
    await expectPageShown(host, greetingHeading("Alex"));
    await goToPage(host, "Einstellungen");
    const tile = host.locator('section[aria-labelledby="haushalt"]');
    await tile.getByRole("button", { name: HOUSEHOLD_TEXTS.createInvite }).click();
    const link = await host.getByLabel(HOUSEHOLD_TEXTS.secondPersonLinkField).inputValue();

    const guest = await newDevice(browser);
    await guest.goto(link);
    await signInWithCode(guest, newAddress());
    await expectPageShown(guest, HOUSEHOLD_TEXTS.acceptTitle);
    await expect(imprintLink(guest)).toBeVisible();
    await imprintLink(guest).click();
    await expectPageShown(guest, "Impressum");
    await backButton(guest).click();
    await expectPageShown(guest, HOUSEHOLD_TEXTS.acceptTitle);
  });
});

async function expectSignIn(page: Page) {
  await expect(
    page.getByRole("heading", { level: 1, name: ACCOUNT_TEXTS.signInTitle }),
  ).toBeVisible();
}
