import { describe, expect, it } from "vitest";
import { type BrowserTraits, installWay, isIos, offersInstallHint } from "./install";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1";
/** iPads ask for the desktop page and look like a Mac, except for the touch screen. */
const IPAD_OR_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Safari/605.1.15";
const FIREFOX_ANDROID = "Mozilla/5.0 (Android 15; Mobile; rv:144.0) Gecko/144.0 Firefox/144.0";
const CHROME_ANDROID =
  "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36";
const FIREFOX_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:144.0) Gecko/20100101 Firefox/144.0";

function traits(userAgent: string, changes: Partial<BrowserTraits> = {}): BrowserTraits {
  return { userAgent, maxTouchPoints: 0, standalone: false, canPrompt: false, ...changes };
}

describe("N3 Weg zur Installation je Browser", () => {
  it("N3 Läuft Putzplan schon als installierte App, wird nichts angeboten", () => {
    expect(installWay(traits(IPHONE_SAFARI, { standalone: true }))).toBe("installed");
    expect(installWay(traits(CHROME_ANDROID, { standalone: true, canPrompt: true }))).toBe(
      "installed",
    );
  });

  it("N3 Bietet der Browser die Installation an, gibt es den Knopf „App installieren“", () => {
    expect(installWay(traits(CHROME_ANDROID, { canPrompt: true }))).toBe("prompt");
  });

  it("N3 iPhone und iPad bekommen die Anleitung über Teilen → Zum Home-Bildschirm", () => {
    expect(installWay(traits(IPHONE_SAFARI, { maxTouchPoints: 5 }))).toBe("ios");
    expect(installWay(traits(IPAD_OR_MAC, { maxTouchPoints: 5 }))).toBe("ios");
  });

  it("N3 Firefox auf Android bekommt den Hinweis auf das Browsermenü", () => {
    expect(installWay(traits(FIREFOX_ANDROID, { maxTouchPoints: 5 }))).toBe("firefoxAndroid");
  });

  it("N3 Andere Browser bekommen nur den allgemeinen Hinweis", () => {
    expect(installWay(traits(IPAD_OR_MAC))).toBe("other");
    expect(installWay(traits(FIREFOX_WINDOWS))).toBe("other");
    // Chrome before it offers the installation (or after its question was answered "no").
    expect(installWay(traits(CHROME_ANDROID, { maxTouchPoints: 5 }))).toBe("other");
  });

  it("N3 Ein Mac ohne Touchscreen ist kein iPad", () => {
    expect(isIos(traits(IPAD_OR_MAC))).toBe(false);
    expect(isIos(traits(IPAD_OR_MAC, { maxTouchPoints: 5 }))).toBe(true);
  });

  it("N3 Den Hinweis in der Woche gibt es nur, wo es einen klaren Weg gibt", () => {
    expect(offersInstallHint("prompt")).toBe(true);
    expect(offersInstallHint("ios")).toBe(true);
    expect(offersInstallHint("firefoxAndroid")).toBe(true);
    expect(offersInstallHint("other")).toBe(false);
    expect(offersInstallHint("installed")).toBe(false);
  });
});
