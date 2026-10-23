import { expect, type Locator, type Page, test } from "@playwright/test";
import { demoData } from "../../src/demo/demoData";
import { calendarDay } from "../../src/domain/date";
import { expectNoAccessibilityViolations } from "./axe";
import { expectPageShown, FROZEN_TODAY, openWeek, startConfigured, storedData } from "./helpers";

// Package 9 in the design of package R1: the week view (F6) as a board of tiles, with ticking off
// and undo (F2, F3, F4, F5).
//
// The clock stands still on Wednesday 21.10.2026, so the demo data always falls on the same days:
//   overdue:   Bad putzen (Mo 19.), Handwerker anrufen (Di 20.)
//   Mi 21.:    Einkaufen, Staubsaugen         Do 22.: Müll rausbringen, Paket abholen
//   Sa 24.:    Küche wischen                  (Müll rausbringen was ticked off on Mo 19.)
//   nächste Woche: Geschenk kaufen (Di 27.), Bettwäsche wechseln (Fr 30.), Fenster putzen (So 1.11.)
//   letzte Woche (erledigt): Bad putzen (Mo 12.), Staubsaugen (Mi 14.),
//                            Bettwäsche wechseln und Müll rausbringen (Fr 16.),
//                            Altglas wegbringen und Küche wischen (Sa 17.)

const demo = () => demoData(FROZEN_TODAY);

/** A tile, found by its heading ("Heute · Mi, 21.10.", "Do, 22.10.", "Überfällig", "Stand"). */
const tile = (page: Page, name: string) => page.getByRole("region", { name, exact: true });
const todayTile = (page: Page) => tile(page, "Heute · Mi, 21.10.");
const overdue = (page: Page) => tile(page, "Überfällig");
const progress = (page: Page) => tile(page, "Stand");
const weekLabel = (page: Page) => page.getByRole("status").filter({ hasText: /^KW / });
const notice = (page: Page) => page.getByRole("region", { name: "Hinweis" });
const tickButton = (page: Page, title: string) =>
  page.getByRole("button", { name: `Abhaken: ${title}` });
/** The button of a day in "Woche im Überblick", e.g. "Do 22." */
const dayButton = (page: Page, day: string) =>
  page.getByRole("button", { name: new RegExp(`^${day.replace(".", "\\.")} `) });

/** Shows a day in the day tile and waits until it is there. */
async function chooseDay(page: Page, day: string, heading: string) {
  await dayButton(page, day).click();
  await expect(page.getByRole("heading", { level: 2, name: heading })).toBeVisible();
}

/** The titles of the tasks in a tile, top to bottom. */
async function titles(section: Locator): Promise<string[]> {
  return section.locator(".entry__title").allTextContents();
}

async function overdueTitles(page: Page): Promise<string[]> {
  const more = overdue(page).getByRole("button", { name: /weitere anzeigen/ });
  if ((await more.count()) > 0) {
    await more.click();
  }
  return overdue(page).locator(".overdue__title").allTextContents();
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

    await expect(page).toHaveTitle("Wochenübersicht – Krümel");
    await expect(weekLabel(page)).toHaveText("KW 43 · 19.–25. Oktober");
    const days = page.getByRole("region", { name: "Woche im Überblick" }).locator(".day-button");
    const expected = [
      "Mo 19. keine Aufgaben",
      "Di 20. keine Aufgaben",
      "Mi 21. 2 Aufgaben",
      "Do 22. 2 Aufgaben",
      "Fr 23. keine Aufgaben",
      "Sa 24. 1 Aufgabe",
      "So 25. keine Aufgaben",
    ];
    await expect(days).toHaveCount(7);
    for (const [index, name] of expected.entries()) {
      await expect(days.nth(index)).toHaveAccessibleName(name);
    }
    expect(await titles(todayTile(page))).toEqual(["Einkaufen", "Staubsaugen"]);
    await expectNoAccessibilityViolations(page);

    await chooseDay(page, "Do 22.", "Do, 22.10.");
    expect(await titles(tile(page, "Do, 22.10."))).toEqual(["Müll rausbringen", "Paket abholen"]);
    await chooseDay(page, "Sa 24.", "Sa, 24.10.");
    expect(await titles(tile(page, "Sa, 24.10."))).toEqual(["Küche wischen"]);
    await chooseDay(page, "Fr 23.", "Fr, 23.10.");
    await expect(tile(page, "Fr, 23.10.")).toContainText("Keine Aufgaben.");
  });

  test("F6 Jede Aufgabe nennt Zuständigkeit und Rhythmus, eine Übernahme „nur dieses Mal“ ihren Namen", async ({
    page,
  }) => {
    await openWeek(page);

    await expect(todayTile(page)).toContainText("Beide · einmalig");
    await expect(todayTile(page)).toContainText("Beide · wöchentlich");
    await chooseDay(page, "Do 22.", "Do, 22.10.");
    await expect(tile(page, "Do, 22.10.")).toContainText("Robin · alle 3 Tage");
    await page.getByRole("button", { name: "Nächste Woche" }).click();
    await chooseDay(page, "So 1.", "So, 01.11.");
    await expect(tile(page, "So, 01.11.")).toContainText(
      "Alex (nur dieses Mal übernommen; sonst Robin) · alle 2 Monate",
    );
  });

  test("F4 Eine Aufgabe mit Checkliste zeigt, wie viel davon abgehakt ist", async ({ page }) => {
    await openWeek(page);

    await expect(todayTile(page)).toContainText("2 von 4 abgehakt");
  });

  test("F6 Der heutige Tag ist hervorgehoben, auch für Hilfsmittel", async ({ page }) => {
    await openWeek(page);

    const today = dayButton(page, "Mi 21.");
    await expect(today).toHaveAttribute("aria-current", "date");
    await expect(page.locator('[aria-current="date"]')).toHaveCount(1);
    await expect(today).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("heading", { level: 2, name: "Heute · Mi, 21.10." })).toBeVisible();
  });

  test("F6 Ein Tag lässt sich wählen; er erscheint in der Tageskachel, die den Fokus bekommt", async ({
    page,
  }) => {
    await openWeek(page);

    await dayButton(page, "Do 22.").focus();
    await page.keyboard.press("Enter");

    await expect(page.getByRole("heading", { level: 2, name: "Do, 22.10." })).toBeFocused();
    await expect(dayButton(page, "Do 22.")).toHaveAttribute("aria-pressed", "true");
    await expect(dayButton(page, "Mi 21.")).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator('[aria-pressed="true"].day-button')).toHaveCount(1);
  });

  test("F6 Überfälliges steht oben und ist deutlich markiert", async ({ page }) => {
    await openWeek(page);

    const tileBox = overdue(page);
    await expect(tileBox).toBeVisible();
    await expect(tileBox).toBeInViewport();
    await expect(tileBox).toContainText("Bad putzen");
    await expect(tileBox).toContainText("2 Tage überfällig (seit Mo, 19.10.) · Alex");
    await expect(tileBox.getByRole("button", { name: "Abhaken: Bad putzen" })).toBeVisible();
    // Farbe der Warnkachel, nicht die der übrigen Kacheln.
    const colours = await page.evaluate(() =>
      [".warn-tile", ".day-tile"].map(
        (selector) => getComputedStyle(document.querySelector(selector) as Element).backgroundColor,
      ),
    );
    expect(colours[0]).not.toBe(colours[1]);

    // Die dringendste steht da, die anderen hinter „+ 1 weitere“.
    const more = tileBox.getByRole("button", { name: "+ 1 weitere anzeigen" });
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await expect(tileBox).not.toContainText("Handwerker anrufen");
    await more.click();
    await expect(tileBox.getByRole("button", { name: "Weniger anzeigen" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(await tileBox.locator(".overdue__title").allTextContents()).toEqual([
      "Bad putzen",
      "Handwerker anrufen",
    ]);
    await expect(tileBox).toContainText("1 Tag überfällig (seit Di, 20.10.) · Alex");
    await expectNoAccessibilityViolations(page);

    // Nicht doppelt: am alten Tag steht die Aufgabe nicht mehr.
    await expect(dayButton(page, "Mo 19.")).toHaveAccessibleName("Mo 19. keine Aufgaben");
  });

  test("F6 Ohne überfällige Aufgaben gibt es keine Überfällig-Kachel", async ({ page }) => {
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

  test("F6 Der Wochenwechsel hat beschriftete Schaltflächen", async ({ page }) => {
    await openWeek(page);

    for (const name of ["Vorherige Woche", "Diese Woche", "Nächste Woche"]) {
      await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
    }
    await expect(page.getByRole("navigation", { name: "Woche wechseln" })).toBeVisible();
  });

  test("F6 Vor- und zurückblättern zwischen den Wochen", async ({ page }) => {
    await openWeek(page);

    await page.getByRole("button", { name: "Nächste Woche" }).click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Nächste Woche");
    await expect(weekLabel(page)).toHaveText("KW 44 · 26. Oktober – 1. November");
    // Ohne heutigen Tag zeigt die Tageskachel den ersten Tag mit Aufgaben.
    expect(await titles(tile(page, "Di, 27.10."))).toEqual(["Geschenk kaufen"]);
    await chooseDay(page, "Fr 30.", "Fr, 30.10.");
    expect(await titles(tile(page, "Fr, 30.10."))).toEqual(["Bettwäsche wechseln"]);
    await chooseDay(page, "So 1.", "So, 01.11.");
    expect(await titles(tile(page, "So, 01.11."))).toEqual(["Fenster putzen"]);
    // Kein Tag ist heute, und Überfälliges steht nur in der laufenden Woche.
    await expect(page.locator('[aria-current="date"]')).toHaveCount(0);
    await expect(overdue(page)).toHaveCount(0);
    await expectNoAccessibilityViolations(page);

    await page.getByRole("button", { name: "Vorherige Woche" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Diese Woche");
    await expect(weekLabel(page)).toHaveText("KW 43 · 19.–25. Oktober");
    await expect(todayTile(page)).toBeVisible();
    await expect(overdue(page)).toBeVisible();

    await page.getByRole("button", { name: "Nächste Woche" }).click();
    await page.getByRole("button", { name: "Nächste Woche" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("In 2 Wochen");
    await expect(weekLabel(page)).toHaveText("KW 45 · 2.–8. November");
    await page.getByRole("button", { name: "Diese Woche", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Diese Woche");
  });

  test("F6 Die Wochenschaltflächen sind mit der Tastatur bedienbar", async ({ page }) => {
    await openWeek(page);

    await page.getByRole("button", { name: "Nächste Woche" }).focus();
    await page.keyboard.press("Enter");

    await expect(weekLabel(page)).toHaveText("KW 44 · 26. Oktober – 1. November");
    await expect(page.getByRole("button", { name: "Nächste Woche" })).toBeFocused();
    // Der Seitentitel bleibt; die Überschrift nimmt beim Blättern nicht den Fokus.
    await expect(page).toHaveTitle("Wochenübersicht – Krümel");
  });

  test("F6 Vergangene Wochen zeigen Erledigtes ausgegraut mit „erledigt von“", async ({ page }) => {
    await openWeek(page);

    await page.getByRole("button", { name: "Vorherige Woche" }).click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Letzte Woche");
    await expect(weekLabel(page)).toHaveText("KW 42 · 12.–18. Oktober");
    const monday = tile(page, "Mo, 12.10.");
    expect(await titles(monday)).toEqual(["Bad putzen"]);
    await expect(monday).toContainText("Erledigt von Alex am Mo, 12.10.2026");
    // Ausgegraut und ohne Schaltfläche zum Abhaken.
    await expect(monday.locator(".entry")).toHaveClass(/entry--done/);
    await expect(page.getByRole("button", { name: /^Abhaken/ })).toHaveCount(0);
    const grey = await monday.locator(".entry").evaluate((item) => getComputedStyle(item).color);
    await expectNoAccessibilityViolations(page);

    await chooseDay(page, "Mi 14.", "Mi, 14.10.");
    expect(await titles(tile(page, "Mi, 14.10."))).toEqual(["Staubsaugen"]);
    await chooseDay(page, "Do 15.", "Do, 15.10.");
    await expect(tile(page, "Do, 15.10.")).toContainText("Keine Aufgaben.");
    await chooseDay(page, "Fr 16.", "Fr, 16.10.");
    expect(await titles(tile(page, "Fr, 16.10."))).toEqual([
      "Bettwäsche wechseln",
      "Müll rausbringen",
    ]);
    // „Altglas wegbringen“ war am Sa 17. fällig und wurde erst am So 18. von Robin erledigt.
    await chooseDay(page, "Sa 17.", "Sa, 17.10.");
    const saturday = tile(page, "Sa, 17.10.");
    expect(await titles(saturday)).toEqual(["Altglas wegbringen", "Küche wischen"]);
    await expect(saturday).toContainText("Erledigt von Robin am So, 18.10.2026");
    await expect(saturday).toContainText("Erledigt von Robin am Sa, 17.10.2026");

    await page.getByRole("button", { name: "Diese Woche", exact: true }).click();
    const normal = await todayTile(page)
      .locator(".entry")
      .first()
      .evaluate((item) => getComputedStyle(item).color);
    expect(grey).not.toBe(normal);
  });

  test("F3 Eine erledigte Aufgabe steht in der laufenden Woche nicht mehr, auch nicht ausgegraut", async ({
    page,
  }) => {
    await openWeek(page);

    // „Altglas wegbringen“ ist erledigt, „Müll rausbringen“ wurde am Mo 19. abgehakt.
    await expect(page.getByText("Altglas wegbringen")).toHaveCount(0);
    await expect(page.locator(".entry--done")).toHaveCount(0);
  });

  test("F6 Zwei Wochen zurück zeigt die Erledigungen dieser Woche, nicht die der anderen", async ({
    page,
  }) => {
    await openWeek(page);

    await page.getByRole("button", { name: "Vorherige Woche" }).click();
    await page.getByRole("button", { name: "Vorherige Woche" }).click();

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Vor 2 Wochen");
    await expect(weekLabel(page)).toHaveText("KW 41 · 5.–11. Oktober");
    expect(await titles(tile(page, "Mo, 05.10."))).toEqual(["Bad putzen"]);
    await chooseDay(page, "Mi 7.", "Mi, 07.10.");
    expect(await titles(tile(page, "Mi, 07.10."))).toEqual(["Staubsaugen"]);
    await expect(tile(page, "Mi, 07.10.")).toContainText("Erledigt von Robin am Mi, 07.10.2026");
  });
});

test.describe("F6 Stand der Woche", () => {
  test("F6 „Stand“ zählt erledigt von fällig in der gezeigten Woche", async ({ page }) => {
    await openWeek(page);

    // Fällig: 7 offene mit Termin in dieser Woche und „Müll rausbringen“ (Mo 19. erledigt).
    await expect(progress(page)).toContainText("1 von 8");
    await expect(progress(page)).toContainText("diese Woche erledigt");

    await page.getByRole("button", { name: "Nächste Woche" }).click();
    await expect(progress(page)).toContainText("0 von 3");

    await page.getByRole("button", { name: "Vorherige Woche" }).click();
    await page.getByRole("button", { name: "Vorherige Woche" }).click();
    await expect(progress(page)).toContainText("6 von 6");
  });

  test("F6 „Stand“ zählt das Abhaken mit und folgt dem Filter", async ({ page }) => {
    await openWeek(page);

    await tickButton(page, "Staubsaugen").click();
    await expect(progress(page)).toContainText("2 von 8");

    await page.getByRole("button", { name: "Nur meine" }).click();
    await expect(progress(page)).toContainText("1 von 4");
  });
});

test.describe("F6 Filter alle / nur meine", () => {
  test("F6 „Nur meine“ blendet die Aufgaben der anderen Person aus, „Alle“ zeigt wieder alles", async ({
    page,
  }) => {
    await openWeek(page);
    await expect(page.getByRole("button", { name: "Alle", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.getByRole("button", { name: "Nur meine" }).click();

    await expect(page.getByRole("button", { name: "Nur meine" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // Alex ist „Ich bin“: Beide-Aufgaben bleiben, Robins Aufgaben verschwinden.
    expect(await titles(todayTile(page))).toEqual(["Einkaufen", "Staubsaugen"]);
    await expect(dayButton(page, "Do 22.")).toHaveAccessibleName("Do 22. keine Aufgaben");
    await expect(dayButton(page, "Sa 24.")).toHaveAccessibleName("Sa 24. keine Aufgaben");
    expect(await overdueTitles(page)).toEqual(["Bad putzen", "Handwerker anrufen"]);
    await expectNoAccessibilityViolations(page);

    await page.getByRole("button", { name: "Alle", exact: true }).click();

    await expect(dayButton(page, "Do 22.")).toHaveAccessibleName("Do 22. 2 Aufgaben");
  });

  test("F5 „Nur meine“ enthält eine Übernahme „nur dieses Mal“ bei der übernehmenden Person", async ({
    page,
  }) => {
    await openWeek(page);
    await page.getByRole("button", { name: "Nur meine" }).click();

    await page.getByRole("button", { name: "Nächste Woche" }).click();

    // Fenster putzen gehört Robin, Alex hat es für diesen Durchgang übernommen.
    expect(await titles(tile(page, "Di, 27.10."))).toEqual(["Geschenk kaufen"]);
    await chooseDay(page, "So 1.", "So, 01.11.");
    expect(await titles(tile(page, "So, 01.11."))).toEqual(["Fenster putzen"]);
    await chooseDay(page, "Fr 30.", "Fr, 30.10.");
    expect(await titles(tile(page, "Fr, 30.10."))).toEqual(["Bettwäsche wechseln"]);
  });

  test("F5 Eine Aufgabe für beide erscheint bei „nur meine“ für beide Personen", async ({
    page,
  }) => {
    await openWeek(page, demo(), "personB");
    await expect(page.getByText("Dieses Gerät:")).toContainText("Robin");

    await page.getByRole("button", { name: "Nur meine" }).click();

    expect(await titles(todayTile(page))).toEqual(["Einkaufen", "Staubsaugen"]);
    await chooseDay(page, "Do 22.", "Do, 22.10.");
    expect(await titles(tile(page, "Do, 22.10."))).toEqual(["Müll rausbringen", "Paket abholen"]);
    // Robin hat hier nichts Überfälliges.
    await expect(overdue(page)).toHaveCount(0);
  });

  test("F6 Der Filter ist als Gruppe benannt und per Tastatur bedienbar", async ({ page }) => {
    await openWeek(page);
    await expect(page.getByRole("group", { name: "Aufgaben filtern" })).toBeVisible();

    await page.getByRole("button", { name: "Nur meine" }).focus();
    await page.keyboard.press("Enter");

    await expect(page.getByRole("button", { name: "Nur meine" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(dayButton(page, "Do 22.")).toHaveAccessibleName("Do 22. keine Aufgaben");
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
    expect(await titles(todayTile(page))).toEqual(["Einkaufen"]);
    await expectNoAccessibilityViolations(page);
    await page.getByRole("button", { name: "Nächste Woche" }).click();
    await chooseDay(page, "Mi 28.", "Mi, 28.10.");
    expect(await titles(tile(page, "Mi, 28.10."))).toEqual(["Staubsaugen"]);
  });

  test("F2 Eine überfällige Aufgabe, verspätet abgehakt, startet den neuen Zyklus am Tag des Abhakens", async ({
    page,
  }) => {
    await openWeek(page);

    await tickButton(page, "Bad putzen").click();

    await expect(notice(page)).toContainText("Nächster Termin: Mi, 28.10.2026.");
    await expect(overdue(page)).not.toContainText("Bad putzen");
    await expect(overdue(page)).toContainText("Handwerker anrufen");
  });

  test("F5 Beim Abhaken wird gespeichert, wer die Aufgabe erledigt hat („Ich bin“) und wann", async ({
    page,
  }) => {
    await openWeek(page);
    const before = demo();

    await tickButton(page, "Einkaufen").click();

    await expect(notice(page)).toBeVisible();
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

  test("Datenmodell v3: Beim Abhaken werden Zeitpunkt und Zuständigkeit festgehalten", async ({
    page,
  }) => {
    await openWeek(page);
    await chooseDay(page, "Do 22.", "Do, 22.10.");

    // „Paket abholen“ gehört Robin; Alex hakt es ab. Die Uhr steht auf Mi 21.10.2026, 12:00 Uhr.
    await tickButton(page, "Paket abholen").click();

    await expect(notice(page)).toBeVisible();
    const data = await storedData(page);
    const added = data.completions[data.completions.length - 1];
    expect(added).toMatchObject({
      taskId: "demo-paket",
      completedBy: "personA",
      assigneeAtCompletion: "personB",
    });
    expect(new Date(added?.completedAt ?? "").getTime()).toBe(
      new Date(2026, 9, 21, 12, 0, 0).getTime(),
    );
  });

  test("F5 Auch die Aufgabe der anderen Person lässt sich abhaken; vermerkt wird, wer es getan hat", async ({
    page,
  }) => {
    await openWeek(page);
    await chooseDay(page, "Do 22.", "Do, 22.10.");

    await tickButton(page, "Paket abholen").click();

    await expect(notice(page)).toBeVisible();
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
    await page.getByRole("button", { name: "Diese Woche", exact: true }).click();
    await expect(page.getByText("Einkaufen", { exact: true })).toHaveCount(0);
  });

  test("F4 Beim Abhaken einer wiederkehrenden Aufgabe werden die Häkchen ihrer Checkliste zurückgesetzt", async ({
    page,
  }) => {
    await openWeek(page);
    const ticked = (await storedData(page)).tasks.find((task) => task.id === "demo-bad");
    expect(ticked?.checklist.some((item) => item.checked)).toBe(true);

    await tickButton(page, "Bad putzen").click();

    await expect(notice(page)).toBeVisible();
    const task = (await storedData(page)).tasks.find((candidate) => candidate.id === "demo-bad");
    expect(task?.checklist).toHaveLength(3);
    expect(task?.checklist.some((item) => item.checked)).toBe(false);
  });

  test("F4 Bei einer einmaligen Aufgabe bleiben die Häkchen erhalten", async ({ page }) => {
    await openWeek(page);

    await tickButton(page, "Einkaufen").click();

    await expect(notice(page)).toBeVisible();
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
    expect(await titles(todayTile(page))).toEqual(["Einkaufen", "Staubsaugen"]);
    expect(await storedData(page)).toEqual(before);
    await expectNoAccessibilityViolations(page);
  });

  test("F4 „Rückgängig“ bringt auch die Häkchen der Checkliste zurück", async ({ page }) => {
    await openWeek(page);
    const before = (await storedData(page)).tasks.find((task) => task.id === "demo-bad");
    await tickButton(page, "Bad putzen").click();

    await notice(page).getByRole("button", { name: "Rückgängig" }).click();

    await expect(notice(page)).toContainText("Rückgängig gemacht");
    const after = (await storedData(page)).tasks.find((task) => task.id === "demo-bad");
    expect(after).toEqual(before);
    expect(after?.checklist.map((item) => item.checked)).toEqual([true, false, false]);
    expect(await overdueTitles(page)).toEqual(["Bad putzen", "Handwerker anrufen"]);
  });

  test("F3 „Rückgängig“ macht eine einmalige Aufgabe wieder offen", async ({ page }) => {
    await openWeek(page);
    await chooseDay(page, "Do 22.", "Do, 22.10.");
    await tickButton(page, "Paket abholen").click();

    await notice(page).getByRole("button", { name: "Rückgängig" }).click();

    await expect(notice(page)).toContainText("Rückgängig gemacht");
    expect(await titles(tile(page, "Do, 22.10."))).toEqual(["Müll rausbringen", "Paket abholen"]);
    expect((await storedData(page)).tasks.find((task) => task.id === "demo-paket")).toMatchObject({
      done: false,
    });
  });

  test("F2 Abhaken bleibt nach dem Neuladen bestehen", async ({ page }) => {
    await openWeek(page);
    await tickButton(page, "Staubsaugen").click();
    await expect(notice(page)).toBeVisible();

    await page.reload();

    await expect(page.getByRole("heading", { level: 1, name: "Diese Woche" })).toBeVisible();
    await expect(page.getByText("Staubsaugen", { exact: true })).toHaveCount(0);
    await expect(notice(page)).toHaveCount(0);
  });

  test("F2 Mehrere Aufgaben nacheinander abhaken: der Hinweis nennt immer die letzte", async ({
    page,
  }) => {
    await openWeek(page);

    await tickButton(page, "Einkaufen").click();
    await expect(notice(page)).toContainText("„Einkaufen“ ist abgehakt");
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

  test("F1 „Neue Aufgabe“ ist auf dem Handy ein schwebender Knopf, am PC ein Knopf im Wochenkopf", async ({
    page,
    isMobile,
  }) => {
    await openWeek(page);

    const link = page.getByRole("link", { name: "Neue Aufgabe" });
    const position = await link.evaluate((element) => getComputedStyle(element).position);
    expect(position).toBe(isMobile ? "fixed" : "static");
    const box = await link.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);

    await link.click();
    await expectPageShown(page, "Neue Aufgabe");
  });

  test("F6 Die Woche rückt nach Mitternacht auf den neuen Tag weiter, auch wenn die Seite offen bleibt", async ({
    page,
  }) => {
    // Sonntag, 25.10.2026, kurz vor Mitternacht.
    await page.clock.install({ time: new Date(2026, 9, 25, 23, 59, 0) });
    await startConfigured(page, demoData(calendarDay("2026-10-25")));
    await expect(weekLabel(page)).toHaveText("KW 43 · 19.–25. Oktober");

    await page.clock.runFor(120_000);

    await expect(weekLabel(page)).toHaveText("KW 44 · 26. Oktober – 1. November");
    await expect(page.getByRole("heading", { level: 2, name: "Heute · Mo, 26.10." })).toBeVisible();
  });

  test("F6 Nichts ragt über die Breite hinaus", async ({ page }) => {
    await openWeek(page);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );

    expect(overflow).toBeLessThanOrEqual(0);
  });
});
