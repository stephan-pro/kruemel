import { expect, type Page, test } from "@playwright/test";
import { DEMO_NAMES, demoData } from "../../src/demo/demoData";
import { expectNoAccessibilityViolations } from "./axe";
import { expectPageShown, goToPage, startConfigured, storedData, today } from "./helpers";
import { E2E_APP } from "./shared";

// Package 8: managing tasks (F1, F3): list, create, change, delete.

const demo = () => demoData(today());

/** The demo data without any task, so the empty list can be seen. */
function withoutTasks() {
  return { ...demo(), tasks: [], completions: [] };
}

async function openTasks(page: Page) {
  await startConfigured(page);
  await goToPage(page, "Aufgaben");
}

async function openNewTask(page: Page) {
  await openTasks(page);
  await page.getByRole("link", { name: "Neue Aufgabe" }).click();
  await expectPageShown(page, "Neue Aufgabe");
}

async function openEdit(page: Page, title: string) {
  await openTasks(page);
  await page.getByRole("link", { name: `Bearbeiten: ${title}` }).click();
  await expectPageShown(page, "Aufgabe bearbeiten");
}

/**
 * Opens an address in a new tab, as when following a link or a bookmark (same browser storage,
 * fresh page load). Changing only the hash of the open page does not reliably reach the app in
 * WebKit.
 */
async function openByAddress(page: Page, address: string): Promise<Page> {
  const opened = await page.context().newPage();
  await opened.goto(address);
  return opened;
}

/** Opens the deletion question with the keyboard (Safari does not focus buttons by clicking). */
async function askToDelete(page: Page, title: string) {
  const trigger = page.getByRole("button", { name: `Löschen: ${title}` });
  await trigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  return trigger;
}

test.describe("F1 Aufgabenliste", () => {
  test("F1 zeigt wiederkehrende und einmalige Aufgaben getrennt, jeweils mit Termin und Zuständigkeit", async ({
    page,
  }) => {
    await openTasks(page);

    await expect(page).toHaveTitle("Aufgaben – Krümel");
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "Wiederkehrende Aufgaben",
      "Einmalige Aufgaben",
    ]);
    const bath = page.getByRole("article", { name: "Bad putzen" });
    await expect(bath).toContainText("wöchentlich");
    await expect(bath).toContainText("Alex");
    await expect(bath).toContainText("Mit Essigreiniger");
    await expect(page.getByRole("article", { name: "Bettwäsche wechseln" })).toContainText(
      "alle 2 Wochen",
    );
    await expect(page.getByRole("article", { name: "Fenster putzen" })).toContainText(
      "Alex (nur dieses Mal übernommen; sonst Robin)",
    );
    await expect(page.getByRole("article", { name: "Paket abholen" })).toContainText("Robin");
    await expect(page.getByRole("article", { name: "Staubsaugen" })).toContainText("Beide");
    await expectNoAccessibilityViolations(page);
  });

  test("F3 Erledigte einmalige Aufgaben stehen nicht in der Liste", async ({ page }) => {
    await openTasks(page);

    await expect(page.getByRole("article", { name: "Altglas wegbringen" })).toHaveCount(0);
  });

  test("F1 Ohne Aufgaben lädt die Liste zum Anlegen der ersten ein", async ({ page }) => {
    await startConfigured(page, withoutTasks());
    await goToPage(page, "Aufgaben");

    await expect(page.getByText("Es gibt noch keine Aufgaben.")).toBeVisible();
    await expect(page.getByRole("link", { name: "Neue Aufgabe" })).toBeVisible();
    await expectNoAccessibilityViolations(page);
  });

  test("F1 Die Schaltflächen nennen die Aufgabe, zu der sie gehören", async ({ page }) => {
    await openTasks(page);

    const card = page.getByRole("article", { name: "Bad putzen" });
    await expect(card.getByRole("link", { name: "Bearbeiten: Bad putzen" })).toBeVisible();
    await expect(card.getByRole("button", { name: "Löschen: Bad putzen" })).toBeVisible();
  });
});

test.describe("F1 Wiederkehrende Aufgabe anlegen", () => {
  test("F1 Das Formular ist barrierefrei und hat den ersten Termin mit heute vorbelegt", async ({
    page,
  }) => {
    await openNewTask(page);

    await expect(page).toHaveTitle("Neue Aufgabe – Krümel");
    await expect(page.getByRole("heading", { level: 1, name: "Neue Aufgabe" })).toBeFocused();
    // Das Formular gehört zur Woche; das Plus der Navigation ist die aktuelle Seite.
    await expect(page.getByRole("link", { name: "Woche", exact: true })).toHaveAttribute(
      "aria-current",
      "true",
    );
    await expect(page.getByRole("link", { name: "Neue Aufgabe" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByLabel("Erster Termin")).toHaveValue(today());
    await expect(
      page.getByRole("radio", { name: "Wiederkehrend (z. B. Bad putzen)" }),
    ).toBeChecked();
    // "Ich bin" ist Alex: Vorbelegung der Zuständigkeit.
    await expect(page.getByRole("radio", { name: DEMO_NAMES.personA })).toBeChecked();
    await expectNoAccessibilityViolations(page);
  });

  test("F1 Jedes Feld hat eine sichtbare Beschriftung", async ({ page }) => {
    await openNewTask(page);

    for (const label of [
      "Titel",
      "Abstand (Anzahl)",
      "Einheit",
      "Erster Termin",
      "Notiz (optional)",
    ]) {
      await expect(page.getByLabel(label, { exact: true })).toBeVisible();
      await expect(page.locator("label", { hasText: label })).toBeVisible();
    }
    // Gruppen von Auswahlfeldern haben eine sichtbare Überschrift.
    for (const legend of ["Art der Aufgabe", "Symbol", "Rhythmus", "Zuständig"]) {
      await expect(page.locator("legend", { hasText: legend })).toBeVisible();
    }
    // Kein Feld ohne Beschriftung.
    const unlabelled = await page.evaluate(() =>
      [...document.querySelectorAll("main input, main select, main textarea")]
        .filter((field) => !field.closest("dialog"))
        .filter((field) => (field as HTMLInputElement).labels?.length === 0)
        .map((field) => field.id),
    );
    expect(unlabelled).toEqual([]);
  });

  test("F1 Titel, Rhythmus, Zuständigkeit, Termin und Notiz werden gespeichert", async ({
    page,
  }) => {
    await openNewTask(page);

    await page.getByLabel("Titel").fill("  Balkon fegen ");
    await page.getByLabel("Abstand (Anzahl)").fill("2");
    await page.getByLabel("Einheit").selectOption("month");
    await page.getByLabel("Erster Termin").fill("2026-11-05");
    await page.getByRole("radio", { name: DEMO_NAMES.personB }).check();
    await page.getByLabel("Notiz (optional)").fill("Mit dem Besen");
    await page.getByRole("button", { name: "Aufgabe anlegen" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Aufgaben" })).toBeFocused();
    await expect(
      page.getByRole("status").filter({ hasText: "Aufgabe „Balkon fegen“ angelegt." }),
    ).toBeVisible();
    const card = page.getByRole("article", { name: "Balkon fegen" });
    await expect(card).toContainText("alle 2 Monate");
    await expect(card).toContainText("Do, 05.11.2026");
    await expect(card).toContainText("Robin");
    await expect(card).toContainText("Mit dem Besen");
    await expectNoAccessibilityViolations(page);

    const saved = (await storedData(page)).tasks.find((task) => task.title === "Balkon fegen");
    expect(saved).toMatchObject({
      kind: "recurring",
      recurrence: { unit: "month", interval: 2 },
      dueDate: "2026-11-05",
      assignee: "personB",
      note: "Mit dem Besen",
      checklist: [],
    });
    expect(saved?.id).toBeTruthy();
    expect((await storedData(page)).tasks).toHaveLength(demo().tasks.length + 1);
  });

  test("F1 Die App behält die neue Aufgabe nach dem Neuladen", async ({ page }) => {
    await openNewTask(page);
    await page.getByLabel("Titel").fill("Balkon fegen");
    await page.getByRole("button", { name: "Aufgabe anlegen" }).click();
    await expect(page.getByRole("article", { name: "Balkon fegen" })).toBeVisible();

    await page.reload();

    await expect(page.getByRole("article", { name: "Balkon fegen" })).toBeVisible();
  });

  test("F1 Abbrechen führt zur Liste zurück, ohne etwas anzulegen", async ({ page }) => {
    await openNewTask(page);
    await page.getByLabel("Titel").fill("Wird nicht gespeichert");

    await page.getByRole("link", { name: "Abbrechen" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Aufgaben" })).toBeVisible();
    await expect(page.getByRole("article", { name: "Wird nicht gespeichert" })).toHaveCount(0);
    expect((await storedData(page)).tasks).toHaveLength(demo().tasks.length);
  });
});

test.describe("F3 Einmalige Aufgabe anlegen", () => {
  test("F3 Titel, Fälligkeitsdatum, Zuständigkeit und Notiz genügen; der Rhythmus entfällt", async ({
    page,
  }) => {
    await openNewTask(page);

    await page.getByRole("radio", { name: "Einmalig (z. B. Paket abholen)" }).check();

    await expect(page.getByLabel("Abstand (Anzahl)")).toHaveCount(0);
    await expect(page.getByLabel("Einheit")).toHaveCount(0);
    await expect(page.getByLabel("Fällig am")).toHaveValue(today());
    await expectNoAccessibilityViolations(page);

    await page.getByLabel("Titel").fill("Sperrmüll anmelden");
    await page.getByLabel("Fällig am").fill("2026-11-02");
    await page.getByRole("radio", { name: "Beide" }).check();
    await page.getByRole("button", { name: "Aufgabe anlegen" }).click();

    const card = page.getByRole("article", { name: "Sperrmüll anmelden" });
    await expect(card).toContainText("Fällig am");
    await expect(card).toContainText("Mo, 02.11.2026");
    await expect(card).toContainText("Beide");
    await expect(card).not.toContainText("Rhythmus");
    const saved = (await storedData(page)).tasks.find(
      (task) => task.title === "Sperrmüll anmelden",
    );
    expect(saved).toMatchObject({ kind: "oneOff", done: false, dueDate: "2026-11-02" });
    expect(saved).not.toHaveProperty("recurrence");
    await expect(page.getByRole("heading", { level: 2, name: "Einmalige Aufgaben" })).toBeVisible();
  });

  test("F3 Wechselt man zur einmaligen Aufgabe, verschwinden die Meldungen zum Rhythmus", async ({
    page,
  }) => {
    await openNewTask(page);
    await page.getByLabel("Titel").fill("Sperrmüll anmelden");
    await page.getByLabel("Abstand (Anzahl)").fill("0");
    await page.getByRole("button", { name: "Aufgabe anlegen" }).click();
    await expect(page.getByText("Bitte eine ganze Zahl ab 1 eingeben.")).toBeVisible();

    await page.getByRole("radio", { name: "Einmalig (z. B. Paket abholen)" }).check();
    await page.getByRole("button", { name: "Aufgabe anlegen" }).click();

    await expect(page.getByText("Bitte eine ganze Zahl ab 1 eingeben.")).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: "Aufgaben" })).toBeVisible();
  });
});

test.describe("Barrierefreie Formulare: Fehler am Feld, Fokus auf dem ersten Fehler", () => {
  test("Ohne Titel steht die Meldung am Titel, und der Fokus liegt dort", async ({ page }) => {
    await openNewTask(page);

    await page.getByRole("button", { name: "Aufgabe anlegen" }).click();

    const title = page.getByLabel("Titel");
    await expect(page.getByText("Bitte einen Titel eingeben.")).toHaveCount(1);
    await expect(title).toBeFocused();
    await expect(title).toHaveAttribute("aria-invalid", "true");
    await expect(title).toHaveAccessibleDescription("Bitte einen Titel eingeben.");
    await expect(page.getByRole("heading", { level: 1, name: "Neue Aufgabe" })).toBeVisible();
    expect((await storedData(page)).tasks).toHaveLength(demo().tasks.length);
    await expectNoAccessibilityViolations(page);
  });

  test("Bei mehreren Fehlern bekommt das erste fehlerhafte Feld den Fokus, danach das nächste", async ({
    page,
  }) => {
    await openNewTask(page);
    await page.getByLabel("Titel").fill("Balkon fegen");
    await page.getByLabel("Abstand (Anzahl)").fill("0");
    await page.getByLabel("Erster Termin").fill("");

    await page.getByRole("button", { name: "Aufgabe anlegen" }).click();

    const interval = page.getByLabel("Abstand (Anzahl)");
    const date = page.getByLabel("Erster Termin");
    await expect(interval).toBeFocused();
    await expect(interval).toHaveAccessibleDescription(
      /Beispiel: 2 und „Wochen“.*Bitte eine ganze Zahl ab 1 eingeben\./,
    );
    await expect(date).toHaveAccessibleDescription(/Bitte ein Datum angeben\./);
    await expect(page.getByLabel("Titel")).not.toHaveAttribute("aria-invalid", "true");
    await expectNoAccessibilityViolations(page);

    // Wer das Feld ändert, sieht seine Meldung nicht mehr; die andere bleibt.
    await interval.fill("2");
    await expect(interval).not.toHaveAttribute("aria-invalid", "true");
    await expect(page.getByText("Bitte eine ganze Zahl ab 1 eingeben.")).toHaveCount(0);
    await expect(page.getByText("Bitte ein Datum angeben.")).toBeVisible();

    await page.getByRole("button", { name: "Aufgabe anlegen" }).click();
    await expect(date).toBeFocused();

    await date.fill("2026-11-05");
    await page.getByRole("button", { name: "Aufgabe anlegen" }).click();
    await expect(page.getByRole("article", { name: "Balkon fegen" })).toBeVisible();
  });

  test("Ein ungültiger Rhythmus nennt, was erwartet wird", async ({ page }) => {
    await openNewTask(page);
    await page.getByLabel("Titel").fill("Balkon fegen");

    for (const [input, message] of [
      ["", "Bitte eine Zahl eingeben."],
      ["1,5", "Bitte eine ganze Zahl ab 1 eingeben."],
      ["400", "Bitte höchstens 365 eingeben."],
    ] as const) {
      await page.getByLabel("Abstand (Anzahl)").fill(input);
      await page.getByRole("button", { name: "Aufgabe anlegen" }).click();
      await expect(page.getByText(message)).toBeVisible();
      await expect(page.getByLabel("Abstand (Anzahl)")).toBeFocused();
    }
  });

  test("Ein zu langer Titel und eine zu lange Notiz werden am jeweiligen Feld gemeldet", async ({
    page,
  }) => {
    await openNewTask(page);
    await page.getByLabel("Titel").fill("x".repeat(81));
    await page.getByLabel("Notiz (optional)").fill("y".repeat(501));

    await page.getByRole("button", { name: "Aufgabe anlegen" }).click();

    await expect(page.getByLabel("Titel")).toBeFocused();
    await expect(page.getByLabel("Titel")).toHaveAccessibleDescription(
      "Der Titel darf höchstens 80 Zeichen lang sein.",
    );
    await expect(page.getByLabel("Notiz (optional)")).toHaveAccessibleDescription(
      "Die Notiz darf höchstens 500 Zeichen lang sein.",
    );

    await page.getByLabel("Titel").fill("Balkon fegen");
    await page.getByRole("button", { name: "Aufgabe anlegen" }).click();
    await expect(page.getByLabel("Notiz (optional)")).toBeFocused();
  });

  test("Beim Bearbeiten gilt dasselbe: Fehler am Feld, Fokus auf dem ersten Fehler", async ({
    page,
  }) => {
    await openEdit(page, "Bad putzen");
    await page.getByLabel("Titel").fill("   ");

    await page.getByRole("button", { name: "Speichern" }).click();

    await expect(page.getByLabel("Titel")).toBeFocused();
    await expect(page.getByLabel("Titel")).toHaveAccessibleDescription(
      "Bitte einen Titel eingeben.",
    );
    await expect(page.getByRole("heading", { level: 1, name: "Aufgabe bearbeiten" })).toBeVisible();
  });

  test("Ein voller oder gesperrter Speicher wird gemeldet; die Eingaben bleiben stehen", async ({
    page,
  }) => {
    await openNewTask(page);
    await page.getByLabel("Titel").fill("Balkon fegen");
    await page.evaluate(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("voll", "QuotaExceededError");
      };
    });

    await page.getByRole("button", { name: "Aufgabe anlegen" }).click();

    await expect(page.getByRole("alert")).toContainText("Nicht gespeichert");
    await expect(page.getByRole("alert")).toContainText("Speichern nicht möglich");
    await expect(page.getByRole("heading", { level: 1, name: "Neue Aufgabe" })).toBeVisible();
    await expect(page.getByLabel("Titel")).toHaveValue("Balkon fegen");
    expect((await storedData(page)).tasks).toHaveLength(demo().tasks.length);
  });
});

test.describe("F1 Aufgabe bearbeiten", () => {
  test("F1 Das Formular zeigt die aktuellen Werte; die Art der Aufgabe bleibt fest", async ({
    page,
  }) => {
    await openEdit(page, "Bad putzen");

    await expect(page).toHaveTitle("Aufgabe bearbeiten – Krümel");
    await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    await expect(page.getByLabel("Titel")).toHaveValue("Bad putzen");
    await expect(page.getByLabel("Abstand (Anzahl)")).toHaveValue("1");
    await expect(page.getByLabel("Einheit")).toHaveValue("week");
    await expect(page.getByLabel("Nächster Termin")).toHaveValue(
      demo().tasks.find((task) => task.id === "demo-bad")?.dueDate ?? "",
    );
    await expect(page.getByRole("radio", { name: DEMO_NAMES.personA })).toBeChecked();
    await expect(page.getByLabel("Notiz (optional)")).toHaveValue(
      "Mit Essigreiniger, nicht mit Scheuermilch",
    );
    await expect(page.getByText("Art der Aufgabe: Wiederkehrend")).toBeVisible();
    await expect(page.getByRole("radio", { name: /Wiederkehrend \(/ })).toHaveCount(0);
    await expectNoAccessibilityViolations(page);
  });

  test("F1 Änderungen erscheinen in der Liste; Checkliste und Erledigungen bleiben", async ({
    page,
  }) => {
    await openEdit(page, "Bad putzen");
    const before = demo();

    await page.getByLabel("Titel").fill("Bad gründlich putzen");
    await page.getByLabel("Abstand (Anzahl)").fill("2");
    await page.getByLabel("Einheit").selectOption("month");
    await page.getByLabel("Nächster Termin").fill("2026-11-10");
    await page.getByRole("radio", { name: "Beide" }).check();
    await page.getByLabel("Notiz (optional)").fill("");
    await page.getByRole("button", { name: "Speichern" }).click();

    await expect(
      page.getByRole("status").filter({ hasText: "Aufgabe „Bad gründlich putzen“ gespeichert." }),
    ).toBeVisible();
    const card = page.getByRole("article", { name: "Bad gründlich putzen" });
    await expect(card).toContainText("alle 2 Monate");
    await expect(card).toContainText("Di, 10.11.2026");
    await expect(card).toContainText("Beide");
    await expect(card).not.toContainText("Notiz");
    await expect(page.getByRole("article", { name: "Bad putzen", exact: true })).toHaveCount(0);

    const data = await storedData(page);
    const saved = data.tasks.find((task) => task.id === "demo-bad");
    const original = before.tasks.find((task) => task.id === "demo-bad");
    expect(saved).toMatchObject({
      title: "Bad gründlich putzen",
      recurrence: { unit: "month", interval: 2 },
      dueDate: "2026-11-10",
      assignee: "both",
    });
    expect(saved).not.toHaveProperty("note");
    expect(saved?.checklist).toEqual(original?.checklist);
    expect(data.tasks).toHaveLength(before.tasks.length);
    expect(data.completions).toEqual(JSON.parse(JSON.stringify(before.completions)));
  });

  test("F3 Eine einmalige Aufgabe bearbeiten: Fällig am, Titel und Zuständigkeit", async ({
    page,
  }) => {
    await openEdit(page, "Paket abholen");
    await expect(page.getByLabel("Abstand (Anzahl)")).toHaveCount(0);

    await page.getByLabel("Titel").fill("Paket in der Filiale abholen");
    await page.getByLabel("Fällig am").fill("2026-10-30");
    await page.getByRole("radio", { name: DEMO_NAMES.personA }).check();
    await page.getByRole("button", { name: "Speichern" }).click();

    const card = page.getByRole("article", { name: "Paket in der Filiale abholen" });
    await expect(card).toContainText("Fr, 30.10.2026");
    await expect(card).toContainText("Alex");
  });

  test("F5 Bleibt die Zuständigkeit gleich, bleibt eine Übernahme „nur dieses Mal“", async ({
    page,
  }) => {
    await openEdit(page, "Fenster putzen");
    await page.getByLabel("Titel").fill("Fenster gründlich putzen");

    await page.getByRole("button", { name: "Speichern" }).click();

    await expect(page.getByRole("article", { name: "Fenster gründlich putzen" })).toContainText(
      "Alex (nur dieses Mal übernommen; sonst Robin)",
    );
    const saved = (await storedData(page)).tasks.find((task) => task.id === "demo-fenster");
    expect(saved).toMatchObject({ takenOverBy: "personA", assignee: "personB" });
  });

  test("F5 Eine neue feste Zuständigkeit beendet die Übernahme „nur dieses Mal“", async ({
    page,
  }) => {
    await openEdit(page, "Fenster putzen");
    await page.getByRole("radio", { name: "Beide" }).check();

    await page.getByRole("button", { name: "Speichern" }).click();

    const card = page.getByRole("article", { name: "Fenster putzen" });
    await expect(card).toContainText("Beide");
    await expect(card).not.toContainText("übernommen");
    // Der Speicher schreibt einen Moment nach der Anzeige.
    const savedTask = async () =>
      (await storedData(page)).tasks.find((task) => task.id === "demo-fenster");
    await expect.poll(savedTask).toMatchObject({ assignee: "both" });
    expect(await savedTask()).not.toHaveProperty("takenOverBy");
  });

  test("F1 Eine Adresse zu einer gelöschten oder unbekannten Aufgabe wird erklärt", async ({
    page,
  }) => {
    await startConfigured(page);
    const opened = await openByAddress(page, `${E2E_APP}#/aufgaben/bearbeiten/gibt-es-nicht`);

    await expect(
      opened.getByRole("heading", { level: 1, name: "Aufgabe nicht gefunden" }),
    ).toBeVisible();
    await expect(opened).toHaveTitle("Aufgabe nicht gefunden – Krümel");
    await expectNoAccessibilityViolations(opened);

    await opened.getByRole("link", { name: "Zurück zu den Aufgaben" }).click();
    await expect(opened.getByRole("heading", { level: 1, name: "Aufgaben" })).toBeVisible();
  });

  test("F1 Die Bearbeiten-Seite lässt sich direkt über ihre Adresse öffnen", async ({ page }) => {
    await startConfigured(page);
    const opened = await openByAddress(page, `${E2E_APP}#/aufgaben/bearbeiten/demo-bad`);

    await expect(opened.getByLabel("Titel")).toHaveValue("Bad putzen");
  });
});

test.describe("F1 Aufgabe löschen: nur nach Rückfrage", () => {
  const badCompletions = () =>
    demo().completions.filter((completion) => completion.taskId === "demo-bad").length;

  test("F1 Die Rückfrage nennt die Aufgabe und die Erledigungen, die mit verschwinden", async ({
    page,
  }) => {
    await openTasks(page);

    await askToDelete(page, "Bad putzen");

    const dialog = page.getByRole("dialog", { name: "Aufgabe „Bad putzen“ löschen?" });
    await expect(dialog).toContainText(
      `Auch ihre ${badCompletions()} Einträge in „Erledigt“ verschwinden.`,
    );
    await expect(dialog).toContainText("nicht rückgängig");
    await expect(dialog.getByRole("button", { name: "Abbrechen" })).toBeFocused();
    await expectNoAccessibilityViolations(page);
    // Gelöscht wird erst nach der Antwort.
    expect((await storedData(page)).tasks).toHaveLength(demo().tasks.length);
  });

  test("F1 Eine Aufgabe ohne Erledigungen sagt das in der Rückfrage", async ({ page }) => {
    await openTasks(page);

    await askToDelete(page, "Geschenk kaufen");

    await expect(page.getByRole("dialog")).toContainText(
      "Sie hat noch keine Einträge in „Erledigt“.",
    );
  });

  test("F1 „Abbrechen“ lässt alles unberührt und gibt den Fokus zurück", async ({ page }) => {
    await openTasks(page);
    const trigger = await askToDelete(page, "Bad putzen");

    await page.getByRole("dialog").getByRole("button", { name: "Abbrechen" }).click();

    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(trigger).toBeFocused();
    await expect(page.getByRole("article", { name: "Bad putzen" })).toBeVisible();
    const data = await storedData(page);
    expect(data.tasks).toHaveLength(demo().tasks.length);
    expect(data.completions).toHaveLength(demo().completions.length);
  });

  test("F1 Escape schließt die Rückfrage, ohne etwas zu löschen", async ({ page }) => {
    await openTasks(page);
    await askToDelete(page, "Bad putzen");

    await page.keyboard.press("Escape");

    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByRole("article", { name: "Bad putzen" })).toBeVisible();
    expect((await storedData(page)).tasks).toHaveLength(demo().tasks.length);
  });

  test("F3 Nach der Bestätigung sind Aufgabe und ihre Erledigungen weg, alles andere bleibt", async ({
    page,
  }) => {
    await openTasks(page);
    await askToDelete(page, "Bad putzen");

    await page.getByRole("button", { name: "Ja, Aufgabe löschen" }).click();

    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByRole("article", { name: "Bad putzen" })).toHaveCount(0);
    await expect(
      page.getByRole("status").filter({ hasText: "Aufgabe „Bad putzen“ gelöscht." }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Aufgaben" })).toBeFocused();
    await expect(page.getByRole("article", { name: "Staubsaugen" })).toBeVisible();

    const data = await storedData(page);
    expect(data.tasks.map((task) => task.id)).not.toContain("demo-bad");
    expect(data.tasks).toHaveLength(demo().tasks.length - 1);
    expect(data.completions.some((completion) => completion.taskId === "demo-bad")).toBe(false);
    expect(data.completions).toHaveLength(demo().completions.length - badCompletions());
    await expectNoAccessibilityViolations(page);
  });

  test("F1 Auch nach dem Neuladen ist die gelöschte Aufgabe weg", async ({ page }) => {
    await openTasks(page);
    await askToDelete(page, "Bad putzen");
    await page.getByRole("button", { name: "Ja, Aufgabe löschen" }).click();
    await expect(page.getByRole("article", { name: "Bad putzen" })).toHaveCount(0);

    await page.reload();

    await expect(page.getByRole("heading", { level: 1, name: "Aufgaben" })).toBeVisible();
    await expect(page.getByRole("article", { name: "Bad putzen" })).toHaveCount(0);
    await expect(page.getByRole("article", { name: "Staubsaugen" })).toBeVisible();
  });

  test("F1 Auch das Bearbeiten-Formular löscht nur nach Rückfrage", async ({ page }) => {
    await openEdit(page, "Bad putzen");
    const trigger = page.getByRole("button", { name: "Aufgabe löschen …" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", { name: "Aufgabe „Bad putzen“ löschen?" });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Abbrechen" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByRole("heading", { level: 1, name: "Aufgabe bearbeiten" })).toBeVisible();
    await expect(trigger).toBeFocused();
    expect((await storedData(page)).tasks).toHaveLength(demo().tasks.length);

    await trigger.focus();
    await page.keyboard.press("Enter");
    await dialog.getByRole("button", { name: "Ja, Aufgabe löschen" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Aufgaben" })).toBeFocused();
    await expect(
      page.getByRole("status").filter({ hasText: "Aufgabe „Bad putzen“ gelöscht." }),
    ).toBeVisible();
    await expect(page.getByRole("article", { name: "Bad putzen" })).toHaveCount(0);
    expect((await storedData(page)).tasks).toHaveLength(demo().tasks.length - 1);
  });

  test("F1 Ein voller Speicher beim Löschen wird gemeldet; nichts wird gelöscht", async ({
    page,
  }) => {
    await openTasks(page);
    await askToDelete(page, "Bad putzen");
    await page.evaluate(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("voll", "QuotaExceededError");
      };
    });

    await page.getByRole("button", { name: "Ja, Aufgabe löschen" }).click();

    await expect(page.getByRole("alert")).toContainText("Nicht gelöscht");
    await expect(page.getByRole("article", { name: "Bad putzen" })).toBeVisible();
    expect((await storedData(page)).tasks).toHaveLength(demo().tasks.length);
  });
});
