import { expect, type Page, test } from "@playwright/test";
import type { OneOffTask } from "../../src/domain/task";
import { type AppData, emptyAppData } from "../../src/storage/appData";
import { ACCOUNT_TEXTS } from "../../src/ui/accountTexts";
import { describeContents } from "../../src/ui/format";
import { HOUSEHOLD_TEXTS, SHARED_TEXTS } from "../../src/ui/householdTexts";
import {
  FAKE_AUTH_KEY,
  householdOfTwo,
  type Member,
  openMember,
  pushAs,
  serverData,
  sharedCopyKeys,
} from "./account";
import { expectNoAccessibilityViolations } from "./axe";
import { dataKey, expectPageShown, goToPage, openSettings, textFile, today } from "./helpers";
import { FAKE_SERVER } from "./shared";

// Package E2-3b: the household's shared data in the app (mode `e2e` = fake server). Two members
// on two devices (browser contexts) see the same tasks; offline work is handed over later; signing
// out deletes the device's copy (with a backup file while changes wait); a backup replaces the
// data for both, only online.

function task(id: string, title: string): OneOffTask {
  return {
    kind: "oneOff",
    id,
    title,
    symbol: "standard",
    assignee: "both",
    dueDate: today(),
    done: false,
    checklist: [],
  };
}

/** Two tasks due today, names Alex and Robin. */
function seed(): AppData {
  return {
    ...emptyAppData(),
    settings: { personNames: { personA: "Alex", personB: "Robin" } },
    tasks: [task("t-bad", "Bad putzen"), task("t-muell", "Müll rausbringen")],
    completions: [],
  };
}

const article = (page: Page, title: string) => page.getByRole("article", { name: title });

/** A page heading; the first page after loading takes no focus, so only its being there counts. */
const heading = (page: Page, title: string) =>
  expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();

/** Another account on the same device: its session put in place, then the app started anew. */
async function switchTo(page: Page, member: Member) {
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), {
    key: FAKE_AUTH_KEY,
    value: JSON.stringify(member),
  });
  await page.reload();
}

async function tick(page: Page, title: string) {
  await goToPage(page, "Woche", "Diese Woche");
  await page.getByRole("button", { name: `Abhaken: ${title}` }).click();
  await expect(page.getByRole("button", { name: `Abhaken: ${title}` })).toHaveCount(0);
}

/** On the task list: edits the title of a task and comes back. */
async function rename(page: Page, from: string, to: string) {
  await page.getByRole("link", { name: `Bearbeiten: ${from}` }).click();
  await expectPageShown(page, "Aufgabe bearbeiten");
  await page.getByLabel("Titel").fill(to);
  await page.getByRole("button", { name: "Speichern" }).click();
  await expectPageShown(page, "Aufgaben");
}

/** Waits until the server holds what `check` expects. */
async function expectOnServer(
  request: Parameters<typeof serverData>[0],
  member: Member,
  check: (data: AppData) => unknown,
  expected: unknown,
) {
  await expect.poll(async () => check(await serverData(request, member))).toEqual(expected);
}

test.describe("E2-3b Gemeinsame Daten im Haushalt", () => {
  test("Zwei Mitglieder sehen dieselben Aufgaben; eine neue Aufgabe von A erscheint bei B ohne Neuladen", async ({
    browser,
    request,
  }) => {
    const { alex, robin } = await householdOfTwo(request, seed());
    const a = await openMember(browser, alex);
    const b = await openMember(browser, robin);
    await expect(article(a, "Bad putzen")).toBeVisible();
    await expect(article(b, "Bad putzen")).toBeVisible();
    await expect(b.getByText(ACCOUNT_TEXTS.signedInAs)).toContainText("Robin");

    await a.getByRole("link", { name: "Neue Aufgabe" }).click();
    await expectPageShown(a, "Neue Aufgabe");
    await a.getByLabel("Titel").fill("Balkon fegen");
    await a.getByRole("button", { name: "Aufgabe anlegen" }).click();

    await expect(article(b, "Balkon fegen")).toBeVisible();
    // Die Daten aus Etappe 1 auf dem Gerät bleiben unberührt.
    expect(await b.evaluate((key) => localStorage.getItem(key), dataKey)).toBeNull();
    await expectNoAccessibilityViolations(b);
  });

  test("Offline abgehakt wird nachgereicht; die Statistik zählt beide", async ({
    browser,
    request,
  }) => {
    const { alex, robin } = await householdOfTwo(request, seed());
    const a = await openMember(browser, alex);
    const b = await openMember(browser, robin);
    await expect(article(a, "Bad putzen")).toBeVisible();

    await a.context().setOffline(true);
    await tick(a, "Bad putzen");
    await tick(b, "Müll rausbringen");
    await expectOnServer(request, alex, (data) => data.completions.length, 1);
    await a.context().setOffline(false);

    await expectOnServer(
      request,
      alex,
      (data) => data.completions.map((completion) => completion.completedBy).sort(),
      ["personA", "personB"],
    );
    await goToPage(b, "Statistik", "Eure Bilanz");
    await expect(b.getByRole("img", { name: "Alex 1 Aufgabe, Robin 1 Aufgabe" })).toBeVisible();
  });

  test("Konflikt: Doppelt abgehakt zählt einmal", async ({ browser, request }) => {
    const { alex, robin } = await householdOfTwo(request, seed());
    const a = await openMember(browser, alex);
    const b = await openMember(browser, robin);
    await expect(article(b, "Bad putzen")).toBeVisible();

    await b.context().setOffline(true);
    await tick(b, "Bad putzen");
    await tick(a, "Bad putzen");
    // Alex' Häkchen muss beim Server sein, bevor Robins Gerät wieder Netz hat.
    await expectOnServer(
      request,
      alex,
      (data) => data.completions.map((completion) => completion.completedBy),
      ["personA"],
    );
    await b.context().setOffline(false);

    await b.waitForTimeout(500);
    await expectOnServer(
      request,
      alex,
      (data) => data.completions.map((completion) => completion.completedBy),
      ["personA"],
    );
    await goToPage(b, "Erledigt");
    await expect(b.locator(".done-row")).toHaveCount(1);
    await expect(b.locator(".done-row")).toContainText("Alex");
  });

  test("Konflikt: Dasselbe Feld – die zuletzt angekommene Änderung gilt auf beiden Geräten", async ({
    browser,
    request,
  }) => {
    const { alex, robin } = await householdOfTwo(request, seed());
    const a = await openMember(browser, alex);
    const b = await openMember(browser, robin);
    await expect(article(b, "Bad putzen")).toBeVisible();

    await a.context().setOffline(true);
    await rename(a, "Bad putzen", "Bad von Alex");
    await rename(b, "Bad putzen", "Bad von Robin");
    await expectOnServer(request, alex, (data) => data.tasks[0]?.title, "Bad von Robin");
    await a.context().setOffline(false);

    await expect(article(b, "Bad von Alex")).toBeVisible();
    await expect(article(a, "Bad von Alex")).toBeVisible();
  });

  test("Konflikt: Löschen gewinnt gegen Bearbeiten", async ({ browser, request }) => {
    const { alex, robin } = await householdOfTwo(request, seed());
    const a = await openMember(browser, alex);
    const b = await openMember(browser, robin);
    await expect(article(b, "Bad putzen")).toBeVisible();

    await a.context().setOffline(true);
    await rename(a, "Bad putzen", "Bad gründlich");
    await b.getByRole("button", { name: "Löschen: Bad putzen" }).click();
    await b.getByRole("button", { name: "Ja, Aufgabe löschen" }).click();
    await a.context().setOffline(false);

    await expect(article(a, "Bad gründlich")).toHaveCount(0);
    await expect(article(a, "Müll rausbringen")).toBeVisible();
    await expectOnServer(request, alex, (data) => data.tasks.map((t) => t.id), ["t-muell"]);
  });

  test("Abmelden mit wartenden Änderungen: Rückfrage nennt sie, Sicherungsdatei, Kopie gelöscht; ein anderes Konto sieht nichts davon", async ({
    browser,
    request,
  }) => {
    const { alex, robin } = await householdOfTwo(request, seed());
    const a = await openMember(browser, alex);
    await expect(article(a, "Bad putzen")).toBeVisible();
    await a.evaluate((key) => localStorage.setItem(key, '{"alt":true}'), dataKey);

    await a.context().setOffline(true);
    await tick(a, "Bad putzen");
    await openSettings(a, "Konto und Haushalt");
    await a.getByRole("button", { name: ACCOUNT_TEXTS.signOut }).click();
    const dialog = a.getByRole("dialog", { name: ACCOUNT_TEXTS.signOutQuestion });
    await expect(dialog).toContainText(SHARED_TEXTS.signOutPending(1));
    await expectNoAccessibilityViolations(a);
    const [download] = await Promise.all([
      a.waitForEvent("download"),
      dialog.getByRole("button", { name: SHARED_TEXTS.signOutWithBackup }).click(),
    ]);

    expect(download.suggestedFilename()).toBe(`kruemel-vor-abmelden-${today()}.json`);
    const saved = JSON.parse(
      await a.evaluate((url) => fetch(url).then((r) => r.text()), download.url()),
    ) as AppData;
    expect(saved.completions.map((completion) => completion.taskId)).toEqual(["t-bad"]);
    await heading(a, ACCOUNT_TEXTS.signInTitle);
    expect(await sharedCopyKeys(a)).toEqual([]);
    expect(await a.evaluate((key) => localStorage.getItem(key), FAKE_AUTH_KEY)).toBeNull();
    expect(await a.evaluate((key) => localStorage.getItem(key), dataKey)).toBe('{"alt":true}');

    // Robin meldet sich auf demselben Gerät an: nichts von Alex' wartender Erledigung.
    await a.context().setOffline(false);
    await switchTo(a, robin);
    await expect(a.locator(".app-person")).toHaveText(`${ACCOUNT_TEXTS.signedInAs} Robin`);
    await goToPage(a, "Erledigt");
    await expect(a.locator(".done-row")).toHaveCount(0);
    await expectOnServer(request, alex, (data) => data.completions.length, 0);
  });

  test("Abmelden ohne wartende Änderungen: keine Datei; nach der nächsten Anmeldung kommen die Daten vom Server", async ({
    browser,
    request,
  }) => {
    const { alex, robin } = await householdOfTwo(request, seed());
    const a = await openMember(browser, alex);
    await expect(article(a, "Bad putzen")).toBeVisible();
    let downloads = 0;
    a.on("download", () => {
      downloads++;
    });

    await openSettings(a, "Konto und Haushalt");
    await a.getByRole("button", { name: ACCOUNT_TEXTS.signOut }).click();
    const dialog = a.getByRole("dialog", { name: ACCOUNT_TEXTS.signOutQuestion });
    await expect(dialog).toContainText(SHARED_TEXTS.signOutExplained);
    await dialog.getByRole("button", { name: ACCOUNT_TEXTS.signOut }).click();
    await heading(a, ACCOUNT_TEXTS.signInTitle);
    expect(await sharedCopyKeys(a)).toEqual([]);

    // (Ein neuer Code für dieselbe Adresse ginge erst nach einer Minute; Robin ist auch im Haushalt.)
    await switchTo(a, robin);
    await goToPage(a, "Aufgaben");
    await expect(article(a, "Bad putzen")).toBeVisible();
    expect(await sharedCopyKeys(a)).toHaveLength(1);
    expect(downloads).toBe(0);
  });

  test("Sicherung: Herunterladen geht offline, Einspielen offline abgelehnt, online ersetzt es die Daten für beide", async ({
    browser,
    request,
  }) => {
    const { alex, robin } = await householdOfTwo(request, seed());
    const a = await openMember(browser, alex, "#/einstellungen/daten");
    const b = await openMember(browser, robin);
    await expect(article(b, "Bad putzen")).toBeVisible();
    await heading(a, "Daten");

    await a.context().setOffline(true);
    const [backup] = await Promise.all([
      a.waitForEvent("download"),
      a.getByRole("button", { name: "Sicherung herunterladen", exact: true }).click(),
    ]);
    expect(backup.suggestedFilename()).toBe(`kruemel-${today()}.json`);
    await a.getByRole("button", { name: "Sicherung einspielen …" }).click();
    await expect(a.getByRole("alert")).toContainText(SHARED_TEXTS.importOffline);
    await expect(a.getByRole("alert")).toContainText(SHARED_TEXTS.unchanged);
    await expectNoAccessibilityViolations(a);

    await a.context().setOffline(false);
    const replacement: AppData = { ...seed(), tasks: [task("t-fenster", "Fenster putzen")] };
    const [chooser] = await Promise.all([
      a.waitForEvent("filechooser"),
      a.getByRole("button", { name: "Sicherung einspielen …" }).click(),
    ]);
    await chooser.setFiles(textFile("sicherung.json", JSON.stringify(replacement)));
    const dialog = a.getByRole("dialog", { name: "Sicherung einspielen?" });
    await expect(dialog).toContainText(SHARED_TEXTS.importReplaces(describeContents(2, 0)));
    await Promise.all([
      a.waitForEvent("download"),
      dialog.getByRole("button", { name: "Ja, Daten ersetzen" }).click(),
    ]);

    await expect(article(b, "Fenster putzen")).toBeVisible();
    await expect(article(b, "Bad putzen")).toHaveCount(0);
    await expectOnServer(request, alex, (data) => data.tasks.map((t) => t.id), ["t-fenster"]);
  });

  test("Neue Version verfügbar: Hat eine neuere App in den Haushalt geschrieben, bietet die App Neu laden an", async ({
    browser,
    request,
  }) => {
    const { alex, robin } = await householdOfTwo(request, seed());
    const a = await openMember(browser, alex);
    await expect(article(a, "Bad putzen")).toBeVisible();

    await pushAs(
      request,
      robin,
      { type: "setNames", names: { personA: "Alex", personB: "Robin" }, id: crypto.randomUUID() },
      99,
    );

    const hint = a.getByRole("complementary", { name: SHARED_TEXTS.newVersionLabel });
    await expect(hint).toContainText(SHARED_TEXTS.newVersion);
    await expectNoAccessibilityViolations(a);
    await hint.getByRole("button", { name: SHARED_TEXTS.reload }).click();
    await expect(article(a, "Bad putzen")).toBeVisible();
  });

  test("Kaputte Kopie: Rohdaten sichern, dann neu vom Server laden", async ({
    browser,
    request,
  }) => {
    const { alex } = await householdOfTwo(request, seed());
    const a = await openMember(browser, alex);
    await expect(article(a, "Bad putzen")).toBeVisible();
    const [key] = await sharedCopyKeys(a);
    await a.evaluate((copy) => localStorage.setItem(copy ?? "", "{kaputt"), key);

    await a.reload();
    await heading(a, "Gespeicherte Daten nicht lesbar");
    await Promise.all([
      a.waitForEvent("download"),
      a.getByRole("button", { name: "Rohdaten herunterladen" }).click(),
    ]);
    await a.getByRole("button", { name: SHARED_TEXTS.fromServer }).click();
    await a
      .getByRole("dialog", { name: SHARED_TEXTS.fromServerQuestion })
      .getByRole("button", { name: SHARED_TEXTS.fromServerConfirm })
      .click();

    await expect(article(a, "Bad putzen")).toBeVisible();
  });

  test("Erster Start ohne Verbindung zum Server: Seite „Keine Verbindung“, danach die Daten", async ({
    browser,
    request,
  }) => {
    const { alex } = await householdOfTwo(request, seed());
    // Der Haushalt ist schon bekannt, die Daten noch nie geladen; der Server antwortet nicht.
    const household = await (
      await request.get(`${FAKE_SERVER}/household`, {
        headers: { Authorization: `Bearer ${alex.token}` },
      })
    ).json();
    const a = await openMember(browser, alex, "#/aufgaben", async (context) => {
      await context.addInitScript(
        (value) => localStorage.setItem("kruemel:household", value),
        JSON.stringify({ userId: alex.session.userId, household: household.household }),
      );
      await context.route(`${FAKE_SERVER}/pull**`, (route) => route.abort());
    });

    await heading(a, HOUSEHOLD_TEXTS.unavailableTitle);
    await expect(a.getByRole("alert")).toContainText(SHARED_TEXTS.notLoadedYet);
    await expectNoAccessibilityViolations(a);

    await a.context().unroute(`${FAKE_SERVER}/pull**`);
    await a.getByRole("button", { name: HOUSEHOLD_TEXTS.retry }).click();
    await expect(article(a, "Bad putzen")).toBeVisible();
  });
});
