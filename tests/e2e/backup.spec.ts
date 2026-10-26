import { type Download, expect, type Page, test } from "@playwright/test";
import { demoData } from "../../src/demo/demoData";
import type { AppData } from "../../src/storage/appData";
import { ACCOUNT_TEXTS } from "../../src/ui/accountTexts";
import { SHARED_TEXTS } from "../../src/ui/householdTexts";
import { pushAs } from "./account";
import { expectNoAccessibilityViolations } from "./axe";
import {
  FROZEN_TODAY,
  goToPage,
  openSettings as openSettingsGroup,
  openWeek,
  storedData,
  textFile,
} from "./helpers";

// Package 11: "Sicherung" in the settings (F7): all data as a file, and back from such a file after
// a question and with an automatic copy of the current data first. The clock stands on Wednesday
// 21.10.2026 (see `week.spec.ts`), so the file names carry that day. Signed in on the shared data
// (E2-3e): a backup replaces the data for both, online only (offline: `sync.spec.ts`).

const demo = () => demoData(FROZEN_TODAY);
const EXPORT_NAME = "kruemel-2026-10-21.json";
const AUTO_BACKUP_NAME = "kruemel-vor-import-2026-10-21.json";

/** A smaller backup with other names: 2 tasks (one with a history), 2 completions. */
function smallBackup(): AppData {
  const data = demo();
  return {
    ...data,
    settings: { personNames: { personA: "Sam", personB: "Kim" } },
    tasks: data.tasks.filter((task) => task.id === "demo-bad" || task.id === "demo-geschenk"),
    completions: data.completions.filter((completion) => completion.taskId === "demo-bad"),
  };
}

/** The same data as a version 1 file wrote it (before F8): no symbols. */
function version1(data: AppData): string {
  return JSON.stringify({
    ...data,
    schemaVersion: 1,
    tasks: data.tasks.map(({ symbol: _symbol, ...task }) => task),
  });
}

async function openSettings(page: Page, data: AppData = demo()) {
  const member = await openWeek(page, data);
  await openSettingsGroup(page, "Daten");
  return member;
}

/**
 * The data with tasks and completions in the order of their ids: the shared storage keeps the place
 * of a task it knew already, so a replaced list may come back in another order.
 */
function sorted(data: AppData): AppData {
  const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);
  return {
    ...data,
    tasks: [...data.tasks].sort(byId),
    completions: [...data.completions].sort(byId),
  };
}

const backupTile = (page: Page) => page.getByRole("region", { name: "Sicherung", exact: true });
const downloadButton = (page: Page) =>
  page.getByRole("button", { name: "Sicherung herunterladen", exact: true });
const importButton = (page: Page) =>
  page.getByRole("button", { name: "Sicherung einspielen …", exact: true });
const question = (page: Page) => page.getByRole("dialog", { name: "Sicherung einspielen?" });
const confirmButton = (page: Page) =>
  question(page).getByRole("button", { name: "Ja, Daten ersetzen" });
const cancelButton = (page: Page) => question(page).getByRole("button", { name: "Abbrechen" });
const problem = (page: Page) => page.getByRole("alert");
const status = (page: Page) => backupTile(page).getByRole("status");

/** Presses "Sicherung einspielen …" and hands the file chooser the file. */
async function chooseBackup(page: Page, file: string | ReturnType<typeof textFile>) {
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    importButton(page).click(),
  ]);
  await chooser.setFiles(file);
}

/** The text of a download (a blob of the page, so it is read there). */
function contentOf(page: Page, download: Download): Promise<string> {
  return page.evaluate((url) => fetch(url).then((response) => response.text()), download.url());
}

async function storedText(page: Page): Promise<string> {
  return JSON.stringify(await storedData(page));
}

test.describe("F7 Export", () => {
  test("F7 Die Einstellungen enthalten die Kachel „Sicherung“ mit Herunterladen und Einspielen", async ({
    page,
  }) => {
    await openSettings(page);

    const tile = backupTile(page);
    await expect(tile.getByRole("heading", { level: 2, name: "Sicherung" })).toBeVisible();
    await expect(tile.getByRole("heading", { level: 3, name: "Herunterladen" })).toBeVisible();
    await expect(tile.getByRole("heading", { level: 3, name: "Einspielen" })).toBeVisible();
    await expect(tile).toContainText("Jetzt auf diesem Gerät: 11 Aufgaben und 10 Erledigungen.");
    await expect(downloadButton(page)).toBeVisible();
    await expect(importButton(page)).toBeVisible();
    await expectNoAccessibilityViolations(page);
  });

  test("F7 Der Export lädt eine Datei „kruemel-JJJJ-MM-TT.json“ mit allen Daten und schemaVersion 3 herunter", async ({
    page,
  }) => {
    await openSettings(page);
    const stored = await storedData(page);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      downloadButton(page).click(),
    ]);

    expect(download.suggestedFilename()).toBe(EXPORT_NAME);
    const text = await contentOf(page, download);
    const file = JSON.parse(text);
    expect(file.schemaVersion).toBe(3);
    expect(file.settings.personNames).toEqual({ personA: "Alex", personB: "Robin" });
    expect(file.tasks).toHaveLength(11);
    expect(file.completions).toHaveLength(10);
    expect(file).toEqual(stored);
    // Die Symbole der Aufgaben sind dabei (F8).
    expect(file.tasks.find((task: { id: string }) => task.id === "demo-bad").symbol).toBe("bath");
  });

  test("F7 „Ich bin“ und die Darstellung gehören zum Gerät und stehen nicht in der Sicherung", async ({
    page,
  }) => {
    await openSettings(page);
    // "Darstellung" and "Sicherung" are different groups: choose dark, then come back.
    await page.getByRole("link", { name: "Zurück zu Einstellungen" }).click();
    await page.getByRole("link", { name: /^Darstellung\b/ }).click();
    await page.getByRole("radio", { name: "Dunkel" }).check();
    await page.getByRole("link", { name: "Zurück zu Einstellungen" }).click();
    await page.getByRole("link", { name: /^Daten\b/ }).click();

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      downloadButton(page).click(),
    ]);

    const text = await contentOf(page, download);
    expect(text).not.toContain("currentPerson");
    expect(text).not.toContain("colorScheme");
  });

  test("F7 Nach dem Herunterladen nennt eine Meldung den Dateinamen", async ({ page }) => {
    await openSettings(page);

    await Promise.all([page.waitForEvent("download"), downloadButton(page).click()]);

    await expect(status(page)).toHaveText(
      `Die Sicherung „${EXPORT_NAME}“ wurde heruntergeladen. Bewahre die Datei sicher auf.`,
    );
    await expectNoAccessibilityViolations(page);
  });
});

test.describe("F7 Import mit Rückfrage und automatischer Sicherung", () => {
  test("F7 Eine heruntergeladene Sicherung lässt sich wieder einspielen und stellt genau diese Daten her", async ({
    page,
  }) => {
    const member = await openSettings(page);
    const original = await storedData(page);
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      downloadButton(page).click(),
    ]);
    const path = await download.path();
    // Daten im Haushalt ändern: nur zwei Aufgaben, keine Erledigungen.
    await pushAs(page.request, member, {
      type: "replaceAll",
      id: crypto.randomUUID(),
      data: { ...original, tasks: original.tasks.slice(0, 2), completions: [] },
    });
    await expect.poll(async () => (await storedData(page)).tasks.length).toBe(2);

    await chooseBackup(page, path);
    await expect(question(page)).toBeVisible();
    await Promise.all([page.waitForEvent("download"), confirmButton(page).click()]);

    await expect.poll(async () => sorted(await storedData(page))).toEqual(sorted(original));
  });

  test("F7 Vor dem Einspielen fragt die App nach, nennt Datei und Inhalt und ändert noch nichts", async ({
    page,
  }) => {
    await openSettings(page);
    const before = await storedText(page);

    await chooseBackup(page, textFile("klein.json", JSON.stringify(smallBackup())));

    const dialog = question(page);
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(
      "Die Datei „klein.json“ enthält 2 Aufgaben und 2 Erledigungen.",
    );
    await expect(dialog).toContainText(
      "In eurem Haushalt sind jetzt 11 Aufgaben und 10 Erledigungen. Sie werden für euch beide ersetzt; das lässt sich nicht rückgängig machen.",
    );
    await expect(dialog).toContainText(`als „${AUTO_BACKUP_NAME}“ herunter`);
    // Wie bei jeder Frage, die etwas ersetzt: zuerst „Abbrechen“.
    await expect(cancelButton(page)).toBeFocused();
    await expectNoAccessibilityViolations(page);
    expect(await storedText(page)).toBe(before);
  });

  test("F7 „Abbrechen“ lässt alles unberührt, und der Fokus kehrt zum Knopf zurück", async ({
    page,
  }) => {
    await openSettings(page);
    const before = await storedText(page);
    await chooseBackup(page, textFile("klein.json", JSON.stringify(smallBackup())));

    await cancelButton(page).click();

    await expect(question(page)).toBeHidden();
    await expect(importButton(page)).toBeFocused();
    expect(await storedText(page)).toBe(before);
    await expect(status(page)).toHaveText("");
  });

  test("F7 Escape schließt die Rückfrage, ohne etwas zu ändern", async ({ page }) => {
    await openSettings(page);
    const before = await storedText(page);
    await chooseBackup(page, textFile("klein.json", JSON.stringify(smallBackup())));
    await expect(cancelButton(page)).toBeFocused();

    await page.keyboard.press("Escape");

    await expect(question(page)).toBeHidden();
    await expect(importButton(page)).toBeFocused();
    expect(await storedText(page)).toBe(before);
  });

  test("F7 Nach der Bestätigung gelten die Daten der Sicherung, auch die Namen, und eine Meldung sagt es", async ({
    page,
  }) => {
    await openSettings(page);
    await chooseBackup(page, textFile("klein.json", JSON.stringify(smallBackup())));

    await Promise.all([page.waitForEvent("download"), confirmButton(page).click()]);

    await expect(question(page)).toBeHidden();
    await expect(status(page)).toHaveText(
      `Sicherung eingespielt: 2 Aufgaben und 2 Erledigungen. Die bisherigen Daten wurden vorher als „${AUTO_BACKUP_NAME}“ heruntergeladen.`,
    );
    await expect(importButton(page)).toBeFocused();
    expect(sorted(await storedData(page))).toEqual(sorted(smallBackup()));
    // Die Namen der Sicherung gelten für den Haushalt: Alex' Gerät heißt jetzt Sam.
    await expect(page.locator(".app-person")).toHaveText(`${ACCOUNT_TEXTS.signedInAs} Sam`);
    await expect(backupTile(page)).toContainText(
      "Jetzt auf diesem Gerät: 2 Aufgaben und 2 Erledigungen.",
    );
    await expectNoAccessibilityViolations(page);
    // Und die anderen Seiten zeigen sie.
    await goToPage(page, "Erledigt");
    await expect(
      page.getByRole("region", { name: "Erledigte Aufgaben" }).getByRole("listitem"),
    ).toHaveCount(2);
  });

  test("F7 Vor dem Ersetzen lädt die App automatisch eine Sicherung der bisherigen Daten herunter", async ({
    page,
  }) => {
    await openSettings(page);
    const before = await storedData(page);
    await chooseBackup(page, textFile("klein.json", JSON.stringify(smallBackup())));

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      confirmButton(page).click(),
    ]);

    expect(download.suggestedFilename()).toBe(AUTO_BACKUP_NAME);
    // Es ist der Stand vor dem Einspielen, und die Datei ist selbst eine gültige Sicherung.
    expect(JSON.parse(await contentOf(page, download))).toEqual(before);
    await expect.poll(async () => (await storedData(page)).tasks.length).toBe(2);
  });

  test("F7 Die automatische Sicherung lässt sich einspielen und macht das Einspielen damit rückgängig", async ({
    page,
  }) => {
    await openSettings(page);
    const before = await storedData(page);
    await chooseBackup(page, textFile("klein.json", JSON.stringify(smallBackup())));
    const [auto] = await Promise.all([page.waitForEvent("download"), confirmButton(page).click()]);
    await expect.poll(async () => (await storedData(page)).tasks.length).toBe(2);
    const path = await auto.path();

    await chooseBackup(page, path);
    await Promise.all([page.waitForEvent("download"), confirmButton(page).click()]);

    await expect.poll(async () => sorted(await storedData(page))).toEqual(sorted(before));
  });

  test("F7 Eine alte Sicherung (schemaVersion 1) wird eingespielt; jede Aufgabe bekommt das Standardsymbol", async ({
    page,
  }) => {
    await openSettings(page);
    await chooseBackup(page, textFile("alt.json", version1(smallBackup())));
    await expect(question(page)).toContainText(
      "Die Datei „alt.json“ enthält 2 Aufgaben und 2 Erledigungen.",
    );

    await Promise.all([page.waitForEvent("download"), confirmButton(page).click()]);

    await expect.poll(async () => (await storedData(page)).tasks.length).toBe(2);
    const data = await storedData(page);
    expect(data.schemaVersion).toBe(3);
    expect(data.tasks.map((task) => task.symbol)).toEqual(["standard", "standard"]);
    expect(data.completions).toHaveLength(2);
  });

  test("F7 Dieselbe Datei lässt sich nach dem Abbrechen noch einmal wählen", async ({ page }) => {
    await openSettings(page);
    const file = textFile("klein.json", JSON.stringify(smallBackup()));
    await chooseBackup(page, file);
    await cancelButton(page).click();
    await expect(question(page)).toBeHidden();

    await chooseBackup(page, file);

    await expect(question(page)).toBeVisible();
  });

  test("F7 Tastatur: Knopf mit Enter, Frage mit Tab und Enter beantworten", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Tastaturbedienung wird am Desktop geprüft");
    await openSettings(page);
    // Listening for the file chooser is switched on in the browser a moment after this call; a key
    // pressed right away could open the real dialog first and the event would never come. So the
    // listener is set up first, and the focus (which takes a few round trips) comes after it.
    const chooserOpened = page.waitForEvent("filechooser");
    await importButton(page).focus();
    await expect(importButton(page)).toBeFocused();
    await page.keyboard.press("Enter");
    const chooser = await chooserOpened;
    await chooser.setFiles(textFile("klein.json", JSON.stringify(smallBackup())));
    await expect(cancelButton(page)).toBeFocused();

    await page.keyboard.press("Tab");
    await expect(confirmButton(page)).toBeFocused();
    await Promise.all([page.waitForEvent("download"), page.keyboard.press("Enter")]);

    await expect.poll(async () => (await storedData(page)).tasks.length).toBe(2);
  });
});

test.describe("F7 Fehlerhafte Dateien", () => {
  const broken = JSON.parse(JSON.stringify(smallBackup()));
  broken.tasks[0].assignee = "personC";
  const newer = { ...smallBackup(), schemaVersion: 4 };

  const cases = [
    {
      name: "Text, der kein JSON ist",
      file: () => textFile("kaputt.json", "das ist kein json"),
      message: "Die Datei ist keine Krümel-Sicherung.",
    },
    {
      name: "ein Fehler im Aufbau, mit Fundstelle",
      file: () => textFile("fehler.json", JSON.stringify(broken)),
      message: "tasks[0].assignee: ungültig, erwartet personA, personB oder both",
    },
    {
      name: "eine Datei aus einer neueren App-Version",
      file: () => textFile("neu.json", JSON.stringify(newer)),
      message: "neueren Version",
    },
    {
      name: "eine zu große Datei",
      file: () => textFile("riesig.json", "x".repeat(5 * 1024 * 1024 + 1)),
      message: "Die Datei ist zu groß für eine Sicherung (höchstens 5 MB).",
    },
  ];

  for (const { name, file, message } of cases) {
    test(`F7 Bei ${name} meldet die App den Grund und lässt die vorhandenen Daten unberührt`, async ({
      page,
    }) => {
      await openSettings(page);
      const before = await storedText(page);

      await chooseBackup(page, file());

      await expect(problem(page)).toContainText("Sicherung nicht eingespielt");
      await expect(problem(page)).toContainText(message);
      await expect(problem(page)).toContainText(SHARED_TEXTS.unchanged);
      await expect(question(page)).toBeHidden();
      expect(await storedText(page)).toBe(before);
      await expectNoAccessibilityViolations(page);
    });
  }

  test("K2b Die Fundstelle steht eingeklappt unter „Details für die Fehlersuche“, ein neuerer Stand sagt, was zu tun ist", async ({
    page,
  }) => {
    await openSettings(page);
    const placed = "tasks[0].assignee: ungültig, erwartet personA, personB oder both";

    await chooseBackup(page, textFile("fehler.json", JSON.stringify(broken)));

    const folded = problem(page).locator("details");
    await expect(problem(page).getByText(placed)).toBeHidden();
    await folded.getByText("Details für die Fehlersuche").click();
    await expect(problem(page).getByText(placed)).toBeVisible();

    await chooseBackup(page, textFile("neu.json", JSON.stringify(newer)));
    await expect(problem(page).getByText("Lade die App neu")).toBeVisible();
    await expect(problem(page).locator("details")).toHaveCount(0);
  });

  test("F7 Nach einer fehlerhaften Datei geht eine gute: die Meldung verschwindet, die Frage kommt", async ({
    page,
  }) => {
    await openSettings(page);
    await chooseBackup(page, textFile("kaputt.json", "kein json"));
    await expect(problem(page)).toBeVisible();

    await chooseBackup(page, textFile("klein.json", JSON.stringify(smallBackup())));

    await expect(problem(page)).toHaveCount(0);
    await expect(question(page)).toBeVisible();
  });

  test("F7 Kann nicht gespeichert werden, bleiben die Daten unverändert und die App meldet es", async ({
    page,
  }) => {
    await openSettings(page);
    const before = await storedText(page);
    await chooseBackup(page, textFile("klein.json", JSON.stringify(smallBackup())));
    await page.evaluate(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("voll", "QuotaExceededError");
      };
    });

    await confirmButton(page).click();

    await expect(problem(page)).toContainText("Sicherung nicht eingespielt");
    await expect(problem(page)).toContainText("Speichern nicht möglich");
    await expect(problem(page)).toContainText(SHARED_TEXTS.unchanged);
    await expect(status(page)).toHaveText("");
    expect(await storedText(page)).toBe(before);
    await expectNoAccessibilityViolations(page);
  });
});
