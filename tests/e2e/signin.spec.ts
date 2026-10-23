import { expect, type Page, test } from "@playwright/test";
import { AUTH_MESSAGES } from "../../src/auth/auth";
import { demoData } from "../../src/demo/demoData";
import { ACCOUNT_TEXTS } from "../../src/ui/accountTexts";
import { HOUSEHOLD_TEXTS, SHARED_TEXTS } from "../../src/ui/householdTexts";
import {
  codeField,
  createHousehold,
  emailField,
  enterCode,
  mailedCode,
  newAddress,
  requestCode,
} from "./account";
import { expectNoAccessibilityViolations } from "./axe";
import {
  dataKey,
  deviceKey,
  expectPageShown,
  goToPage,
  greetingHeading,
  localData,
  today,
} from "./helpers";
import { E2E_APP, FAKE_SERVER } from "./shared";

// Package E2-2c: the sign-in pages against the fake server. The app in the mode `e2e` without a
// test session (`kruemel-fake:session`) asks for a sign-in first, as the mode `supabase` does; the
// data stay in this browser until E2-3. The fake server hands out the code instead of a mail
// (`/test/code`). Helpers for signing in: `account.ts`.

/** Opens the app with the demo data on this device (local storage), not signed in. */
async function openSignedOut(page: Page) {
  await page.addInitScript(
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
  await page.goto(E2E_APP);
  await expect(page.getByRole("heading", { level: 1, name: "Anmelden" })).toBeVisible();
}

/** Signs in and creates a household (E2-2d); the names on this device stay as they are. */
async function signIn(page: Page, email: string) {
  await openSignedOut(page);
  await requestCode(page, email);
  await enterCode(page, await mailedCode(page, email));
  await expectPageShown(page, HOUSEHOLD_TEXTS.createTitle);
  await createHousehold(page, "Alex", "Sam");
  await expectPageShown(page, greetingHeading("Alex"));
}

/** A code that is surely not the mailed one: every digit shifted by one. */
const otherCode = (code: string) =>
  code.replace(/\d/g, (digit) => String((Number(digit) + 1) % 10));

/** The message at a field: read with the field (`aria-describedby`), field marked invalid. */
async function expectFieldError(page: Page, field: ReturnType<typeof codeField>, message: string) {
  await expect(field).toHaveAttribute("aria-invalid", "true");
  await expect(field).toHaveAccessibleDescription(
    new RegExp(message.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
  );
  await expect(page.getByText(message, { exact: true }).first()).toBeVisible();
}

test.describe("E2-2c Anmelden mit Code", () => {
  test("Anmelden mit E-Mail und Code öffnet die App; die Sitzung bleibt nach dem Neuladen", async ({
    page,
  }) => {
    const email = newAddress();
    await openSignedOut(page);
    await expect(page).toHaveTitle("Anmelden – Krümel");
    await expect(page.getByRole("navigation", { name: "Hauptnavigation" })).toHaveCount(0);
    await expect(emailField(page)).toHaveAttribute("type", "email");
    await expect(emailField(page)).toHaveAttribute("autocomplete", "email");
    await expectNoAccessibilityViolations(page);

    await requestCode(page, email);
    await expect(page.getByText(ACCOUNT_TEXTS.codeIntro(email))).toBeVisible();
    await expect(codeField(page)).toHaveAttribute("autocomplete", "one-time-code");
    await expect(codeField(page)).toHaveAttribute("inputmode", "numeric");
    await expectNoAccessibilityViolations(page);

    // Am Handy lädt die App nach dem Wechsel ins Mailprogramm oft neu: der Schritt bleibt.
    await page.reload();
    await expect(
      page.getByRole("heading", { level: 1, name: ACCOUNT_TEXTS.codeTitle }),
    ).toBeVisible();

    await enterCode(page, await mailedCode(page, email));
    await expectPageShown(page, HOUSEHOLD_TEXTS.createTitle);
    await createHousehold(page, "Alex", "Sam");

    await expectPageShown(page, greetingHeading("Alex"));
    await expect(page.getByText(ACCOUNT_TEXTS.signedInAs)).toContainText("Alex");
    await page.reload();
    await expect(
      page.getByRole("heading", { level: 1, name: greetingHeading("Alex") }),
    ).toBeVisible();
  });

  test("Falscher Code und falsche Eingabe: Meldung am Feld, Fokus im Feld; nach fünf Fehlversuchen zu viele Versuche", async ({
    page,
  }) => {
    const email = newAddress();
    await openSignedOut(page);
    await requestCode(page, email);
    const code = await mailedCode(page, email);

    await enterCode(page, "12");
    await expectFieldError(page, codeField(page), ACCOUNT_TEXTS.codeFormat);
    await expect(codeField(page)).toBeFocused();

    await enterCode(page, otherCode(code));
    await expectFieldError(page, codeField(page), AUTH_MESSAGES.wrongCode);
    await expect(codeField(page)).toBeFocused();
    await expectNoAccessibilityViolations(page);

    // Mit Enter im Feld bleibt der Fokus dort; die Statuszeile liest die Meldung vor.
    await codeField(page).fill(otherCode(code));
    await codeField(page).press("Enter");
    await expect(page.getByRole("status").filter({ hasText: AUTH_MESSAGES.wrongCode })).toHaveCount(
      1,
    );

    for (let tries = 3; tries <= 5; tries++) {
      await enterCode(page, otherCode(code));
      await expectFieldError(page, codeField(page), AUTH_MESSAGES.wrongCode);
    }
    await enterCode(page, code);
    await expectFieldError(page, codeField(page), AUTH_MESSAGES.tooManyTries);
  });

  test("Abgelaufener Code: eigene Meldung am Feld", async ({ page }) => {
    const email = newAddress();
    await openSignedOut(page);
    await requestCode(page, email);
    // Zehn Minuten Warten spielt der Anmeldedienst nach (die Regel selbst prüft der Vertragstest).
    await page.route(`${FAKE_SERVER}/auth/verify`, (route) =>
      route.fulfill({ status: 400, json: { failure: "expiredCode" } }),
    );

    await enterCode(page, await mailedCode(page, email));

    await expectFieldError(page, codeField(page), AUTH_MESSAGES.expiredCode);
  });

  test("Neuer Code erst nach einer Minute; zu früh angefordert meldet der Dienst zu viele Versuche", async ({
    page,
  }) => {
    await page.clock.install();
    const email = newAddress();
    await openSignedOut(page);
    await requestCode(page, email);
    await expect(page.getByText(ACCOUNT_TEXTS.resendWait)).toBeVisible();
    await expect(page.getByRole("button", { name: ACCOUNT_TEXTS.resendCode })).toHaveCount(0);

    // Nur die Uhr der App läuft vor; für den Dienst ist die Minute noch nicht um.
    await page.clock.fastForward(61_000);
    await page.getByRole("button", { name: ACCOUNT_TEXTS.resendCode }).click();

    await expectFieldError(page, codeField(page), AUTH_MESSAGES.tooManyTries);
    await expect(codeField(page)).toBeFocused();
  });

  test("Neuer Code: Hinweis, der neue gilt; „Andere E-Mail-Adresse“ führt zurück", async ({
    page,
  }) => {
    await page.clock.install();
    const email = newAddress();
    await openSignedOut(page);
    await requestCode(page, email);
    // Die Minute des Dienstes spielt die Umleitung nach; die Uhr der App läuft vor.
    await page.route(`${FAKE_SERVER}/auth/code`, (route) =>
      route.fulfill({ status: 200, json: {} }),
    );
    await page.clock.fastForward(61_000);

    await page.getByRole("button", { name: ACCOUNT_TEXTS.resendCode }).click();
    await expect(
      page.getByRole("status").filter({ hasText: ACCOUNT_TEXTS.codeResent }),
    ).toBeVisible();
    await expect(page.getByText(ACCOUNT_TEXTS.resendWait)).toBeVisible();

    await page.getByRole("button", { name: ACCOUNT_TEXTS.otherEmail }).click();
    await expectPageShown(page, "Anmelden");
    await expect(emailField(page)).toHaveValue(email);
  });

  test("Ungültige Adresse, nicht erlaubt und kein Netz: Meldung am Feld der E-Mail-Adresse", async ({
    page,
  }) => {
    await openSignedOut(page);
    await emailField(page).fill("keine-adresse");
    await page.getByRole("button", { name: ACCOUNT_TEXTS.sendCode }).click();
    await expectFieldError(page, emailField(page), AUTH_MESSAGES.invalidEmail);
    await expect(emailField(page)).toBeFocused();

    await page.route(`${FAKE_SERVER}/auth/code`, (route) =>
      route.fulfill({ status: 403, json: { failure: "notAllowed" } }),
    );
    await emailField(page).fill(newAddress());
    await page.getByRole("button", { name: ACCOUNT_TEXTS.sendCode }).click();
    await expectFieldError(page, emailField(page), AUTH_MESSAGES.notAllowed);
    await page.unroute(`${FAKE_SERVER}/auth/code`);

    await page.context().setOffline(true);
    await page.getByRole("button", { name: ACCOUNT_TEXTS.sendCode }).click();
    await expectFieldError(page, emailField(page), AUTH_MESSAGES.offline);
    await expectNoAccessibilityViolations(page);
  });

  test("Ohne Verbindung zum Dienst startet die App mit der gemerkten Sitzung", async ({ page }) => {
    const email = newAddress();
    await signIn(page, email);
    await page.route(`${FAKE_SERVER}/**`, (route) => route.abort("internetdisconnected"));

    await page.reload();

    await expect(
      page.getByRole("heading", { level: 1, name: greetingHeading("Alex") }),
    ).toBeVisible();
    await expect(page.getByText(ACCOUNT_TEXTS.signedInAs)).toContainText("Alex");
  });

  test("Abmelden mit Rückfrage: danach die Anmeldeseite, die Aufgaben aus Etappe 1 bleiben auf dem Gerät", async ({
    page,
  }) => {
    await signIn(page, newAddress());
    await goToPage(page, "Einstellungen");
    const signOut = page
      .getByRole("region", { name: ACCOUNT_TEXTS.accountTile })
      .getByRole("button", { name: ACCOUNT_TEXTS.signOut })
      .first();

    await signOut.click();
    const dialog = page.getByRole("dialog", { name: ACCOUNT_TEXTS.signOutQuestion });
    // E2-3b: die gemeinsame Kopie geht, die lokalen Daten (`putzplan:data`) bleiben.
    await expect(dialog).toContainText(SHARED_TEXTS.signOutExplained);
    await expectNoAccessibilityViolations(page);
    await dialog.getByRole("button", { name: "Abbrechen" }).click();
    await expect(signOut).toBeFocused();

    await signOut.click();
    await dialog.getByRole("button", { name: ACCOUNT_TEXTS.signOut }).click();

    await expectPageShown(page, "Anmelden");
    expect((await localData(page)).tasks.length).toBeGreaterThan(0);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Anmelden" })).toBeVisible();
  });
});
