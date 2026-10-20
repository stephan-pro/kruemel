import { describe, expect, it } from "vitest";
import template from "../../docs/design/kruemel-icon.svg?raw";
import apple from "../../public/apple-touch-icon.png?inline";
import source from "../../public/icon.svg?raw";
import icon192 from "../../public/icon-192.png?inline";
import icon512 from "../../public/icon-512.png?inline";
import maskable from "../../public/icon-maskable-512.png?inline";
import manifestText from "../../public/manifest.webmanifest?raw";

// N3 / DESIGN.md section 9: the app icon is the Krümel template, in all sizes. `npm run icons` draws
// the PNGs from public/icon.svg and checks the safe zone of the maskable ones pixel by pixel.

/** The drawing without comments, the title and the whitespace between the tags. */
function drawing(svg: string): string {
  return svg
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<title>[\s\S]*?<\/title>/g, "")
    .replace(/>\s+</g, "><")
    .replace(/\s+/g, " ")
    .trim();
}

/** Width and height from the header of a PNG file given as a data URL. */
function pngSize(dataUrl: string): [number, number] {
  const bytes = Uint8Array.from(atob(dataUrl.split(",")[1] ?? ""), (char) => char.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  expect(view.getUint32(0)).toBe(0x89504e47);
  return [view.getUint32(16), view.getUint32(20)];
}

describe("N3 App-Symbol: der Krümel aus der Vorlage", () => {
  it("N3 public/icon.svg ist die Vorlage docs/design/kruemel-icon.svg, Motiv unverändert", () => {
    const pictureOf = (svg: string) => drawing(svg).replace(/^<svg[^>]*>/, "");

    expect(pictureOf(source)).toBe(pictureOf(template));
  });

  it("N3 Der Krümel bleibt goldbraun auf violetter Kachel, nie blau", () => {
    expect(source).toContain('rx="112" fill="#5530D9"');
    expect(source).toContain('fill="#F2B661"');
    expect(source).toContain('fill="#C98A3A"');
    // Blau kommt nur als Teil des Violetts vor (Kachel und Scheibe), nicht im Krümel selbst.
    const body = source.slice(source.indexOf('<g transform="translate(-24 0)">'));
    expect(body).not.toMatch(/fill="#(?:[0-5][0-9A-F]){2}[C-F][0-9A-F]"/i);
  });

  it("N3 Alle Größen sind da: 192, 512, maskierbar 512 und das Symbol für den iPhone-Bildschirm 180", () => {
    expect(pngSize(icon192)).toEqual([192, 192]);
    expect(pngSize(icon512)).toEqual([512, 512]);
    expect(pngSize(maskable)).toEqual([512, 512]);
    expect(pngSize(apple)).toEqual([180, 180]);
  });

  it("N3 Das Manifest nennt dieselben Dateien", () => {
    const sources = (JSON.parse(manifestText).icons as { src: string }[]).map((icon) => icon.src);

    expect(sources).toEqual(["icon-192.png", "icon-512.png", "icon-maskable-512.png", "icon.svg"]);
  });
});
