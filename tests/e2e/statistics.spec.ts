import { expect, type Page, test } from "@playwright/test";
import { demoData } from "../../src/demo/demoData";
import { expectNoAccessibilityViolations } from "./axe";
import { FROZEN_TODAY, freezeClock, goToPage, openToday, store } from "./helpers";

// E2-4b: die Seite „Statistik“ (DESIGN.md Abschnitt 6, „Eure Bilanz“).
//
// Die Uhr steht auf Mi 21.10.2026. Aus den Demo-Daten (siehe week.spec.ts) ergibt sich für Alex und
// Robin, jeweils nach dem Tag, an dem abgehakt wurde:
//   diese Woche (KW 43, 19.–25.10.): Müll rausbringen (Alex)                                      → 1
//   letzte Woche (12.–18.10.):       Bad putzen, Staubsaugen, Bettwäsche (Alex);
//                                    Müll rausbringen, Küche wischen, Altglas (Robin)               → 6
//   Oktober: dazu Bad putzen (5.10., Alex) und Staubsaugen (7.10., Robin)                          → 9
//   September: Fenster putzen (1.9., Robin)                                                         → 1
//   2026 insgesamt: 10, je 5 von Alex und Robin; einmal hat Alex übernommen, was Robin zugeteilt war
//   (Müll rausbringen am 19.10.). Am häufigsten: Bad putzen, Müll rausbringen, Staubsaugen (je 2×).
//   Serie: die Wochen vom 12.10., 5.10. und 31.8. waren ganz erledigt, die dazwischen ohne Fälliges.

const period = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
const total = (page: Page) => page.locator(".stats-total__value");
const comparison = (page: Page) => page.locator(".stats-total__text");
const chart = (page: Page) => page.locator("svg.chart");

async function openStatistics(page: Page, data = demoData(FROZEN_TODAY)) {
  await openToday(page, data);
  await goToPage(page, "Statistik", "Eure Bilanz");
}

test.describe("F9 Statistik: Zeitraum, Summe und Vergleich", () => {
  test("F9 Die Seite heißt „Eure Bilanz“ und zeigt zuerst die Woche mit Summe und Vergleich zur Vorwoche", async ({
    page,
  }) => {
    await openStatistics(page);

    await expect(page).toHaveTitle("Statistik – Krümel");
    await expect(period(page, "Woche")).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("heading", { level: 2, name: "Gemeinsam erledigt · KW 43" }),
    ).toBeVisible();
    await expect(total(page)).toHaveText("1");
    await expect(comparison(page)).toHaveText("5 weniger als in der Vorwoche");
  });

  test("F9 Monat und Jahr rechnen neu und vergleichen mit dem Vormonat und dem Vorjahr", async ({
    page,
  }) => {
    await openStatistics(page);

    await period(page, "Monat").click();
    await expect(period(page, "Monat")).toHaveAttribute("aria-pressed", "true");
    await expect(period(page, "Woche")).toHaveAttribute("aria-pressed", "false");
    await expect(
      page.getByRole("heading", { level: 2, name: "Gemeinsam erledigt · Oktober 2026" }),
    ).toBeVisible();
    await expect(total(page)).toHaveText("9");
    await expect(comparison(page)).toHaveText("8 mehr als im Vormonat");

    await period(page, "Jahr").click();
    await expect(
      page.getByRole("heading", { level: 2, name: "Gemeinsam erledigt · 2026" }),
    ).toBeVisible();
    await expect(total(page)).toHaveText("10");
    await expect(comparison(page)).toHaveText("10 mehr als im Vorjahr");
  });

  test("F9 Die Serie nennt die Wochen in Folge, in denen alles Fällige erledigt war", async ({
    page,
  }) => {
    await openStatistics(page);

    await expect(page.locator(".stats-total__streak")).toHaveText("3 Wochen in Folge");
    // Sie hängt nicht am gewählten Zeitraum.
    await period(page, "Jahr").click();
    await expect(page.locator(".stats-total__streak")).toHaveText("3 Wochen in Folge");
  });

  test("F9 Ohne Erledigtes gibt es keine Serie und die Seite sagt, dass noch nichts da ist", async ({
    page,
  }) => {
    await openStatistics(page, { ...demoData(FROZEN_TODAY), completions: [] });

    await expect(total(page)).toHaveText("0");
    await expect(page.locator(".stats-total__streak")).toHaveCount(0);
    await expect(page.getByText("In diesem Zeitraum wurde noch nichts erledigt.")).toBeVisible();
    await expect(page.locator(".split-legend")).toContainText("Alex 0");
    await expect(page.locator(".split-legend")).toContainText("Robin 0");
    await expectNoAccessibilityViolations(page);
  });
});

test.describe("F9 Statistik: Diagramm", () => {
  test("F9 Das Diagramm ist ein Bild mit vollständiger Textbeschreibung: je Tag der Woche, je Monat im Jahr", async ({
    page,
  }) => {
    await openStatistics(page);

    await expect(chart(page)).toHaveAttribute("role", "img");
    await expect(chart(page)).toHaveAttribute(
      "aria-label",
      "Erledigt pro Tag: Montag 1, Dienstag 0, Mittwoch 0, Donnerstag 0, Freitag 0, Samstag 0, Sonntag 0",
    );
    expect(await chart(page).locator(".chart__bar").count()).toBe(7);

    await period(page, "Monat").click();
    expect(await chart(page).locator(".chart__bar").count()).toBe(31);
    await expect(chart(page)).toHaveAttribute("aria-label", /^Erledigt pro Tag: 1\. 0, 2\. 0,/);
    await expect(chart(page)).toHaveAttribute("aria-label", /19\. 1, 20\. 0/);

    await period(page, "Jahr").click();
    expect(await chart(page).locator(".chart__bar").count()).toBe(12);
    await expect(chart(page)).toHaveAttribute(
      "aria-label",
      "Erledigt pro Monat: Januar 0, Februar 0, März 0, April 0, Mai 0, Juni 0, Juli 0, August 0, September 1, Oktober 9, November 0, Dezember 0",
    );
  });

  test("F9 Die Balken wachsen in unter 200 ms und stehen bei „weniger Bewegung“ still", async ({
    page,
  }) => {
    await openStatistics(page);

    const seconds = await page.evaluate(() =>
      Number.parseFloat(
        getComputedStyle(document.querySelector(".chart__bar") as Element).animationDuration,
      ),
    );
    expect(seconds).toBeGreaterThan(0);
    expect(seconds).toBeLessThan(0.2);

    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(
      await page.evaluate(
        () => getComputedStyle(document.querySelector(".chart__bar") as Element).animationName,
      ),
    ).toBe("none");
  });
});

test.describe("F9 Statistik: Teamwork und Häufigstes", () => {
  test("F9 Teamwork zeigt den Anteil beider mit Namen und Zahl, und wie oft füreinander übernommen wurde", async ({
    page,
  }) => {
    await openStatistics(page);
    await period(page, "Jahr").click();

    await expect(
      page.getByRole("img", { name: "Alex 5 Aufgaben, Robin 5 Aufgaben" }),
    ).toBeVisible();
    await expect(page.locator(".split-legend")).toContainText("Alex 5");
    await expect(page.locator(".split-legend")).toContainText("Robin 5");
    await expect(page.getByText("1-mal habt ihr füreinander übernommen.")).toBeVisible();

    await period(page, "Woche").click();
    await expect(page.getByRole("img", { name: "Alex 1 Aufgabe, Robin 0 Aufgaben" })).toBeVisible();
  });

  test("F9 Es gibt keine Rangliste und keine Gewinner-Wörter", async ({ page }) => {
    await openStatistics(page);
    await period(page, "Jahr").click();

    const text = (await page.locator("main").innerText()).toLowerCase();

    for (const word of [
      "sieger",
      "gewinner",
      "platz",
      "rang",
      "besser",
      "schlechter",
      "verlierer",
    ]) {
      expect(text).not.toContain(word);
    }
  });

  test("F9 „Am häufigsten erledigt“ zeigt die drei Aufgaben mit Symbol und Anzahl", async ({
    page,
  }) => {
    await openStatistics(page);
    await period(page, "Jahr").click();

    const items = page.locator(".top-list__item");
    await expect(items).toHaveCount(3);
    expect(await items.locator(".top-list__title").allTextContents()).toEqual([
      "Bad putzen",
      "Müll rausbringen",
      "Staubsaugen",
    ]);
    await expect(items.first().locator(".task-symbol")).toHaveAttribute("data-symbol", "bath");
    await expect(items.first()).toContainText("2×");
    await expect(items.first().getByText("2-mal erledigt")).toBeAttached();
  });

  test("F9 Gezählt wird pro Aufgabe, nicht pro Titel: zwei Aufgaben mit demselben Titel stehen getrennt da", async ({
    page,
  }) => {
    const data = demoData(FROZEN_TODAY);
    await openStatistics(page, {
      ...data,
      tasks: data.tasks.map((task) =>
        task.id === "demo-muell" ? { ...task, title: "Bad putzen" } : task,
      ),
    });
    await period(page, "Jahr").click();

    expect(await page.locator(".top-list__title").allTextContents()).toEqual([
      "Bad putzen",
      "Bad putzen",
      "Staubsaugen",
    ]);
    await expect(page.locator(".top-list__count")).toHaveText(["2×", "2×", "2×"]);
  });

  test("F9 Im Woche-Zeitraum steht nur, was in dieser Woche erledigt wurde", async ({ page }) => {
    await openStatistics(page);

    expect(await page.locator(".top-list__title").allTextContents()).toEqual(["Müll rausbringen"]);
  });
});

test.describe("N2 Statistik: Barrierefreiheit und Handy", () => {
  test("N2 Jeder Zeitraum hat in beiden Farbschemata keine Verstöße", async ({ page }) => {
    await openStatistics(page);

    for (const name of ["Woche", "Monat", "Jahr"]) {
      await period(page, name).click();
      await expect(period(page, name)).toHaveAttribute("aria-pressed", "true");
      await expectNoAccessibilityViolations(page);
    }
  });

  test("N2 Der Zeitraum ist als Gruppe benannt und mit der Tastatur zu wählen", async ({
    page,
  }) => {
    await openStatistics(page);
    await expect(page.getByRole("group", { name: "Zeitraum" })).toBeVisible();

    await period(page, "Woche").focus();
    await page.keyboard.press("Tab");
    await expect(period(page, "Monat")).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(period(page, "Monat")).toHaveAttribute("aria-pressed", "true");
    await expect(total(page)).toHaveText("9");
  });

  test("N2 Am kleinsten Handy ragt nichts über den Rand und alle Tippflächen sind mindestens 44 × 44 Pixel", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await openStatistics(page);
    await period(page, "Monat").click();

    const result = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      small: [...document.querySelectorAll("main button, main a, nav a")]
        .filter((element) => (element as HTMLElement).offsetParent !== null)
        .map((element) => {
          const { width, height } = element.getBoundingClientRect();
          return { name: element.textContent?.trim(), width, height };
        })
        .filter(({ width, height }) => width < 44 || height < 44),
    }));

    expect(result.overflow).toBeLessThanOrEqual(0);
    expect(result.small).toEqual([]);
  });

  test("N2 Im Kontrastmodus behalten die Karten ihren Rand und die Balken die Farbe des Systems", async ({
    page,
  }) => {
    await openStatistics(page);
    await page.emulateMedia({ forcedColors: "active" });

    const result = await page.evaluate(() => ({
      borders: [".stats-total", ".stats-card"].map(
        (selector) => getComputedStyle(document.querySelector(selector) as Element).borderTopStyle,
      ),
      bar: getComputedStyle(document.querySelector(".chart__bar") as Element).fill,
      background: getComputedStyle(document.querySelector(".stats-total") as Element)
        .backgroundColor,
    }));

    expect(result.borders).toEqual(["solid", "solid"]);
    // Der Balken hebt sich vom Grund der Karte ab.
    expect(result.bar).not.toBe(result.background);
  });

  test("N2 Die Statistik ist von jedem Gerät aus erreichbar: Navigation am Handy, Name auch ohne Beschriftung", async ({
    page,
  }) => {
    await freezeClock(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await store(
      page,
      {
        "putzplan:data": JSON.stringify(demoData(FROZEN_TODAY)),
        "putzplan:device": JSON.stringify({ currentPerson: "personB" }),
      },
      "#/statistik",
    );

    await expect(page.getByRole("heading", { level: 1, name: "Eure Bilanz" })).toBeVisible();
    await expect(
      page.getByRole("navigation", { name: "Hauptnavigation" }).getByRole("link", {
        name: "Statistik",
      }),
    ).toHaveAttribute("aria-current", "page");
  });
});
