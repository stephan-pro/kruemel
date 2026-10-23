import { type Browser, expect, type Page, test } from "@playwright/test";
import { demoData } from "../../src/demo/demoData";
import { ACCOUNT_TEXTS } from "../../src/ui/accountTexts";
import { HOUSEHOLD_TEXTS } from "../../src/ui/householdTexts";
import { createHousehold, newAddress, signInWithCode } from "./account";
import { expectNoAccessibilityViolations } from "./axe";
import {
  dataKey,
  deviceKey,
  expectPageShown,
  goToPage,
  greetingHeading,
  storedData,
  today,
} from "./helpers";
import { E2E_APP } from "./shared";

// Package E2-2e: "Ich bin" comes from the role in the household, not from a choice on the device.
// Both devices here carry data from stage 1 (names Alex and Sam, "Ich bin" = first person), so
// the role has to win over what the device remembers.

/** A new device with the data of stage 1: the demo data, "Ich bin" = first person. */
async function deviceWithData(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  await context.addInitScript(
    ({ data, device, keys }) => {
      if (localStorage.getItem(keys.data) === null) {
        localStorage.setItem(keys.data, data);
        localStorage.setItem(keys.device, device);
      }
    },
    {
      data: JSON.stringify(demoData(today())),
      device: JSON.stringify({ currentPerson: "personA" }),
      keys: { data: dataKey, device: deviceKey },
    },
  );
  return context.newPage();
}

const householdTile = (page: Page) =>
  page.getByRole("region", { name: HOUSEHOLD_TEXTS.tileTitle, exact: true });

/** Ticks off the first task the week view offers; returns the data saved on this device. */
async function tickFirstTask(page: Page) {
  await goToPage(page, "Woche", "Diese Woche");
  const before = (await storedData(page)).completions.length;
  await page
    .getByRole("button", { name: /^Abhaken:/ })
    .first()
    .click();
  await expect.poll(async () => (await storedData(page)).completions.length).toBe(before + 1);
  const { completions } = await storedData(page);
  return completions[completions.length - 1];
}

test.describe("E2-2e „Ich bin“ aus der Rolle", () => {
  test("Wer den Haushalt anlegt, ist die erste Person: Kopfzeile, Einstellungen und Abhaken", async ({
    browser,
  }) => {
    const alex = await deviceWithData(browser);
    await alex.goto(E2E_APP);
    const email = newAddress();
    await signInWithCode(alex, email);
    await expectPageShown(alex, HOUSEHOLD_TEXTS.createTitle);
    await createHousehold(alex, "Alex", "Dilan");
    await expectPageShown(alex, greetingHeading("Alex"));

    await expect(alex.getByText(ACCOUNT_TEXTS.signedInAs)).toContainText("Alex");
    await goToPage(alex, "Einstellungen");
    // Keine Auswahl „Ich bin“ und keine eigenen Namen mehr; die E-Mail-Adresse steht bei „Anmeldung“.
    await expect(alex.getByLabel("Name der ersten Person")).toHaveCount(0);
    await expect(alex.getByRole("group", { name: /Ich bin/ })).toHaveCount(0);
    await expect(householdTile(alex)).toContainText(HOUSEHOLD_TEXTS.namesFixed);
    await expect(
      alex.getByRole("region", { name: ACCOUNT_TEXTS.accountTile, exact: true }),
    ).toContainText(email);
    await expectNoAccessibilityViolations(alex);

    expect(await tickFirstTask(alex)).toMatchObject({ completedBy: "personA" });
  });

  test("Das zweite Mitglied ist die zweite Person, auch auf einem Gerät mit anderem „Ich bin“", async ({
    browser,
  }) => {
    const founder = await deviceWithData(browser);
    await founder.goto(E2E_APP);
    await signInWithCode(founder, newAddress());
    await createHousehold(founder, "Alex", "Dilan");
    await expectPageShown(founder, greetingHeading("Alex"));
    await goToPage(founder, "Einstellungen");
    await householdTile(founder)
      .getByRole("button", { name: HOUSEHOLD_TEXTS.createInvite })
      .click();
    const link = await founder.getByLabel(HOUSEHOLD_TEXTS.inviteLinkField).inputValue();

    // Das Gerät merkt sich „erste Person“ und die Namen Alex und Sam aus Etappe 1.
    const dilan = await deviceWithData(browser);
    await dilan.goto(link);
    await signInWithCode(dilan, newAddress());
    await expectPageShown(dilan, HOUSEHOLD_TEXTS.acceptTitle);
    await dilan.getByRole("button", { name: HOUSEHOLD_TEXTS.accept }).click();

    // Die Rolle und die Namen des Haushalts gelten, nicht die des Geräts.
    await expectPageShown(dilan, greetingHeading("Dilan"));
    await expect(dilan.getByText(ACCOUNT_TEXTS.signedInAs)).toContainText("Dilan");
    await goToPage(dilan, "Einstellungen");
    await expect(dilan.getByLabel("Name der ersten Person")).toHaveCount(0);
    await expect(householdTile(dilan).locator('[data-person="personB"]')).toContainText(
      "Dilan (du)",
    );
    await expectNoAccessibilityViolations(dilan);

    expect(await tickFirstTask(dilan)).toMatchObject({ completedBy: "personB" });

    // Nach dem Neuladen (und ohne zu warten, bis der Haushalt gelesen ist) dasselbe.
    await dilan.reload();
    await expect(dilan.getByText(ACCOUNT_TEXTS.signedInAs)).toContainText("Dilan");
    // Die Angabe des Geräts bleibt unberührt: die Übernahme der alten Aufgaben (E2-3d) braucht sie.
    expect(
      await dilan
        .evaluate((key) => localStorage.getItem(key), deviceKey)
        .then((v) => JSON.parse(v ?? "{}")),
    ).toMatchObject({ currentPerson: "personA" });
  });
});
