import { type Browser, expect, type Page, test } from "@playwright/test";
import { AUTH_MESSAGES } from "../../src/auth/auth";
import { HOUSEHOLD_MESSAGES } from "../../src/auth/household";
import { ACCOUNT_TEXTS } from "../../src/ui/accountTexts";
import { FRIEND_TEXTS, HOUSEHOLD_TEXTS } from "../../src/ui/householdTexts";
import {
  codeField,
  createHousehold,
  emailField,
  enterCode,
  mailedCode,
  newAddress,
  signInWithCode,
} from "./account";
import { expectNoAccessibilityViolations } from "./axe";
import { expectPageShown, goToPage, greetingHeading } from "./helpers";
import { E2E_APP, FAKE_SERVER } from "./shared";

// Package E2-5b: new accounts only with an invite, against the fake server (its gate follows the
// database's `before_user_created`, `FakeAccounts.admit`). "Freunde einladen" in the settings makes
// a link with which somebody gets an account and a household of their own; the household link
// lets one new account in as well. Without a valid invite an unknown address gets no code.

/** A new device of one person, allowed to use the clipboard (for "Kopieren"). */
async function newDevice(browser: Browser): Promise<Page> {
  const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  return context.newPage();
}

const friendTile = (page: Page) => page.locator('section[aria-labelledby="freunde"]');
const friendLinkField = (page: Page) => page.getByLabel(FRIEND_TEXTS.linkField);
const createButton = (page: Page) =>
  friendTile(page).getByRole("button", {
    name: new RegExp(`${FRIEND_TEXTS.create}|${FRIEND_TEXTS.createAnother}`),
  });
const openRows = (page: Page) => friendTile(page).getByRole("listitem");

/** Signs in on a new device (an account made by hand) and creates a household; on "Heute". */
async function founder(browser: Browser): Promise<Page> {
  const page = await newDevice(browser);
  await page.goto(E2E_APP);
  await signInWithCode(page, newAddress());
  await expectPageShown(page, HOUSEHOLD_TEXTS.createTitle);
  await createHousehold(page, "Alex", "Dilan");
  await expectPageShown(page, greetingHeading("Alex"));
  return page;
}

/** In the settings of `page`: a new friend invite link. */
async function friendLink(page: Page): Promise<string> {
  if (!(await friendTile(page).isVisible())) {
    await goToPage(page, "Einstellungen");
  }
  const before =
    (await friendLinkField(page).count()) > 0 ? await friendLinkField(page).inputValue() : "";
  await createButton(page).click();
  await expect(friendLinkField(page)).not.toHaveValue(before);
  return friendLinkField(page).inputValue();
}

/** On the sign-in page: asks for a code for an address that has no account yet. */
async function askForCode(page: Page, email: string) {
  await emailField(page).fill(email);
  await page.getByRole("button", { name: ACCOUNT_TEXTS.sendCode }).click();
}

/** The message at the field of the e-mail address, and that no code was "mailed". */
async function expectRefused(page: Page, email: string, message: string) {
  await expect(emailField(page)).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText(message, { exact: true }).first()).toBeVisible();
  const mail = await page.request.get(`${FAKE_SERVER}/test/code`, { params: { email } });
  expect(mail.status()).toBe(404);
}

test.describe("E2-5b Neue Konten nur mit Einladung", () => {
  test("Freunde einladen: Link erzeugen, kopieren, QR-Code; mit dem Link entsteht ein Konto mit eigenem Haushalt", async ({
    browser,
  }) => {
    const alex = await founder(browser);
    await goToPage(alex, "Einstellungen");
    const tile = friendTile(alex);
    await expect(tile.getByRole("heading", { name: FRIEND_TEXTS.tileTitle })).toBeVisible();
    await expect(tile).toContainText(FRIEND_TEXTS.limits);

    await createButton(alex).click();
    await expect(friendLinkField(alex)).toBeFocused();
    const link = await friendLinkField(alex).inputValue();
    expect(link).toMatch(/^http:\/\/localhost:4175\/kruemel\/#\/freunde\/[A-Za-z0-9_-]{16,}$/);
    await tile.getByRole("button", { name: HOUSEHOLD_TEXTS.copy }).click();
    await expect(tile.getByRole("status").first()).toHaveText(HOUSEHOLD_TEXTS.copied);
    expect(await alex.evaluate(() => navigator.clipboard.readText())).toBe(link);
    await tile.getByRole("button", { name: HOUSEHOLD_TEXTS.showQr }).click();
    await expect(tile.getByRole("img", { name: FRIEND_TEXTS.qrLabel })).toHaveAttribute(
      "data-address",
      link,
    );
    await expect(openRows(alex)).toHaveCount(1);
    await expectNoAccessibilityViolations(alex);

    const sam = await newDevice(browser);
    const email = newAddress();
    await sam.goto(link);
    await expect(sam).toHaveTitle("Anmelden – Krümel");
    await expect(sam.getByText(ACCOUNT_TEXTS.invitedFriend)).toBeVisible();
    await expectNoAccessibilityViolations(sam);
    await signInWithCode(sam, email, true);
    await expectPageShown(sam, HOUSEHOLD_TEXTS.createTitle);
    await createHousehold(sam, "Sam", "Kim");
    await expectPageShown(sam, greetingHeading("Sam"));

    // Eigener Haushalt: Sam lädt selbst ein, Alex sieht den Link nicht mehr als offen.
    await goToPage(sam, "Einstellungen");
    await expect(sam.locator('section[aria-labelledby="haushalt"]')).toContainText("Kim");
    await goToPage(alex, "Heute", greetingHeading("Alex"));
    await goToPage(alex, "Einstellungen");
    await expect(friendTile(alex)).toBeVisible();
    await expect(openRows(alex)).toHaveCount(0);
  });

  test("Ohne Einladung bekommt eine unbekannte Adresse keinen Code; ein benutzter Link hat eine eigene Meldung", async ({
    browser,
  }) => {
    const stranger = await newDevice(browser);
    await stranger.goto(E2E_APP);
    const email = newAddress();
    await askForCode(stranger, email);
    await expectRefused(stranger, email, AUTH_MESSAGES.notAllowed);
    await expect(emailField(stranger)).toBeFocused();
    await expectNoAccessibilityViolations(stranger);

    const alex = await founder(browser);
    const link = await friendLink(alex);
    const first = await newDevice(browser);
    await first.goto(link);
    await signInWithCode(first, newAddress(), true);
    await expectPageShown(first, HOUSEHOLD_TEXTS.createTitle);

    const late = await newDevice(browser);
    const lateEmail = newAddress();
    await late.goto(link);
    await askForCode(late, lateEmail);
    await expectRefused(late, lateEmail, AUTH_MESSAGES.inviteInvalid);
  });

  test("Zurückziehen und Grenze: höchstens 5 offene Links; ein zurückgezogener lässt niemanden herein", async ({
    browser,
  }) => {
    const alex = await founder(browser);
    const links = [];
    for (let count = 0; count < 5; count++) {
      links.push(await friendLink(alex));
    }
    await expect(openRows(alex)).toHaveCount(5);

    // Per Tastatur: der Knopf hat den Fokus, Enter löst ihn aus.
    await createButton(alex).focus();
    await alex.keyboard.press("Enter");
    await expect(friendTile(alex).getByText(HOUSEHOLD_MESSAGES.friendInvitesOpen)).toBeVisible();
    await expectNoAccessibilityViolations(alex);

    await openRows(alex)
      .first()
      .getByRole("button", { name: new RegExp(`^${FRIEND_TEXTS.cancel}`) })
      .click();
    await expect(friendTile(alex).getByRole("status").last()).toHaveText(FRIEND_TEXTS.cancelled);
    await expect(openRows(alex)).toHaveCount(4);
    await expect(createButton(alex)).toBeFocused();

    // „Zeigen“ holt einen offenen Link wieder ins Feld.
    await openRows(alex)
      .last()
      .getByRole("button", { name: new RegExp(`^${FRIEND_TEXTS.show}`) })
      .click();
    await expect(friendLinkField(alex)).toHaveValue(links[4] ?? "");

    const late = await newDevice(browser);
    const email = newAddress();
    await late.goto(links[0] ?? "");
    await askForCode(late, email);
    await expectRefused(late, email, AUTH_MESSAGES.inviteInvalid);
  });

  test("Auch der Haushalts-Link erlaubt ein neues Konto; die Anmeldeseite sagt, wozu", async ({
    browser,
  }) => {
    const alex = await founder(browser);
    await goToPage(alex, "Einstellungen");
    await alex
      .locator('section[aria-labelledby="haushalt"]')
      .getByRole("button", { name: HOUSEHOLD_TEXTS.createInvite })
      .click();
    const link = await alex.getByLabel(HOUSEHOLD_TEXTS.inviteLinkField).inputValue();

    const dilan = await newDevice(browser);
    await dilan.goto(link);
    await expect(dilan.getByText(ACCOUNT_TEXTS.invitedHousehold)).toBeVisible();
    await signInWithCode(dilan, newAddress(), true);
    await expectPageShown(dilan, HOUSEHOLD_TEXTS.acceptTitle);
    await dilan.getByRole("button", { name: HOUSEHOLD_TEXTS.accept }).click();
    await expectPageShown(dilan, greetingHeading("Dilan"));
  });

  test("Am Handy (360 px) ohne Querscrollen; ohne Netz eine Meldung statt eines Links", async ({
    browser,
  }) => {
    const alex = await founder(browser);
    await alex.setViewportSize({ width: 360, height: 640 });
    await friendLink(alex);
    const overflow = await alex.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    await expectNoAccessibilityViolations(alex);

    await alex.context().setOffline(true);
    await createButton(alex).click();
    await expect(friendTile(alex).getByText(HOUSEHOLD_MESSAGES.offline)).toBeVisible();
  });

  test("Code eingeben nach Einladung: falscher Code bleibt am Feld, der richtige öffnet „Haushalt anlegen“", async ({
    browser,
  }) => {
    const alex = await founder(browser);
    const link = await friendLink(alex);
    const sam = await newDevice(browser);
    const email = newAddress();
    await sam.goto(link);
    await askForCode(sam, email);
    await expectPageShown(sam, ACCOUNT_TEXTS.codeTitle);
    const code = await mailedCode(sam, email);

    await enterCode(sam, code === "000000" ? "111111" : "000000");
    await expect(codeField(sam)).toHaveAttribute("aria-invalid", "true");
    // Nach dem Neuladen (Wechsel ins Mailprogramm) gilt der Code weiter.
    await sam.reload();
    await enterCode(sam, code);
    await expectPageShown(sam, HOUSEHOLD_TEXTS.createTitle);
  });
});
