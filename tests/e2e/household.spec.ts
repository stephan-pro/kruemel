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

// The tile's title is the household's name once it has one (E2-4c): found by its heading's id.
const householdTile = (page: Page) => page.locator('section[aria-labelledby="haushalt"]');
const linkField = (page: Page) => page.getByLabel(HOUSEHOLD_TEXTS.secondPersonLinkField);
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
    await expect(tile.getByRole("status").first()).toHaveText(HOUSEHOLD_TEXTS.copied);
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
    await expect(dilan.getByText(ACCOUNT_TEXTS.signedInAs)).toContainText("Dilan");
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
    // K2c: a link for friends in this field is recognised and explained.
    await field.fill(
      "https://beispiel.de/kruemel/#/freunde/abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",
    );
    await page.getByRole("button", { name: HOUSEHOLD_TEXTS.openInvite }).click();
    await expect(field).toHaveAccessibleDescription(HOUSEHOLD_TEXTS.friendLinkHere);
    await expectNoAccessibilityViolations(page);

    await page.getByRole("button", { name: HOUSEHOLD_TEXTS.create }).click();
    await expectPageShown(page, greetingHeading("Alex"));
  });
});

const householdNameField = (page: Page) =>
  householdTile(page).getByLabel(HOUSEHOLD_TEXTS.householdNameLabel);
const ownNameField = (page: Page) => householdTile(page).getByLabel(HOUSEHOLD_TEXTS.ownNameLabel);
const saveNamesButton = (page: Page) =>
  householdTile(page).getByRole("button", { name: HOUSEHOLD_TEXTS.saveNames });
const namesStatus = (page: Page) =>
  householdTile(page).getByRole("form", { name: HOUSEHOLD_TEXTS.namesTitle }).getByRole("status");

test.describe("E2-3g Namen ändern", () => {
  test("Eigenen Namen und Namen des Haushalts ändern; die andere Person sieht beides", async ({
    browser,
  }) => {
    const alex = await founder(browser);
    const dilan = await invited(browser, await inviteLink(alex));
    await acceptButton(dilan.page).click();
    await expectPageShown(dilan.page, greetingHeading("Dilan"));

    await expect(householdNameField(alex)).toHaveValue("");
    await expect(ownNameField(alex)).toHaveValue("Alex");
    await householdNameField(alex).fill("  WG Sonnenweg ");
    await ownNameField(alex).fill("Alexa");
    await saveNamesButton(alex).click();
    await expect(namesStatus(alex)).toHaveText(HOUSEHOLD_TEXTS.namesSaved);
    await expect(householdNameField(alex)).toHaveValue("WG Sonnenweg");
    // Die Kopfzeile (in den Einstellungen steht „Angemeldet als“ auch bei „Anmeldung“).
    await expect(alex.locator(".app-person")).toHaveText(`${ACCOUNT_TEXTS.signedInAs} Alexa`);
    await expect(householdTile(alex).locator('[data-person="personA"]')).toHaveText(
      /Alexa \(du\)\s*dabei/,
    );
    await expectNoAccessibilityViolations(alex);

    // Dilan sieht beides in den Einstellungen und ändert den eigenen Namen.
    await goToPage(dilan.page, "Einstellungen");
    await expect(householdNameField(dilan.page)).toHaveValue("WG Sonnenweg");
    await expect(householdTile(dilan.page).locator('[data-person="personA"]')).toHaveText(
      /Alexa\s*dabei/,
    );
    await ownNameField(dilan.page).fill("Dila");
    await saveNamesButton(dilan.page).click();
    await expect(namesStatus(dilan.page)).toHaveText(HOUSEHOLD_TEXTS.namesSaved);

    // Alex sieht den neuen Namen ohne Neuladen; der eigene Name bleibt.
    await expect(householdTile(alex).locator('[data-person="personB"]')).toHaveText(/Dila\s*dabei/);
    await expect(ownNameField(alex)).toHaveValue("Alexa");
  });

  test("Namen ändern: Meldungen am Feld; ohne Netz wartet der eigene Name, der des Haushalts nicht", async ({
    browser,
  }) => {
    const alex = await founder(browser);
    await goToPage(alex, "Einstellungen");

    await ownNameField(alex).fill(" ");
    await saveNamesButton(alex).click();
    await expect(ownNameField(alex)).toBeFocused();
    await expect(ownNameField(alex)).toHaveAttribute("aria-invalid", "true");
    await expect(ownNameField(alex)).toHaveAccessibleDescription(/Bitte einen Namen eingeben\./);

    await ownNameField(alex).fill("dilan");
    await saveNamesButton(alex).click();
    await expect(ownNameField(alex)).toHaveAccessibleDescription(
      /Die beiden Namen müssen sich unterscheiden\./,
    );

    await householdNameField(alex).fill("x".repeat(31));
    await saveNamesButton(alex).click();
    await expect(householdNameField(alex)).toBeFocused();
    await expect(householdNameField(alex)).toHaveAccessibleDescription(
      new RegExp(HOUSEHOLD_MESSAGES.invalidHouseholdName),
    );
    await expectNoAccessibilityViolations(alex);

    await alex.context().setOffline(true);
    await householdNameField(alex).fill("Zuhause");
    await ownNameField(alex).fill("Alexa");
    await saveNamesButton(alex).click();
    const alert = householdTile(alex).getByRole("alert");
    await expect(alert).toContainText(HOUSEHOLD_TEXTS.householdNameFailed);
    await expect(alert).toContainText(HOUSEHOLD_MESSAGES.offline);
    // Die Kopfzeile (in den Einstellungen steht „Angemeldet als“ auch bei „Anmeldung“).
    await expect(alex.locator(".app-person")).toHaveText(`${ACCOUNT_TEXTS.signedInAs} Alexa`);
    await expect(householdNameField(alex)).toHaveValue("Zuhause");

    // Wieder mit Netz: derselbe Knopf speichert den Haushaltsnamen, der eigene ist übertragen.
    await alex.context().setOffline(false);
    await saveNamesButton(alex).click();
    await expect(namesStatus(alex)).toHaveText(HOUSEHOLD_TEXTS.namesSaved);
    await expect(alert).toHaveCount(0);
    await alex.reload();
    await expect(alex.getByRole("heading", { level: 1, name: "Einstellungen" })).toBeVisible();
    await expect(householdNameField(alex)).toHaveValue("Zuhause");
    await expect(ownNameField(alex)).toHaveValue("Alexa");
  });
});

// E2-4c: the household's name in the header and as the title of the tile.
const headerHousehold = (page: Page) => page.locator(".app-household");
const tileTitle = (page: Page) => householdTile(page).getByRole("heading", { level: 2 }).first();

test.describe("E2-4c Haushaltsname anzeigen", () => {
  test("Ohne Namen steht „Haushalt“ in der Kachel und nichts in der Kopfzeile", async ({
    browser,
  }) => {
    const alex = await founder(browser);
    await expect(headerHousehold(alex)).toHaveCount(0);
    await goToPage(alex, "Einstellungen");
    await expect(tileTitle(alex)).toHaveText(HOUSEHOLD_TEXTS.tileTitle);
  });

  test("Mit Namen: Kachel-Überschrift und Kopfzeile; die andere Person sieht Änderungen ohne Neuladen", async ({
    browser,
  }) => {
    const alex = await founder(browser);
    const dilan = await invited(browser, await inviteLink(alex));
    await acceptButton(dilan.page).click();
    await expectPageShown(dilan.page, greetingHeading("Dilan"));

    // `inviteLink` left Alex in the settings.
    await householdNameField(alex).fill("WG Sonnenweg");
    await saveNamesButton(alex).click();
    await expect(namesStatus(alex)).toHaveText(HOUSEHOLD_TEXTS.namesSaved);
    await expect(tileTitle(alex)).toHaveText("WG Sonnenweg");
    await expect(headerHousehold(alex)).toHaveText("WG Sonnenweg");
    await expectNoAccessibilityViolations(alex);

    // Dilan sieht ihn nach dem nächsten Abgleich (hier: beim Zurückkehren in die App).
    await dilan.page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect(headerHousehold(dilan.page)).toHaveText("WG Sonnenweg");
    await goToPage(dilan.page, "Einstellungen");
    await expect(tileTitle(dilan.page)).toHaveText("WG Sonnenweg");

    // Dilan ändert ihn nur; Alex sieht den neuen Namen, ohne neu zu laden.
    await householdNameField(dilan.page).fill("Zuhause");
    await saveNamesButton(dilan.page).click();
    await expect(namesStatus(dilan.page)).toHaveText(HOUSEHOLD_TEXTS.namesSaved);
    await alex.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect(headerHousehold(alex)).toHaveText("Zuhause");
    await expect(tileTitle(alex)).toHaveText("Zuhause");

    // Leer gemacht: wieder „Haushalt“, nichts in der Kopfzeile.
    await householdNameField(dilan.page).fill("");
    await saveNamesButton(dilan.page).click();
    await expect(namesStatus(dilan.page)).toHaveText(HOUSEHOLD_TEXTS.namesSaved);
    await alex.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect(headerHousehold(alex)).toHaveCount(0);
    await expect(tileTitle(alex)).toHaveText(HOUSEHOLD_TEXTS.tileTitle);
  });

  test("Ein langer Name wird in der Kopfzeile gekürzt, am Handy bleibt die Seite ohne Querlauf", async ({
    browser,
  }) => {
    const alex = await founder(browser);
    await goToPage(alex, "Einstellungen");
    const long = "Wohngemeinschaft Sonnenweg 12";
    await householdNameField(alex).fill(long);
    await saveNamesButton(alex).click();
    await expect(namesStatus(alex)).toHaveText(HOUSEHOLD_TEXTS.namesSaved);

    // Am PC: Seitenleiste, der Name steht unter „Krümel“, einzeilig mit „…“.
    await alex.setViewportSize({ width: 1280, height: 800 });
    const household = headerHousehold(alex);
    await expect(household).toHaveAttribute("title", long);
    const box = await household.evaluate((element) => ({
      clipped: element.scrollWidth > element.clientWidth,
      ellipsis: getComputedStyle(element).textOverflow,
    }));
    expect(box).toEqual({ clipped: true, ellipsis: "ellipsis" });

    // Am Handy: schmale Zeile über der Überschrift, nichts läuft über den Rand.
    await alex.setViewportSize({ width: 360, height: 640 });
    await expect(household).toBeVisible();
    const phone = await alex.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      brandHeight: document.querySelector(".app-brand")?.getBoundingClientRect().height ?? 0,
    }));
    expect(phone.overflow).toBe(false);
    expect(phone.brandHeight).toBeLessThanOrEqual(40);
    await expectNoAccessibilityViolations(alex);
  });
});
