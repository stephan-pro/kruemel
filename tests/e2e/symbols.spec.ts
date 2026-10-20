import { expect, type Locator, type Page, test } from "@playwright/test";
import { demoData } from "../../src/demo/demoData";
import { calendarDay } from "../../src/domain/date";
import { TASK_SYMBOLS } from "../../src/domain/taskSymbols";
import type { AppData } from "../../src/storage/appData";
import { expectNoAccessibilityViolations } from "./axe";
import {
  dataKey,
  expectPageShown,
  goToPage,
  startConfigured,
  store,
  storedData,
  WEEK_HASH,
} from "./helpers";

// Package R2: a symbol per task (F8), chosen in the task form and shown wherever the task stands.
// The clock stands still on Wednesday 21.10.2026 (as in week.spec.ts): "Einkaufen" is due today,
// "Bad putzen" is the most urgent overdue task.

const TODAY = calendarDay("2026-10-21");
const demo = () => demoData(TODAY);

async function start(page: Page, data: AppData | string = demo()) {
  await page.clock.setFixedTime(new Date(2026, 9, 21, 12, 0, 0));
  if (typeof data === "string") {
    await store(
      page,
      {
        [dataKey]: data,
        "putzplan:device": JSON.stringify({ currentPerson: "personA" }),
      },
      WEEK_HASH,
    );
  } else {
    await startConfigured(page, data);
  }
  await expect(page.getByRole("heading", { level: 1, name: "Diese Woche" })).toBeVisible();
}

async function openNewTask(page: Page) {
  await goToPage(page, "Aufgaben");
  await page.getByRole("link", { name: "Neue Aufgabe" }).click();
  await expectPageShown(page, "Neue Aufgabe");
}

async function openEdit(page: Page, title: string) {
  await goToPage(page, "Aufgaben");
  await page.getByRole("link", { name: `Bearbeiten: ${title}` }).click();
  await expectPageShown(page, "Aufgabe bearbeiten");
}

const symbolRadio = (page: Page, label: string) =>
  page.getByRole("radio", { name: label, exact: true });

/** The symbol a part of the page shows (decoration, so it is read from the page, not the tree). */
async function shownSymbol(container: Locator): Promise<string | null> {
  return container.locator(".task-symbol").first().getAttribute("data-symbol");
}

const card = (page: Page, title: string) => page.getByRole("article", { name: title, exact: true });
const todayTile = (page: Page) => page.getByRole("region", { name: "Heute · Mi, 21.10." });
const entry = (page: Page, title: string) =>
  todayTile(page).locator(".entry").filter({ hasText: title });

/** Version 1 as the app stored it before F8: no symbols. */
function version1(data: AppData): string {
  return JSON.stringify({
    ...data,
    schemaVersion: 1,
    tasks: data.tasks.map(({ symbol: _symbol, ...task }) => task),
  });
}

test.describe("F8 Symbol im Aufgabenformular", () => {
  test("F8 Die Symbole stehen als Radio-Gruppe mit sichtbarer Legende zur Wahl, vorbelegt mit dem Standardsymbol", async ({
    page,
  }) => {
    await start(page);
    await openNewTask(page);

    const group = page.getByRole("group", { name: "Symbol" });
    await expect(page.locator("legend", { hasText: "Symbol" })).toBeVisible();
    await expect(group.getByRole("radio")).toHaveCount(TASK_SYMBOLS.length);
    for (const symbol of TASK_SYMBOLS) {
      await expect(symbolRadio(page, symbol.label)).toHaveCount(1);
    }
    await expect(symbolRadio(page, "Standard (Haus)")).toBeChecked();
    await expect(page.getByText("Gewählt: Standard (Haus)")).toBeVisible();
    // Jede Symbol-Kachel ist mindestens 44 × 44 px groß.
    const box = await page.locator(".symbol-choice").first().boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
    await expectNoAccessibilityViolations(page);
  });

  test("F8 Mit der Maus gewählt, erscheint das Symbol in der Aufgabenliste und in der Woche", async ({
    page,
  }) => {
    await start(page);
    await openNewTask(page);
    await page.getByLabel("Titel").fill("Blumen gießen");

    await symbolRadio(page, "Pflanze").click();

    await expect(symbolRadio(page, "Pflanze")).toBeChecked();
    await expect(symbolRadio(page, "Standard (Haus)")).not.toBeChecked();
    await expect(page.getByText("Gewählt: Pflanze")).toBeVisible();
    await expectNoAccessibilityViolations(page);
    await page.getByRole("button", { name: "Aufgabe anlegen" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Aufgaben" })).toBeFocused();
    expect(await shownSymbol(card(page, "Blumen gießen"))).toBe("plant");
    const saved = (await storedData(page)).tasks.find((task) => task.title === "Blumen gießen");
    expect(saved?.symbol).toBe("plant");

    await page.getByRole("link", { name: "Woche", exact: true }).click();
    await expectPageShown(page, "Diese Woche");
    expect(await shownSymbol(entry(page, "Blumen gießen"))).toBe("plant");
  });

  test("F8 Mit der Tastatur wählen: Pfeiltasten wechseln das Symbol wie in jeder Radio-Gruppe", async ({
    page,
  }) => {
    await start(page);
    await openNewTask(page);
    await page.getByLabel("Titel").fill("Fegen");

    // Tab führt vom Titel in die Gruppe, auf das gewählte Symbol.
    await page.keyboard.press("Tab");
    await expect(symbolRadio(page, "Standard (Haus)")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await expect(symbolRadio(page, "Besen")).toBeChecked();
    await expect(symbolRadio(page, "Besen")).toBeFocused();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowLeft");

    await expect(symbolRadio(page, "Besen")).toBeChecked();
    await expect(page.getByText("Gewählt: Besen")).toBeVisible();
    // Der Fokus ist an der Kachel zu sehen.
    const outline = await page
      .locator(".symbol-choice__tile")
      .nth(1)
      .evaluate((tile) => getComputedStyle(tile).outlineStyle);
    expect(outline).toBe("solid");

    await page.getByRole("button", { name: "Aufgabe anlegen" }).click();
    expect(await shownSymbol(card(page, "Fegen"))).toBe("broom");
  });

  test("F8 Beim Bearbeiten ist das Symbol der Aufgabe gewählt und lässt sich ändern", async ({
    page,
  }) => {
    await start(page);
    await openEdit(page, "Bad putzen");
    await expect(symbolRadio(page, "Badewanne")).toBeChecked();

    await symbolRadio(page, "Dusche").click();
    await page.getByRole("button", { name: "Speichern" }).click();

    await expect(
      page.getByRole("status").filter({ hasText: "Aufgabe „Bad putzen“ gespeichert." }),
    ).toBeVisible();
    expect(await shownSymbol(card(page, "Bad putzen"))).toBe("shower");
    const saved = (await storedData(page)).tasks.find((task) => task.id === "demo-bad");
    expect(saved?.symbol).toBe("shower");
  });
});

test.describe("F8 Anordnung der Symbolauswahl", () => {
  /** How many tiles stand in each row of the symbol field, top to bottom, and the smallest tile. */
  async function rowsOfTiles(page: Page) {
    const tiles = await page.locator(".symbol-choice").evaluateAll((all) =>
      all.map((element) => {
        const box = element.getBoundingClientRect();
        return { top: Math.round(box.top), width: box.width, height: box.height };
      }),
    );
    const rows = new Map<number, number>();
    for (const { top } of tiles) {
      rows.set(top, (rows.get(top) ?? 0) + 1);
    }
    return {
      perRow: [...rows.entries()].sort(([a], [b]) => a - b).map(([, count]) => count),
      smallest: Math.min(...tiles.flatMap(({ width, height }) => [width, height])),
    };
  }

  test("F8 In jeder Breite steht keine einzelne Kachel allein in der letzten Reihe, und alle Kacheln sind groß genug", async ({
    page,
  }) => {
    await start(page);
    await openNewTask(page);

    // Von sehr schmalen Handys über 360/375/390/412 bis zum Breitbild (mit Seitenleiste ab 900).
    for (const width of [320, 340, 360, 375, 390, 412, 480, 640, 800, 899, 900, 1024, 1280, 1600]) {
      await page.setViewportSize({ width, height: 900 });
      const { perRow, smallest } = await rowsOfTiles(page);

      expect(
        perRow.reduce((sum, count) => sum + count, 0),
        `Breite ${width}`,
      ).toBe(TASK_SYMBOLS.length);
      expect(
        perRow[perRow.length - 1],
        `Letzte Reihe bei Breite ${width}: ${perRow}`,
      ).toBeGreaterThan(1);
      expect(smallest, `Kleinste Kachel bei Breite ${width}`).toBeGreaterThanOrEqual(44);
      // Alle Reihen bis auf die letzte sind voll.
      expect(
        new Set(perRow.slice(0, -1)).size,
        `Reihen bei Breite ${width}: ${perRow}`,
      ).toBeLessThanOrEqual(1);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `Seite ragt bei Breite ${width} über den Rand`).toBeLessThanOrEqual(0);
    }
  });

  test("F8 Mit 21 Symbolen füllen 7 × 3 oder 6 × 3 + 3 die Reihen, nicht 5 × 4 + 1", async ({
    page,
  }) => {
    await start(page);
    await openNewTask(page);

    await page.setViewportSize({ width: 1280, height: 900 });
    expect((await rowsOfTiles(page)).perRow).toEqual([7, 7, 7]);
    await page.setViewportSize({ width: 375, height: 900 });
    expect((await rowsOfTiles(page)).perRow).toEqual([6, 6, 6, 3]);
  });
});

test.describe("F8 Anzeige der Symbole", () => {
  test("F8 Die Woche zeigt das Symbol jeder Aufgabe in Tageskachel, Überfällig-Kachel und Tagesspalten", async ({
    page,
  }) => {
    await start(page);

    expect(await shownSymbol(entry(page, "Einkaufen"))).toBe("shopping");
    expect(await shownSymbol(entry(page, "Staubsaugen"))).toBe("broom");
    const overdue = page.getByRole("region", { name: "Überfällig", exact: true });
    expect(await shownSymbol(overdue.locator(".overdue").first())).toBe("bath");
    const strip = page.getByRole("region", { name: "Woche im Überblick" });
    expect(await shownSymbol(strip.locator(".chip").filter({ hasText: "Paket abholen" }))).toBe(
      "standard",
    );
    // Schmuck: Der Titel sagt, was die Aufgabe ist; das Symbol bleibt Screenreadern verborgen.
    for (const symbol of await page.locator(".task-symbol").all()) {
      await expect(symbol).toHaveAttribute("aria-hidden", "true");
    }
    await expect(todayTile(page).getByText("Einkaufen", { exact: true })).toBeVisible();
    await expectNoAccessibilityViolations(page);
  });

  test("F8 Die Aufgabenliste zeigt das Symbol jeder Aufgabe, ohne Wahl das Standardsymbol", async ({
    page,
  }) => {
    await start(page);
    await goToPage(page, "Aufgaben");

    expect(await shownSymbol(card(page, "Bad putzen"))).toBe("bath");
    expect(await shownSymbol(card(page, "Geschenk kaufen"))).toBe("gift");
    expect(await shownSymbol(card(page, "Paket abholen"))).toBe("standard");
    await expectNoAccessibilityViolations(page);
  });
});

test.describe("F8 Alte Daten (schemaVersion 1)", () => {
  test("F8 Alte Daten im Speicher werden geladen und zeigen überall das Standardsymbol", async ({
    page,
  }) => {
    const old = version1(demo());
    await start(page, old);

    await expect(todayTile(page).getByText("Einkaufen", { exact: true })).toBeVisible();
    const symbols = await page
      .locator(".task-symbol")
      .evaluateAll((all) => all.map((symbol) => symbol.getAttribute("data-symbol")));
    expect(symbols.length).toBeGreaterThan(0);
    expect(new Set(symbols)).toEqual(new Set(["standard"]));
    // Bis zum nächsten Speichern bleiben die Rohdaten, wie sie waren.
    expect(await page.evaluate((key) => localStorage.getItem(key), dataKey)).toBe(old);
    await expectNoAccessibilityViolations(page);

    await goToPage(page, "Aufgaben");
    expect(await shownSymbol(card(page, "Bad putzen"))).toBe("standard");
  });

  test("F8 Nach dem nächsten Speichern liegen die alten Daten in der aktuellen Version (3) mit Standardsymbol vor", async ({
    page,
  }) => {
    await start(page, version1(demo()));

    await page.getByRole("button", { name: "Abhaken: Einkaufen" }).click();
    await expect(page.getByRole("region", { name: "Hinweis" })).toBeVisible();

    const data = await storedData(page);
    expect(data.schemaVersion).toBe(3);
    expect(data.tasks.every((task) => task.symbol === "standard")).toBe(true);
    expect(data.tasks).toHaveLength(demo().tasks.length);
    expect(data.completions).toHaveLength(demo().completions.length + 1);
  });
});
