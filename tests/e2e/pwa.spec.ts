import { expect, type Page, test } from "@playwright/test";
import { demoData } from "../../src/demo/demoData";
import { expectNoAccessibilityViolations } from "./axe";
import {
  dataKey,
  deviceKey,
  FROZEN_TODAY,
  freezeClock,
  goToPage,
  localData,
  notice,
  openSettings,
  startLocal,
  store,
  textFile,
} from "./helpers";

// Package 12: the app can be put on the home screen and used without internet (N3). What a test
// cannot do is install an app; it checks everything an installation relies on: manifest, icons, bar
// colours, the service worker and the kept files, and then works with the network switched off.
// Mode `local`: only the real builds have the service worker (not the mode `e2e`).

const demoUrl = "http://localhost:4174/kruemel/";

/** Waits until the service worker has installed and kept all files. */
async function waitForServiceWorker(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
}

/**
 * A configured app (the demo data of the frozen day) whose service worker runs and controls the
 * page. It waits for the worker before leaving the first page: WebKit drops an installation that
 * is interrupted by the next navigation (the worker then comes with the following visit).
 */
async function startInstalled(page: Page) {
  await freezeClock(page);
  await page.goto("./");
  await waitForServiceWorker(page);
  await page.evaluate(
    ([dataName, deviceName, data]) => {
      localStorage.setItem(dataName as string, data as string);
      localStorage.setItem(deviceName as string, JSON.stringify({ currentPerson: "personA" }));
      location.hash = "#/woche";
    },
    [dataKey, deviceKey, JSON.stringify(demoData(FROZEN_TODAY))],
  );
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Diese Woche" })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null), {
      message: "Der Service Worker übernimmt die Seite nicht",
    })
    .toBe(true);
}

/** The width and height of an image the page can load. */
function imageSize(page: Page, url: string): Promise<[number, number]> {
  return page.evaluate(async (address) => {
    const blob = await fetch(address).then((response) => response.blob());
    const bitmap = await createImageBitmap(blob);
    return [bitmap.width, bitmap.height] as [number, number];
  }, url);
}

test.describe("N3 Manifest und Symbole", () => {
  test("N3 Die Seite verweist auf ein Manifest, das sie als eigenständige App beschreibt", async ({
    page,
  }) => {
    await page.goto("./");

    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    expect(href).toBe("/kruemel/manifest.webmanifest");
    const manifest = await page.evaluate(
      (address) => fetch(address).then((r) => r.json()),
      href as string,
    );
    expect(manifest).toMatchObject({
      name: "Krümel",
      short_name: "Krümel",
      lang: "de",
      display: "standalone",
      start_url: "./",
      scope: "./",
      background_color: "#f3f2f8",
      theme_color: "#f3f2f8",
    });
  });

  test("N3 Alle Symbole des Manifests gibt es, in der angegebenen Größe", async ({ page }) => {
    await page.goto("./");
    const manifest = await page.evaluate(() =>
      fetch("/kruemel/manifest.webmanifest").then((response) => response.json()),
    );

    const pngs = manifest.icons.filter((icon: { type: string }) => icon.type === "image/png");
    expect(pngs).toHaveLength(3);
    for (const icon of pngs) {
      const [width, height] = icon.sizes.split("x").map(Number);
      expect(await imageSize(page, `/kruemel/${icon.src}`), icon.src).toEqual([width, height]);
    }
    const svg = await page.request.get("/kruemel/icon.svg");
    expect(svg.headers()["content-type"]).toContain("image/svg+xml");
  });

  test("N3 Für das iPhone gibt es ein Symbol von 180 px und die Angaben zur eigenständigen App", async ({
    page,
  }) => {
    await page.goto("./");

    const href = await page.locator('link[rel="apple-touch-icon"]').getAttribute("href");
    expect(href).toBe("/kruemel/apple-touch-icon.png");
    expect(await imageSize(page, href as string)).toEqual([180, 180]);
    await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute(
      "content",
      "yes",
    );
    await expect(page.locator('meta[name="apple-mobile-web-app-title"]')).toHaveAttribute(
      "content",
      "Krümel",
    );
  });

  test("N3 Die Seite nutzt den ganzen Bildschirm und hält Abstand zur Aussparung (viewport-fit=cover)", async ({
    page,
  }) => {
    await page.goto("./");

    await expect(page.locator('meta[name="viewport"]')).toHaveAttribute(
      "content",
      /viewport-fit=cover/,
    );
  });
});

test.describe("N3 Farbe der Leiste je Farbschema", () => {
  const themeColors = (page: Page) =>
    page.evaluate(() =>
      [...document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map(
        (meta) => `${meta.dataset.scheme}:${meta.media}:${meta.content}`,
      ),
    );

  test("N3 Ohne Wahl gilt für ein helles und für ein dunkles Gerät je eine Leistenfarbe", async ({
    page,
  }) => {
    await startLocal(page);

    expect(await themeColors(page)).toEqual([
      "light:(prefers-color-scheme: light):#f3f2f8",
      "dark:(prefers-color-scheme: dark):#0b1022",
    ]);
  });

  test("N3 Ein auf dem Gerät gewähltes dunkles Farbschema färbt die Leiste schon beim Laden dunkel", async ({
    page,
  }) => {
    await store(page, {
      [dataKey]: JSON.stringify(demoData(FROZEN_TODAY)),
      [deviceKey]: JSON.stringify({ currentPerson: "personA", colorScheme: "dark" }),
    });

    expect(await themeColors(page)).toEqual([
      "light:(prefers-color-scheme: light):#0b1022",
      "dark:(prefers-color-scheme: dark):#0b1022",
    ]);
  });

  test("N3 Beim Wechsel der Darstellung in den Einstellungen folgt die Leistenfarbe sofort", async ({
    page,
  }) => {
    await startLocal(page);
    await openSettings(page, "Darstellung");

    await page.getByRole("radio", { name: "Dunkel" }).check();
    expect(await themeColors(page)).toEqual([
      "light:(prefers-color-scheme: light):#0b1022",
      "dark:(prefers-color-scheme: dark):#0b1022",
    ]);

    await page.getByRole("radio", { name: "Hell" }).check();
    expect(await themeColors(page)).toEqual([
      "light:(prefers-color-scheme: light):#f3f2f8",
      "dark:(prefers-color-scheme: dark):#f3f2f8",
    ]);

    await page.getByRole("radio", { name: /^Automatisch/ }).check();
    expect(await themeColors(page)).toEqual([
      "light:(prefers-color-scheme: light):#f3f2f8",
      "dark:(prefers-color-scheme: dark):#0b1022",
    ]);
  });
});

test.describe("N3 Service Worker und Nutzung ohne Internet", () => {
  test("N3 Der Service Worker hält die Seite, die Programmdateien, die Schrift und die Symbole bereit", async ({
    page,
  }) => {
    await startInstalled(page);

    const kept = await page.evaluate(async () => {
      const names = await caches.keys();
      const cache = await caches.open(names[0] as string);
      const urls = (await cache.keys()).map((request) => new URL(request.url).pathname);
      return { names, urls };
    });

    expect(kept.names).toHaveLength(1);
    expect(kept.names[0]).toMatch(/^kruemel-/);
    expect(kept.urls).toContain("/kruemel/");
    expect(kept.urls.filter((url) => /\/assets\/index-.*\.js$/.test(url))).toHaveLength(1);
    expect(kept.urls.filter((url) => /\/assets\/index-.*\.css$/.test(url))).toHaveLength(1);
    // Die Schrift: alle drei Schriftsysteme, damit auch Namen mit Sonderzeichen ohne Netz stimmen.
    expect(kept.urls.filter((url) => url.endsWith(".woff2"))).toHaveLength(3);
    for (const file of [
      "manifest.webmanifest",
      "icon.svg",
      "icon-192.png",
      "icon-512.png",
      "icon-maskable-512.png",
      "apple-touch-icon.png",
    ]) {
      expect(kept.urls).toContain(`/kruemel/${file}`);
    }
  });

  test("N3 Ohne Internet öffnet die App wie gewohnt, mit Daten, Schrift und Farben", async ({
    page,
    context,
  }) => {
    await startInstalled(page);
    const failed: string[] = [];
    page.on("requestfailed", (request) => failed.push(request.url()));

    await context.setOffline(true);
    await page.reload();

    await expect(page.getByRole("heading", { level: 1, name: "Diese Woche" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Abhaken: Einkaufen" })).toBeVisible();
    // Die Schrift kommt aus den gehaltenen Dateien, nicht vom System.
    const fonts = await page.evaluate(async () => {
      await document.fonts.ready;
      return [...document.fonts].filter((font) => font.status === "loaded").length;
    });
    expect(fonts).toBeGreaterThan(0);
    expect(failed.filter((url) => url.startsWith("http://localhost"))).toEqual([]);
    await expectNoAccessibilityViolations(page);
  });

  test("N3 Ohne Internet lässt sich abhaken, rückgängig machen und navigieren; alles bleibt gespeichert", async ({
    page,
    context,
  }) => {
    await startInstalled(page);
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Diese Woche" })).toBeVisible();

    await page.getByRole("button", { name: "Abhaken: Einkaufen" }).click();
    await expect(notice(page)).toContainText("„Einkaufen“ ist abgehakt");
    await goToPage(page, "Erledigt");
    await expect(
      page.getByRole("region", { name: "Erledigte Aufgaben" }).getByRole("listitem").first(),
    ).toContainText("Einkaufen");

    expect((await localData(page)).completions).toHaveLength(
      demoData(FROZEN_TODAY).completions.length + 1,
    );
  });

  test("F7 Auch ohne Internet: Sicherung herunterladen und wieder einspielen funktionieren", async ({
    page,
    context,
  }) => {
    await startInstalled(page);
    await context.setOffline(true);
    await page.reload();
    await openSettings(page, "Daten");

    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Sicherung herunterladen", exact: true }).click(),
    ]);
    expect(download.suggestedFilename()).toBe("kruemel-2026-10-21.json");
    const saved = JSON.parse(
      await page.evaluate((url) => fetch(url).then((response) => response.text()), download.url()),
    );
    expect(saved.tasks).toHaveLength(11);

    // Einspielen: eine kleinere Sicherung über den Dateiwähler.
    const small = { ...saved, tasks: saved.tasks.slice(0, 2), completions: [] };
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByRole("button", { name: "Sicherung einspielen …", exact: true }).click(),
    ]);
    await chooser.setFiles(textFile("klein.json", JSON.stringify(small)));
    const question = page.getByRole("dialog", { name: "Sicherung einspielen?" });
    await expect(question).toBeVisible();
    await Promise.all([
      page.waitForEvent("download"),
      question.getByRole("button", { name: "Ja, Daten ersetzen" }).click(),
    ]);

    await expect.poll(async () => (await localData(page)).tasks.length).toBe(2);
    await expect(
      page.getByRole("status").filter({ hasText: "Sicherung eingespielt" }),
    ).toBeVisible();
  });

  test("N3 Auch ohne Internet zeigt „Auf anderem Gerät öffnen“ den QR-Code (nachgeladene Datei)", async ({
    page,
    context,
  }) => {
    await startInstalled(page);
    await context.setOffline(true);
    await page.reload();
    await openSettings(page, "Konto und Haushalt");

    await page.getByRole("button", { name: "QR-Code zeigen" }).click();

    await expect(page.getByRole("img", { name: /^QR-Code mit der Adresse / })).toBeVisible();
  });

  test("N3 Schneller Start: die Seite kommt sofort vom Gerät, ein Ladebild steht bis zum ersten Bild der App", async ({
    page,
    context,
    browserName,
  }) => {
    await startInstalled(page);
    // Ein Server, der nie antwortet: die gehaltene Seite darf nicht auf ihn warten. Nur Chromium
    // leitet Anfragen des Service Workers durch `route`; WebKit hielte damit die Seite selbst an.
    if (browserName === "chromium") {
      await context.route("**/kruemel/", () => undefined);
    }

    const started = Date.now();
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Diese Woche" })).toBeVisible();
    expect(Date.now() - started).toBeLessThan(3000);

    // Das Ladebild steht in der Seite selbst (vor jedem Skript) und ist danach ersetzt.
    const splash = await page.evaluate(async () => {
      const html = await caches.match(location.href.split("#")[0] as string, { ignoreVary: true });
      const parsed = new DOMParser().parseFromString(await (html as Response).text(), "text/html");
      // Das Ladebild hat je Sprache einen Text; hier zählt der deutsche (EN-c: der englische steht
      // in language.spec.ts).
      const status = parsed.querySelector('#app [role="status"]');
      for (const english of status?.querySelectorAll('[lang="en"]') ?? []) {
        english.remove();
      }
      return status?.textContent?.replace(/\s+/g, " ").trim();
    });
    expect(splash).toBe("Krümel Wird geladen …");
    await expect(page.locator(".splash")).toHaveCount(0);
  });

  test("N3 Kommt eine neue Version, bietet die offene App „Neu laden“ an", async ({ page }) => {
    await startInstalled(page);
    const hint = page.getByRole("complementary", { name: "Neue Version" });
    await expect(hint).toHaveCount(0);

    // So meldet der Browser, dass ein neuer Service Worker (neuer Build) übernommen hat.
    await page.evaluate(() => navigator.serviceWorker.dispatchEvent(new Event("controllerchange")));

    await expect(hint).toContainText("Es gibt eine neue Version von Krümel.");
    await expectNoAccessibilityViolations(page);
    await hint.getByRole("button", { name: "Neu laden" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Diese Woche" })).toBeVisible();
    await expect(hint).toHaveCount(0);
  });

  test("N3 Der Speicher des Service Workers enthält nur Dateien der App, auch nach einem Download", async ({
    page,
  }) => {
    await startInstalled(page);

    // Ein Download ist eine blob:-Adresse der Seite; sie darf nie im Speicher des Service Workers landen.
    await openSettings(page, "Daten");
    await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: "Sicherung herunterladen", exact: true }).click(),
    ]);
    const urls = await page.evaluate(async () => {
      const names = await caches.keys();
      const cache = await caches.open(names[0] as string);
      return (await cache.keys()).map((request) => request.url);
    });
    expect(urls.every((url) => url.startsWith("http://localhost:4173/kruemel/"))).toBe(true);
  });

  test("N3 Der Demo-Modus (npm run demo) arbeitet ohne Service Worker", async ({ page }) => {
    await page.goto(demoUrl);
    await expect(page.getByText("Demo-Modus:")).toBeVisible();

    const registrations = await page.evaluate(() =>
      navigator.serviceWorker.getRegistrations().then((list) => list.length),
    );

    expect(registrations).toBe(0);
  });
});

test.describe("S6 Content Security Policy", () => {
  test("S6 Die Seite erlaubt Verbindungen nur zur eigenen Adresse (Etappe 1: ohne Server)", async ({
    page,
  }) => {
    await page.goto("./");

    const policy = await page
      .locator('meta[http-equiv="Content-Security-Policy"]')
      .getAttribute("content");

    expect(policy).toContain("connect-src 'self' blob:;");
    expect(policy).toMatch(/script-src 'self' 'sha256-[A-Za-z0-9+/=]+';/);
  });

  test("S6 Die App läuft ohne Verstoß gegen die Richtlinie: Farbschema-Skript, Schrift, Service Worker, QR-Code", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const found: string[] = [];
      (window as unknown as { cspViolations: string[] }).cspViolations = found;
      document.addEventListener("securitypolicyviolation", (event) => {
        found.push(`${event.violatedDirective}: ${event.blockedURI}`);
      });
    });
    await startInstalled(page);
    await store(page, {
      [deviceKey]: JSON.stringify({ currentPerson: "personA", colorScheme: "dark" }),
    });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await openSettings(page, "Konto und Haushalt");
    await page.getByRole("button", { name: "QR-Code zeigen" }).click();
    await expect(page.getByRole("img", { name: /^QR-Code mit der Adresse / })).toBeVisible();
    await goToPage(page, "Aufgaben");

    expect(
      await page.evaluate(() => (window as unknown as { cspViolations: string[] }).cspViolations),
    ).toEqual([]);
  });
});
