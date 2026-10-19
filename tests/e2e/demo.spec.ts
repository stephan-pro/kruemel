import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { demoData } from "../../src/demo/demoData";
import { dayFromDate } from "../../src/domain/date";

// `npm run demo` serves the app in mode "demo" (see `webServer` in playwright.config.ts).
const demoUrl = "http://localhost:4174/putzplan/";
const dataKey = "putzplan-demo:data";

// The same example data the app seeds, computed for the same day.
const expected = demoData(dayFromDate(new Date()));
const hint = `Demo-Modus: ${expected.tasks.length} Beispielaufgaben und ${expected.completions.length} Erledigungen`;

test.describe("Demo-Modus (Q8)", () => {
  test("füllt beim ersten Start den Demo-Speicher mit den Beispieldaten", async ({ page }) => {
    await page.goto(demoUrl);
    await expect(page.getByText(hint)).toBeVisible();
    const stored = await page.evaluate((key) => localStorage.getItem(key), dataKey);
    expect(JSON.parse(stored ?? "null")).toEqual(JSON.parse(JSON.stringify(expected)));
  });

  test("hat keine Barrierefreiheitsverstöße (axe)", async ({ page }) => {
    await page.goto(demoUrl);
    await expect(page.getByText(hint)).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
  });

  test("behält eigene Änderungen beim Neuladen", async ({ page }) => {
    await page.goto(demoUrl);
    await expect(page.getByText(hint)).toBeVisible();
    await page.evaluate((key) => {
      const data = JSON.parse(localStorage.getItem(key) ?? "{}") as { tasks: { id: string }[] };
      data.tasks = data.tasks.filter((task) => task.id !== "demo-geschenk");
      localStorage.setItem(key, JSON.stringify(data));
    }, dataKey);
    await page.reload();
    await expect(
      page.getByText(`Demo-Modus: ${expected.tasks.length - 1} Beispielaufgaben`),
    ).toBeVisible();
  });

  test("lädt über „Beispieldaten neu laden“ frische Daten und räumt die Adresse auf", async ({
    page,
  }) => {
    await page.goto(demoUrl);
    await expect(page.getByText(hint)).toBeVisible();
    await page.evaluate((key) => {
      const data = JSON.parse(localStorage.getItem(key) ?? "{}") as { tasks: { id: string }[] };
      data.tasks = data.tasks.filter((task) => task.id !== "demo-geschenk");
      localStorage.setItem(key, JSON.stringify(data));
    }, dataKey);
    await page.reload();
    await expect(
      page.getByText(`Demo-Modus: ${expected.tasks.length - 1} Beispielaufgaben`),
    ).toBeVisible();
    await page.getByRole("link", { name: "Beispieldaten neu laden" }).click();
    await expect(page.getByText(hint)).toBeVisible();
    await expect(page).toHaveURL(demoUrl);
  });

  test("lässt echte Daten im selben Browser unberührt", async ({ page }) => {
    await page.goto(demoUrl);
    await expect(page.getByText(hint)).toBeVisible();
    await page.evaluate(() => localStorage.setItem("putzplan:data", "echte Daten"));
    await page.getByRole("link", { name: "Beispieldaten neu laden" }).click();
    await expect(page.getByText(hint)).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem("putzplan:data"))).toBe("echte Daten");
  });
});

test("die echte App enthält weder Demo-Hinweis noch Demo-Daten", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { level: 1, name: "Putzplan" })).toBeVisible();
  await expect(page.getByText("Demo-Modus")).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), dataKey)).toBeNull();
});
