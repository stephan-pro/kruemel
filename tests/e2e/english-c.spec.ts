import { expect, type Page, test } from "@playwright/test";
import { de } from "../../src/i18n/de";
import { en } from "../../src/i18n/en";
import { LEGAL_CONTACT, LEGAL_CONTENT } from "../../src/ui/legalTexts";
import type { Member } from "./account";
import { expectNoAccessibilityViolations } from "./axe";
import { overflowing, startShared } from "./helpers";
import { mockPush } from "./pushMock";
import { E2E_APP, FAKE_SERVER } from "./shared";

// EN-c: the rest in English: the tile "Notifications" and the language the server is told, the
// legal pages, the loading picture and the demo data. The browser of these tests asks for English;
// the other tests stay German. Against the fake server, like the German ones (`notifications.spec.ts`,
// `legal.spec.ts`, `demo.spec.ts`).

test.use({ locale: "en-GB" });

const german = (page: Page) => page.getByRole("button", { name: "Deutsch" });
const english = (page: Page) => page.getByRole("button", { name: "English" });

const text = en.notifications;
const tileOf = (page: Page) => page.getByRole("region", { name: text.tile.tileTitle });
const statusOf = (page: Page) => tileOf(page).locator(".sync-status").first();
const button = (page: Page, name: string) => tileOf(page).getByRole("button", { name });
const bearer = (member: Member) => ({ Authorization: `Bearer ${member.token}` });

async function serverDevices(page: Page, member: Member) {
  const response = await page.request.get(`${FAKE_SERVER}/test/push-devices`, {
    headers: bearer(member),
  });
  return ((await response.json()) as { devices: { deviceId: string; locale: string }[] }).devices;
}

async function serverPushes(page: Page, member: Member) {
  const response = await page.request.get(`${FAKE_SERVER}/test/pushes`, {
    headers: bearer(member),
  });
  return ((await response.json()) as { pushes: { payload: unknown }[] }).pushes;
}

test.describe("EN-c Benachrichtigungen auf Englisch", () => {
  test("EN-c Kachel, Status, Fehler und Anleitung auf Englisch; der Server bekommt die Sprache des Geräts, auch nach einem Wechsel", async ({
    page,
  }) => {
    await mockPush(page);
    const member = await startShared(page, undefined, "#/einstellungen/benachrichtigungen");

    await expect(page.getByRole("heading", { level: 1, name: "Notifications" })).toBeVisible();
    await expect(page).toHaveTitle("Notifications – Krümel");
    await expect(tileOf(page)).toContainText(text.tile.intro);
    await expect(tileOf(page)).toContainText(text.tile.testOnly);
    await expect(statusOf(page)).toHaveText(text.status.off);
    await expectNoAccessibilityViolations(page);

    await button(page, text.tile.enable).click();
    await expect(statusOf(page)).toHaveText(text.status.active);
    await expect(tileOf(page).locator(":scope > .form-status")).toHaveText(text.tile.enabled);
    // The settings of the device, with the weekdays in English.
    await expect(tileOf(page)).toContainText(text.settings.title);
    await expect(tileOf(page).getByRole("checkbox", { name: "Monday", exact: true })).toBeVisible();
    await expect(
      tileOf(page).getByRole("group", { name: text.settings.dailyDaysLegend }),
    ).toBeVisible();
    await expectNoAccessibilityViolations(page);
    expect(await serverDevices(page, member)).toEqual([expect.objectContaining({ locale: "en" })]);

    // The test notification names the language: the device writes the English text.
    await button(page, text.tile.sendTest).click();
    await expect(tileOf(page).locator(":scope > .form-status")).toHaveText(text.tile.testSent);
    expect((await serverPushes(page, member)).map((sent) => sent.payload)).toEqual([
      { v: 1, k: "test", l: "en" },
    ]);
    await button(page, text.tile.sendTest).click();
    await expect(tileOf(page).getByRole("alert")).toContainText(text.failures.testWait);

    // Saving the settings tells the server the language too.
    await page.getByLabel(text.settings.dailyTimeLabel).fill("06:45");
    await page.getByRole("button", { name: text.settings.save }).click();
    await expect(tileOf(page).locator("form .form-status")).toHaveText(text.settings.saved);

    // Switching the language: the tile follows, the server hears of it.
    await page.evaluate(() => {
      location.hash = "#/einstellungen/darstellung";
    });
    await german(page).click();
    await expect(page.getByRole("heading", { level: 1, name: "Darstellung" })).toBeVisible();
    await expect.poll(async () => (await serverDevices(page, member))[0]?.locale).toBe("de");
    await page.evaluate(() => {
      location.hash = "#/einstellungen/benachrichtigungen";
    });
    // The tile is German now: its name and its status line.
    const germanTile = page.getByRole("region", { name: de.notifications.tile.tileTitle });
    await expect(germanTile.locator(".sync-status").first()).toHaveText(
      de.notifications.status.active,
    );
  });

  test("EN-c Blockiert: die Anleitung für diesen Browser auf Englisch, 360 px ohne Seitwärtsrollen", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await mockPush(page, { permission: "denied" });
    await startShared(page, undefined, "#/einstellungen/benachrichtigungen");

    await expect(statusOf(page)).toHaveText(text.status.blocked);
    await tileOf(page).getByText(text.tile.blockedGuide).click();
    await expect(tileOf(page)).toContainText("choose “Allow” for “Notifications”");
    await expect(tileOf(page)).toContainText(text.tile.blockedAfter);
    await expectNoAccessibilityViolations(page);
    expect(await overflowing(page)).toEqual([]);
  });

  test("EN-c Ohne Einrichtung des Browsers (Push nicht unterstützt): Status auf Englisch", async ({
    page,
  }) => {
    await mockPush(page, { supported: false });
    await startShared(page, undefined, "#/einstellungen/benachrichtigungen");

    await expect(statusOf(page)).toHaveText(text.status.unsupported);
    await expectNoAccessibilityViolations(page);
  });
});

test.describe("EN-c Impressum und Datenschutzerklärung auf Englisch", () => {
  const legal = LEGAL_CONTENT.en;
  const note = legal.words.translationNote ?? "";

  test("EN-c Datenschutzerklärung: Übersetzungshinweis oben, alle Abschnitte, Platzhalter, Aufsichtsbehörde", async ({
    page,
  }) => {
    await page.goto(`${E2E_APP}#/datenschutz`);

    await expect(page.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeVisible();
    await expect(page).toHaveTitle("Privacy policy – Krümel");
    expect(note).toBe("This is a translation. The German version is authoritative.");
    // The note is the first line of the text.
    await expect(page.locator("article.legal > p").first()).toHaveText(note);
    await expect(page.getByText(legal.words.stateLabel(legal.date))).toBeVisible();
    for (const section of legal.privacy) {
      await expect(page.getByRole("heading", { level: 2, name: section.title })).toBeVisible();
    }
    await expect(page.getByRole("region", { name: legal.mailProvider.title })).toContainText(
      "Google",
    );
    const notifications = page.getByRole("region", { name: "Notifications", exact: true });
    for (const word of ["Google", "Mozilla", "Apple", "Microsoft", "90 days", "encrypted"]) {
      await expect(notifications).toContainText(word);
    }
    await expect(page.getByText("Kavalleriestraße 2–4, 40213 Düsseldorf")).toBeVisible();
    await expect(page.getByText("www.ldi.nrw.de")).toBeVisible();
    await expect(page.locator("a[href^='http']")).toHaveCount(0);
    // The personal details stay placeholders.
    await expect(page.getByText(LEGAL_CONTACT.email).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Back" })).toBeVisible();
  });

  test("EN-c Impressum: Seitentitel, Abschnitte und Links auf Englisch", async ({ page }) => {
    await page.goto(`${E2E_APP}#/impressum`);

    await expect(page.getByRole("heading", { level: 1, name: "Imprint" })).toBeVisible();
    await expect(page).toHaveTitle("Imprint – Krümel");
    await expect(page.locator("article.legal > p").first()).toHaveText(note);
    for (const section of legal.imprint) {
      await expect(page.getByRole("heading", { level: 2, name: section.title })).toBeVisible();
    }
    await expect(page.getByText(LEGAL_CONTACT.name).first()).toBeVisible();
    const links = page.getByRole("navigation", { name: legal.words.linksLabel });
    await links.getByRole("link", { name: "Privacy policy", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Privacy policy" })).toBeVisible();
  });

  test("EN-c Umschalten auf der Rechtsseite: Deutsch ohne den Hinweis, wieder Englisch mit ihm; die Seite bleibt", async ({
    page,
  }) => {
    await page.goto(`${E2E_APP}#/datenschutz`);
    await expect(page.getByText(note)).toBeVisible();

    await german(page).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Datenschutzerklärung" }),
    ).toBeVisible();
    await expect(page.getByText(note)).toHaveCount(0);
    await expect(page.getByText(/Dies ist eine Übersetzung|translation/i)).toHaveCount(0);
    await expect(
      page.getByText(LEGAL_CONTENT.de.words.stateLabel(LEGAL_CONTENT.de.date)),
    ).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "de");
    await expect(page).toHaveTitle("Datenschutzerklärung – Krümel");
    await expect(page).toHaveURL(/#\/datenschutz$/);

    await english(page).click();
    await expect(page.getByText(note)).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });

  test("EN-c Beide Seiten, hell und dunkel ohne axe-Verstöße, 360 px ohne Seitwärtsrollen", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    for (const hash of ["#/impressum", "#/datenschutz"]) {
      await page.goto(`${E2E_APP}${hash}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoAccessibilityViolations(page);
      expect(await overflowing(page)).toEqual([]);
    }
  });
});

test.describe("EN-c Ladebild", () => {
  /** The page with its script held back, so only the loading picture is there. */
  async function splash(page: Page) {
    await page.route("**/*.js", (route) => route.abort());
    await page.goto(E2E_APP);
    const text = page.locator(".splash__text:visible");
    await expect(text).toHaveCount(1);
    return {
      text: (await text.textContent())?.trim(),
      lang: await page.locator("html").getAttribute("lang"),
    };
  }

  test("EN-c Das Ladebild folgt der Browsersprache und, wenn gewählt, der gespeicherten Sprache; die Sprache steht vor dem ersten Bild fest", async ({
    browser,
  }) => {
    const open = async (locale: string, chosen?: string) => {
      const context = await browser.newContext({ locale });
      const page = await context.newPage();
      if (chosen !== undefined) {
        await page.addInitScript(
          (value) => localStorage.setItem("kruemel:language", value),
          chosen,
        );
      }
      const shown = await splash(page);
      await context.close();
      return shown;
    };

    expect(await open("en-GB")).toEqual({ text: "Loading …", lang: "en" });
    expect(await open("de-DE")).toEqual({ text: "Wird geladen …", lang: "de" });
    // Another language of the browser counts as German.
    expect(await open("fr-FR")).toEqual({ text: "Wird geladen …", lang: "de" });
    // The choice on the device wins over the browser's.
    expect(await open("de-DE", "en")).toEqual({ text: "Loading …", lang: "en" });
    expect(await open("en-GB", "de")).toEqual({ text: "Wird geladen …", lang: "de" });
  });

  test("EN-c Nach dem Laden bleibt die Sprache dieselbe: kein Wechsel zwischen Ladebild und App", async ({
    page,
  }) => {
    const seen: string[] = [];
    await page.exposeFunction("noteLanguage", (lang: string) => seen.push(lang));
    await page.addInitScript(() => {
      new MutationObserver(() => {
        (window as unknown as { noteLanguage(lang: string): void }).noteLanguage(
          document.documentElement.lang,
        );
      }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });
    });

    await page.goto(E2E_APP);
    await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();

    // The attribute was set before anything was drawn and did not change afterwards.
    expect(new Set(seen).size).toBeLessThanOrEqual(1);
    expect(await page.locator("html").getAttribute("lang")).toBe("en");
  });
});

test.describe("EN-c Demo-Modus auf Englisch", () => {
  const demoUrl = "http://localhost:4174/kruemel/";

  test("EN-c Die Beispieldaten haben englische Wörter, der Hinweis ist englisch", async ({
    page,
  }) => {
    await page.goto(demoUrl);

    await expect(page.getByText(/^Demo mode: \d+ sample tasks and \d+ completions/)).toBeVisible();
    const stored = await page.evaluate(() => localStorage.getItem("putzplan-demo:data"));
    const titles = (JSON.parse(stored ?? "{}") as { tasks: { title: string }[] }).tasks.map(
      (task) => task.title,
    );
    expect(titles).toContain("Clean the bathroom");
    expect(titles).not.toContain("Bad putzen");
    await expectNoAccessibilityViolations(page);
  });
});
