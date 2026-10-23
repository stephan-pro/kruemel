import { type APIRequestContext, expect, type Page, test } from "@playwright/test";
import { HOUSEHOLD_MESSAGES, type HouseholdInfo } from "../../src/auth/household";
import { dataWith, weekly } from "../../src/sync/sync.fixtures";
import { DELETE_ACCOUNT_TEXTS } from "../../src/ui/accountTexts";
import { HOUSEHOLD_TEXTS, LEAVE_TEXTS } from "../../src/ui/householdTexts";
import {
  householdOfTwo,
  type Member,
  memberByApi,
  openMember,
  serverData,
  sharedCopyKeys,
} from "./account";
import { expectNoAccessibilityViolations } from "./axe";
import { goToPage } from "./helpers";
import { FAKE_SERVER } from "./shared";

// E2-5a: remove the other person, leave the household, delete one's account; against the fake
// server, the members made through its API (`account.ts`).

const DATA = dataWith([weekly({ assignee: "personB" })]);

const householdTile = (page: Page) => page.getByRole("region", { name: /Haushalt/ }).first();
const accountTile = (page: Page) => page.getByRole("region", { name: "Anmeldung" });
const dialog = (page: Page) => page.getByRole("dialog");

/** The household of a member as the server has it. */
async function householdOf(request: APIRequestContext, member: Member) {
  const response = await request.get(`${FAKE_SERVER}/household`, {
    headers: { Authorization: `Bearer ${member.token}` },
  });
  return ((await response.json()) as { household: HouseholdInfo | null }).household;
}

/** A member's device on the settings page. */
async function settingsOf(browser: Parameters<typeof openMember>[0], member: Member) {
  const page = await openMember(browser, member, "#/heute");
  await goToPage(page, "Einstellungen");
  return page;
}

/** "Haushalt anlegen" with a notice on top. */
async function expectHouseholdPage(page: Page, notice: string) {
  await expect(
    page.getByRole("heading", { level: 1, name: HOUSEHOLD_TEXTS.createTitle }),
  ).toBeVisible();
  await expect(page.getByRole("region", { name: LEAVE_TEXTS.noticeLabel })).toHaveText(notice);
  expect(await sharedCopyKeys(page)).toEqual([]);
}

test.describe("E2-5a Person entfernen", () => {
  test("Rückfrage, Abbrechen, Entfernen: der Platz ist frei, die entfernte Person sieht den Hinweis", async ({
    browser,
    request,
  }) => {
    const { alex, robin } = await householdOfTwo(request, DATA);
    const page = await settingsOf(browser, alex);
    const robinPage = await openMember(browser, robin, "#/heute");
    await expect(robinPage.getByRole("heading", { level: 1 })).toBeVisible();
    const remove = householdTile(page).getByRole("button", { name: LEAVE_TEXTS.remove("Robin") });

    await remove.click();
    await expect(dialog(page)).toContainText(LEAVE_TEXTS.removeDialog("Robin"));
    await expectNoAccessibilityViolations(page);
    await dialog(page).getByRole("button", { name: "Abbrechen" }).click();
    await expect(remove).toBeFocused();
    expect((await householdOf(request, alex))?.members).toEqual(["personA", "personB"]);

    await remove.click();
    await dialog(page).getByRole("button", { name: LEAVE_TEXTS.removeConfirm }).click();
    await expect(
      householdTile(page)
        .getByRole("status")
        .filter({ hasText: LEAVE_TEXTS.removed("Robin") }),
    ).toHaveCount(1);
    await expect(householdTile(page).locator('[data-person="personB"]')).toHaveText(
      /Robin\s*noch nicht dabei/,
    );
    await expect(
      householdTile(page).getByRole("button", { name: HOUSEHOLD_TEXTS.createInvite }),
    ).toBeFocused();
    expect((await serverData(request, alex)).tasks.map((task) => task.title)).toEqual([
      "Bad putzen",
    ]);

    // Robin: at the next look at the household (here: back in the app).
    await robinPage.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expectHouseholdPage(robinPage, LEAVE_TEXTS.notMember);
    await expectNoAccessibilityViolations(robinPage);
  });

  test("Wartet bei der entfernten Person noch etwas, kommt es als Datei; nichts landet in der Ablage", async ({
    browser,
    request,
  }) => {
    const { alex, robin } = await householdOfTwo(request, DATA);
    const robinPage = await settingsOf(browser, robin);
    await robinPage.context().setOffline(true);
    await householdTile(robinPage).getByLabel(HOUSEHOLD_TEXTS.ownNameLabel).fill("Robi");
    await householdTile(robinPage).getByRole("button", { name: HOUSEHOLD_TEXTS.saveNames }).click();
    await expect(robinPage.locator(".app-person")).toContainText("Robi");

    await request.post(`${FAKE_SERVER}/household/remove`, {
      headers: { Authorization: `Bearer ${alex.token}` },
      data: { person: "personB" },
    });
    const download = robinPage.waitForEvent("download");
    await robinPage.context().setOffline(false);

    expect((await download).suggestedFilename()).toMatch(
      /^kruemel-vor-austritt-\d{4}-\d{2}-\d{2}\.json$/,
    );
    await expectHouseholdPage(robinPage, `${LEAVE_TEXTS.notMember} ${LEAVE_TEXTS.pendingSaved}`);
    expect((await serverData(request, alex)).settings.personNames?.personB).toBe("Robin");
  });
});

test.describe("E2-5a Haushalt verlassen", () => {
  test("Robin geht mit Sicherung aus der Rückfrage; Alex behält alles und kann neu einladen", async ({
    browser,
    request,
  }) => {
    const { alex, robin } = await householdOfTwo(request, DATA);
    const page = await settingsOf(browser, robin);

    await householdTile(page).getByRole("button", { name: LEAVE_TEXTS.leave }).click();
    await expect(dialog(page)).toContainText(LEAVE_TEXTS.leaveDialog("Alex"));
    const backup = page.waitForEvent("download");
    await dialog(page).getByRole("button", { name: LEAVE_TEXTS.backup }).click();
    expect((await backup).suggestedFilename()).toMatch(/^kruemel-\d{4}-\d{2}-\d{2}\.json$/);
    await expect(dialog(page).getByRole("status")).toHaveText(LEAVE_TEXTS.backupDone);
    await expectNoAccessibilityViolations(page);
    await dialog(page).getByRole("button", { name: LEAVE_TEXTS.leaveConfirm }).click();

    await expectHouseholdPage(page, LEAVE_TEXTS.youLeft);
    expect(await householdOf(request, robin)).toBeNull();
    expect(await householdOf(request, alex)).toMatchObject({ members: ["personA"] });
    expect((await serverData(request, alex)).tasks.map((task) => task.assignee)).toEqual([
      "personB",
    ]);
  });

  test("Die letzte Person nimmt den Haushalt mit: die Rückfrage sagt es, die Sicherung kommt von selbst", async ({
    browser,
    request,
  }) => {
    const alex = await memberByApi(request);
    await request.post(`${FAKE_SERVER}/household/create`, {
      headers: { Authorization: `Bearer ${alex.token}` },
      data: { personA: "Alex", personB: "Robin" },
    });
    const page = await settingsOf(browser, alex);

    await householdTile(page).getByRole("button", { name: LEAVE_TEXTS.leave }).click();
    await expect(dialog(page)).toContainText(LEAVE_TEXTS.leaveLastDialog);
    await expect(dialog(page).getByRole("button", { name: LEAVE_TEXTS.backup })).toHaveCount(0);
    const download = page.waitForEvent("download");
    await dialog(page).getByRole("button", { name: LEAVE_TEXTS.leaveLastConfirm }).click();

    expect((await download).suggestedFilename()).toMatch(/^kruemel-vor-austritt-/);
    await expectHouseholdPage(page, LEAVE_TEXTS.youLeft);
    expect(await householdOf(request, alex)).toBeNull();
  });
});

test.describe("E2-5a Konto löschen", () => {
  test("Erst mit dem Wort „löschen“; danach Anmeldeseite mit Hinweis, Alex behält Haushalt und Daten", async ({
    browser,
    request,
  }) => {
    const { alex, robin } = await householdOfTwo(request, DATA);
    const page = await settingsOf(browser, robin);
    const open = accountTile(page).getByRole("button", { name: DELETE_ACCOUNT_TEXTS.open });
    const word = () => dialog(page).getByLabel(DELETE_ACCOUNT_TEXTS.wordLabel);
    const confirm = () => dialog(page).getByRole("button", { name: DELETE_ACCOUNT_TEXTS.confirm });

    await open.click();
    await expect(
      dialog(page).getByRole("heading", { name: DELETE_ACCOUNT_TEXTS.question }),
    ).toBeFocused();
    for (const text of [
      DELETE_ACCOUNT_TEXTS.goes,
      DELETE_ACCOUNT_TEXTS.stays("Alex"),
      DELETE_ACCOUNT_TEXTS.noUndo,
      DELETE_ACCOUNT_TEXTS.wayBack,
    ]) {
      await expect(dialog(page)).toContainText(text);
    }
    await confirm().click();
    await expect(word()).toBeFocused();
    await expect(word()).toHaveAccessibleDescription(DELETE_ACCOUNT_TEXTS.wordMissing);
    await word().fill("loeschen");
    await confirm().click();
    await expect(word()).toHaveAttribute("aria-invalid", "true");
    await expectNoAccessibilityViolations(page);
    await page.keyboard.press("Escape");
    await expect(open).toBeFocused();
    expect(await householdOf(request, robin)).not.toBeNull();

    await open.click();
    await expect(word()).toHaveValue("");
    await word().fill(" LÖSCHEN ");
    await confirm().click();

    await expect(page.getByRole("heading", { level: 1, name: "Anmelden" })).toBeVisible();
    await expect(page.getByText(DELETE_ACCOUNT_TEXTS.deleted)).toBeVisible();
    expect(await sharedCopyKeys(page)).toEqual([]);
    expect(
      await page.evaluate(() => [
        localStorage.getItem("kruemel:household"),
        localStorage.getItem("kruemel-fake:auth"),
      ]),
    ).toEqual([null, null]);
    expect(await householdOf(request, alex)).toMatchObject({ members: ["personA"] });
    expect((await serverData(request, alex)).tasks).toHaveLength(1);
    // The session is gone on the server as well.
    const ended = await request.get(`${FAKE_SERVER}/household`, {
      headers: { Authorization: `Bearer ${robin.token}` },
    });
    expect(ended.status()).toBe(401);
  });
});

test.describe("E2-5a Ohne Netz und am Handy", () => {
  test("Ohne Netz ändern Entfernen, Verlassen und Konto löschen nichts und sagen warum", async ({
    browser,
    request,
  }) => {
    const { alex } = await householdOfTwo(request, DATA);
    const page = await settingsOf(browser, alex);
    await page.context().setOffline(true);
    const tile = householdTile(page);

    await tile.getByRole("button", { name: LEAVE_TEXTS.remove("Robin") }).click();
    await dialog(page).getByRole("button", { name: LEAVE_TEXTS.removeConfirm }).click();
    await expect(tile.getByRole("alert")).toContainText(HOUSEHOLD_MESSAGES.offline);

    await tile.getByRole("button", { name: LEAVE_TEXTS.leave }).click();
    await dialog(page).getByRole("button", { name: LEAVE_TEXTS.leaveConfirm }).click();
    await expect(
      tile.getByRole("alert").filter({ hasText: LEAVE_TEXTS.leaveFailed }),
    ).toContainText(HOUSEHOLD_MESSAGES.offline);

    await accountTile(page).getByRole("button", { name: DELETE_ACCOUNT_TEXTS.open }).click();
    await dialog(page).getByLabel(DELETE_ACCOUNT_TEXTS.wordLabel).fill("löschen");
    await dialog(page).getByRole("button", { name: DELETE_ACCOUNT_TEXTS.confirm }).click();
    await expect(accountTile(page).getByRole("alert")).toContainText(HOUSEHOLD_MESSAGES.offline);

    await page.context().setOffline(false);
    expect(await householdOf(request, alex)).toMatchObject({ members: ["personA", "personB"] });
    expect(await sharedCopyKeys(page)).toHaveLength(1);
    await expect(page.getByRole("heading", { level: 1, name: "Einstellungen" })).toBeVisible();
  });

  test("Am Handy (360 px) passen Kachel und Rückfragen ohne Querlauf", async ({
    browser,
    request,
  }) => {
    const { alex } = await householdOfTwo(request, DATA);
    const page = await settingsOf(browser, alex);
    await page.setViewportSize({ width: 360, height: 640 });
    const overflow = () =>
      page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );

    expect(await overflow()).toBe(false);
    await householdTile(page).getByRole("button", { name: LEAVE_TEXTS.leave }).click();
    await expect(dialog(page)).toBeVisible();
    expect(await overflow()).toBe(false);
    await dialog(page).getByRole("button", { name: "Abbrechen" }).click();
    await accountTile(page).getByRole("button", { name: DELETE_ACCOUNT_TEXTS.open }).click();
    await expect(dialog(page)).toBeVisible();
    expect(await overflow()).toBe(false);
    const box = await dialog(page).boundingBox();
    expect(box?.width ?? 999).toBeLessThanOrEqual(360);
    await expectNoAccessibilityViolations(page);
  });
});
