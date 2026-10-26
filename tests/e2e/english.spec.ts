import { type Browser, expect, type Page, test } from "@playwright/test";
import { demoData } from "../../src/demo/demoData";
import { de } from "../../src/i18n/de";
import { en } from "../../src/i18n/en";
import { addUser, householdOfTwo, mailedCode, newAddress } from "./account";
import { expectNoAccessibilityViolations } from "./axe";
import {
  dataKey,
  deviceKey,
  expectPageShown,
  FROZEN_TODAY,
  freezeClock,
  overflowing,
  startShared,
  store,
  textFile,
} from "./helpers";
import { E2E_APP, FAKE_SERVER } from "./shared";

// EN-b: account, household, invite, names, backup, transfer and the messages of failures in
// English. The browser of these tests asks for English (no choice made on the device yet); the
// other tests stay German. Against the fake server, like the German ones (`signin.spec.ts`,
// `household.spec.ts`, `backup.spec.ts`, `syncstatus.spec.ts`).

test.use({ locale: "en-GB" });

const greeting = (name: string) => new RegExp(`^(Good morning|Hello|Good evening), ${name}!$`);

/** A new device of one person that asks for English and may use the clipboard. */
async function newDevice(browser: Browser): Promise<Page> {
  const context = await browser.newContext({
    locale: "en-GB",
    permissions: ["clipboard-read", "clipboard-write"],
  });
  return context.newPage();
}

const german = (page: Page) => page.getByRole("button", { name: "Deutsch" });
const english = (page: Page) => page.getByRole("button", { name: "English" });
// By id, so the fields are found in either language (the label changes with it).
const emailField = (page: Page) => page.locator("#anmelden-email");
const codeField = (page: Page) => page.locator("#anmelden-code");
const heading = (page: Page, name: string | RegExp) =>
  page.getByRole("heading", { level: 1, name });

/** The message at a field, read with the field (`aria-describedby`), and shown. */
async function expectFieldMessage(page: Page, field: ReturnType<typeof codeField>, text: string) {
  await expect(field).toHaveAttribute("aria-invalid", "true");
  // A hint of the field may come first; the message ends the description.
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  await expect(field).toHaveAccessibleDescription(new RegExp(`(^|\\s)${escaped}$`));
  await expect(page.getByText(text, { exact: true }).first()).toBeVisible();
}

async function requestCode(page: Page, email: string, invited = false) {
  if (!invited) {
    await addUser(page.request, email);
  }
  await emailField(page).fill(email);
  await page.getByRole("button", { name: en.account.sendCode }).click();
  await expectPageShown(page, en.account.codeTitle);
}

async function enterCode(page: Page, code: string) {
  await codeField(page).fill(code);
  await page.getByRole("button", { name: en.account.verifyCode, exact: true }).click();
}

/** Signs in on the sign-in page (the address needs an account unless `invited`). */
async function signIn(page: Page, email: string, invited = false) {
  await expect(heading(page, en.account.signInTitle)).toBeVisible();
  await requestCode(page, email, invited);
  await enterCode(page, await mailedCode(page, email));
}

/** On "Create household": the two names, then the button. */
async function createHousehold(page: Page, own: string, other: string) {
  await page.getByLabel(en.household.ownNameLabel).fill(own);
  await page.getByLabel(en.household.otherNameLabel).fill(other);
  await page.getByRole("button", { name: en.household.create }).click();
}

async function openGroup(page: Page, group: "konto" | "daten" | "darstellung", title: string) {
  await page.evaluate((hash) => {
    location.hash = hash;
  }, `#/einstellungen/${group}`);
  await expect(heading(page, title)).toBeVisible();
}

const householdTile = (page: Page) => page.locator('section[aria-labelledby="haushalt"]');

test.describe("EN-b Anmelden auf Englisch", () => {
  test("EN-b Seiten, Meldungen am Feld und Sprachwechsel bei offener Meldung", async ({
    browser,
  }) => {
    const page = await newDevice(browser);
    const email = newAddress();
    await addUser(page.request, email);
    await page.goto(E2E_APP);

    await expect(heading(page, "Sign in")).toBeVisible();
    await expect(page).toHaveTitle("Sign in – Krümel");
    await expect(page.getByText(en.account.signInIntro)).toBeVisible();
    await expect(emailField(page)).toHaveAttribute("type", "email");

    await emailField(page).fill("not-an-address");
    await page.getByRole("button", { name: en.account.sendCode }).click();
    await expectFieldMessage(page, emailField(page), en.errors.auth.invalidEmail);
    // The message follows a switch of the language while it is on the screen.
    await german(page).click();
    await expectFieldMessage(page, emailField(page), de.errors.auth.invalidEmail);
    await expect(page.getByText(en.errors.auth.invalidEmail)).toHaveCount(0);
    await english(page).click();
    await expectFieldMessage(page, emailField(page), en.errors.auth.invalidEmail);

    await requestCode(page, email, true);
    await expect(page.getByText(en.account.codeIntro(email))).toBeVisible();
    await expect(page.getByText(en.account.resendWait)).toBeVisible();

    await enterCode(page, "12");
    await expectFieldMessage(page, codeField(page), en.account.codeFormat);
    await expect(codeField(page)).toBeFocused();

    const code = await mailedCode(page, email);
    await enterCode(
      page,
      code.replace(/\d/g, (digit) => String((Number(digit) + 1) % 10)),
    );
    await expectFieldMessage(page, codeField(page), en.errors.auth.wrongCode);
    await german(page).click();
    await expectFieldMessage(page, codeField(page), de.errors.auth.wrongCode);
    await expect(heading(page, de.account.codeTitle)).toBeVisible();
    await english(page).click();
    await expect(heading(page, en.account.codeTitle)).toBeVisible();
    await expectNoAccessibilityViolations(page);

    await enterCode(page, code);
    await expectPageShown(page, en.household.createTitle);
    await expect(page).toHaveTitle("Create household – Krümel");
    await page.getByRole("button", { name: en.household.create }).click();
    await expect(page.getByText(en.formErrors.nameEmpty)).toHaveCount(2);
    await expect(page.getByLabel(en.household.ownNameLabel)).toBeFocused();
    await expectNoAccessibilityViolations(page);

    await createHousehold(page, "Alex", "Sam");
    await expectPageShown(page, greeting("Alex"));
    await expect(page.getByText(en.account.signedInAs)).toContainText("Alex");

    // Account: who is signed in, and the question before signing out.
    await openGroup(page, "konto", en.routes.settingsAccount.title);
    await expect(page.getByText(en.account.accountSignedIn(email))).toBeVisible();
    await page.getByRole("button", { name: en.account.signOut, exact: true }).click();
    const question = page.getByRole("dialog", { name: en.account.signOutQuestion });
    await expect(question).toContainText(en.shared.signOutExplained);
    await question.getByRole("button", { name: en.common.cancel }).click();
    await expect(question).toBeHidden();
  });

  test("EN-b Alle Fehlertexte der Anmeldung gibt es in beiden Sprachen; Unbekanntes bleibt allgemein", async () => {
    for (const [key, text] of Object.entries(en.errors.auth)) {
      expect(text.trim(), key).not.toBe("");
      expect(text, key).not.toBe(de.errors.auth[key as keyof typeof de.errors.auth]);
    }
    expect(en.errors.unexpected).not.toBe(de.errors.unexpected);
  });
});

test.describe("EN-b Haushalt, Einladung und Namen auf Englisch", () => {
  test("EN-b Haushalt anlegen, Einladungslink, Beitritt, Namen ändern", async ({ browser }) => {
    const alex = await newDevice(browser);
    await alex.goto(E2E_APP);
    await signIn(alex, newAddress());
    await createHousehold(alex, "Alex", "Dilan");
    await expectPageShown(alex, greeting("Alex"));

    await openGroup(alex, "konto", en.routes.settingsAccount.title);
    const tile = householdTile(alex);
    await expect(tile.locator('[data-person="personA"]')).toHaveText(/Alex \(you\)\s*joined/);
    await expect(tile.locator('[data-person="personB"]')).toHaveText(/Dilan\s*not joined yet/);

    await tile.getByRole("button", { name: en.household.createInvite }).click();
    const linkField = alex.getByLabel(en.household.secondPersonLinkField);
    await expect(linkField).toBeFocused();
    const link = await linkField.inputValue();
    expect(link).toMatch(/#\/einladung\/[A-Za-z0-9_-]{16,}$/);
    await expect(linkField).toHaveAccessibleDescription(/^Valid until \w{3}, \d\d\/\d\d\/\d{4}\.$/);
    await tile.getByRole("button", { name: en.household.copy }).click();
    await expect(tile.getByRole("status").first()).toHaveText(en.household.copied);
    await tile.getByRole("button", { name: en.household.showQr }).click();
    await expect(tile.getByRole("img", { name: en.household.qrLabel })).toBeVisible();
    await expectNoAccessibilityViolations(alex);

    // Names: too long, the same, then fine.
    const ownName = alex.getByLabel(en.household.ownNameLabel);
    await ownName.fill("x".repeat(31));
    await tile.getByRole("button", { name: en.household.saveNames }).click();
    await expectFieldMessage(alex, ownName, en.formErrors.nameTooLong(30));
    await alex.getByLabel(en.household.householdNameLabel).fill("y".repeat(31));
    await tile.getByRole("button", { name: en.household.saveNames }).click();
    await expectFieldMessage(
      alex,
      alex.getByLabel(en.household.householdNameLabel),
      en.errors.household.invalidHouseholdName,
    );
    await alex.getByLabel(en.household.householdNameLabel).fill("Sunny Lane");
    await ownName.fill("Alexa");
    await tile.getByRole("button", { name: en.household.saveNames }).click();
    await expect(tile.getByRole("status").filter({ hasText: en.household.namesSaved })).toHaveCount(
      1,
    );

    // The second person: opens the link, signs in with a new address, accepts.
    const dilan = await newDevice(browser);
    const email = newAddress();
    await dilan.goto(link);
    await expect(dilan.getByText(en.account.invitedHousehold)).toBeVisible();
    await signIn(dilan, email, true);
    await expectPageShown(dilan, en.household.acceptTitle);
    await expect(dilan.getByText(en.household.acceptAs(email))).toBeVisible();
    await expectNoAccessibilityViolations(dilan);
    await dilan.getByRole("button", { name: en.household.accept }).click();
    await expectPageShown(dilan, greeting("Dilan"));

    // A used link cannot be used again: the sign-in says so, in the language set.
    const late = await newDevice(browser);
    await late.goto(link);
    await emailField(late).fill(newAddress());
    await late.getByRole("button", { name: en.account.sendCode }).click();
    await expectFieldMessage(late, emailField(late), en.errors.auth.inviteInvalid);
    await expectNoAccessibilityViolations(late);
    await german(late).click();
    await expectFieldMessage(late, emailField(late), de.errors.auth.inviteInvalid);
  });

  test("EN-b Namen ändern ohne Haushalt: Ersteinrichtung und „Ich bin“ (Modus lokal)", async ({
    page,
  }) => {
    await page.goto("./");
    await expect(heading(page, en.names.setupTitle)).toBeVisible();
    await expect(page).toHaveTitle("First-time setup – Krümel");
    await page.getByRole("button", { name: en.names.setupSubmit }).click();
    await expect(page.getByText(en.formErrors.nameEmpty)).toHaveCount(2);
    await expect(page.getByText(en.formErrors.personMissing)).toBeVisible();
    await expect(page.getByLabel(en.names.firstName)).toBeFocused();
    await expectNoAccessibilityViolations(page);

    await page.getByLabel(en.names.firstName).fill("Alex");
    await page.getByLabel(en.names.secondName).fill("alex");
    await page.getByRole("radio", { name: "Alex", exact: true }).check();
    await page.getByRole("button", { name: en.names.setupSubmit }).click();
    await expect(page.getByText(en.formErrors.namesEqual)).toBeVisible();

    await page.getByLabel(en.names.secondName).fill("Robin");
    await page.getByRole("button", { name: en.names.setupSubmit }).click();
    await expect(heading(page, greeting("Alex"))).toBeVisible();
  });

  test("EN-b „Wer benutzt dieses Gerät?“ auf Englisch", async ({ page }) => {
    await store(page, { [dataKey]: JSON.stringify(demoData(FROZEN_TODAY)) });
    await expect(heading(page, en.names.whoTitle)).toBeVisible();
    await expect(page.getByRole("group", { name: en.names.iAm })).toBeVisible();
    await expectNoAccessibilityViolations(page);
    await page.getByRole("button", { name: en.names.whoSubmit }).click();
    await expect(page.getByText(en.formErrors.personMissing)).toBeVisible();
    await page.getByRole("radio", { name: "Alex" }).check();
    await page.getByRole("button", { name: en.names.whoSubmit }).click();
    await expect(heading(page, greeting("Alex"))).toBeVisible();
    expect(await page.evaluate((key) => localStorage.getItem(key), deviceKey)).toContain("personA");
  });
});

test.describe("EN-b Sicherung auf Englisch", () => {
  test("EN-b Herunterladen, fehlerhafte Datei, Rückfrage und Einspielen", async ({ page }) => {
    await freezeClock(page);
    await startShared(page, demoData(FROZEN_TODAY), "#/einstellungen/daten");
    await expect(heading(page, en.routes.settingsData.title)).toBeVisible();
    const tile = page.getByRole("region", { name: en.backup.title, exact: true });
    await expect(
      tile.getByRole("heading", { level: 3, name: en.backup.downloadTitle }),
    ).toBeVisible();
    await expect(tile).toContainText(en.backup.nowOnDevice("11 tasks and 10 completions"));
    await expect(tile).toContainText(en.shared.backupIntro);
    await expectNoAccessibilityViolations(page);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      tile.getByRole("button", { name: en.backup.download }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("kruemel-2026-10-21.json");
    await expect(tile.getByRole("status")).toHaveText(
      en.backup.exported("kruemel-2026-10-21.json"),
    );
    const path = await download.path();

    // A file that is no backup: the reason, where it is wrong, and nothing changed.
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      tile.getByRole("button", { name: en.backup.importButton }).click(),
    ]);
    await chooser.setFiles(textFile("broken.json", '{"schemaVersion": 1, "tasks": 5}'));
    const problem = page.getByRole("alert");
    await expect(problem).toContainText(en.backup.importFailed);
    await expect(problem).toContainText(`${en.backup.notABackup} ${en.shared.unchanged}`);
    await expect(problem).toContainText(/tasks: /);
    await expectNoAccessibilityViolations(page);

    // A good file: the question names the file and what it holds.
    const [secondChooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      tile.getByRole("button", { name: en.backup.importButton }).click(),
    ]);
    await secondChooser.setFiles(path);
    const question = page.getByRole("dialog", { name: en.backup.question });
    await expect(question).toContainText(
      en.backup.fileContains(
        (await download.path())?.split(/[\\/]/).pop() ?? "",
        "11 tasks and 10 completions",
      ),
    );
    await expect(question).toContainText(en.shared.importReplaces("11 tasks and 10 completions"));
    await expect(question).toContainText(en.backup.autoCopy("kruemel-vor-import-2026-10-21.json"));
    await expectNoAccessibilityViolations(page);
    await Promise.all([
      page.waitForEvent("download"),
      question.getByRole("button", { name: en.backup.confirm }).click(),
    ]);
    await expect(tile.getByRole("status")).toContainText(
      "Backup restored: 11 tasks and 10 completions.",
    );
  });
});

test.describe("EN-b Abgleichsstand auf Englisch", () => {
  test("EN-b Ohne Internet, wartende Änderungen, abgelehnte Änderung", async ({ page }) => {
    await freezeClock(page);
    const member = await startShared(page, demoData(FROZEN_TODAY), "#/woche");
    await expect(heading(page, "This week")).toBeVisible();

    await page.context().setOffline(true);
    await page
      .getByRole("button", { name: /^Mark as done: / })
      .first()
      .click();
    const waiting = page.getByRole("complementary", { name: en.sync.waitingLabel });
    await expect(waiting).toHaveText(en.sync.waitingOffline(1));
    await expect(
      page.getByRole("status").filter({ hasText: en.sync.waitingOffline(1) }),
    ).toHaveCount(1);

    await openGroup(page, "daten", en.routes.settingsData.title);
    const syncTile = page.getByRole("region", { name: en.sync.tileTitle });
    await expect(syncTile).toContainText(en.sync.tileIntro);
    await expect(syncTile).toContainText(en.sync.waitingOffline(1));
    await expectNoAccessibilityViolations(page);

    await page.context().setOffline(false);
    await expect(waiting).toHaveCount(0);
    await expect(syncTile).toContainText(en.sync.allSent);

    // The server refuses the next change for good: it is put aside, with the way out in English.
    const response = await page.request.post(`${FAKE_SERVER}/test/refuse`, {
      headers: { Authorization: `Bearer ${member.token}` },
      data: { count: 1 },
    });
    expect(response.ok()).toBe(true);
    await page.evaluate(() => {
      location.hash = "#/woche";
    });
    await page
      .getByRole("button", { name: /^Mark as done: / })
      .first()
      .click();
    const rejected = page.getByRole("complementary", { name: en.sync.rejectedLabel });
    await expect(rejected).toContainText(en.sync.rejected(1));
    await expect(rejected).toContainText(en.sync.rejectedHint);
    await expectNoAccessibilityViolations(page);
    await rejected.getByRole("button", { name: en.sync.discard }).click();
    const question = page.getByRole("dialog", { name: en.sync.discardQuestion(1) });
    await expect(question).toContainText(en.sync.discardDialog);
    await question.getByRole("button", { name: en.sync.discardConfirm }).click();
    await expect(rejected).toHaveCount(0);
  });
});

test.describe("EN-b Speicherproblem auf Englisch", () => {
  test("EN-b Unlesbare Daten: Seite, Rohdaten, Neu beginnen (Modus lokal)", async ({ page }) => {
    const broken = '{"schemaVersion": 1, "tasks": [';
    await store(page, { [dataKey]: broken });
    await expect(heading(page, en.storageProblem.titleRescue)).toBeVisible();
    await expect(page).toHaveTitle("Stored data cannot be read – Krümel");
    await expect(page.getByRole("alert")).toContainText(en.errors.storage.damaged);
    await expect(page.getByRole("alert")).toContainText(en.storageProblem.alertTitle);
    await expect(page.getByText(en.storageProblem.intro)).toBeVisible();
    await expectNoAccessibilityViolations(page);

    await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: en.storageProblem.downloadRaw }).click(),
    ]);
    await expect(page.getByText(en.storageProblem.rawDownloaded)).toBeVisible();
    await expect(page.getByRole("heading", { name: en.storageProblem.step2 })).toBeVisible();
    await page.getByRole("button", { name: en.storageProblem.startOver }).click();
    const question = page.getByRole("dialog", { name: en.storageProblem.question });
    await expect(question).toContainText(en.storageProblem.dialog);
    await question.getByRole("button", { name: en.storageProblem.confirm }).click();
    await expect(heading(page, en.names.setupTitle)).toBeVisible();
  });

  test("EN-b Fundstellen und ein Speicher, der nicht schreiben lässt, sagen es auf Englisch", async ({
    page,
  }) => {
    await store(page, {
      [dataKey]: JSON.stringify({ schemaVersion: 1, settings: {}, tasks: 5, completions: [] }),
    });
    await expect(page.getByRole("alert")).toContainText(en.errors.storage.incomplete);
    await page.getByText(en.errors.details).click();
    await expect(page.getByText("tasks: erwartet eine Liste")).toBeVisible();
  });

  test("EN-b Speicher voll beim ersten Einrichten: Meldung auf Englisch", async ({ page }) => {
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("full", "QuotaExceededError");
      };
    });
    await page.goto("./");
    await page.getByLabel(en.names.firstName).fill("Alex");
    await page.getByLabel(en.names.secondName).fill("Robin");
    await page.getByRole("radio", { name: "Alex" }).check();
    await page.getByRole("button", { name: en.names.setupSubmit }).click();
    await expect(page.getByRole("alert")).toContainText(en.errors.storage.full);
    await expect(page.getByRole("alert")).toContainText(en.common.notSaved);
  });
});

test.describe("EN-b Handy 360 px und axe in beiden Sprachen", () => {
  test("EN-b Die längeren englischen Texte laufen nirgends über", async ({ browser }) => {
    const context = await browser.newContext({
      locale: "en-GB",
      viewport: { width: 360, height: 640 },
    });
    const page = await context.newPage();
    const email = newAddress();
    await addUser(page.request, email);
    await page.goto(E2E_APP);
    await expect(heading(page, en.account.signInTitle)).toBeVisible();
    expect(await overflowing(page)).toEqual([]);
    await emailField(page).fill("not-an-address");
    await page.getByRole("button", { name: en.account.sendCode }).click();
    expect(await overflowing(page)).toEqual([]);
    await requestCode(page, email, true);
    await enterCode(page, "12");
    expect(await overflowing(page)).toEqual([]);
    await enterCode(page, await mailedCode(page, email));
    await expectPageShown(page, en.household.createTitle);
    await page.getByRole("button", { name: en.household.create }).click();
    expect(await overflowing(page)).toEqual([]);
    await createHousehold(page, "Alex", "Sam");
    await expectPageShown(page, greeting("Alex"));

    for (const [group, title] of [
      ["konto", en.routes.settingsAccount.title],
      ["daten", en.routes.settingsData.title],
      ["darstellung", en.routes.settingsAppearance.title],
    ] as const) {
      await openGroup(page, group, title);
      expect(await overflowing(page), group).toEqual([]);
    }
  });

  test("EN-b Die Seiten der Restliste: axe hell und dunkel auf Deutsch und Englisch", async ({
    browser,
    request,
  }) => {
    const { alex } = await householdOfTwo(request, demoData(FROZEN_TODAY));
    const page = await newDevice(browser);
    await page.context().addInitScript(
      ({ key, value }) => {
        if (sessionStorage.getItem("e2e-seeded") === null) {
          sessionStorage.setItem("e2e-seeded", "1");
          localStorage.setItem(key, value);
        }
      },
      { key: "kruemel-fake:auth", value: JSON.stringify(alex) },
    );
    await page.goto(`${E2E_APP}#/einstellungen/konto`);
    await expect(heading(page, en.routes.settingsAccount.title)).toBeVisible();
    for (const hash of ["konto", "daten", "darstellung"]) {
      await page.evaluate((target) => {
        location.hash = `#/einstellungen/${target}`;
      }, hash);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoAccessibilityViolations(page);
    }
    await openGroup(page, "darstellung", en.routes.settingsAppearance.title);
    await german(page).click();
    for (const hash of ["konto", "daten"]) {
      await page.evaluate((target) => {
        location.hash = `#/einstellungen/${target}`;
      }, hash);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoAccessibilityViolations(page);
    }
  });
});
