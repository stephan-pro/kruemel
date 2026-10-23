import { expect, type Locator, type Page, test } from "@playwright/test";
import { expectNoAccessibilityViolations } from "./axe";
import {
  chooseDay,
  detailDialog,
  detailValue,
  notice,
  openWeek,
  overdueTile,
  storedData,
  taskButton,
  tile,
  todayTile,
} from "./helpers";

// Package 10: "Übernehmen" (F5) in the rows of the week view and in the details: a one-off task is
// handed over at once, a recurring one asks "nur dieses Mal oder dauerhaft" (default: nur dieses
// Mal). Alex (personA) is "Ich bin"; the clock stands on Wednesday 21.10.2026.

const takeOverButton = (scope: Locator, title: string) =>
  scope.getByRole("button", { name: `Übernehmen: ${title}` });

const question = (page: Page, title: string) =>
  page.getByRole("dialog", { name: `Aufgabe „${title}“ übernehmen?`, exact: true });

async function taskOf(page: Page, id: string) {
  return (await storedData(page)).tasks.find((task) => task.id === id);
}

/** Waits until the stored task matches: the page shows a change at once, the storage a moment later. */
async function expectTask(page: Page, id: string, expected: Record<string, unknown>) {
  await expect.poll(() => taskOf(page, id)).toMatchObject(expected);
}

/** Thursday, 22.10. is the day with Robin's tasks "Müll rausbringen" (recurring), "Paket abholen". */
async function openThursday(page: Page, person: "personA" | "personB" = "personA") {
  await openWeek(page, undefined, person);
  await chooseDay(page, "Do 22.", "Do, 22.10.");
  return tile(page, "Do, 22.10.");
}

test.describe("F5 Übernehmen: wo es angeboten wird", () => {
  test("F5 Bei Aufgaben der anderen Person und bei „beide“ gibt es „Übernehmen“, bei eigenen nicht", async ({
    page,
  }) => {
    await openWeek(page);

    // „beide“: Einkaufen und Staubsaugen.
    await expect(takeOverButton(todayTile(page), "Einkaufen")).toBeVisible();
    await expect(takeOverButton(todayTile(page), "Staubsaugen")).toBeVisible();
    // Robins Aufgaben am Donnerstag.
    await chooseDay(page, "Do 22.", "Do, 22.10.");
    await expect(takeOverButton(tile(page, "Do, 22.10."), "Paket abholen")).toBeVisible();
    await expect(takeOverButton(tile(page, "Do, 22.10."), "Müll rausbringen")).toBeVisible();
    // Alex' eigene überfällige Aufgaben: nichts zu übernehmen.
    await expect(overdueTile(page)).toContainText("Bad putzen");
    await expect(overdueTile(page).getByRole("button", { name: /^Übernehmen/ })).toHaveCount(0);
  });

  test("F5 Auf der Kachel „Überfällig“ gibt es „Übernehmen“ für die Aufgaben der anderen Person", async ({
    page,
  }) => {
    await openWeek(page, undefined, "personB");

    await expect(takeOverButton(overdueTile(page), "Bad putzen")).toBeVisible();
    await expectNoAccessibilityViolations(page);
  });

  test("F5 Die Knöpfe nennen die Aufgabe, zu der sie gehören", async ({ page }) => {
    await openWeek(page);

    const button = takeOverButton(todayTile(page), "Einkaufen");
    await expect(button).toHaveText("Übernehmen");
    await expect(button).toHaveAccessibleName("Übernehmen: Einkaufen");
  });
});

test.describe("F5 Einmalige Aufgabe übernehmen: ohne Rückfrage", () => {
  test("F5 „Übernehmen“ weist eine einmalige Aufgabe sofort um und sagt es in einem Hinweis", async ({
    page,
  }) => {
    const thursday = await openThursday(page);

    await takeOverButton(thursday, "Paket abholen").click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(notice(page)).toContainText("„Paket abholen“ ist jetzt bei Alex.");
    await expect(notice(page)).toBeFocused();
    // Der Speicher schreibt einen Moment nach dem Hinweis.
    await expect
      .poll(async () => await taskOf(page, "demo-paket"))
      .toMatchObject({ kind: "oneOff", assignee: "personA" });
    // Jetzt ist es Alex' eigene Aufgabe: kein „Übernehmen“ mehr, die Zeile nennt Alex.
    await expect(thursday).toContainText("Alex · einmalig");
    await expect(takeOverButton(thursday, "Paket abholen")).toHaveCount(0);
    await expectNoAccessibilityViolations(page);
  });

  test("F5 Eine Aufgabe für „beide“ lässt sich übernehmen und gehört dann einer Person", async ({
    page,
  }) => {
    await openWeek(page);

    await takeOverButton(todayTile(page), "Einkaufen").click();

    await expect(notice(page)).toContainText("„Einkaufen“ ist jetzt bei Alex.");
    // Der Speicher schreibt einen Moment nach dem Hinweis.
    await expect.poll(async () => (await taskOf(page, "demo-einkaufen"))?.assignee).toBe("personA");
    await expect(todayTile(page)).toContainText("Alex · einmalig");
  });
});

test.describe("F5 Wiederkehrende Aufgabe übernehmen: nur dieses Mal oder dauerhaft", () => {
  test("F5 „Übernehmen“ fragt „nur dieses Mal“ oder „dauerhaft“; „nur dieses Mal“ ist vorgewählt", async ({
    page,
  }) => {
    const thursday = await openThursday(page);

    await takeOverButton(thursday, "Müll rausbringen").click();

    const dialog = question(page, "Müll rausbringen");
    await expect(dialog).toBeVisible();
    const once = dialog.getByRole("radio", {
      name: "Nur dieses Mal (danach ist wieder Robin zuständig)",
    });
    const always = dialog.getByRole("radio", { name: "Dauerhaft (ab jetzt ist Alex zuständig)" });
    await expect(once).toBeChecked();
    await expect(always).not.toBeChecked();
    await expect(dialog.getByRole("group", { name: "Wie lange?" })).toBeVisible();
    // Der Fokus beginnt bei der Auswahl, um die es geht (nicht bei „Abbrechen“, nichts wird gelöscht).
    await expect(once).toBeFocused();
    await expectNoAccessibilityViolations(page);
    // Gespeichert wird erst nach der Antwort.
    expect(await taskOf(page, "demo-muell")).not.toHaveProperty("takenOverBy");
  });

  test("F5 „Nur dieses Mal“ setzt die Übernahme; die feste Zuständigkeit bleibt Robin", async ({
    page,
  }) => {
    const thursday = await openThursday(page);
    await takeOverButton(thursday, "Müll rausbringen").click();

    await question(page, "Müll rausbringen").getByRole("button", { name: "Übernehmen" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(notice(page)).toContainText(
      "„Müll rausbringen“ ist jetzt bei Alex, nur dieses Mal.",
    );
    await expect(notice(page)).toBeFocused();
    await expect
      .poll(async () => Object.hasOwn((await taskOf(page, "demo-muell")) ?? {}, "takenOverBy"))
      .toBe(true);
    expect(await taskOf(page, "demo-muell")).toMatchObject({
      assignee: "personB",
      takenOverBy: "personA",
    });
    await expect(thursday).toContainText(
      "Alex (nur dieses Mal übernommen; sonst Robin) · alle 3 Tage",
    );
    await expectNoAccessibilityViolations(page);
  });

  test("F5 Beim nächsten Zyklus gilt wieder die feste Zuweisung", async ({ page }) => {
    const thursday = await openThursday(page);
    await takeOverButton(thursday, "Müll rausbringen").click();
    await question(page, "Müll rausbringen").getByRole("button", { name: "Übernehmen" }).click();
    await expect(notice(page)).toContainText("nur dieses Mal");

    await page.getByRole("button", { name: "Abhaken: Müll rausbringen" }).click();

    await expect
      .poll(async () => Object.hasOwn((await taskOf(page, "demo-muell")) ?? {}, "takenOverBy"))
      .toBe(false);
    expect(await taskOf(page, "demo-muell")).toMatchObject({ assignee: "personB" });
    const data = await storedData(page);
    expect(data.completions[data.completions.length - 1]).toMatchObject({
      taskId: "demo-muell",
      completedBy: "personA",
    });
  });

  test("F5 „Dauerhaft“ macht Alex zum festen Zuständigen", async ({ page }) => {
    const thursday = await openThursday(page);
    await takeOverButton(thursday, "Müll rausbringen").click();
    const dialog = question(page, "Müll rausbringen");

    await dialog.getByRole("radio", { name: /^Dauerhaft/ }).check();
    await dialog.getByRole("button", { name: "Übernehmen" }).click();

    await expect(notice(page)).toContainText("„Müll rausbringen“ gehört jetzt dauerhaft Alex.");
    await expect.poll(async () => (await taskOf(page, "demo-muell"))?.assignee).toBe("personA");
    const task = await taskOf(page, "demo-muell");
    expect(task).toMatchObject({ assignee: "personA" });
    expect(task).not.toHaveProperty("takenOverBy");
    await expect(thursday).toContainText("Alex · alle 3 Tage");
  });

  test("F5 Die Übernahme bleibt nach dem Neuladen bestehen", async ({ page }) => {
    const thursday = await openThursday(page);
    await takeOverButton(thursday, "Müll rausbringen").click();
    await question(page, "Müll rausbringen").getByRole("button", { name: "Übernehmen" }).click();
    await expect(notice(page)).toBeVisible();

    await page.reload();

    await chooseDay(page, "Do 22.", "Do, 22.10.");
    await expect(tile(page, "Do, 22.10.")).toContainText("nur dieses Mal übernommen");
  });

  test("F5 „Abbrechen“ und Escape lassen alles unberührt; der Fokus kehrt auf „Übernehmen“ zurück", async ({
    page,
  }) => {
    const thursday = await openThursday(page);
    const before = await storedData(page);
    const trigger = takeOverButton(thursday, "Müll rausbringen");

    await trigger.click();
    await question(page, "Müll rausbringen").getByRole("button", { name: "Abbrechen" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(trigger).toBeFocused();

    await trigger.click();
    await expect(question(page, "Müll rausbringen")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(await storedData(page)).toEqual(before);
  });

  test("F5 Die Rückfrage beginnt nach dem Abbrechen wieder mit „nur dieses Mal“", async ({
    page,
  }) => {
    const thursday = await openThursday(page);
    const trigger = takeOverButton(thursday, "Müll rausbringen");
    await trigger.click();
    const dialog = question(page, "Müll rausbringen");
    await dialog.getByRole("radio", { name: /^Dauerhaft/ }).check();
    await dialog.getByRole("button", { name: "Abbrechen" }).click();

    await trigger.click();

    await expect(dialog.getByRole("radio", { name: /^Nur dieses Mal/ })).toBeChecked();
  });

  test("F5 Mit der Tastatur: Enter öffnet die Rückfrage bei der Auswahl, Pfeiltasten wählen, Tab erreicht „Übernehmen“", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName === "webkit", "Safari springt mit Tab nicht auf Knöpfe und Links");
    const thursday = await openThursday(page);
    await takeOverButton(thursday, "Müll rausbringen").focus();
    await page.keyboard.press("Enter");
    const dialog = question(page, "Müll rausbringen");
    await expect(dialog.getByRole("radio", { name: /^Nur dieses Mal/ })).toBeFocused();

    await page.keyboard.press("ArrowDown");
    await expect(dialog.getByRole("radio", { name: /^Dauerhaft/ })).toBeChecked();
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Abbrechen" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "Übernehmen" })).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(notice(page)).toContainText("gehört jetzt dauerhaft Alex");
  });

  test("F5 Ein voller Speicher wird in der Rückfrage gemeldet; nichts ändert sich", async ({
    page,
  }) => {
    const thursday = await openThursday(page);
    await takeOverButton(thursday, "Müll rausbringen").click();
    const dialog = question(page, "Müll rausbringen");
    await page.evaluate(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("voll", "QuotaExceededError");
      };
    });

    await dialog.getByRole("button", { name: "Übernehmen" }).click();

    await expect(dialog.getByRole("alert")).toContainText("Nicht gespeichert");
    await expect(dialog).toBeVisible();
    expect(await taskOf(page, "demo-muell")).not.toHaveProperty("takenOverBy");
    await expectNoAccessibilityViolations(page);
  });

  test("F5 Auf der Kachel „Überfällig“ übernimmt Robin die Aufgabe von Alex, dauerhaft", async ({
    page,
  }) => {
    await openWeek(page, undefined, "personB");
    await takeOverButton(overdueTile(page), "Bad putzen").click();
    const dialog = question(page, "Bad putzen");
    await expect(
      dialog.getByRole("radio", { name: "Nur dieses Mal (danach ist wieder Alex zuständig)" }),
    ).toBeChecked();

    await dialog.getByRole("radio", { name: "Dauerhaft (ab jetzt ist Robin zuständig)" }).check();
    await dialog.getByRole("button", { name: "Übernehmen" }).click();

    await expect(notice(page)).toContainText("„Bad putzen“ gehört jetzt dauerhaft Robin.");
    expect(await taskOf(page, "demo-bad")).toMatchObject({ assignee: "personB" });
    await expect(overdueTile(page)).toContainText("Robin");
  });

  test("F5 „Nur meine“ zeigt eine übernommene Aufgabe bei der übernehmenden Person", async ({
    page,
  }) => {
    const thursday = await openThursday(page);
    await page.getByRole("button", { name: "Nur meine" }).click();
    await expect(thursday).toContainText("Keine Aufgaben.");
    await page.getByRole("button", { name: "Alle", exact: true }).click();
    await takeOverButton(thursday, "Paket abholen").click();
    await expect(notice(page)).toBeVisible();

    await page.getByRole("button", { name: "Nur meine" }).click();

    await expect(taskButton(thursday, "Paket abholen")).toBeVisible();
    await expect(taskButton(thursday, "Müll rausbringen")).toHaveCount(0);
  });
});

test.describe("F5 Übernehmen in der Detailansicht", () => {
  test("F5 Eine wiederkehrende Aufgabe fragt auch aus der Detailansicht, Escape schließt nur die Rückfrage", async ({
    page,
  }) => {
    const thursday = await openThursday(page);
    await taskButton(thursday, "Müll rausbringen").click();
    const details = detailDialog(page, "Müll rausbringen");
    await expect(details).toBeVisible();

    await details.getByRole("button", { name: "Übernehmen" }).click();
    await expect(question(page, "Müll rausbringen")).toBeVisible();
    await expectNoAccessibilityViolations(page);
    await page.keyboard.press("Escape");

    await expect(question(page, "Müll rausbringen")).toBeHidden();
    await expect(details).toBeVisible();
    expect(await taskOf(page, "demo-muell")).not.toHaveProperty("takenOverBy");
  });

  test("F5 Nach der Antwort schließen beide Ansichten, und der Hinweis nimmt den Fokus", async ({
    page,
  }) => {
    const thursday = await openThursday(page);
    await taskButton(thursday, "Müll rausbringen").click();
    await detailDialog(page, "Müll rausbringen")
      .getByRole("button", { name: "Übernehmen" })
      .click();

    await question(page, "Müll rausbringen").getByRole("button", { name: "Übernehmen" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(notice(page)).toContainText(
      "„Müll rausbringen“ ist jetzt bei Alex, nur dieses Mal.",
    );
    await expect(notice(page)).toBeFocused();
    await expectTask(page, "demo-muell", { takenOverBy: "personA" });
  });

  test("F5 Eine einmalige Aufgabe wird aus der Detailansicht ohne Rückfrage umgewiesen", async ({
    page,
  }) => {
    const thursday = await openThursday(page);
    await taskButton(thursday, "Paket abholen").click();

    await detailDialog(page, "Paket abholen").getByRole("button", { name: "Übernehmen" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(notice(page)).toContainText("„Paket abholen“ ist jetzt bei Alex.");
    expect(await taskOf(page, "demo-paket")).toMatchObject({ assignee: "personA" });
  });

  test("F5 Ein voller Speicher beim Umweisen wird in der Detailansicht gemeldet", async ({
    page,
  }) => {
    const thursday = await openThursday(page);
    await taskButton(thursday, "Paket abholen").click();
    const details = detailDialog(page, "Paket abholen");
    await page.evaluate(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("voll", "QuotaExceededError");
      };
    });

    await details.getByRole("button", { name: "Übernehmen" }).click();

    await expect(details.getByRole("alert")).toContainText("Nicht gespeichert");
    await expect(details).toBeVisible();
    expect(await taskOf(page, "demo-paket")).toMatchObject({ assignee: "personB" });
  });

  test("F5 Die Detailansicht nennt eine Übernahme „nur dieses Mal“ bei der Zuständigkeit", async ({
    page,
  }) => {
    await openWeek(page);
    await page.getByRole("button", { name: "Nächste Woche" }).click();
    await chooseDay(page, "So 1.", "So, 01.11.");

    await taskButton(tile(page, "So, 01.11."), "Fenster putzen").click();

    await expect(detailValue(detailDialog(page, "Fenster putzen"), "Zuständig")).toHaveText(
      "Alex (nur dieses Mal übernommen; sonst Robin)",
    );
  });
});
