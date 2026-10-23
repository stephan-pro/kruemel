import { expect, type Page, test } from "@playwright/test";
import type { OneOffTask } from "../../src/domain/task";
import { type AppData, emptyAppData } from "../../src/storage/appData";
import { SYNC_TEXTS } from "../../src/ui/householdTexts";
import { householdOfTwo, type Member, openMember } from "./account";
import { expectNoAccessibilityViolations } from "./axe";
import { goToPage, today } from "./helpers";
import { FAKE_SERVER } from "./shared";

// Package E2-3c: where the shared data stand and what went wrong (mode `e2e` = fake server). The
// hint on top shows only while changes wait; a change the server refuses for good is put aside
// with "Als Datei herunterladen" and "Verwerfen" and survives a reload; conflicts show a hint
// with ×. Everything is read out without moving the focus.

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

const waitingHint = (page: Page) =>
  page.getByRole("complementary", { name: SYNC_TEXTS.waitingLabel });
const rejectedHint = (page: Page) =>
  page.getByRole("complementary", { name: SYNC_TEXTS.rejectedLabel });
const conflictHints = (page: Page) =>
  page.getByRole("complementary", { name: SYNC_TEXTS.conflictLabel });
/** The hidden line that reads the hints out. */
const announced = (page: Page, text: string) => page.getByRole("status").filter({ hasText: text });
const syncTile = (page: Page) => page.getByRole("region", { name: SYNC_TEXTS.tileTitle });

async function tick(page: Page, title: string) {
  if (!page.url().endsWith("#/woche")) {
    await goToPage(page, "Woche", "Diese Woche");
  }
  await page.getByRole("button", { name: `Abhaken: ${title}` }).click();
  await expect(page.getByRole("button", { name: `Abhaken: ${title}` })).toHaveCount(0);
}

/** The fake server refuses the member's next change for good (as Supabase does invalid data). */
async function refuseNext(request: Parameters<typeof householdOfTwo>[0], member: Member) {
  const response = await request.post(`${FAKE_SERVER}/test/refuse`, {
    headers: { Authorization: `Bearer ${member.token}` },
    data: { count: 1 },
  });
  expect(response.ok()).toBe(true);
}

test.describe("E2-3c Abgleichsstand und Fehlerhinweise", () => {
  test("Ohne Internet: oben steht, wie viele Änderungen warten; nach dem Abgleich verschwindet es", async ({
    browser,
    request,
  }) => {
    const { alex } = await householdOfTwo(request, seed());
    const a = await openMember(browser, alex);
    await expect(a.getByRole("article", { name: "Bad putzen" })).toBeVisible();
    await expect(waitingHint(a)).toHaveCount(0);

    await a.context().setOffline(true);
    await tick(a, "Bad putzen");
    await expect(waitingHint(a)).toHaveText(SYNC_TEXTS.waitingOffline(1));
    await expect(announced(a, SYNC_TEXTS.waitingOffline(1))).toHaveCount(1);
    await tick(a, "Müll rausbringen");
    await expect(waitingHint(a)).toHaveText(SYNC_TEXTS.waitingOffline(2));
    // K2b: only the step to offline is read out, not every further change that waits.
    await expect(announced(a, SYNC_TEXTS.waitingOffline(2))).toHaveCount(0);
    await goToPage(a, "Einstellungen");
    await expect(syncTile(a)).toContainText(SYNC_TEXTS.waitingOffline(2));
    await expectNoAccessibilityViolations(a);

    await a.context().setOffline(false);
    await expect(waitingHint(a)).toHaveCount(0);
    await expect(announced(a, SYNC_TEXTS.allSent)).toHaveCount(1);
    await expect(syncTile(a)).toContainText(SYNC_TEXTS.allSent);
    // Die Ansage nimmt den Fokus nicht weg.
    await expect(a.getByRole("heading", { level: 1, name: "Einstellungen" })).toBeFocused();
  });

  test("Server nicht erreichbar: der Hinweis nennt das, und die Änderung geht beim nächsten Abgleich durch", async ({
    browser,
    request,
  }) => {
    const { alex } = await householdOfTwo(request, seed());
    const a = await openMember(browser, alex);
    await expect(a.getByRole("article", { name: "Bad putzen" })).toBeVisible();

    await a.context().route(`${FAKE_SERVER}/push**`, (route) => route.abort());
    await tick(a, "Bad putzen");
    await expect(waitingHint(a)).toHaveText(SYNC_TEXTS.waitingUnreachable(1));

    await a.context().unroute(`${FAKE_SERVER}/push**`);
    await tick(a, "Müll rausbringen");
    await expect(waitingHint(a)).toHaveCount(0);
    await goToPage(a, "Erledigt");
    await expect(a.locator(".done-row")).toHaveCount(2);
  });

  test("Dauerhaft abgelehnt: Hinweis mit „Als Datei herunterladen“ und „Verwerfen“, er übersteht ein Neuladen", async ({
    browser,
    request,
  }) => {
    const { alex } = await householdOfTwo(request, seed());
    const a = await openMember(browser, alex);
    await expect(a.getByRole("article", { name: "Bad putzen" })).toBeVisible();
    await refuseNext(request, alex);

    await goToPage(a, "Woche", "Diese Woche");
    await a.getByRole("button", { name: "Abhaken: Bad putzen" }).click();
    await expect(rejectedHint(a)).toContainText(SYNC_TEXTS.rejected(1));
    await expect(announced(a, SYNC_TEXTS.rejected(1))).toHaveCount(1);
    // Die abgelehnte Erledigung zählt nicht; der Rest läuft weiter.
    await expect(a.getByRole("button", { name: "Abhaken: Bad putzen" })).toBeVisible();
    await tick(a, "Müll rausbringen");
    await expect(waitingHint(a)).toHaveCount(0);
    await expectNoAccessibilityViolations(a);

    await a.reload();
    await expect(rejectedHint(a)).toContainText(SYNC_TEXTS.rejected(1));
    await goToPage(a, "Einstellungen");
    await expect(syncTile(a)).toContainText(SYNC_TEXTS.rejectedTile(1));

    const [download] = await Promise.all([
      a.waitForEvent("download"),
      rejectedHint(a).getByRole("button", { name: SYNC_TEXTS.download }).click(),
    ]);
    expect(download.suggestedFilename()).toBe(`kruemel-nicht-gespeichert-${today()}.json`);
    const file = JSON.parse(
      await a.evaluate((url) => fetch(url).then((r) => r.text()), download.url()),
    );
    expect(file.changes).toHaveLength(1);
    expect(file.changes[0]).toMatchObject({ title: "Bad putzen", change: { type: "complete" } });
    await expect(rejectedHint(a)).toContainText(SYNC_TEXTS.downloaded);

    // Verwerfen fragt nach; Escape bricht ab und gibt den Fokus zurück.
    const discard = rejectedHint(a).getByRole("button", { name: SYNC_TEXTS.discard });
    await discard.click();
    const dialog = a.getByRole("dialog", { name: SYNC_TEXTS.discardQuestion(1) });
    await expect(dialog).toContainText(SYNC_TEXTS.discardDialog);
    await expect(dialog.getByRole("button", { name: "Abbrechen" })).toBeFocused();
    await expectNoAccessibilityViolations(a);
    await a.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(discard).toBeFocused();

    await discard.press("Enter");
    await dialog.getByRole("button", { name: SYNC_TEXTS.discardConfirm }).click();
    await expect(rejectedHint(a)).toHaveCount(0);
    await expect(a.getByRole("heading", { level: 1, name: "Einstellungen" })).toBeFocused();
    await a.reload();
    await expect(syncTile(a)).toContainText(SYNC_TEXTS.allSent);
    await expect(rejectedHint(a)).toHaveCount(0);
  });

  test("Konflikt: Hatte die andere Person schon abgehakt, sagt es ein Hinweis, der mit × zugeht", async ({
    browser,
    request,
  }) => {
    const { alex, robin } = await householdOfTwo(request, seed());
    const a = await openMember(browser, alex);
    const b = await openMember(browser, robin);
    await expect(b.getByRole("article", { name: "Bad putzen" })).toBeVisible();

    await b.context().setOffline(true);
    await tick(b, "Bad putzen");
    await tick(a, "Bad putzen");
    await b.context().setOffline(false);

    const text = SYNC_TEXTS.alreadyDone("Bad putzen", "Alex");
    await expect(conflictHints(b)).toContainText(text);
    await expect(announced(b, text)).toHaveCount(1);
    await expectNoAccessibilityViolations(b);
    await conflictHints(b).getByRole("button", { name: SYNC_TEXTS.close }).click();
    await expect(conflictHints(b)).toHaveCount(0);
    await expect(b.getByRole("heading", { level: 1, name: "Diese Woche" })).toBeFocused();
  });
});
