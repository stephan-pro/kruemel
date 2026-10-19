import { expect, type Locator, type Page, test } from "@playwright/test";
import { demoData } from "../../src/demo/demoData";
import { calendarDay } from "../../src/domain/date";
import { expectNoAccessibilityViolations } from "./axe";
import { dataKey, deviceKey, expectPageShown, startConfigured, store, storedData } from "./helpers";

// Package 9: the week view (F6) with ticking off and undo (F2, F3, F4, F5).
//
// The clock stands still on Wednesday 21.10.2026, so the demo data always falls on the same days:
//   overdue:   Bad putzen (Mo 19.), Handwerker anrufen (Di 20.)
//   Mi 21.:    Einkaufen, Staubsaugen         Do 22.: Müll rausbringen, Paket abholen
//   Sa 24.:    Küche wischen
//   nächste Woche: Geschenk kaufen (Di 27.), Bettwäsche wechseln (Fr 30.), Fenster putzen (So 1.11.)
//   letzte Woche (erledigt): Bad putzen (Mo 12.), Staubsaugen (Mi 14.),
//                            Bettwäsche wechseln und Müll rausbringen (Fr 16.),
//                            Altglas wegbringen und Küche wischen (Sa 17.)

const TODAY = calendarDay("2026-10-21");
const demo = () => demoData(TODAY);

async function freezeClock(page: Page) {
  await page.clock.setFixedTime(new Date(2026, 9, 21, 12, 0, 0));
}

async function openWeek(page: Page, data = demo()) {
  await freezeClock(page);
  await startConfigured(page, data);
  await expect(page.getByRole("heading", { level: 1, name: "Wochenübersicht" })).toBeVisible();
}

const day = (page: Page, name: string) => page.getByRole("region", { name, exact: true });
const overdue = (page: Page) => day(page, "Überfällig");
const notice = (page: Page) => page.getByRole("region", { name: "Hinweis" });
const tickButton = (page: Page, title: string) =>
  page.getByRole("button", { name: `Abhaken: ${title}` });

/** The titles of the tasks in a section, top to bottom. */
async function titles(section: Locator): Promise<string[]> {
  return section.locator(".week-item__title").allTextContents();
}

/** Ticks off with the keyboard (Safari does not focus buttons by clicking). */
async function tickWithKeyboard(page: Page, title: string) {
  await tickButton(page, title).focus();
  await page.keyboard.press("Enter");
}

test.describe("F6 Wochenübersicht", () => {
  test("F6 Zeigt die laufende Woche Montag bis Sonntag mit allen fälligen Aufgaben", async ({
    page,
  }) => {
    await openWeek(page);

    await expect(page).toHaveTitle("Wochenübersicht – Putzplan");
    await expect(page.getByRole("heading", { level: 2 })).toHaveText([
      "Überfällig",
      "Mo, 19.10.2026",
      "Di, 20.10.2026",
      "Mi, 21.10.2026 (heute)",
      "Do, 22.10.2026",
      "Fr, 23.10.2026",
      "Sa, 24.10.2026",
      "So, 25.10.2026",
    ]);
    await expect(page.getByText("Diese Woche: Mo, 19.10.2026 bis So, 25.10.2026")).toBeVisible();
    expect(await titles(day(page, "Mi, 21.10.2026 (heute)"))).toEqual(["Einkaufen", "Staubsaugen"]);
    expect(await titles(day(page, "Do, 22.10.2026"))).toEqual([
      "Müll rausbringen",
      "Paket abholen",
    ]);
    expect(await titles(day(page, "Sa, 24.10.2026"))).toEqual(["Küche wischen"]);
    await expect(day(page, "Fr, 23.10.2026")).toContainText("Keine Aufgaben.");
    // Wiederkehrende Aufgaben stehen nur an ihrem nächsten Termin: keine Vorschau.
    await expect(page.getByText("Staubsaugen")).toHaveCount(1);
    await expect(page.getByText("Bad putzen")).toHaveCount(1);
    await expectNoAccessibilityViolations(page);
  });

  test("F6 Jede Aufgabe nennt Zuständigkeit und Rhythmus, eine Übernahme „nur dieses Mal“ ihren Namen", async ({
    page,
  }) => {
    await openWeek(page);

    const wednesday = day(page, "Mi, 21.10.2026 (heute)");
    await expect(wednesday).toContainText("Zuständig: Beide · einmalig");
    await expect(wednesday).toContainText("Zuständig: Beide · wöchentlich");
    await expect(day(page, "Do, 22.10.2026")).toContainText("Zuständig: Robin · alle 3 Tage");
    await page.getByRole("button", { name: "Nächste Woche" }).click();
    await expect(day(page, "So, 01.11.2026")).toContainText(
      "Zuständig: Alex (nur dieses Mal übernommen; sonst Robin) · alle 2 Monate",
    );
  });

  test("F6 Der heutige Tag ist hervorgehoben, auch für Hilfsmittel", async ({ page }) => {
    await openWeek(page);

    const today = day(page, "Mi, 21.10.2026 (heute)");
    await expect(today).toHaveAttribute("aria-current", "date");
    await expect(today).toHaveClass(/week-day--today/);
    await expect(page.locator('[aria-current="date"]')).toHaveCount(1);
    await expect(day(page, "Di, 20.10.2026")).not.toHaveClass(/week-day--today/);
  });

  test("F6 Überfälliges steht ganz oben und ist deutlich markiert", async ({ page }) => {
    await openWeek(page);

    const headings = await page.getByRole("heading", { level: 2 }).allTextContents();
    expect(headings[0]).toBe("Überfällig");
    expect(await titles(overdue(page))).toEqual(["Bad putzen", "Handwerker anrufen"]);
    await expect(overdue(page)).toContainText("2 Tage überfällig · fällig war Mo, 19.10.2026");
    await expect(overdue(page)).toContainText("1 Tag überfällig · fällig war Di, 20.10.2026");
    // Nicht doppelt: am alten Tag steht die Aufgabe nicht mehr.
    await expect(day(page, "Mo, 19.10.2026")).toContainText("Keine Aufgaben.");
    await expect(overdue(page).getByRole("button", { name: "Abhaken: Bad putzen" })).toBeVisible();
  });

  test("F6 Ohne überfällige Aufgaben gibt es keinen Überfällig-Block", async ({ page }) => {
    const data = demo();
    const gone = ["demo-bad", "demo-handwerker"];
    await openWeek(page, {
      ...data,
      tasks: data.tasks.filter((task) => !gone.includes(task.id)),
      completions: data.completions.filter((completion) => !gone.includes(completion.taskId)),
    });

    await expect(overdue(page)).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 2, name: "Überfällig" })).toHaveCount(0);
  });

  test("F6 Der Wochenwechsel hat sichtbar beschriftete Schaltflächen", async ({ page }) => {
    await openWeek(page);

    for (const name of ["Vorherige Woche", "Diese Woche", "Nächste Woche"]) {
      await expect(page.getByRole("button", { name })).toBeVisible();
    }
    await expect(page.getByRole("navigation", { name: "Woche wechseln" })).toBeVisible();
  });

  test("F6 Vor- und zurückblättern zwischen den Wochen", async ({ page }) => {
    await openWeek(page);

    await page.getByRole("button", { name: "Nächste Woche" }).click();

    await expect(page.getByText("Woche vom Mo, 26.10.2026 bis So, 01.11.2026")).toBeVisible();
    await expect(page.getByRole("status")).toContainText("Woche vom Mo, 26.10.2026");
    expect(await titles(day(page, "Di, 27.10.2026"))).toEqual(["Geschenk kaufen"]);
    expect(await titles(day(page, "Fr, 30.10.2026"))).toEqual(["Bettwäsche wechseln"]);
    expect(await titles(day(page, "So, 01.11.2026"))).toEqual(["Fenster putzen"]);
    // Kein Tag ist heute, und Überfälliges steht nur in der laufenden Woche.
    await expect(page.locator('[aria-current="date"]')).toHaveCount(0);
    await expect(overdue(page)).toHaveCount(0);
    await expectNoAccessibilityViolations(page);

    await page.getByRole("button", { name: "Vorherige Woche" }).click();
    await expect(page.getByText("Diese Woche: Mo, 19.10.2026 bis So, 25.10.2026")).toBeVisible();
    await expect(overdue(page)).toBeVisible();

    await page.getByRole("button", { name: "Nächste Woche" }).click();
    await page.getByRole("button", { name: "Nächste Woche" }).click();
    await expect(page.getByText("Woche vom Mo, 02.11.2026 bis So, 08.11.2026")).toBeVisible();
    await page.getByRole("button", { name: "Diese Woche" }).click();
    await expect(page.getByText("Diese Woche: Mo, 19.10.2026 bis So, 25.10.2026")).toBeVisible();
  });

  test("F6 Die Wochenschaltflächen sind mit der Tastatur bedienbar", async ({ page }) => {
    await openWeek(page);

    await page.getByRole("button", { name: "Nächste Woche" }).focus();
    await page.keyboard.press("Enter");

    await expect(page.getByText("Woche vom Mo, 26.10.2026 bis So, 01.11.2026")).toBeVisible();
    await expect(page.getByRole("button", { name: "Nächste Woche" })).toBeFocused();
  });

  test("F6 Vergangene Wochen zeigen Erledigtes ausgegraut mit „erledigt von“", async ({ page }) => {
    await openWeek(page);

    await page.getByRole("button", { name: "Vorherige Woche" }).click();

    await expect(
      page.getByText("Vergangene Woche vom Mo, 12.10.2026 bis So, 18.10.2026"),
    ).toBeVisible();
    const monday = day(page, "Mo, 12.10.2026");
    expect(await titles(monday)).toEqual(["Bad putzen"]);
    await expect(monday).toContainText("Erledigt von Alex am Mo, 12.10.2026");
    expect(await titles(day(page, "Mi, 14.10.2026"))).toEqual(["Staubsaugen"]);
    await expect(day(page, "Do, 15.10.2026")).toContainText("Keine Aufgaben.");
    expect(await titles(day(page, "Fr, 16.10.2026"))).toEqual([
      "Bettwäsche wechseln",
      "Müll rausbringen",
    ]);
    // „Altglas wegbringen“ war am Sa 17. fällig und wurde erst am So 18. von Robin erledigt.
    const saturday = day(page, "Sa, 17.10.2026");
    expect(await titles(saturday)).toEqual(["Altglas wegbringen", "Küche wischen"]);
    await expect(saturday).toContainText("Erledigt von Robin am So, 18.10.2026");
    await expect(saturday).toContainText("Erledigt von Robin am Sa, 17.10.2026");
    // Ausgegraut und ohne Schaltfläche zum Abhaken.
    await expect(monday.locator(".week-item")).toHaveClass(/week-item--done/);
    await expect(page.getByRole("button", { name: /^Abhaken/ })).toHaveCount(0);
    const grey = await monday
      .locator(".week-item")
      .evaluate((item) => getComputedStyle(item).color);
    await page.getByRole("button", { name: "Diese Woche" }).click();
    const normal = await tickButton(page, "Einkaufen")
      .locator("xpath=ancestor::li")
      .evaluate((item) => getComputedStyle(item).color);
    expect(grey).not.toBe(normal);
    await page.getByRole("button", { name: "Vorherige Woche" }).click();
    await expectNoAccessibilityViolations(page);
  });

  test("F3 Eine erledigte Aufgabe steht in der laufenden Woche nicht mehr, auch nicht ausgegraut", async ({
    page,
  }) => {
    await openWeek(page);

    // „Altglas wegbringen“ ist erledigt, „Müll rausbringen“ wurde am Mo 19. abgehakt.
    await expect(page.getByText("Altglas wegbringen")).toHaveCount(0);
    await expect(page.locator(".week-item--done")).toHaveCount(0);
  });

  test("F6 Zwei Wochen zurück zeigt die Erledigungen dieser Woche, nicht die der anderen", async ({
    page,
  }) => {
    await openWeek(page);

    await page.getByRole("button", { name: "Vorherige Woche" }).click();
    await page.getByRole("button", { name: "Vorherige Woche" }).click();

    await expect(
      page.getByText("Vergangene Woche vom Mo, 05.10.2026 bis So, 11.10.2026"),
    ).toBeVisible();
    expect(await titles(day(page, "Mo, 05.10.2026"))).toEqual(["Bad putzen"]);
    expect(await titles(day(page, "Mi, 07.10.2026"))).toEqual(["Staubsaugen"]);
    await expect(day(page, "Mi, 07.10.2026")).toContainText("Erledigt von Robin am Mi, 07.10.2026");
  });
});

test.describe("F6 Filter alle / nur meine", () => {
  test("F6 „Nur meine Aufgaben“ blendet die Aufgaben der anderen Person aus, „Alle Aufgaben“ zeigt wieder alles", async ({
    page,
  }) => {
    await openWeek(page);
    await expect(page.getByRole("radio", { name: "Alle Aufgaben" })).toBeChecked();

    await page.getByRole("radio", { name: "Nur meine Aufgaben" }).check();

    // Alex ist „Ich bin“: Beide-Aufgaben bleiben, Robins Aufgaben verschwinden.
    expect(await titles(day(page, "Mi, 21.10.2026 (heute)"))).toEqual(["Einkaufen", "Staubsaugen"]);
    await expect(day(page, "Do, 22.10.2026")).toContainText("Keine Aufgaben.");
    await expect(day(page, "Sa, 24.10.2026")).toContainText("Keine Aufgaben.");
    expect(await titles(overdue(page))).toEqual(["Bad putzen", "Handwerker anrufen"]);
    await expectNoAccessibilityViolations(page);

    await page.getByRole("radio", { name: "Alle Aufgaben" }).check();

    expect(await titles(day(page, "Do, 22.10.2026"))).toEqual([
      "Müll rausbringen",
      "Paket abholen",
    ]);
  });

  test("F5 „Nur meine“ enthält eine Übernahme „nur dieses Mal“ bei der übernehmenden Person", async ({
    page,
  }) => {
    await openWeek(page);
    await page.getByRole("radio", { name: "Nur meine Aufgaben" }).check();

    await page.getByRole("button", { name: "Nächste Woche" }).click();

    // Fenster putzen gehört Robin, Alex hat es für diesen Durchgang übernommen.
    expect(await titles(day(page, "So, 01.11.2026"))).toEqual(["Fenster putzen"]);
    expect(await titles(day(page, "Di, 27.10.2026"))).toEqual(["Geschenk kaufen"]);
    expect(await titles(day(page, "Fr, 30.10.2026"))).toEqual(["Bettwäsche wechseln"]);
  });

  test("F5 Eine Aufgabe für beide erscheint bei „nur meine“ für beide Personen", async ({
    page,
  }) => {
    await freezeClock(page);
    await store(page, {
      [dataKey]: JSON.stringify(demo()),
      [deviceKey]: JSON.stringify({ currentPerson: "personB" }),
    });
    await expect(page.getByText("Ich bin:")).toContainText("Robin");

    await page.getByRole("radio", { name: "Nur meine Aufgaben" }).check();

    expect(await titles(day(page, "Mi, 21.10.2026 (heute)"))).toEqual(["Einkaufen", "Staubsaugen"]);
    expect(await titles(day(page, "Do, 22.10.2026"))).toEqual([
      "Müll rausbringen",
      "Paket abholen",
    ]);
    // Robin hat hier nichts Überfälliges.
    await expect(overdue(page)).toHaveCount(0);
  });

  test("F6 Der Filter hat eine sichtbare Beschriftung und lässt sich per Tastatur ändern", async ({
    page,
  }) => {
    await openWeek(page);
    await expect(page.locator("legend", { hasText: "Anzeigen" })).toBeVisible();

    await page.getByRole("radio", { name: "Alle Aufgaben" }).focus();
    await page.keyboard.press("ArrowDown");

    await expect(page.getByRole("radio", { name: "Nur meine Aufgaben" })).toBeChecked();
    await expect(day(page, "Do, 22.10.2026")).toContainText("Keine Aufgaben.");
  });
});

test.describe("F2 Abhaken mit Hinweis „Rückgängig“", () => {
  test("F2 Eine wiederkehrende Aufgabe wird abgehakt: sie bekommt ihren nächsten Termin ab heute", async ({
    page,
  }) => {
    await openWeek(page);

    await tickButton(page, "Staubsaugen").click();

    await expect(notice(page)).toContainText(
      "„Staubsaugen“ ist abgehakt. Nächster Termin: Mi, 28.10.2026.",
    );
    await expect(notice(page).getByRole("button", { name: "Rückgängig" })).toBeVisible();
    await expect(page.getByText("Staubsaugen", { exact: true })).toHaveCount(0);
    expect(await titles(day(page, "Mi, 21.10.2026 (heute)"))).toEqual(["Einkaufen"]);
    await page.getByRole("button", { name: "Nächste Woche" }).click();
    expect(await titles(day(page, "Mi, 28.10.2026"))).toEqual(["Staubsaugen"]);
    await expectNoAccessibilityViolations(page);
  });

  test("F2 Eine überfällige Aufgabe, verspätet abgehakt, startet den neuen Zyklus am Tag des Abhakens", async ({
    page,
  }) => {
    await openWeek(page);

    await tickButton(page, "Bad putzen").click();

    await expect(notice(page)).toContainText("Nächster Termin: Mi, 28.10.2026.");
    await expect(overdue(page)).not.toContainText("Bad putzen");
  });

  test("F5 Beim Abhaken wird gespeichert, wer die Aufgabe erledigt hat („Ich bin“) und wann", async ({
    page,
  }) => {
    await openWeek(page);
    const before = demo();

    await tickButton(page, "Einkaufen").click();

    const data = await storedData(page);
    expect(data.completions).toHaveLength(before.completions.length + 1);
    const added = data.completions[data.completions.length - 1];
    expect(added).toMatchObject({
      taskId: "demo-einkaufen",
      completedBy: "personA",
      completedOn: "2026-10-21",
      previousDueDate: "2026-10-21",
    });
    expect(added?.id).toBeTruthy();
  });

  test("F5 Auch die Aufgabe der anderen Person lässt sich abhaken; vermerkt wird, wer es getan hat", async ({
    page,
  }) => {
    await openWeek(page);

    await tickButton(page, "Paket abholen").click();

    const data = await storedData(page);
    expect(data.completions[data.completions.length - 1]).toMatchObject({
      taskId: "demo-paket",
      completedBy: "personA",
    });
  });

  test("F3 Eine einmalige Aufgabe verschwindet nach dem Abhaken und liegt bei „Erledigt“", async ({
    page,
  }) => {
    await openWeek(page);

    await tickButton(page, "Einkaufen").click();

    await expect(notice(page)).toContainText(
      "„Einkaufen“ ist abgehakt und steht jetzt unter „Erledigt“.",
    );
    await expect(page.getByText("Einkaufen", { exact: true })).toHaveCount(0);
    expect(
      (await storedData(page)).tasks.find((task) => task.id === "demo-einkaufen"),
    ).toMatchObject({
      kind: "oneOff",
      done: true,
    });
    // Auch in der Woche des ursprünglichen Termins taucht sie nicht mehr auf.
    await page.getByRole("button", { name: "Nächste Woche" }).click();
    await page.getByRole("button", { name: "Diese Woche" }).click();
    await expect(page.getByText("Einkaufen", { exact: true })).toHaveCount(0);
  });

  test("F4 Beim Abhaken einer wiederkehrenden Aufgabe werden die Häkchen ihrer Checkliste zurückgesetzt", async ({
    page,
  }) => {
    await openWeek(page);
    const ticked = (await storedData(page)).tasks.find((task) => task.id === "demo-bad");
    expect(ticked?.checklist.some((item) => item.checked)).toBe(true);

    await tickButton(page, "Bad putzen").click();

    const task = (await storedData(page)).tasks.find((candidate) => candidate.id === "demo-bad");
    expect(task?.checklist).toHaveLength(3);
    expect(task?.checklist.some((item) => item.checked)).toBe(false);
  });

  test("F4 Bei einer einmaligen Aufgabe bleiben die Häkchen erhalten", async ({ page }) => {
    await openWeek(page);

    await tickButton(page, "Einkaufen").click();

    const task = (await storedData(page)).tasks.find(
      (candidate) => candidate.id === "demo-einkaufen",
    );
    expect(task?.checklist.map((item) => item.checked)).toEqual([true, true, false, false]);
  });

  test("F2 Der Hinweis nimmt den Fokus, damit er vorgelesen wird und die Tastatur nicht verloren geht", async ({
    page,
  }) => {
    await openWeek(page);

    await tickWithKeyboard(page, "Einkaufen");

    await expect(notice(page)).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Rückgängig" })).toBeFocused();
  });

  test("F2 „Rückgängig“ stellt den vorherigen Termin wieder her", async ({ page }) => {
    await openWeek(page);
    const before = await storedData(page);
    await tickButton(page, "Staubsaugen").click();

    await notice(page).getByRole("button", { name: "Rückgängig" }).click();

    await expect(notice(page)).toContainText(
      "Rückgängig gemacht: „Staubsaugen“ ist wieder offen, fällig am Mi, 21.10.2026.",
    );
    await expect(notice(page).getByRole("button", { name: "Rückgängig" })).toHaveCount(0);
    expect(await titles(day(page, "Mi, 21.10.2026 (heute)"))).toEqual(["Einkaufen", "Staubsaugen"]);
    expect(await storedData(page)).toEqual(before);
    await expectNoAccessibilityViolations(page);
  });

  test("F4 „Rückgängig“ bringt auch die Häkchen der Checkliste zurück", async ({ page }) => {
    await openWeek(page);
    const before = (await storedData(page)).tasks.find((task) => task.id === "demo-bad");
    await tickButton(page, "Bad putzen").click();

    await notice(page).getByRole("button", { name: "Rückgängig" }).click();

    const after = (await storedData(page)).tasks.find((task) => task.id === "demo-bad");
    expect(after).toEqual(before);
    expect(after?.checklist.map((item) => item.checked)).toEqual([true, false, false]);
    expect(await titles(overdue(page))).toEqual(["Bad putzen", "Handwerker anrufen"]);
  });

  test("F3 „Rückgängig“ macht eine einmalige Aufgabe wieder offen", async ({ page }) => {
    await openWeek(page);
    await tickButton(page, "Paket abholen").click();

    await notice(page).getByRole("button", { name: "Rückgängig" }).click();

    expect(await titles(day(page, "Do, 22.10.2026"))).toEqual([
      "Müll rausbringen",
      "Paket abholen",
    ]);
    expect((await storedData(page)).tasks.find((task) => task.id === "demo-paket")).toMatchObject({
      done: false,
    });
  });

  test("F2 Abhaken bleibt nach dem Neuladen bestehen", async ({ page }) => {
    await openWeek(page);
    await tickButton(page, "Staubsaugen").click();
    await expect(notice(page)).toBeVisible();

    await page.reload();

    await expect(page.getByRole("heading", { level: 1, name: "Wochenübersicht" })).toBeVisible();
    await expect(page.getByText("Staubsaugen", { exact: true })).toHaveCount(0);
    await expect(notice(page)).toHaveCount(0);
  });

  test("F2 Mehrere Aufgaben nacheinander abhaken: der Hinweis nennt immer die letzte", async ({
    page,
  }) => {
    await openWeek(page);

    await tickButton(page, "Einkaufen").click();
    await tickButton(page, "Staubsaugen").click();

    await expect(notice(page)).toContainText("„Staubsaugen“ ist abgehakt.");
    await expect(notice(page)).not.toContainText("Einkaufen");
    expect((await storedData(page)).completions).toHaveLength(demo().completions.length + 2);
  });

  test("F2 Ein voller oder gesperrter Speicher beim Abhaken wird gemeldet; die Aufgabe bleibt offen", async ({
    page,
  }) => {
    await openWeek(page);
    await page.evaluate(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("voll", "QuotaExceededError");
      };
    });

    await tickButton(page, "Staubsaugen").click();

    await expect(page.getByRole("alert")).toContainText("Nicht gespeichert");
    await expect(page.getByRole("alert")).toContainText("Speichern nicht möglich");
    await expect(tickButton(page, "Staubsaugen")).toBeVisible();
    expect((await storedData(page)).completions).toHaveLength(demo().completions.length);
  });
});

test.describe("Rahmen der Wochenübersicht", () => {
  test("F1 Ohne Aufgaben lädt die Seite zum Anlegen der ersten ein", async ({ page }) => {
    await openWeek(page, { ...demo(), tasks: [], completions: [] });

    await expect(page.getByText("Es gibt noch keine Aufgaben.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Nächste Woche" })).toHaveCount(0);
    await expectNoAccessibilityViolations(page);

    await page.getByRole("link", { name: "Erste Aufgabe anlegen" }).click();
    await expectPageShown(page, "Neue Aufgabe");
  });

  test("F6 Die Woche rückt nach Mitternacht auf den neuen Tag weiter, auch wenn die Seite offen bleibt", async ({
    page,
  }) => {
    // Sonntag, 25.10.2026, kurz vor Mitternacht.
    await page.clock.install({ time: new Date(2026, 9, 25, 23, 59, 0) });
    await startConfigured(page, demoData(calendarDay("2026-10-25")));
    await expect(page.getByText("Diese Woche: Mo, 19.10.2026 bis So, 25.10.2026")).toBeVisible();

    await page.clock.runFor(120_000);

    await expect(page.getByText("Diese Woche: Mo, 26.10.2026 bis So, 01.11.2026")).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Mo, 26.10.2026 (heute)" }),
    ).toBeVisible();
  });

  test("F6 Auf dem Handy ragt nichts über die Breite hinaus", async ({ page }) => {
    await openWeek(page);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );

    expect(overflow).toBeLessThanOrEqual(0);
  });
});
