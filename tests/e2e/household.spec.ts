import { type Browser, expect, type Page, test } from "@playwright/test";
import { HOUSEHOLD_MESSAGES } from "../../src/auth/household";
import { ACCOUNT_TEXTS } from "../../src/ui/accountTexts";
import { HOUSEHOLD_TEXTS, INVITE_FAILURE_TITLES } from "../../src/ui/householdTexts";
import { createHousehold, newAddress, signInWithCode } from "./account";
import { expectNoAccessibilityViolations } from "./axe";
import { expectPageShown, goToPage, greetingHeading } from "./helpers";
import { E2E_APP, FAKE_SERVER } from "./shared";

// Package E2-2d: the household and the invite against the fake server. Each person uses a
// browser of their own (a new context: own storage, so a new device without data). The fake server
// keeps households and invites with the rules of the database (`FakeAccounts`).

/** A new device of one person, allowed to use the clipboard (for "Kopieren"). */
async function newDevice(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  return context.newPage();
}

const householdTile = (page: Page) =>
  page.getByRole("region", { name: HOUSEHOLD_TEXTS.tileTitle, exact: true });
const linkField = (page: Page) => page.getByLabel(HOUSEHOLD_TEXTS.inviteLinkField);
const createInviteButton = (page: Page) =>
  householdTile(page).getByRole("button", { name: HOUSEHOLD_TEXTS.createInvite });

/** Signs in on a new device and creates a household; returns the device on "Heute". */
async function founder(browser: Browser, own = "Alex", other = "Dilan"): Promise<Page> {
  const page = await newDevice(browser);
  await page.goto(E2E_APP);
  await signInWithCode(page, newAddress());
  await expectPageShown(page, HOUSEHOLD_TEXTS.createTitle);
  await createHousehold(page, own, other);
  await expectPageShown(page, greetingHeading(own));
  return page;
}

/** In the settings of `page`: a new invite link. */
async function inviteLink(page: Page): Promise<string> {
  if (!(await householdTile(page).isVisible())) {
    await goToPage(page, "Einstellungen");
  }
  const button = householdTile(page).getByRole("button", {
    name: new RegExp(`${HOUSEHOLD_TEXTS.createInvite}|${HOUSEHOLD_TEXTS.newInvite}`),
  });
  const before = (await linkField(page).count()) > 0 ? await linkField(page).inputValue() : "";
  await button.click();
  await expect(linkField(page)).not.toHaveValue(before);
  return linkField(page).inputValue();
}

/** Opens the link on a new device and signs in; the device is on "Einladung annehmen". */
async function invited(browser: Browser, link: string): Promise<{ page: Page; email: string }> {
  const page = await newDevice(browser);
  const email = newAddress();
  await page.goto(link);
  await signInWithCode(page, email);
  await expectPageShown(page, HOUSEHOLD_TEXTS.acceptTitle);
  return { page, email };
}

const acceptButton = (page: Page) => page.getByRole("button", { name: HOUSEHOLD_TEXTS.accept });

test.describe("E2-2d Haushalt und Einladung", () => {
  test("Haushalt anlegen, Einladungslink kopieren, die zweite Person tritt bei", async ({
    browser,
  }) => {
    const alex = await newDevice(browser);
    await alex.goto(E2E_APP);
    await signInWithCode(alex, newAddress());
    await expectPageShown(alex, HOUSEHOLD_TEXTS.createTitle);
    await expect(alex).toHaveTitle("Haushalt anlegen – Krümel");
    await expectNoAccessibilityViolations(alex);

    await createHousehold(alex, "Alex", "Dilan");

    // Ein neues Gerät übernimmt die Namen des Haushalts: keine Ersteinrichtung.
    await expectPageShown(alex, greetingHeading("Alex"));
    await goToPage(alex, "Einstellungen");
    const tile = householdTile(alex);
    await expect(tile.locator('[data-person="personA"]')).toHaveText(/Alex \(du\)\s*dabei/);
    await expect(tile.locator('[data-person="personB"]')).toHaveText(/Dilan\s*noch nicht dabei/);

    await createInviteButton(alex).click();
    await expect(linkField(alex)).toBeFocused();
    const link = await linkField(alex).inputValue();
    expect(link).toMatch(/^http:\/\/localhost:4175\/kruemel\/#\/einladung\/[A-Za-z0-9_-]{16,}$/);
    await expect(linkField(alex)).toHaveAccessibleDescription(
      /^Gültig bis \w\w\., \d\d\.\d\d\.\d{4}\.$/,
    );

    await tile.getByRole("button", { name: HOUSEHOLD_TEXTS.copy }).click();
    await expect(tile.getByRole("status")).toHaveText(HOUSEHOLD_TEXTS.copied);
    expect(await alex.evaluate(() => navigator.clipboard.readText())).toBe(link);

    await tile.getByRole("button", { name: HOUSEHOLD_TEXTS.showQr }).click();
    await expect(tile.getByRole("img", { name: HOUSEHOLD_TEXTS.qrLabel })).toHaveAttribute(
      "data-address",
      link,
    );
    await expectNoAccessibilityViolations(alex);

    const { page: dilan, email } = await invited(browser, link);
    await expect(dilan.getByText(HOUSEHOLD_TEXTS.acceptAs(email))).toBeVisible();
    await expectNoAccessibilityViolations(dilan);
    await acceptButton(dilan).click();

    await expectPageShown(dilan, greetingHeading("Dilan"));
    await expect(dilan.getByText(ACCOUNT_TEXTS.signedInAs)).toContainText(email);
    await goToPage(dilan, "Einstellungen");
    await expect(householdTile(dilan).locator('[data-person="personB"]')).toHaveText(
      /Dilan \(du\)\s*dabei/,
    );
    await expect(householdTile(dilan)).toContainText(HOUSEHOLD_TEXTS.bothJoined);
    await expect(createInviteButton(dilan)).toHaveCount(0);

    // Beim nächsten Öffnen der Einstellungen sieht Alex, dass Dilan dabei ist.
    await goToPage(alex, "Heute", greetingHeading("Alex"));
    await goToPage(alex, "Einstellungen");
    await expect(householdTile(alex)).toContainText(HOUSEHOLD_TEXTS.bothJoined);
  });

  test("Ein neuer Link macht den alten ungültig; ein benutzter Link geht kein zweites Mal", async ({
    browser,
  }) => {
    const alex = await founder(browser);
    const first = await inviteLink(alex);
    const second = await inviteLink(alex);
    await expect(householdTile(alex)).toContainText(HOUSEHOLD_TEXTS.newInviteHint);

    const late = await invited(browser, first);
    await acceptButton(late.page).click();
    await expectPageShown(late.page, INVITE_FAILURE_TITLES.inviteUnknown as string);
    await expect(late.page.getByText(HOUSEHOLD_MESSAGES.inviteUnknown)).toBeVisible();
    await expectNoAccessibilityViolations(late.page);
    await late.page.getByRole("button", { name: HOUSEHOLD_TEXTS.goOn }).click();
    await expectPageShown(late.page, HOUSEHOLD_TEXTS.createTitle);

    const dilan = await invited(browser, second);
    await acceptButton(dilan.page).click();
    await expectPageShown(dilan.page, greetingHeading("Dilan"));

    // Eingefügt statt angetippt (die installierte App am iPhone): derselbe Weg.
    await late.page.getByLabel(HOUSEHOLD_TEXTS.inviteLinkField).fill(`Hier: ${second}`);
    await late.page.getByRole("button", { name: HOUSEHOLD_TEXTS.openInvite }).click();
    await expectPageShown(late.page, HOUSEHOLD_TEXTS.acceptTitle);
    await acceptButton(late.page).click();
    await expectPageShown(late.page, INVITE_FAILURE_TITLES.inviteUsed as string);
    await expect(late.page.getByText(HOUSEHOLD_MESSAGES.inviteUsed)).toBeVisible();
  });

  test("Wer schon einen Haushalt hat, sieht das gleich beim Öffnen einer Einladung", async ({
    browser,
  }) => {
    const sam = await founder(browser, "Sam", "Kim");
    const link = await inviteLink(await founder(browser));

    await sam.goto(link);

    await expect(
      sam.getByRole("heading", { level: 1, name: INVITE_FAILURE_TITLES.alreadyMember as string }),
    ).toBeVisible();
    await expect(sam.getByText(HOUSEHOLD_MESSAGES.alreadyMember)).toBeVisible();
    await sam.getByRole("button", { name: HOUSEHOLD_TEXTS.goOn }).click();
    await expectPageShown(sam, greetingHeading("Sam"));
    // Die Einladung ist vergessen: nach dem Neuladen kommt sie nicht wieder.
    await sam.reload();
    await expect(
      sam.getByRole("heading", { level: 1, name: greetingHeading("Sam") }),
    ).toBeVisible();
  });

  test("Abgelaufene Einladung, voller Haushalt und kein Netz beim Beitreten", async ({
    browser,
  }) => {
    const link = await inviteLink(await founder(browser));
    const { page } = await invited(browser, link);
    // Sieben Tage Warten und eine dritte Person spielt die Umleitung nach (die Regeln selbst
    // prüft der Vertragstest).
    const answer = { failure: "inviteExpired" };
    await page.route(`${FAKE_SERVER}/household/accept`, (route) =>
      route.fulfill({ status: 400, json: answer }),
    );
    await acceptButton(page).click();
    await expectPageShown(page, INVITE_FAILURE_TITLES.inviteExpired as string);
    await expect(page.getByText(HOUSEHOLD_MESSAGES.inviteExpired)).toBeVisible();
    const goOn = page.getByRole("button", { name: HOUSEHOLD_TEXTS.goOn });
    await goOn.click();
    await expectPageShown(page, HOUSEHOLD_TEXTS.createTitle);

    await page.goto(link);
    await expectPageShown(page, HOUSEHOLD_TEXTS.acceptTitle);
    answer.failure = "householdFull";
    await acceptButton(page).click();
    await expectPageShown(page, INVITE_FAILURE_TITLES.householdFull as string);
    await expect(page.getByText(HOUSEHOLD_MESSAGES.householdFull)).toBeVisible();
    await goOn.click();
    await expectPageShown(page, HOUSEHOLD_TEXTS.createTitle);

    await page.goto(link);
    await expectPageShown(page, HOUSEHOLD_TEXTS.acceptTitle);
    await page.unroute(`${FAKE_SERVER}/household/accept`);
    await page.route(`${FAKE_SERVER}/household/accept`, (route) =>
      route.abort("internetdisconnected"),
    );
    await acceptButton(page).click();
    await expect(page.getByRole("alert")).toContainText(HOUSEHOLD_MESSAGES.offline);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(HOUSEHOLD_TEXTS.acceptTitle);

    // Wieder mit Netz klappt es mit demselben Link.
    await page.unroute(`${FAKE_SERVER}/household/accept`);
    await acceptButton(page).click();
    await expectPageShown(page, greetingHeading("Dilan"));
  });

  test("Haushalt anlegen: Meldungen am Feld, kein Netz, kein Einladungslink; ohne Netz beim ersten Start", async ({
    browser,
  }) => {
    const page = await newDevice(browser);
    await page.goto(E2E_APP);
    // Der Haushalt lässt sich nach der Anmeldung zuerst nicht lesen: Seite „Keine Verbindung“.
    await page.route(`${FAKE_SERVER}/household`, (route) => route.abort("internetdisconnected"));
    await signInWithCode(page, newAddress());
    await expectPageShown(page, HOUSEHOLD_TEXTS.unavailableTitle);
    await expect(page.getByRole("alert")).toContainText(HOUSEHOLD_MESSAGES.offline);
    await page.unroute(`${FAKE_SERVER}/household`);
    await page.getByRole("button", { name: HOUSEHOLD_TEXTS.retry }).click();
    await expectPageShown(page, HOUSEHOLD_TEXTS.createTitle);

    const ownName = page.getByLabel(HOUSEHOLD_TEXTS.ownNameLabel);
    await page.getByRole("button", { name: HOUSEHOLD_TEXTS.create }).click();
    await expect(ownName).toBeFocused();
    await expect(ownName).toHaveAttribute("aria-invalid", "true");
    await expect(ownName).toHaveAccessibleDescription("Bitte einen Namen eingeben.");

    await page.route(`${FAKE_SERVER}/household/create`, (route) =>
      route.abort("internetdisconnected"),
    );
    await createHousehold(page, "Alex", "Dilan");
    await expect(page.getByRole("alert")).toContainText(HOUSEHOLD_MESSAGES.offline);
    await page.unroute(`${FAKE_SERVER}/household/create`);

    const field = page.getByLabel(HOUSEHOLD_TEXTS.inviteLinkField);
    await field.fill("https://beispiel.de/kruemel/");
    await page.getByRole("button", { name: HOUSEHOLD_TEXTS.openInvite }).click();
    await expect(field).toBeFocused();
    await expect(field).toHaveAccessibleDescription(HOUSEHOLD_TEXTS.notAnInvite);
    await expectNoAccessibilityViolations(page);

    await page.getByRole("button", { name: HOUSEHOLD_TEXTS.create }).click();
    await expectPageShown(page, greetingHeading("Alex"));
  });
});
