import { expect, type Page, test } from "@playwright/test";
import { expectNoAccessibilityViolations } from "./axe";
import {
  chooseDay,
  detailDialog,
  detailValue,
  expectPageShown,
  notice,
  openWeek,
  overdueTile,
  storedData,
  taskButton,
  tile,
  todayTile,
} from "./helpers";

// Package 10: a tap or click on a task of the week view opens its details (F6); there are
// "Bearbeiten", "Übernehmen" and the checklist (F4, F5). Escape closes the view and the focus
// returns to the task. The clock stands on Wednesday 21.10.2026 (see `week.spec.ts`).

/** The stored ticks of a task; a box shows its tick at once, the shared storage a moment later. */
async function checkedOf(page: Page, id: string) {
  const task = (await storedData(page)).tasks.find((candidate) => candidate.id === id);
  return task?.checklist.map((item) => item.checked);
}

test.describe("F6 Detailansicht einer Aufgabe", () => {
  test("F6 Ein Klick auf eine Aufgabe öffnet ihre Detailansicht mit allen Angaben", async ({
    page,
  }) => {
    await openWeek(page);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await taskButton(todayTile(page), "Einkaufen").click();

    const dialog = detailDialog(page, "Einkaufen");
    await expect(dialog).toBeVisible();
    await expect(detailValue(dialog, "Zuständig")).toHaveText("Beide");
    await expect(detailValue(dialog, "Art")).toHaveText("Einmalige Aufgabe");
    await expect(detailValue(dialog, "Fällig am")).toHaveText("Mi, 21.10.2026");
    // Die Checkliste mit ihren Häkchen, dazu die Knöpfe der Ansicht.
    const checklist = dialog.getByRole("group", { name: "Checkliste: Einkaufen" });
    await expect(checklist.getByRole("checkbox")).toHaveCount(4);
    await expect(checklist.getByRole("checkbox", { name: "Milch" })).toBeChecked();
    await expect(checklist.getByRole("checkbox", { name: "Obst" })).not.toBeChecked();
    await expect(dialog).toContainText("2 von 4 abgehakt");
    await expect(dialog.getByRole("link", { name: "Bearbeiten" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Übernehmen" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Schließen" })).toBeVisible();
    await expectNoAccessibilityViolations(page);
  });

  test("F6 Die Detailansicht einer überfälligen Aufgabe nennt Rhythmus, Termin mit Verzug und Notiz", async ({
    page,
  }) => {
    await openWeek(page);

    await taskButton(overdueTile(page), "Bad putzen").click();

    const dialog = detailDialog(page, "Bad putzen");
    await expect(dialog).toBeVisible();
    await expect(detailValue(dialog, "Zuständig")).toHaveText("Alex");
    await expect(detailValue(dialog, "Rhythmus")).toHaveText("wöchentlich");
    await expect(detailValue(dialog, "Nächster Termin")).toHaveText(
      "Mo, 19.10.2026 (2 Tage überfällig)",
    );
    await expect(detailValue(dialog, "Notiz")).toHaveText(
      "Mit Essigreiniger, nicht mit Scheuermilch",
    );
    // Die eigene Aufgabe lässt sich nicht „übernehmen“.
    await expect(dialog.getByRole("button", { name: "Übernehmen" })).toHaveCount(0);
    await expectNoAccessibilityViolations(page);
  });

  test("F6 Auch eine Aufgabe in „Woche im Überblick“ (am PC) öffnet die Detailansicht", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Die Tagesspalten gibt es nur am PC");
    await openWeek(page);

    const strip = page.getByRole("region", { name: "Woche im Überblick" });
    await strip.getByRole("button", { name: /^Paket abholen/ }).click();

    await expect(detailDialog(page, "Paket abholen")).toBeVisible();
    await expect(detailValue(detailDialog(page, "Paket abholen"), "Zuständig")).toHaveText("Robin");
  });

  test("F6 Eine erledigte Aufgabe in einer vergangenen Woche zeigt, wer sie wann erledigt hat", async ({
    page,
  }) => {
    await openWeek(page);
    await page.getByRole("button", { name: "Vorherige Woche" }).click();

    await taskButton(tile(page, "Mo, 12.10."), "Bad putzen").click();

    const dialog = detailDialog(page, "Bad putzen");
    await expect(dialog).toBeVisible();
    await expect(detailValue(dialog, "Erledigt")).toHaveText("Erledigt von Alex am Mo, 12.10.2026");
    // Nichts mehr abzuhaken oder zu übernehmen; bearbeiten lässt sich die Aufgabe weiterhin.
    await expect(dialog.getByRole("group")).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Übernehmen" })).toHaveCount(0);
    await expect(dialog.getByRole("link", { name: "Bearbeiten" })).toBeVisible();
    await expectNoAccessibilityViolations(page);
  });

  test("F6 Die Detailansicht lässt sich mit der Tastatur öffnen; der Fokus beginnt beim Titel", async ({
    page,
  }) => {
    await openWeek(page);

    const opener = taskButton(todayTile(page), "Einkaufen");
    await opener.focus();
    await page.keyboard.press("Enter");

    const dialog = detailDialog(page, "Einkaufen");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { level: 2, name: "Einkaufen" })).toBeFocused();
  });

  test("F6 Der Fokus bleibt in der Detailansicht, solange sie offen ist (Tab geht im Kreis)", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === "webkit", "Safari springt mit Tab nicht auf Links");
    await openWeek(page);
    await taskButton(todayTile(page), "Einkaufen").click();
    const dialog = detailDialog(page, "Einkaufen");
    await expect(dialog).toBeVisible();

    // 4 Kästchen, Bearbeiten, Übernehmen, Schließen: danach beginnt es wieder in der Ansicht (oder
    // in der Leiste des Browsers), nie bei einer Aufgabe dahinter.
    for (let step = 0; step < 12; step++) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(
        () =>
          document.activeElement === document.body ||
          document.activeElement?.closest("dialog") !== null,
      );
      expect(inside).toBe(true);
    }
  });

  test("F6 Escape schließt die Detailansicht, und der Fokus kehrt auf die Aufgabe zurück", async ({
    page,
  }) => {
    await openWeek(page);
    const before = await storedData(page);
    const opener = taskButton(todayTile(page), "Einkaufen");
    await opener.click();
    await expect(detailDialog(page, "Einkaufen")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(opener).toBeFocused();
    expect(await storedData(page)).toEqual(before);
  });

  test("F6 „Schließen“ schließt die Detailansicht, und der Fokus kehrt auf die Aufgabe zurück", async ({
    page,
  }) => {
    await openWeek(page);
    const opener = taskButton(overdueTile(page), "Bad putzen");
    await opener.click();
    const dialog = detailDialog(page, "Bad putzen");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Schließen" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(opener).toBeFocused();
  });

  test("F6 Aus der Detailansicht führt „Bearbeiten“ zum Formular dieser Aufgabe", async ({
    page,
  }) => {
    await openWeek(page);
    await taskButton(todayTile(page), "Einkaufen").click();

    await detailDialog(page, "Einkaufen").getByRole("link", { name: "Bearbeiten" }).click();

    await expectPageShown(page, "Aufgabe bearbeiten");
    await expect(page.getByLabel("Titel")).toHaveValue("Einkaufen");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("F6 Beim Abhaken in der Zeile bleibt alles wie vorher: Abhaken öffnet keine Detailansicht", async ({
    page,
  }) => {
    await openWeek(page);

    await page.getByRole("button", { name: "Abhaken: Staubsaugen" }).click();

    await expect(notice(page)).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test.describe("F4 Checkliste in der Detailansicht", () => {
  test("F4 Ein Häkchen in der Detailansicht wird gespeichert und zeigt sich auch in der Zeile", async ({
    page,
  }) => {
    await openWeek(page);
    await taskButton(todayTile(page), "Einkaufen").click();
    const dialog = detailDialog(page, "Einkaufen");

    await dialog.getByRole("checkbox", { name: "Obst" }).check();

    await expect(dialog).toContainText("3 von 4 abgehakt");
    await expect(dialog).toBeVisible();
    await expect.poll(() => checkedOf(page, "demo-einkaufen")).toEqual([true, true, true, false]);

    await dialog.getByRole("button", { name: "Schließen" }).click();
    await expect(todayTile(page)).toContainText("3 von 4 abgehakt");
  });

  test("F4 Ein Häkchen lässt sich wieder abwählen", async ({ page }) => {
    await openWeek(page);
    await taskButton(todayTile(page), "Einkaufen").click();
    const dialog = detailDialog(page, "Einkaufen");

    await dialog.getByRole("checkbox", { name: "Milch" }).uncheck();

    await expect(dialog).toContainText("1 von 4 abgehakt");
    await expect.poll(() => checkedOf(page, "demo-einkaufen")).toEqual([false, true, false, false]);
  });

  test("F4 Mit der Tastatur: Leertaste setzt das Häkchen, der Fokus bleibt auf dem Kästchen", async ({
    page,
  }) => {
    await openWeek(page);
    await taskButton(todayTile(page), "Einkaufen").click();
    const dialog = detailDialog(page, "Einkaufen");
    const box = dialog.getByRole("checkbox", { name: "Spülmittel" });

    await box.focus();
    await page.keyboard.press("Space");

    await expect(box).toBeChecked();
    await expect(box).toBeFocused();
  });

  test("F4 Ein voller Speicher wird in der Detailansicht gemeldet; das Häkchen bleibt, wie es war", async ({
    page,
  }) => {
    await openWeek(page);
    await taskButton(todayTile(page), "Einkaufen").click();
    const dialog = detailDialog(page, "Einkaufen");
    await page.evaluate(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("voll", "QuotaExceededError");
      };
    });

    await dialog.getByRole("checkbox", { name: "Obst" }).click();

    await expect(dialog.getByRole("alert")).toContainText("Nicht gespeichert");
    await expect(dialog.getByRole("checkbox", { name: "Obst" })).not.toBeChecked();
    await expectNoAccessibilityViolations(page);
  });

  test("F4 Eine Aufgabe ohne Checkliste zeigt in der Detailansicht keine", async ({ page }) => {
    await openWeek(page);

    await taskButton(todayTile(page), "Staubsaugen").click();

    await expect(detailDialog(page, "Staubsaugen")).toBeVisible();
    await expect(detailDialog(page, "Staubsaugen").getByRole("group")).toHaveCount(0);
  });
});

test.describe("F6 Detailansicht: Aufgaben anderer Wochen", () => {
  test("F6 In der nächsten Woche öffnet eine Aufgabe ihre Detailansicht; Escape bringt den Fokus zurück", async ({
    page,
  }) => {
    await openWeek(page);
    await page.getByRole("button", { name: "Nächste Woche" }).click();
    await chooseDay(page, "Fr 30.", "Fr, 30.10.");
    const opener = taskButton(tile(page, "Fr, 30.10."), "Bettwäsche wechseln");

    await opener.click();

    const dialog = detailDialog(page, "Bettwäsche wechseln");
    await expect(detailValue(dialog, "Rhythmus")).toHaveText("alle 2 Wochen");
    await page.keyboard.press("Escape");
    await expect(opener).toBeFocused();
  });
});
