import { expect, type Locator, type Page, test } from "@playwright/test";
import { demoData } from "../../src/demo/demoData";
import { addDays } from "../../src/domain/date";
import type { Completion } from "../../src/domain/task";
import type { AppData } from "../../src/storage/appData";
import { expectNoAccessibilityViolations } from "./axe";
import { FROZEN_TODAY, goToPage, notice, openWeek, storedData } from "./helpers";

// Package 11: "Erledigt" (F3) with "Rückgängig" for the last completion of a task (F2). The clock
// stands on Wednesday 21.10.2026 (see `week.spec.ts`), so the demo data falls on fixed days:
//   19.10. Müll rausbringen (Alex) · 18.10. Altglas wegbringen (Robin) · 17.10. Küche wischen (Robin)
//   16.10. Bettwäsche wechseln (Alex), Müll rausbringen (Robin) · 14.10. Staubsaugen (Alex)
//   12.10. Bad putzen (Alex) · 07.10. Staubsaugen (Robin) · 05.10. Bad putzen (Alex)
//   01.09. Fenster putzen (Robin)

const demo = () => demoData(FROZEN_TODAY);

async function openDone(page: Page, data: AppData = demo()) {
  await openWeek(page, data);
  await goToPage(page, "Erledigt");
}

const list = (page: Page) => page.getByRole("region", { name: "Erledigte Aufgaben" });
const rows = (page: Page) => list(page).getByRole("listitem");
const row = (page: Page, text: string) => rows(page).filter({ hasText: text });
const undoButton = (scope: Locator, title: string) =>
  scope.getByRole("button", { name: `Rückgängig: ${title}`, exact: true });

/** The titles of the rows, top to bottom. */
async function titles(page: Page): Promise<string[]> {
  return rows(page).locator(".entry__title").allTextContents();
}

test.describe("F3 Erledigt-Liste", () => {
  test("F3 „Erledigt“ zeigt jeden erledigten Durchgang, die neuesten zuerst", async ({ page }) => {
    await openDone(page);

    await expect(rows(page)).toHaveCount(10);
    expect(await titles(page)).toEqual([
      "Müll rausbringen",
      "Altglas wegbringen",
      "Küche wischen",
      "Bettwäsche wechseln",
      "Müll rausbringen",
      "Staubsaugen",
      "Bad putzen",
      "Staubsaugen",
      "Bad putzen",
      "Fenster putzen",
    ]);
    // Eine wiederkehrende Aufgabe steht mit jedem Durchgang da, nicht nur mit dem letzten.
    await expect(page.getByText("10 Einträge")).toBeVisible();
  });

  test("F3 Jede Zeile zeigt Symbol, Titel und „Erledigt von … am …“", async ({ page }) => {
    await openDone(page);

    const first = rows(page).first();
    await expect(first).toContainText("Müll rausbringen");
    await expect(first).toContainText("Erledigt von Alex am Mo, 19.10.2026");
    await expect(first.locator(".task-symbol")).toHaveAttribute("data-symbol", "trash");
    await expect(rows(page).nth(1)).toContainText("Erledigt von Robin am So, 18.10.2026");
    await expect(rows(page).nth(1).locator(".task-symbol")).toHaveAttribute(
      "data-symbol",
      "recycling",
    );
    await expect(rows(page).last()).toContainText("Erledigt von Robin am Di, 01.09.2026");
  });

  test("F3 Die Seite ist eine Kachel mit Zeilen im Stil der Tageskachel und barrierefrei (axe, hell und dunkel)", async ({
    page,
  }) => {
    await openDone(page);

    await expect(page).toHaveTitle("Erledigt – Krümel");
    await expect(page.getByRole("heading", { level: 1, name: "Erledigt" })).toBeFocused();
    await expect(page.getByRole("heading", { level: 2, name: "Erledigte Aufgaben" })).toBeVisible();
    await expect(list(page).locator("ul.entries > li.entry")).toHaveCount(10);
    await expectNoAccessibilityViolations(page);
  });

  test("F3 Ohne Erledigtes steht ein Hinweis statt der Liste", async ({ page }) => {
    await openDone(page, { ...demo(), completions: [] });

    await expect(
      page.getByText("Noch nichts erledigt. Abgehakte Aufgaben stehen hier."),
    ).toBeVisible();
    await expect(page.getByText("0 Einträge")).toBeVisible();
    await expect(rows(page)).toHaveCount(0);
    await expectNoAccessibilityViolations(page);
  });

  test("F3 Auch eine große Zahl Einträge bleibt erhalten und wird ganz gezeigt (unbegrenzt)", async ({
    page,
  }) => {
    const base = demo();
    const old = Array.from(
      { length: 200 },
      (_, index): Completion => ({
        id: `alt-${index}`,
        taskId: "demo-staubsaugen",
        completedOn: addDays(FROZEN_TODAY, -400 + index),
        completedBy: "personB",
        previousDueDate: addDays(FROZEN_TODAY, -400 + index),
        checkedItemIds: [],
      }),
    );
    await openDone(page, { ...base, completions: [...old, ...base.completions] });

    await expect(rows(page)).toHaveCount(210);
    await expect(page.getByText("210 Einträge")).toBeVisible();
  });

  test("F3 Eine abgehakte einmalige Aufgabe landet in „Erledigt“", async ({ page }) => {
    await openWeek(page);
    await page.getByRole("button", { name: "Abhaken: Einkaufen" }).click();
    await expect(notice(page)).toContainText("steht jetzt unter „Erledigt“");

    await goToPage(page, "Erledigt");

    await expect(rows(page)).toHaveCount(11);
    await expect(rows(page).first()).toContainText("Einkaufen");
    await expect(rows(page).first()).toContainText("Erledigt von Alex am Mi, 21.10.2026");
  });
});

test.describe("F2 Rückgängig über „Erledigt“", () => {
  test("F2 „Rückgängig“ gibt es nur beim letzten Abhaken einer Aufgabe", async ({ page }) => {
    await openDone(page);

    // 7 Aufgaben mit Erledigungen → 7 Knöpfe; die älteren Durchgänge von Müll, Staubsaugen und Bad haben keinen.
    await expect(list(page).getByRole("button", { name: /^Rückgängig: / })).toHaveCount(7);
    await expect(undoButton(rows(page).nth(0), "Müll rausbringen")).toBeVisible();
    await expect(rows(page).nth(4)).toContainText("Müll rausbringen");
    await expect(rows(page).nth(4).getByRole("button")).toHaveCount(0);
    await expect(rows(page).nth(7).getByRole("button")).toHaveCount(0);
    await expect(rows(page).nth(8).getByRole("button")).toHaveCount(0);
    await expect(
      page.getByText("Rückgängig machen lässt sich nur das letzte Abhaken einer Aufgabe."),
    ).toBeVisible();
  });

  test("F2 „Rückgängig“ in „Erledigt“ stellt den vorherigen Termin einer wiederkehrenden Aufgabe wieder her", async ({
    page,
  }) => {
    await openDone(page);
    const before = await storedData(page);
    const muell = before.tasks.find((task) => task.id === "demo-muell");
    expect(muell?.dueDate).toBe("2026-10-22");

    await undoButton(rows(page).first(), "Müll rausbringen").click();

    await expect(notice(page)).toContainText(
      "Rückgängig gemacht: „Müll rausbringen“ ist wieder offen, fällig am Mo, 19.10.2026.",
    );
    await expect(rows(page)).toHaveCount(9);
    const after = await storedData(page);
    expect(after.tasks.find((task) => task.id === "demo-muell")?.dueDate).toBe("2026-10-19");
    expect(after.completions).toHaveLength(9);
  });

  test("F2 Danach lässt sich auch der Durchgang davor zurücknehmen", async ({ page }) => {
    await openDone(page);

    await undoButton(rows(page).first(), "Müll rausbringen").click();

    // Der Durchgang vom 16.10. ist jetzt der letzte der Aufgabe und bekommt den Knopf.
    const older = row(page, "Erledigt von Robin am Fr, 16.10.2026");
    await expect(older).toContainText("Müll rausbringen");
    await undoButton(older, "Müll rausbringen").click();
    await expect(rows(page)).toHaveCount(8);
    const data = await storedData(page);
    expect(data.tasks.find((task) => task.id === "demo-muell")?.dueDate).toBe("2026-10-16");
  });

  test("F3 Eine zurückgenommene einmalige Aufgabe steht wieder bei „Aufgaben“", async ({
    page,
  }) => {
    await openDone(page);
    await expect(page.getByRole("heading", { level: 1, name: "Erledigt" })).toBeFocused();

    await undoButton(row(page, "Altglas wegbringen"), "Altglas wegbringen").click();

    await expect(notice(page)).toContainText(
      "„Altglas wegbringen“ ist wieder offen, fällig am Sa, 17.10.2026.",
    );
    await goToPage(page, "Aufgaben");
    await expect(page.getByRole("article", { name: "Altglas wegbringen" })).toBeVisible();
  });

  test("F4 Rückgängig bringt auch die Häkchen der Checkliste einer wiederkehrenden Aufgabe zurück", async ({
    page,
  }) => {
    await openWeek(page);
    // Bad putzen (überfällig, Checkliste mit einem Häkchen) abhaken: die Häkchen werden zurückgesetzt.
    await page.getByRole("button", { name: "Abhaken: Bad putzen" }).click();
    await goToPage(page, "Erledigt");
    const ticked = (await storedData(page)).tasks.find((task) => task.id === "demo-bad");
    expect(ticked?.checklist.map((item) => item.checked)).toEqual([false, false, false]);

    await undoButton(rows(page).first(), "Bad putzen").click();
    await expect(notice(page)).toBeFocused();

    const restored = (await storedData(page)).tasks.find((task) => task.id === "demo-bad");
    expect(restored?.checklist.map((item) => item.checked)).toEqual([true, false, false]);
  });

  test("F2 Nach „Rückgängig“ bekommt die Meldung den Fokus und wird beim nächsten Mal ersetzt", async ({
    page,
  }) => {
    await openDone(page);

    await undoButton(rows(page).first(), "Müll rausbringen").click();

    await expect(notice(page)).toBeFocused();
    await expectNoAccessibilityViolations(page);
    await undoButton(row(page, "Altglas wegbringen"), "Altglas wegbringen").click();
    await expect(notice(page)).toContainText("„Altglas wegbringen“ ist wieder offen");
    await expect(notice(page)).not.toContainText("Müll");
    await expect(notice(page)).toBeFocused();
  });

  test("F2 „Rückgängig“ ist mit der Tastatur zu bedienen", async ({ page }) => {
    await openDone(page);

    await undoButton(rows(page).first(), "Müll rausbringen").focus();
    await page.keyboard.press("Enter");

    await expect(notice(page)).toBeFocused();
    await expect(rows(page)).toHaveCount(9);
  });

  test("F2 Ein Fehler beim Speichern lässt die Liste unverändert und wird gemeldet", async ({
    page,
  }) => {
    await openDone(page);
    await page.evaluate(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("voll", "QuotaExceededError");
      };
    });

    await undoButton(rows(page).first(), "Müll rausbringen").click();

    await expect(page.getByRole("alert")).toContainText("Nicht gespeichert");
    await expect(page.getByRole("alert")).toContainText("Speichern nicht möglich");
    await expect(rows(page)).toHaveCount(10);
    expect((await storedData(page)).completions).toHaveLength(10);
    await expectNoAccessibilityViolations(page);
  });
});

test.describe("N2 Bedienbarkeit von „Erledigt“", () => {
  test("N2 Die Knöpfe sind mindestens 44 px hoch, und die Seite scrollt nicht seitlich", async ({
    page,
  }) => {
    await openDone(page);

    const box = await undoButton(rows(page).first(), "Müll rausbringen").boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("N2 Der Name des Knopfs beginnt mit dem sichtbaren Text und nennt die Aufgabe", async ({
    page,
  }) => {
    await openDone(page);

    const button = undoButton(rows(page).first(), "Müll rausbringen");
    await expect(button).toHaveText("Rückgängig");
  });
});
