import { expect, type Page, test } from "@playwright/test";
import { demoData } from "../../src/demo/demoData";
import type { AppData } from "../../src/storage/appData";
import { expectNoAccessibilityViolations } from "./axe";
import {
  dataKey,
  deviceKey,
  FROZEN_TODAY,
  freezeClock,
  notice,
  openToday,
  store,
  storedData,
} from "./helpers";

// E2-4a: die Startseite „Heute“ (DESIGN.md Abschnitt 5) und die neue Navigation (Abschnitt 7).
//
// Die Uhr steht auf Mi 21.10.2026, 12:00 Uhr. Für Alex (Person A) steht dann an (siehe week.spec.ts):
//   überfällig: Bad putzen (Mo 19.), Handwerker anrufen (Di 20.)
//   heute:      Einkaufen, Staubsaugen (beide für beide)
//   Do 22.:     Müll rausbringen und Paket abholen (beide für Robin), bei „Meine“ leer

const cards = (page: Page) => page.locator(".today-card");
const titles = (page: Page) => page.locator(".today-card__title").allTextContents();
const dayField = (page: Page, day: string) =>
  page.getByRole("button", { name: new RegExp(`^${day}, `) });

test.describe("F6 Heute: Kopf und Begrüßung", () => {
  test("F6 Die Begrüßung nennt den Namen und richtet sich nach der Tageszeit", async ({ page }) => {
    const items = {
      [dataKey]: JSON.stringify(demoData(FROZEN_TODAY)),
      [deviceKey]: JSON.stringify({ currentPerson: "personA" }),
    };
    for (const [hour, expected] of [
      [8, "Guten Morgen, Alex!"],
      [12, "Hallo, Alex!"],
      [20, "Guten Abend, Alex!"],
    ] as const) {
      await page.clock.setFixedTime(new Date(2026, 9, 21, hour, 0, 0));
      await store(page, items, "#/heute");

      await expect(page.getByRole("heading", { level: 1, name: expected })).toBeVisible();
      await expect(page).toHaveTitle("Heute – Krümel");
    }
  });

  test("F6 Der Kopf zeigt Initiale, Datum und die Kalenderwoche; Robin sieht seinen Namen", async ({
    page,
  }) => {
    await openToday(page, demoData(FROZEN_TODAY), "personB");

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Hallo, Robin!");
    await expect(page.getByRole("img", { name: "Robin", exact: true })).toHaveText("R");
    await expect(page.getByText("Mittwoch, 21. Oktober")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: /^KW / })).toHaveText("KW 43");
  });

  test("F6 Ein Satz fasst zusammen, was heute ansteht, und nennt das Überfällige", async ({
    page,
  }) => {
    await openToday(page);

    await expect(page.locator(".today__summary")).toHaveText(
      "Heute stehen 4 Aufgaben für dich an. 2 davon sind überfällig.",
    );
  });

  test("F6 Ohne Aufgaben begrüßt die Seite und führt zur ersten Aufgabe", async ({ page }) => {
    await openToday(page, { ...demoData(FROZEN_TODAY), tasks: [], completions: [] });

    await expect(page.locator(".today__summary")).toHaveText("Heute steht nichts für dich an.");
    await expect(page.getByText("Es gibt noch keine Aufgaben.")).toBeVisible();
    await page.getByRole("link", { name: "Erste Aufgabe anlegen" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Neue Aufgabe" })).toBeFocused();
  });
});

test.describe("F6 Heute: Deine Woche, Kacheln und Aufgaben des Tages", () => {
  test("F6 Sieben Tagesfelder zeigen je Tag, was offen und was erledigt ist", async ({ page }) => {
    await openToday(page);

    const labels = await page.locator(".day-field .visually-hidden").allTextContents();
    expect(labels).toEqual([
      "Montag, 1 Aufgabe",
      "Dienstag, 1 Aufgabe",
      "Mittwoch, heute, 0 von 2 erledigt",
      "Donnerstag, frei",
      "Freitag, frei",
      "Samstag, frei",
      "Sonntag, frei",
    ]);
    await expect(page.locator(".day-field--today")).toHaveAttribute("aria-current", "date");
    await expect(page.locator(".day-field--today .day-field__mark")).toHaveText("0/2");
    await expect(page.locator(".day-field--open .day-field__mark").first()).toHaveText("1");
  });

  test("F6 Die Kacheln zeigen die eigene Woche und die gemeinsame mit Ring und Prozent", async ({
    page,
  }) => {
    await openToday(page);

    const mine = page.getByRole("region", { name: "Deine Woche", exact: true }).nth(1);
    await expect(mine).toContainText("Aufgaben geschafft");
    await expect(mine.locator(".stat-tile__value .visually-hidden")).toHaveText("0 von 4");
    const together = page.getByRole("region", { name: "Gemeinsam", exact: true });
    const ring = together.getByRole("img");
    await expect(ring).toHaveAttribute("aria-label", /^Gemeinsam \d+ von \d+ erledigt$/);
    const label = (await ring.getAttribute("aria-label")) ?? "";
    const [, done, due] = label.match(/(\d+) von (\d+)/) ?? [];
    await expect(ring).toContainText(`${Math.round((Number(done) / Number(due)) * 100)}%`);
    await expect(together).toContainText(`${done} von ${due} diese Woche`);
  });

  test("F6 „Heute für dich“ zeigt Überfälliges zuerst, dann das Heutige", async ({ page }) => {
    await openToday(page);

    await expect(page.getByRole("heading", { level: 2, name: "Heute für dich" })).toBeVisible();
    expect(await titles(page)).toEqual([
      "Bad putzen",
      "Handwerker anrufen",
      "Einkaufen",
      "Staubsaugen",
    ]);
    await expect(cards(page).nth(0)).toContainText("2 Tage überfällig");
    await expect(cards(page).nth(1)).toContainText("1 Tag überfällig");
    await expect(cards(page).nth(2)).not.toContainText("überfällig");
  });

  test("F2 Abhaken setzt die Aufgabe nach unten, mit Uhrzeit, und „Rückgängig“ holt sie zurück", async ({
    page,
  }) => {
    await openToday(page);

    await page.getByRole("button", { name: "Abhaken: Staubsaugen" }).click();

    await expect(notice(page)).toContainText("„Staubsaugen“ ist abgehakt");
    await expect(page.locator(".today__summary")).toHaveText(
      "Heute stehen 3 Aufgaben für dich an. 2 davon sind überfällig.",
    );
    expect(await titles(page)).toEqual([
      "Bad putzen",
      "Handwerker anrufen",
      "Einkaufen",
      "Staubsaugen",
    ]);
    const done = cards(page).last();
    await expect(done).toHaveClass(/today-card--done/);
    await expect(done).toContainText("erledigt um 12:00");
    await expect(done.getByRole("img", { name: "Erledigt" })).toBeVisible();
    await expect(page.locator(".day-field--today .day-field__mark")).toHaveText("1/2");

    const stored = (await storedData(page)).completions.at(-1);
    expect(stored?.taskId).toBe("demo-staubsaugen");
    expect(stored?.completedBy).toBe("personA");
    expect(typeof stored?.completedAt).toBe("string");
    expect(stored?.assigneeAtCompletion).toBe("both");

    await notice(page).getByRole("button", { name: "Rückgängig" }).click();

    await expect(notice(page)).toContainText("Rückgängig gemacht");
    await expect(page.locator(".today-card--done")).toHaveCount(0);
    await expect(page.locator(".today__summary")).toHaveText(
      "Heute stehen 4 Aufgaben für dich an. 2 davon sind überfällig.",
    );
  });

  test("F6 Sind alle Aufgaben des Tages erledigt, sagt der Satz es", async ({ page }) => {
    const data = demoData(FROZEN_TODAY);
    const only: AppData = {
      ...data,
      tasks: data.tasks.filter((task) => task.id === "demo-einkaufen"),
      completions: [],
    };
    await openToday(page, only);

    await page.getByRole("button", { name: "Abhaken: Einkaufen" }).click();

    await expect(page.locator(".today__summary")).toHaveText(
      "Heute ist alles erledigt. Gut gemacht!",
    );
  });

  test("F5 „Meine / Alle“ filtert die Liste; ein Tipp auf einen Tag zeigt dessen Aufgaben", async ({
    page,
  }) => {
    await openToday(page);

    await dayField(page, "Donnerstag").click();

    await expect(
      page.getByRole("heading", { level: 2, name: "Do, 22.10. für dich" }),
    ).toBeFocused();
    await expect(dayField(page, "Donnerstag")).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Für diesen Tag steht nichts an.")).toBeVisible();

    await page.getByRole("button", { name: "Alle", exact: true }).click();

    await expect(page.getByRole("button", { name: "Alle", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(
      page.getByRole("heading", { level: 2, name: "Do, 22.10. für euch" }),
    ).toBeVisible();
    expect(await titles(page)).toEqual(["Müll rausbringen", "Paket abholen"]);
    await expect(cards(page).first()).toContainText("Robin");
  });

  test("F6 Die Wochenwahl blättert die Tagesfelder und Kacheln, „Diese Woche“ kommt zurück", async ({
    page,
  }) => {
    await openToday(page);

    await page.getByRole("button", { name: "Nächste Woche" }).click();

    await expect(page.getByRole("status").filter({ hasText: /^KW / })).toHaveText("KW 44");
    await expect(page.getByRole("region", { name: "Gemeinsam" })).toContainText("in dieser Woche");
    await expect(page.locator(".day-field--today")).toHaveCount(0);
    // Ohne gewählten Tag zeigt die Liste den Montag dieser Woche.
    await expect(
      page.getByRole("heading", { level: 2, name: "Mo, 26.10. für dich" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Diese Woche" }).click();

    await expect(page.getByRole("status").filter({ hasText: /^KW / })).toHaveText("KW 43");
    await expect(page.getByRole("heading", { level: 2, name: "Heute für dich" })).toBeVisible();
  });

  test("F6 Eine Aufgabe öffnet ihre Details; Escape schließt sie und gibt den Fokus zurück", async ({
    page,
  }) => {
    await openToday(page);
    const open = page.locator('[data-task-open="demo-bad"]');

    await open.focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", { name: "Bad putzen", exact: true });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(open).toBeFocused();
  });

  test("F5 Aus den Details lässt sich eine Aufgabe der anderen Person übernehmen", async ({
    page,
  }) => {
    await openToday(page);
    await dayField(page, "Donnerstag").click();
    await page.getByRole("button", { name: "Alle", exact: true }).click();

    await page.locator('[data-task-open="demo-paket"]').click();
    await page
      .getByRole("dialog", { name: "Paket abholen" })
      .getByRole("button", { name: "Übernehmen" })
      .click();

    await expect(notice(page)).toContainText("„Paket abholen“ ist jetzt bei Alex.");
  });
});

test.describe("N1 Navigation: Heute · Woche · Plus · Statistik · Einstellungen", () => {
  test("N1 Die Einträge stehen in dieser Reihenfolge, der aktuelle ist als Seite markiert", async ({
    page,
  }) => {
    await openToday(page);
    const nav = page.getByRole("navigation", { name: "Hauptnavigation" });

    const names = await nav
      .getByRole("link")
      .evaluateAll((links) => links.map((link) => link.textContent?.trim()));
    expect(names).toEqual(["Heute", "Woche", "Neue Aufgabe", "Statistik", "Einstellungen"]);
    await expect(nav.getByRole("link", { name: "Heute" })).toHaveAttribute("aria-current", "page");
    await expect(nav.locator("[aria-current]")).toHaveCount(1);
  });

  test("N1 Jeder Eintrag führt zu seiner Seite, das Plus zum Formular für eine neue Aufgabe", async ({
    page,
  }) => {
    await openToday(page);
    const nav = page.getByRole("navigation", { name: "Hauptnavigation" });

    await nav.getByRole("link", { name: "Woche", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Diese Woche" })).toBeFocused();
    await expect(nav.getByRole("link", { name: "Woche" })).toHaveAttribute("aria-current", "page");

    await nav.getByRole("link", { name: "Statistik" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Eure Bilanz" })).toBeFocused();

    await nav.getByRole("link", { name: "Einstellungen" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Einstellungen" })).toBeFocused();

    await nav.getByRole("link", { name: "Neue Aufgabe" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Neue Aufgabe" })).toBeFocused();
    await expect(nav.getByRole("link", { name: "Neue Aufgabe" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    // Das Formular gehört zur Woche: dieser Eintrag bleibt „wahr“, ohne die Seite zu sein.
    await expect(nav.getByRole("link", { name: "Woche" })).toHaveAttribute("aria-current", "true");

    await nav.getByRole("link", { name: "Heute" }).click();
    await expect(page.getByRole("heading", { level: 1, name: /^Hallo, / })).toBeFocused();
  });

  test("N1 „Aufgaben“ und „Erledigt“ sind aus „Woche“ und aus den Einstellungen erreichbar", async ({
    page,
  }) => {
    await openToday(page);
    const nav = page.getByRole("navigation", { name: "Hauptnavigation" });
    await expect(nav.getByRole("link", { name: "Aufgaben" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Erledigt" })).toHaveCount(0);

    await nav.getByRole("link", { name: "Woche", exact: true }).click();
    await page
      .getByRole("navigation", { name: "Listen" })
      .getByRole("link", { name: "Aufgaben" })
      .click();
    await expect(page.getByRole("heading", { level: 1, name: "Aufgaben" })).toBeFocused();
    await expect(nav.getByRole("link", { name: "Woche", exact: true })).toHaveAttribute(
      "aria-current",
      "true",
    );

    await nav.getByRole("link", { name: "Woche", exact: true }).click();
    await page
      .getByRole("navigation", { name: "Listen" })
      .getByRole("link", { name: "Erledigt" })
      .click();
    await expect(page.getByRole("heading", { level: 1, name: "Erledigt" })).toBeFocused();

    await nav.getByRole("link", { name: "Einstellungen" }).click();
    await page.getByRole("link", { name: "Aufgaben", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Aufgaben" })).toBeFocused();
    await nav.getByRole("link", { name: "Einstellungen" }).click();
    await page.getByRole("link", { name: "Erledigt", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Erledigt" })).toBeFocused();
  });

  test("N1 Am Handy zeigt nur die aktuelle Seite ihren Namen, die übrigen nur das Symbol", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openToday(page);
    const nav = page.getByRole("navigation", { name: "Hauptnavigation" });

    const visible = await nav.getByRole("link").evaluateAll((links) =>
      links.map((link) => {
        const label = link.querySelector(".main-nav__label") as HTMLElement;
        return Math.round(label.getBoundingClientRect().width) > 2;
      }),
    );
    // Nur „Heute“ zeigt seinen Namen.
    expect(visible).toEqual([true, false, false, false, false]);
    // Trotzdem hat jedes Symbol einen Namen und mindestens 44 × 44 Pixel.
    for (const link of await nav.getByRole("link").all()) {
      const box = await link.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("N1 Auf der Startseite ist alles mit der Tastatur zu erreichen: Tagesfeld, Filter, Abhaken", async ({
    page,
  }) => {
    await openToday(page);

    await dayField(page, "Mittwoch").focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { level: 2, name: "Heute für dich" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Meine" })).toBeFocused();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Alle", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.getByRole("button", { name: "Abhaken: Einkaufen" }).focus();
    await page.keyboard.press("Enter");
    await expect(notice(page)).toBeFocused();
  });
});

test.describe("N2 Heute: Barrierefreiheit", () => {
  test("N2 Die Startseite hat in beiden Farbschemata keine Verstöße (mit Details und Hinweis)", async ({
    page,
  }) => {
    await openToday(page);
    await expectNoAccessibilityViolations(page);

    await page.getByRole("button", { name: "Abhaken: Staubsaugen" }).click();
    await expect(notice(page)).toBeVisible();
    await expectNoAccessibilityViolations(page);

    await page.locator('[data-task-open="demo-bad"]').click();
    await expect(page.getByRole("dialog", { name: "Bad putzen" })).toBeVisible();
    await expectNoAccessibilityViolations(page);
  });

  test("N2 Tippflächen sind auch am kleinsten Handy mindestens 44 × 44 Pixel groß", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await openToday(page);

    const small = await page.evaluate(() =>
      [...document.querySelectorAll("main button, main a, nav a")]
        .filter((element) => (element as HTMLElement).offsetParent !== null)
        .map((element) => {
          const { width, height } = element.getBoundingClientRect();
          return {
            name: element.getAttribute("aria-label") ?? element.textContent?.trim(),
            width,
            height,
          };
        })
        .filter(({ width, height }) => width < 44 || height < 44),
    );

    expect(small).toEqual([]);
  });

  test("N2 Im Kontrastmodus behalten Karten, Kacheln und Tagesfelder ihre Ränder, Erledigtes sein Häkchen", async ({
    page,
  }) => {
    await openToday(page);
    await page.getByRole("button", { name: "Abhaken: Staubsaugen" }).click();
    await expect(notice(page)).toBeVisible();

    await page.emulateMedia({ forcedColors: "active" });

    const borders = await page.evaluate(() =>
      [".today-card", ".stat-tile", ".day-field", ".week-pill", ".main-nav"].map(
        (selector) =>
          `${selector} ${getComputedStyle(document.querySelector(selector) as Element).borderTopStyle}`,
      ),
    );
    expect(borders).toEqual([
      ".today-card solid",
      ".stat-tile solid",
      ".day-field solid",
      ".week-pill solid",
      ".main-nav solid",
    ]);
    await expect(page.locator(".today-card--done .tick-round--done svg")).toBeVisible();
    await expect(page.locator(".day-field[aria-pressed=true]")).toHaveCount(1);
  });

  test("N2 Mit „weniger Bewegung“ läuft keine Animation (Ring, Abhak-Knopf)", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openToday(page);

    const durations = await page.evaluate(() =>
      [".ring__fill", ".tick-round", ".tick-round__icon"].map(
        (selector) =>
          getComputedStyle(document.querySelector(selector) as Element).transitionDuration,
      ),
    );

    expect(durations.every((duration) => duration === "0s")).toBe(true);
  });

  test("N2 Mit Bewegung dauert der Übergang des Rings unter 200 ms", async ({ page }) => {
    await openToday(page);

    const seconds = await page.evaluate(() =>
      Number.parseFloat(
        getComputedStyle(document.querySelector(".ring__fill") as Element).transitionDuration,
      ),
    );

    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThan(0.2);
  });
});

test.describe("F6 Heute: Zeit ohne Uhrzeit", () => {
  test("F6 Eine Erledigung aus Etappe 1 ohne Uhrzeit steht nur als „erledigt“ da", async ({
    page,
  }) => {
    const data = demoData(FROZEN_TODAY);
    const completion = data.completions[0];
    if (completion === undefined) {
      throw new Error("Die Demo-Daten haben keine Erledigung");
    }
    await freezeClock(page);
    await openToday(page, {
      ...data,
      completions: [{ ...completion, completedOn: FROZEN_TODAY }, ...data.completions.slice(1)],
    });

    await expect(page.locator(".today-card--done").first()).toContainText(/erledigt( von \w+)?$/);
  });
});
