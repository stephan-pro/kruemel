import { expect, type Page, test } from "@playwright/test";
import { DEMO_NAMES, demoData } from "../../src/demo/demoData";
import { dayFromDate } from "../../src/domain/date";
import { expectNoAccessibilityViolations } from "./axe";
import {
  dataKey,
  deviceKey,
  goToPage,
  greetingHeading,
  startConfigured,
  startLocal,
  store,
} from "./helpers";
import { E2E_APP } from "./shared";

// Packages 7+ of docs/PLAN.md. First setup, editable names and unreadable data of this device exist
// only in the mode `local` (production build, `baseURL`); the frame and the navigation are tested
// as in real use, signed in on the shared data (E2-3e).

async function fillSetup(page: Page, nameA: string, nameB: string) {
  await page.getByLabel("Name der ersten Person").fill(nameA);
  await page.getByLabel("Name der zweiten Person").fill(nameB);
}

test.describe("Ersteinrichtung (F5 Namen)", () => {
  test("verlangt beide Namen und führt zum ersten leeren Feld", async ({ page }) => {
    await page.goto("./");
    await page.getByRole("button", { name: "Los geht’s" }).click();

    await expect(page.getByText("Bitte einen Namen eingeben.")).toHaveCount(2);
    await expect(page.getByText("Bitte auswählen, wer dieses Gerät benutzt.")).toBeVisible();
    await expect(page.getByLabel("Name der ersten Person")).toBeFocused();
    await expect(page.getByLabel("Name der ersten Person")).toHaveAccessibleDescription(
      "Bitte einen Namen eingeben.",
    );
    await expectNoAccessibilityViolations(page);
  });

  test("lehnt zwei gleiche Namen ab", async ({ page }) => {
    await page.goto("./");
    await fillSetup(page, "Alex", "alex");
    await page.getByRole("radio", { name: "Alex", exact: true }).check();
    await page.getByRole("button", { name: "Los geht’s" }).click();

    await expect(page.getByText("Die beiden Namen müssen sich unterscheiden.")).toBeVisible();
    await expect(page.getByLabel("Name der zweiten Person")).toBeFocused();
  });

  test("verlangt die Wahl „Ich bin“", async ({ page }) => {
    await page.goto("./");
    await fillSetup(page, "Alex", "Robin");
    await page.getByRole("button", { name: "Los geht’s" }).click();

    await expect(page.getByText("Bitte auswählen, wer dieses Gerät benutzt.")).toBeVisible();
    await expect(page.getByRole("radio", { name: "Alex" })).toBeFocused();
  });

  test("zeigt die eingetragenen Namen bei „Ich bin“", async ({ page }) => {
    await page.goto("./");
    await fillSetup(page, "Alex", "Robin");

    await expect(page.getByRole("radio", { name: "Alex" })).toBeVisible();
    await expect(page.getByRole("radio", { name: "Robin" })).toBeVisible();
  });

  test("speichert Namen und „Ich bin“ und öffnet „Heute“", async ({ page }) => {
    await page.goto("./");
    await fillSetup(page, "  Alex ", "Robin");
    await page.getByRole("radio", { name: "Robin" }).check();
    await page.getByRole("button", { name: "Los geht’s" }).click();

    await expect(page).toHaveTitle("Heute – Krümel");
    await expect(
      page.getByRole("heading", { level: 1, name: greetingHeading("Robin") }),
    ).toBeFocused();
    await expect(page.getByText("Dieses Gerät:")).toContainText("Robin");

    const data = JSON.parse((await page.evaluate((k) => localStorage.getItem(k), dataKey)) ?? "");
    expect(data.schemaVersion).toBe(3);
    expect(data.settings.personNames).toEqual({ personA: "Alex", personB: "Robin" });
    // „Ich bin“ gehört zum Gerät, nicht zu den Daten der Sicherung.
    expect(data.currentPerson).toBeUndefined();
    const device = await page.evaluate((k) => localStorage.getItem(k), deviceKey);
    expect(JSON.parse(device ?? "")).toEqual({ currentPerson: "personB" });
  });

  test("fragt beim nächsten Start nicht erneut", async ({ page }) => {
    await page.goto("./");
    await fillSetup(page, "Alex", "Robin");
    await page.getByRole("radio", { name: "Alex" }).check();
    await page.getByRole("button", { name: "Los geht’s" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: greetingHeading("Alex") }),
    ).toBeVisible();

    await page.reload();

    await expect(
      page.getByRole("heading", { level: 1, name: greetingHeading("Alex") }),
    ).toBeVisible();
    await expect(page.getByText("Dieses Gerät:")).toContainText("Alex");
  });

  test("meldet einen vollen oder gesperrten Speicher und nimmt nichts als gespeichert an", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new DOMException("voll", "QuotaExceededError");
      };
    });
    await page.goto("./");
    await fillSetup(page, "Alex", "Robin");
    await page.getByRole("radio", { name: "Alex" }).check();
    await page.getByRole("button", { name: "Los geht’s" }).click();

    await expect(page.getByRole("alert")).toContainText("Speichern nicht möglich");
    await expect(page.getByRole("heading", { level: 1, name: "Ersteinrichtung" })).toBeVisible();
  });
});

test.describe("„Ich bin“ auf einem Gerät ohne Auswahl (F5)", () => {
  test("fragt nach, wenn die Namen schon bekannt sind", async ({ page }) => {
    const data = demoData(dayFromDate(new Date()));
    await store(page, { [dataKey]: JSON.stringify(data) });

    await expect(page).toHaveTitle("Wer benutzt dieses Gerät? – Krümel");
    await expect(page.getByRole("radio", { name: DEMO_NAMES.personA })).toBeVisible();
    await expectNoAccessibilityViolations(page);

    await page.getByRole("button", { name: "Weiter" }).click();
    await expect(page.getByText("Bitte auswählen, wer dieses Gerät benutzt.")).toBeVisible();

    await page.getByRole("radio", { name: DEMO_NAMES.personB }).check();
    await page.getByRole("button", { name: "Weiter" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: greetingHeading(DEMO_NAMES.personB) }),
    ).toBeVisible();
    await expect(page.getByText("Dieses Gerät:")).toContainText(DEMO_NAMES.personB);
  });
});

test.describe("Rahmen und Navigation", () => {
  // The week view names the shown week in its heading and "Heute" greets by name; the tab title
  // stays "Wochenübersicht" and "Heute".
  const pages = [
    { link: "Heute", title: "Heute", heading: greetingHeading() },
    { link: "Woche", title: "Wochenübersicht", heading: "Diese Woche" },
    { link: "Statistik", title: "Statistik", heading: "Eure Bilanz" },
    { link: "Einstellungen", title: "Einstellungen", heading: "Einstellungen" },
  ];

  test("beginnt ohne Adresszusatz mit „Heute“", async ({ page }) => {
    await startConfigured(page, undefined, "");

    await expect(page).toHaveTitle("Heute – Krümel");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      greetingHeading(DEMO_NAMES.personA),
    );
    await expect(page.getByRole("link", { name: "Heute" })).toHaveAttribute("aria-current", "page");
  });

  for (const { link, title, heading } of pages) {
    test(`Seite „${title}“: Tab-Titel, Überschrift mit Fokus, aktuelle Seite und axe`, async ({
      page,
    }) => {
      await startConfigured(page);
      // Not the start page first, so the change is visible for every page.
      await page
        .getByRole("link", {
          name: link === "Einstellungen" ? "Woche" : "Einstellungen",
          exact: true,
        })
        .click();

      await page.getByRole("link", { name: link, exact: true }).click();

      await expect(page).toHaveTitle(`${title} – Krümel`);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeFocused();
      await expect(page.getByRole("link", { name: link, exact: true })).toHaveAttribute(
        "aria-current",
        "page",
      );
      await expect(page.locator('[aria-current="page"]')).toHaveCount(1);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expectNoAccessibilityViolations(page);
    });
  }

  // Not in the navigation: reached from "Woche" (today.spec.ts follows the links).
  for (const { title, hash } of [
    { title: "Aufgaben", hash: "#/aufgaben" },
    { title: "Erledigt", hash: "#/erledigt" },
  ]) {
    test(`Seite „${title}“: Tab-Titel, Überschrift mit Fokus, „Woche“ als Abschnitt und axe`, async ({
      page,
    }) => {
      await startConfigured(page, undefined, hash);
      await goToPage(page, "Einstellungen");

      await goToPage(page, title);

      await expect(page).toHaveTitle(`${title} – Krümel`);
      await expect(page.locator('[aria-current="page"]')).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Woche", exact: true })).toHaveAttribute(
        "aria-current",
        "true",
      );
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await expectNoAccessibilityViolations(page);
    });
  }

  test("Tastatur: Der erste Tabulator-Stopp ist „Zum Inhalt springen“", async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, "Tastaturbedienung wird am Desktop geprüft");
    await startConfigured(page);
    await expect(page.getByRole("heading", { level: 1, name: "Diese Woche" })).toBeVisible();

    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Zum Inhalt springen" })).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page.locator("main")).toBeFocused();
    await expect(page).toHaveURL(/\/kruemel\/#\/woche$/);
  });

  test("Tastatur: Die Navigation ist mit Tab und Enter bedienbar", async ({
    page,
    isMobile,
    browserName,
  }) => {
    test.skip(isMobile, "Tastaturbedienung wird am Desktop geprüft");
    // Safari springt mit Tab nur auf Formularfelder und Buttons; Links erreicht man dort mit Option+Tab.
    test.skip(browserName === "webkit", "Safari überspringt Links beim Tabulator");
    await startConfigured(page);
    // The navigation appears once the data is loaded; Tab pressed earlier would skip over it.
    await expect(page.getByRole("link", { name: "Woche", exact: true })).toBeVisible();

    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Zum Inhalt springen" })).toBeFocused();
    for (const name of ["Heute", "Woche", "Neue Aufgabe", "Statistik", "Einstellungen"]) {
      await page.keyboard.press("Tab");
      await expect(page.getByRole("link", { name, exact: true })).toBeFocused();
    }
    await page.keyboard.press("Enter");

    await expect(page.getByRole("heading", { level: 1, name: "Einstellungen" })).toBeFocused();
  });

  test("Browser-Zurück führt zur vorigen Seite", async ({ page }) => {
    await startConfigured(page);
    await page.getByRole("link", { name: "Einstellungen", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Einstellungen" })).toBeVisible();

    await page.goBack();

    await expect(page.getByRole("heading", { level: 1, name: "Diese Woche" })).toBeFocused();
  });

  test("öffnet eine Seite direkt über ihre Adresse", async ({ page }) => {
    await startConfigured(page);

    // A new tab, as when following a link or a bookmark (same browser storage, fresh page load).
    const opened = await page.context().newPage();
    await opened.goto(`${E2E_APP}#/erledigt`);

    await expect(opened.getByRole("heading", { level: 1, name: "Erledigt" })).toBeVisible();
    await expect(opened).toHaveTitle("Erledigt – Krümel");
  });

  test("passt auf die Breite des Geräts, ohne seitlich zu scrollen", async ({ page }) => {
    await startConfigured(page);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );

    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe("Einstellungen (F5 Namen, Modus local)", () => {
  test("ändert Namen und „Ich bin“ und meldet das Speichern", async ({ page }) => {
    await startLocal(page);
    await goToPage(page, "Einstellungen");
    await expect(page.getByLabel("Name der ersten Person")).toHaveValue(DEMO_NAMES.personA);
    await expect(page.getByRole("radio", { name: DEMO_NAMES.personA })).toBeChecked();

    await page.getByLabel("Name der zweiten Person").fill("Sam");
    await page.getByRole("radio", { name: "Sam" }).check();
    await page.getByRole("button", { name: "Speichern" }).click();

    await expect(page.getByRole("status").filter({ hasText: "Gespeichert." })).toBeVisible();
    await expect(page.getByText("Dieses Gerät:")).toContainText("Sam");
    await expectNoAccessibilityViolations(page);

    await page.reload();
    await expect(page.getByText("Dieses Gerät:")).toContainText("Sam");
    // Die Aufgaben der Beispieldaten bleiben erhalten.
    const data = JSON.parse((await page.evaluate((k) => localStorage.getItem(k), dataKey)) ?? "");
    expect(data.settings.personNames).toEqual({ personA: DEMO_NAMES.personA, personB: "Sam" });
    expect(data.tasks.length).toBe(demoData(dayFromDate(new Date())).tasks.length);
  });

  test("lehnt ungültige Namen auch hier ab", async ({ page }) => {
    await startLocal(page);
    await goToPage(page, "Einstellungen");

    await page.getByLabel("Name der ersten Person").fill("");
    await page.getByRole("button", { name: "Speichern" }).click();

    await expect(page.getByText("Bitte einen Namen eingeben.")).toBeVisible();
    await expect(page.getByLabel("Name der ersten Person")).toBeFocused();
  });
});

test.describe("Unlesbare Daten (Speicher)", () => {
  const broken = '{"schemaVersion": 1, "tasks": [';

  async function startBroken(page: Page) {
    await store(page, { [dataKey]: broken });
    await expect(
      page.getByRole("heading", { level: 1, name: "Gespeicherte Daten nicht lesbar" }),
    ).toBeVisible();
  }

  test("meldet das verständlich, ohne die Daten anzutasten, und ist barrierefrei", async ({
    page,
  }) => {
    await startBroken(page);

    await expect(page).toHaveTitle("Gespeicherte Daten nicht lesbar – Krümel");
    await expect(page.getByRole("alert")).toContainText("beschädigt");
    await expect(page.getByRole("link", { name: "Woche" })).toHaveCount(0);
    expect(await page.evaluate((k) => localStorage.getItem(k), dataKey)).toBe(broken);
    await expectNoAccessibilityViolations(page);
  });

  test("nennt bei fehlerhaftem Aufbau die Fundstelle", async ({ page }) => {
    await store(page, {
      [dataKey]: JSON.stringify({ schemaVersion: 1, settings: {}, tasks: 5, completions: [] }),
    });

    await expect(page.getByText("tasks: erwartet eine Liste")).toBeVisible();
  });

  test("Weg 1: lädt die Rohdaten unverändert als Datei herunter", async ({ page }) => {
    await startBroken(page);

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Rohdaten herunterladen" }).click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/^kruemel-rohdaten-\d{4}-\d{2}-\d{2}\.json$/);
    // The file is a blob of the page; reading it there avoids needing Node types for one line.
    const content = await page.evaluate((url) => fetch(url).then((r) => r.text()), download.url());
    expect(content).toBe(broken);
    await expect(page.getByRole("status")).toContainText("heruntergeladen");
  });

  test("Weg 2 gibt es erst nach dem Herunterladen", async ({ page }) => {
    await startBroken(page);
    await expect(page.getByRole("button", { name: /Neu beginnen/ })).toHaveCount(0);

    await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Rohdaten herunterladen" }).click(),
    ]);

    await expect(page.getByRole("button", { name: /Neu beginnen/ })).toBeVisible();
  });

  test("Neu beginnen fragt nach; „Abbrechen“ lässt alles unberührt", async ({ page }) => {
    await startBroken(page);
    await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Rohdaten herunterladen" }).click(),
    ]);
    const trigger = page.getByRole("button", { name: /Neu beginnen/ });
    // With the keyboard: Safari does not focus a button by clicking it, so there would be no
    // focus to give back.
    await trigger.focus();
    await page.keyboard.press("Enter");

    const dialog = page.getByRole("dialog", { name: "Wirklich neu beginnen?" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Abbrechen" })).toBeFocused();
    await expectNoAccessibilityViolations(page);
    await dialog.getByRole("button", { name: "Abbrechen" }).click();

    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
    expect(await page.evaluate((k) => localStorage.getItem(k), dataKey)).toBe(broken);
  });

  test("Escape schließt die Rückfrage, ohne etwas zu löschen", async ({ page }) => {
    await startBroken(page);
    await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Rohdaten herunterladen" }).click(),
    ]);
    await page.getByRole("button", { name: /Neu beginnen/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.getByRole("dialog")).toBeHidden();
    expect(await page.evaluate((k) => localStorage.getItem(k), dataKey)).toBe(broken);
  });

  test("Nach der Bestätigung beginnt die App neu mit der Ersteinrichtung", async ({ page }) => {
    await startBroken(page);
    await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Rohdaten herunterladen" }).click(),
    ]);
    await page.getByRole("button", { name: /Neu beginnen/ }).click();
    await page.getByRole("button", { name: "Ja, Daten löschen" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Ersteinrichtung" })).toBeFocused();
    expect(await page.evaluate((k) => localStorage.getItem(k), dataKey)).toBeNull();

    await fillSetup(page, "Alex", "Robin");
    await page.getByRole("radio", { name: "Alex" }).check();
    await page.getByRole("button", { name: "Los geht’s" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: greetingHeading("Alex") }),
    ).toBeVisible();
  });

  test("„Erneut versuchen“ lädt wieder, nachdem der Fehler behoben ist", async ({ page }) => {
    await startBroken(page);
    await page.evaluate((k) => localStorage.removeItem(k), dataKey);

    await page.getByRole("button", { name: "Erneut versuchen" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Ersteinrichtung" })).toBeVisible();
  });

  test("Gesperrter Browser-Speicher wird erklärt; Löschen wird nicht angeboten", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, "localStorage", {
        get() {
          throw new DOMException("gesperrt", "SecurityError");
        },
      });
    });
    await page.goto("./");

    await expect(
      page.getByRole("heading", { level: 1, name: "Speicher nicht verfügbar" }),
    ).toBeVisible();
    await expect(page.getByRole("alert")).toContainText("nicht verfügbar");
    await expect(page.getByRole("button", { name: /Neu beginnen|Rohdaten/ })).toHaveCount(0);
    await expectNoAccessibilityViolations(page);
  });
});
