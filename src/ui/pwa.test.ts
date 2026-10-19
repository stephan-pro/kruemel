import { describe, expect, it } from "vitest";
import indexHtml from "../../index.html?raw";
import manifestText from "../../public/manifest.webmanifest?raw";
import { applyThemeColor, THEME_COLORS } from "./colorScheme";
import tokensCss from "./tokens.css?raw";

// N3: the app can be put on the home screen. The colours of the manifest, of the bar colour tags in
// index.html and of THEME_COLORS all come from the page background in tokens.css.

/** The `--bg` of the block that follows `selector` in tokens.css. */
function background(selector: string): string {
  const start = tokensCss.indexOf(`${selector} {`);
  const body = tokensCss.slice(start, tokensCss.indexOf("}", start));
  return (body.match(/--bg:\s*(#[0-9a-f]{6})/i)?.[1] ?? "").toLowerCase();
}

const light = background(":root");
const dark = background(':root[data-theme="dark"]');
const manifest = JSON.parse(manifestText);

/** A stand-in for `<meta name="theme-color">` tags: only what `applyThemeColor` touches. */
function fakeDocument(schemes: readonly string[]) {
  const metas = schemes.map((scheme) => ({ dataset: { scheme }, content: "" }));
  const doc = { querySelectorAll: () => metas } as unknown as Document;
  return { doc, contents: () => metas.map((meta) => meta.content) };
}

describe("N3 App auf dem Home-Bildschirm: Farben", () => {
  it("N3 Die Leistenfarbe je Farbschema ist der Seitenhintergrund aus den Tokens", () => {
    expect(THEME_COLORS.light).toBe(light);
    expect(THEME_COLORS.dark).toBe(dark);
  });

  it("N3 Das Manifest nutzt den hellen Seitenhintergrund für Start-Bildschirm und Leiste", () => {
    expect(manifest.background_color).toBe(light);
    expect(manifest.theme_color).toBe(light);
  });

  it("N3 Die Leistenfarben in index.html gelten je Farbschema des Geräts und stimmen mit den Tokens überein", () => {
    expect(indexHtml).toMatch(
      new RegExp(
        `data-scheme="light"\\s+media="\\(prefers-color-scheme: light\\)"\\s+content="${light}"`,
      ),
    );
    expect(indexHtml).toMatch(
      new RegExp(
        `data-scheme="dark"\\s+media="\\(prefers-color-scheme: dark\\)"\\s+content="${dark}"`,
      ),
    );
    // Das Skript, das ein gewähltes Farbschema vor dem Zeichnen setzt, nutzt dieselben Farben.
    expect(indexHtml).toContain(`scheme === "dark" ? "${dark}" : "${light}"`);
  });

  it("N3 Ein gewähltes Farbschema färbt beide Leistentags, „Automatisch“ gibt jedem seine Farbe", () => {
    const { doc, contents } = fakeDocument(["light", "dark"]);

    applyThemeColor("dark", doc);
    expect(contents()).toEqual([dark, dark]);
    applyThemeColor("light", doc);
    expect(contents()).toEqual([light, light]);
    applyThemeColor("auto", doc);
    expect(contents()).toEqual([light, dark]);
  });
});

describe("N3 App auf dem Home-Bildschirm: Manifest und Seite", () => {
  it("N3 Das Manifest macht aus der Seite eine eigenständige App unter ihrer Adresse", () => {
    expect(manifest.name).toBe("Putzplan");
    expect(manifest.short_name).toBe("Putzplan");
    expect(manifest.lang).toBe("de");
    expect(manifest.display).toBe("standalone");
    // Relativ zum Manifest, damit es unter /putzplan/ genauso geht wie unter einer anderen Adresse.
    expect(manifest.start_url).toBe("./");
    expect(manifest.scope).toBe("./");
  });

  it("N3 Das Manifest bietet Symbole in 192 und 512 px sowie ein maskierbares", () => {
    const icons: { src: string; sizes: string; purpose?: string }[] = manifest.icons;

    const bySizeAndPurpose = icons.map((icon) => `${icon.sizes} ${icon.purpose ?? "any"}`);
    expect(bySizeAndPurpose).toContain("192x192 any");
    expect(bySizeAndPurpose).toContain("512x512 any");
    expect(bySizeAndPurpose).toContain("512x512 maskable");
    // Maskierbare Symbole nie als „any“ ausgeben (das Betriebssystem würde sie zuschneiden).
    expect(icons.filter((icon) => icon.purpose?.includes("maskable")).length).toBe(1);
  });

  it("N3 Die Seite verweist auf Manifest und Symbole und nutzt den ganzen Bildschirm (Aussparung des Handys)", () => {
    expect(indexHtml).toContain('rel="manifest" href="%BASE_URL%manifest.webmanifest"');
    expect(indexHtml).toContain('rel="apple-touch-icon" href="%BASE_URL%apple-touch-icon.png"');
    expect(indexHtml).toContain("viewport-fit=cover");
    expect(indexHtml).toContain('name="apple-mobile-web-app-capable" content="yes"');
  });
});
