import { expect, type Page, test } from "@playwright/test";
import { demoData } from "../../src/demo/demoData";
import { expectNoAccessibilityViolations } from "./axe";
import { FROZEN_TODAY, openWeek, overdueTile, todayTile } from "./helpers";

// Package 12: the week view on a phone. "Überfällig" must be in sight when the page opens (F6), on
// the small phones people still use. The clock stands on Wednesday 21.10.2026 (see `week.spec.ts`);
// the first overdue task is "Bad putzen".

const PHONES = [
  { name: "360 × 640 (kleines Android-Handy)", width: 360, height: 640 },
  { name: "390 × 844 (iPhone)", width: 390, height: 844 },
];

/** The box of an element, relative to the page that was not scrolled. */
async function boxOf(locator: ReturnType<Page["locator"]>) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box as { x: number; y: number; width: number; height: number };
}

/** The top edge of the navigation bar at the bottom: what is below it is covered. */
async function navigationTop(page: Page): Promise<number> {
  return (await boxOf(page.locator(".main-nav"))).y;
}

test.describe("F6 „Überfällig“ am Handy ohne Scrollen sichtbar", () => {
  for (const { name, width, height } of PHONES) {
    test(`F6 Auf ${name} steht die Kachel „Überfällig“ beim Öffnen ganz im Bild, über der Tageskachel`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await openWeek(page);

      const overdue = await boxOf(overdueTile(page));
      const day = await boxOf(todayTile(page));
      expect(await page.evaluate(() => scrollY)).toBe(0);
      // Ganz sichtbar: unter dem oberen Rand und über der Leiste unten (die deckt den Rest ab).
      expect(overdue.y).toBeGreaterThanOrEqual(0);
      expect(overdue.y + overdue.height).toBeLessThanOrEqual(await navigationTop(page));
      // Und sie steht über der Tageskachel, nicht daneben oder darunter.
      expect(overdue.y + overdue.height).toBeLessThanOrEqual(day.y);
      await expect(
        overdueTile(page).getByRole("button", { name: "Abhaken: Bad putzen" }),
      ).toBeInViewport({ ratio: 1 });
    });
  }

  test("F6 Auch mit einem langen Titel bleibt die Kachel auf dem kleinen Handy ganz im Bild", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    const data = demoData(FROZEN_TODAY);
    const longTitle = "Sehr langer Titel einer überfälligen Aufgabe, der über mehrere Zeilen läuft";
    await openWeek(page, {
      ...data,
      tasks: data.tasks.map((task) =>
        task.id === "demo-bad" ? { ...task, title: longTitle } : task,
      ),
    });

    const overdue = await boxOf(overdueTile(page));

    expect(overdue.y + overdue.height).toBeLessThanOrEqual(await navigationTop(page));
  });

  test("F6 Im Seitenaufbau steht „Überfällig“ vor der Tageskachel, damit Tastatur und Screenreader zuerst dorthin kommen", async ({
    page,
  }) => {
    await openWeek(page);

    const order = await page
      .locator(".week-board > section")
      .evaluateAll((sections) =>
        sections.map((section) => section.getAttribute("aria-labelledby")),
      );

    expect(order).toEqual(["ueberfaellig", "tag-titel", "stand", "woche-tage"]);
  });

  test("F6 Ohne überfällige Aufgaben beginnt die Seite mit der Tageskachel", async ({ page }) => {
    const data = demoData(FROZEN_TODAY);
    const gone = ["demo-bad", "demo-handwerker"];
    await page.setViewportSize({ width: 360, height: 640 });
    await openWeek(page, {
      ...data,
      tasks: data.tasks.filter((task) => !gone.includes(task.id)),
      completions: data.completions.filter((completion) => !gone.includes(completion.taskId)),
    });

    const order = await page
      .locator(".week-board > section")
      .evaluateAll((sections) =>
        sections.map((section) => section.getAttribute("aria-labelledby")),
      );

    expect(order).toEqual(["tag-titel", "stand", "woche-tage"]);
  });

  test("F6 Am PC steht „Überfällig“ weiterhin rechts neben der Tageskachel und „Stand“ darunter", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await openWeek(page);

    const overdue = await boxOf(overdueTile(page));
    const day = await boxOf(todayTile(page));
    const progress = await boxOf(page.getByRole("region", { name: "Stand", exact: true }));

    expect(overdue.x).toBeGreaterThanOrEqual(day.x + day.width);
    expect(Math.abs(overdue.y - day.y)).toBeLessThanOrEqual(1);
    expect(progress.x).toBe(overdue.x);
    expect(progress.y).toBeGreaterThanOrEqual(overdue.y + overdue.height);
    expect(await page.evaluate(() => scrollX)).toBe(0);
    await expectNoAccessibilityViolations(page);
  });

  test("F6 Dazwischen (Tablet) stehen die Kacheln untereinander und nichts ragt über den Rand", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 820, height: 1180 });
    await openWeek(page);

    const overdue = await boxOf(overdueTile(page));
    const day = await boxOf(todayTile(page));
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );

    expect(overdue.y + overdue.height).toBeLessThanOrEqual(day.y);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("N3 Abstände am Rand (Aussparung des Handys)", () => {
  test("N3 Ohne Aussparung bleibt es beim normalen Seitenrand von 16 px", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await openWeek(page);

    const padding = await page.evaluate(() => {
      const style = (selector: string) =>
        getComputedStyle(document.querySelector(selector) as Element);
      return {
        mainLeft: style("main").paddingLeft,
        mainRight: style("main").paddingRight,
        headerLeft: style(".app-header").paddingLeft,
        navBottom: style(".main-nav").paddingBottom,
      };
    });

    expect(padding).toEqual({
      mainLeft: "16px",
      mainRight: "16px",
      headerLeft: "16px",
      navBottom: "6px",
    });
  });
});
