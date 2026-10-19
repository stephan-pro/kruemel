import { expect, type Page, test } from "@playwright/test";
import { expectNoAccessibilityViolations } from "./axe";
import {
  chooseDay,
  expectPageShown,
  goToPage,
  notice,
  openWeek,
  storedData,
  tile,
  todayTile,
} from "./helpers";

// Package 10: checklists (F4) in the rows of the week view and in the task form. The clock stands
// on Wednesday 21.10.2026 (see `week.spec.ts`): "Einkaufen" (due today, Milch and Brot ticked,
// Obst and Spülmittel not) and "Küche wischen" (Sa 24., Herd, Arbeitsplatte, Boden, none ticked).

const group = (page: Page, title: string) =>
  todayTile(page).getByRole("group", { name: `Checkliste: ${title}` });

/** Phones fold the boxes away behind "Checkliste"; this opens them there and does nothing at the PC. */
async function showChecklist(page: Page, title: string) {
  await expect(todayTile(page)).toBeVisible();
  const toggle = todayTile(page).getByRole("button", { name: `Checkliste: ${title}` });
  if (await toggle.isVisible()) {
    await toggle.click();
  }
  await expect(group(page, title)).toBeVisible();
}

async function checkedOf(page: Page, id: string): Promise<boolean[] | undefined> {
  const task = (await storedData(page)).tasks.find((candidate) => candidate.id === id);
  return task?.checklist.map((item) => item.checked);
}

test.describe("F4 Checkliste in der Zeile", () => {
  test("F4 Die Einträge stehen als Kästchen in der Zeile, die Häkchen stimmen mit den Daten überein", async ({
    page,
  }) => {
    await openWeek(page);
    await showChecklist(page, "Einkaufen");

    const boxes = group(page, "Einkaufen").getByRole("checkbox");
    await expect(boxes).toHaveCount(4);
    await expect(boxes.nth(0)).toHaveAccessibleName("Milch");
    await expect(boxes.nth(1)).toHaveAccessibleName("Brot");
    await expect(boxes.nth(2)).toHaveAccessibleName("Obst");
    await expect(boxes.nth(3)).toHaveAccessibleName("Spülmittel");
    await expect(boxes.nth(0)).toBeChecked();
    await expect(boxes.nth(1)).toBeChecked();
    await expect(boxes.nth(2)).not.toBeChecked();
    await expect(boxes.nth(3)).not.toBeChecked();
    await expectNoAccessibilityViolations(page);
  });

  test("F4 Am PC sind die Einträge immer sichtbar, am Handy klappt „Checkliste“ sie auf und zu", async ({
    page,
    isMobile,
  }) => {
    await openWeek(page);
    const toggle = todayTile(page).getByRole("button", { name: "Checkliste: Einkaufen" });

    if (isMobile) {
      await expect(group(page, "Einkaufen")).toBeHidden();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect(group(page, "Einkaufen")).toBeVisible();
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(group(page, "Einkaufen")).toBeHidden();
    } else {
      await expect(toggle).toBeHidden();
      await expect(group(page, "Einkaufen")).toBeVisible();
    }
  });

  test("F4 Ein Häkchen wird sofort gespeichert; der Fortschritt zieht mit, es gibt keinen Hinweis und der Fokus bleibt", async ({
    page,
  }) => {
    await openWeek(page);
    await showChecklist(page, "Einkaufen");
    const obst = group(page, "Einkaufen").getByRole("checkbox", { name: "Obst" });

    await obst.focus();
    await page.keyboard.press("Space");

    await expect(obst).toBeChecked();
    await expect(obst).toBeFocused();
    expect(await checkedOf(page, "demo-einkaufen")).toEqual([true, true, true, false]);
    await expect(todayTile(page)).toContainText("3 von 4 abgehakt");
    await expect(notice(page)).toHaveCount(0);
    // Die Aufgabe selbst bleibt offen.
    await expect(todayTile(page).getByRole("button", { name: "Abhaken: Einkaufen" })).toBeVisible();
  });

  test("F4 Ein Häkchen lässt sich mit der Maus setzen und wieder abwählen", async ({ page }) => {
    await openWeek(page);
    await showChecklist(page, "Einkaufen");
    const boxes = group(page, "Einkaufen");

    await boxes.getByRole("checkbox", { name: "Spülmittel" }).check();
    expect(await checkedOf(page, "demo-einkaufen")).toEqual([true, true, false, true]);
    await boxes.getByRole("checkbox", { name: "Milch" }).uncheck();

    expect(await checkedOf(page, "demo-einkaufen")).toEqual([false, true, false, true]);
    await expect(todayTile(page)).toContainText("2 von 4 abgehakt");
  });

  test("F4 Die Häkchen bleiben nach dem Neuladen bestehen", async ({ page }) => {
    await openWeek(page);
    await showChecklist(page, "Einkaufen");
    await group(page, "Einkaufen").getByRole("checkbox", { name: "Obst" }).check();

    await page.reload();

    await showChecklist(page, "Einkaufen");
    await expect(group(page, "Einkaufen").getByRole("checkbox", { name: "Obst" })).toBeChecked();
  });

  test("F4 Ein voller Speicher wird gemeldet; das Kästchen zeigt wieder, was gespeichert ist", async ({
    page,
  }) => {
    await openWeek(page);
    await showChecklist(page, "Einkaufen");
    await page.evaluate(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("voll", "QuotaExceededError");
      };
    });

    await group(page, "Einkaufen").getByRole("checkbox", { name: "Obst" }).click();

    await expect(page.getByRole("alert")).toContainText("Nicht gespeichert");
    await expect(
      group(page, "Einkaufen").getByRole("checkbox", { name: "Obst" }),
    ).not.toBeChecked();
    expect(await checkedOf(page, "demo-einkaufen")).toEqual([true, true, false, false]);
  });

  test("F4 Beim Abhaken einer wiederkehrenden Aufgabe sind die Häkchen danach zurückgesetzt, die Einträge bleiben", async ({
    page,
  }) => {
    await openWeek(page);
    await chooseDay(page, "Sa 24.", "Sa, 24.10.");
    const saturday = tile(page, "Sa, 24.10.");
    const toggle = saturday.getByRole("button", { name: "Checkliste: Küche wischen" });
    if (await toggle.isVisible()) {
      await toggle.click();
    }
    const boxes = saturday.getByRole("group", { name: "Checkliste: Küche wischen" });
    await boxes.getByRole("checkbox", { name: "Herd" }).check();
    await boxes.getByRole("checkbox", { name: "Boden" }).check();
    expect(await checkedOf(page, "demo-kueche")).toEqual([true, false, true]);

    await saturday.getByRole("button", { name: "Abhaken: Küche wischen" }).click();

    await expect(notice(page)).toBeVisible();
    expect(await checkedOf(page, "demo-kueche")).toEqual([false, false, false]);
  });

  test("F4 Jedes Kästchen ist mindestens 44 Pixel hoch und eine Gruppe mit dem Namen der Aufgabe", async ({
    page,
  }) => {
    await openWeek(page);
    await showChecklist(page, "Einkaufen");

    const heights = await group(page, "Einkaufen")
      .locator(".check")
      .evaluateAll((labels) => labels.map((label) => label.getBoundingClientRect().height));

    expect(heights).toHaveLength(4);
    for (const height of heights) {
      expect(height).toBeGreaterThanOrEqual(44);
    }
  });

  test("F4 Erledigtes in einer vergangenen Woche zeigt keine Kästchen", async ({ page }) => {
    await openWeek(page);

    await page.getByRole("button", { name: "Vorherige Woche" }).click();

    await expect(page.getByRole("checkbox")).toHaveCount(0);
  });
});

test.describe("F4 Checkliste im Aufgabenformular", () => {
  async function openNewTask(page: Page) {
    await openWeek(page);
    await page.getByRole("link", { name: "Neue Aufgabe" }).click();
    await expectPageShown(page, "Neue Aufgabe");
  }

  async function openEdit(page: Page, title: string) {
    await openWeek(page);
    await goToPage(page, "Aufgaben");
    await page.getByRole("link", { name: `Bearbeiten: ${title}` }).click();
    await expectPageShown(page, "Aufgabe bearbeiten");
  }

  const field = (page: Page) => page.getByLabel("Neuer Eintrag");
  const addButton = (page: Page) => page.getByRole("button", { name: "Hinzufügen" });

  async function addItem(page: Page, text: string) {
    await field(page).fill(text);
    await addButton(page).click();
  }

  test("F4 Das Formular hat ein Feld „Neuer Eintrag“ mit sichtbarer Beschriftung, anfangs ohne Einträge", async ({
    page,
  }) => {
    await openNewTask(page);

    await expect(page.locator("legend", { hasText: "Checkliste (optional)" })).toBeVisible();
    await expect(page.locator("label", { hasText: "Neuer Eintrag" })).toBeVisible();
    await expect(addButton(page)).toBeVisible();
    await expect(page.locator(".checklist-editor")).toHaveCount(0);
    await expectNoAccessibilityViolations(page);
  });

  test("F4 Einträge lassen sich hinzufügen: der Knopf und die Eingabetaste, ohne das Formular abzusenden", async ({
    page,
  }) => {
    await openNewTask(page);

    await addItem(page, "  Milch ");
    await expect(page.locator(".checklist-editor__item")).toHaveText(["Milch"]);
    await expect(field(page)).toHaveValue("");
    await expect(field(page)).toBeFocused();
    await expect(
      page.getByRole("status").filter({ hasText: "Eintrag „Milch“ hinzugefügt." }),
    ).toBeAttached();

    await field(page).fill("Brot");
    await page.keyboard.press("Enter");

    await expect(page.locator(".checklist-editor__item")).toHaveText(["Milch", "Brot"]);
    await expect(page.getByRole("heading", { level: 1, name: "Neue Aufgabe" })).toBeVisible();
    await expectNoAccessibilityViolations(page);
  });

  test("F4 Gespeichert werden die Einträge samt Aufgabe; in der Woche stehen sie als Kästchen", async ({
    page,
  }) => {
    await openNewTask(page);
    await page.getByRole("radio", { name: "Einmalig (z. B. Paket abholen)" }).check();
    await page.getByLabel("Titel").fill("Wocheneinkauf");
    await addItem(page, "Milch");
    await addItem(page, "Brot");

    await page.getByRole("button", { name: "Aufgabe anlegen" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Aufgaben" })).toBeFocused();
    const saved = (await storedData(page)).tasks.find((task) => task.title === "Wocheneinkauf");
    expect(saved?.checklist.map((item) => [item.text, item.checked])).toEqual([
      ["Milch", false],
      ["Brot", false],
    ]);
    expect(new Set(saved?.checklist.map((item) => item.id)).size).toBe(2);
    await page.getByRole("link", { name: "Woche", exact: true }).click();
    await expectPageShown(page, "Diese Woche");
    await expect(todayTile(page)).toContainText("Wocheneinkauf");
    await expect(todayTile(page)).toContainText("0 von 2 abgehakt");
  });

  test("F4 Was im Feld steht, wenn man speichert, wird als letzter Eintrag mitgespeichert", async ({
    page,
  }) => {
    await openNewTask(page);
    await page.getByLabel("Titel").fill("Wocheneinkauf");
    await addItem(page, "Milch");
    await field(page).fill("Brot");

    await page.getByRole("button", { name: "Aufgabe anlegen" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Aufgaben" })).toBeFocused();
    const saved = (await storedData(page)).tasks.find((task) => task.title === "Wocheneinkauf");
    expect(saved?.checklist.map((item) => item.text)).toEqual(["Milch", "Brot"]);
  });

  test("F4 Einträge lassen sich löschen; der Fokus geht ins Feld, und es wird angesagt", async ({
    page,
  }) => {
    await openNewTask(page);
    await page.getByLabel("Titel").fill("Wocheneinkauf");
    await addItem(page, "Milch");
    await addItem(page, "Brot");
    await addItem(page, "Obst");

    await page.getByRole("button", { name: "Eintrag löschen: Brot" }).click();

    await expect(page.locator(".checklist-editor__item")).toHaveText(["Milch", "Obst"]);
    await expect(field(page)).toBeFocused();
    await expect(
      page.getByRole("status").filter({ hasText: "Eintrag „Brot“ gelöscht." }),
    ).toBeAttached();
    // Jeder Löschen-Knopf ist mindestens 44 × 44 Pixel groß.
    for (const box of await page.getByRole("button", { name: /^Eintrag löschen/ }).all()) {
      const size = await box.boundingBox();
      expect(size?.width).toBeGreaterThanOrEqual(44);
      expect(size?.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole("button", { name: "Aufgabe anlegen" }).click();
    const saved = (await storedData(page)).tasks.find((task) => task.title === "Wocheneinkauf");
    expect(saved?.checklist.map((item) => item.text)).toEqual(["Milch", "Obst"]);
  });

  test("F4 Ein leerer Eintrag wird am Feld gemeldet; sobald man tippt, ist die Meldung weg", async ({
    page,
  }) => {
    await openNewTask(page);

    await addButton(page).click();

    await expect(page.getByText("Bitte einen Text für den Eintrag eingeben.")).toBeVisible();
    await expect(field(page)).toBeFocused();
    await expect(field(page)).toHaveAttribute("aria-invalid", "true");
    await expect(field(page)).toHaveAccessibleDescription(
      "Bitte einen Text für den Eintrag eingeben.",
    );
    await expectNoAccessibilityViolations(page);

    await field(page).fill("M");
    await expect(page.getByText("Bitte einen Text für den Eintrag eingeben.")).toHaveCount(0);
  });

  test("F4 Ein zu langer Eintrag wird beim Speichern am Feld gemeldet; nichts wird gespeichert", async ({
    page,
  }) => {
    await openNewTask(page);
    await page.getByLabel("Titel").fill("Wocheneinkauf");
    const before = (await storedData(page)).tasks.length;
    await field(page).fill("x".repeat(81));

    await page.getByRole("button", { name: "Aufgabe anlegen" }).click();

    await expect(field(page)).toBeFocused();
    await expect(field(page)).toHaveAccessibleDescription(
      "Ein Eintrag darf höchstens 80 Zeichen lang sein.",
    );
    await expect(page.getByRole("heading", { level: 1, name: "Neue Aufgabe" })).toBeVisible();
    expect((await storedData(page)).tasks).toHaveLength(before);
  });

  test("F4 Beim Bearbeiten stehen die Einträge da; löschen und ergänzen ändert nur die Einträge, Häkchen bleiben", async ({
    page,
  }) => {
    await openEdit(page, "Bad putzen");
    await expect(page.locator(".checklist-editor__item")).toHaveText([
      "Waschbecken",
      "Toilette",
      "Dusche",
    ]);
    await expectNoAccessibilityViolations(page);

    await page.getByRole("button", { name: "Eintrag löschen: Toilette" }).click();
    await addItem(page, "Spiegel");
    await page.getByRole("button", { name: "Speichern" }).click();

    await expect(
      page.getByRole("status").filter({ hasText: "Aufgabe „Bad putzen“ gespeichert." }),
    ).toBeVisible();
    const saved = (await storedData(page)).tasks.find((task) => task.id === "demo-bad");
    expect(saved?.checklist.map((item) => [item.text, item.checked])).toEqual([
      ["Waschbecken", true],
      ["Dusche", false],
      ["Spiegel", false],
    ]);
  });

  test("F4 Alle Einträge löschen leert die Checkliste der Aufgabe", async ({ page }) => {
    await openEdit(page, "Bad putzen");
    for (const text of ["Waschbecken", "Toilette", "Dusche"]) {
      await page.getByRole("button", { name: `Eintrag löschen: ${text}` }).click();
    }

    await page.getByRole("button", { name: "Speichern" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Aufgaben" })).toBeFocused();
    expect(
      (await storedData(page)).tasks.find((task) => task.id === "demo-bad")?.checklist,
    ).toEqual([]);
  });

  test("F4 Ein voller Speicher wird gemeldet; die Einträge im Formular bleiben stehen", async ({
    page,
  }) => {
    await openNewTask(page);
    await page.getByLabel("Titel").fill("Wocheneinkauf");
    await addItem(page, "Milch");
    await page.evaluate(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("voll", "QuotaExceededError");
      };
    });

    await page.getByRole("button", { name: "Aufgabe anlegen" }).click();

    await expect(page.getByRole("alert")).toContainText("Nicht gespeichert");
    await expect(page.locator(".checklist-editor__item")).toHaveText(["Milch"]);
  });

  test("F4 Die Einträge sind auch mit der Tastatur zu bedienen: Tab, Eingabetaste, Löschen-Knopf", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === "webkit", "Safari springt mit Tab nicht auf Knöpfe");
    await openNewTask(page);
    await field(page).focus();
    await page.keyboard.type("Milch");
    await page.keyboard.press("Enter");
    await expect(page.locator(".checklist-editor__item")).toHaveText(["Milch"]);

    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("button", { name: "Eintrag löschen: Milch" })).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page.locator(".checklist-editor__item")).toHaveCount(0);
    await expect(field(page)).toBeFocused();
  });
});
