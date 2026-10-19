import { describe, expect, it } from "vitest";
import tokensCss from "./tokens.css?raw";

// N2 and DESIGN.md section 2: every combination of colours the app uses is checked here, in both
// themes. Text needs 4.5:1, borders, focus rings and symbols need 3:1 (WCAG 1.4.3, 1.4.11).

type Palette = Record<string, string>;

/** The `--name: #hex` values of the first block that follows `selector`. */
function block(selector: string): Palette {
  const start = tokensCss.indexOf(`${selector} {`);
  expect(start, `Block ${selector} fehlt`).toBeGreaterThanOrEqual(0);
  const body = tokensCss.slice(start, tokensCss.indexOf("}", start));
  return Object.fromEntries(
    [...body.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})\s*;/gi)].map(([, name, value]) => [
      name as string,
      (value as string).toLowerCase(),
    ]),
  );
}

const light = block(":root");
const darkAuto = block(':root:not([data-theme="light"])');
const darkChosen = block(':root[data-theme="dark"]');
const dark = { ...light, ...darkChosen };

function channel(hex: string, offset: number): number {
  const value = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

function contrast(a: string, b: string): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (high + 0.05) / (low + 0.05);
}

/** Foreground token, background token. */
const TEXT_PAIRS: readonly [string, string][] = [
  ["--text", "--bg"],
  ["--text", "--surface"],
  ["--text", "--surface-2"],
  ["--text-muted", "--bg"],
  ["--text-muted", "--surface"],
  ["--text-muted", "--surface-2"],
  ["--accent", "--bg"],
  ["--accent", "--surface"],
  ["--accent", "--surface-2"],
  ["--warn-text", "--bg"],
  ["--warn-text", "--surface"],
  ["--warn-text", "--surface-2"],
  ["--on-accent-tile", "--accent-tile"],
  ["--on-warn-tile", "--warn-tile"],
  ["--on-warn-tile-action", "--warn-tile-action"],
  ["--on-inverse", "--inverse"],
  // Demo hint and success messages.
  ["--text", "--tone-blue-bg"],
  ["--accent", "--tone-blue-bg"],
  ["--text", "--tone-green-bg"],
];

const NON_TEXT_PAIRS: readonly [string, string][] = [
  ["--control-border", "--bg"],
  ["--control-border", "--surface"],
  ["--control-border", "--surface-2"],
  // The focus ring.
  ["--accent", "--bg"],
  ["--accent", "--surface"],
  ["--accent", "--surface-2"],
  // Focus ring and button edge on the warn tile.
  ["--on-warn-tile", "--warn-tile"],
  ["--warn-tile-action", "--warn-tile"],
  // Selected filter and day against the tile they sit on.
  ["--inverse", "--surface"],
  ["--inverse", "--surface-2"],
  ["--tone-blue-fg", "--tone-blue-bg"],
  ["--tone-green-fg", "--tone-green-bg"],
  ["--tone-orange-fg", "--tone-orange-bg"],
];

describe.each([
  ["hell", light],
  ["dunkel", dark],
])("N2 Kontraste im Farbschema %s", (_name, palette: Palette) => {
  function ratio(foreground: string, background: string): number {
    const [fg, bg] = [palette[foreground], palette[background]];
    expect(fg, foreground).toBeDefined();
    expect(bg, background).toBeDefined();
    return contrast(fg as string, bg as string);
  }

  it.each(TEXT_PAIRS)("N2 Text %s auf %s erreicht mindestens 4,5:1", (foreground, background) => {
    expect(ratio(foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(NON_TEXT_PAIRS)(
    "N2 Bedienelement %s auf %s erreicht mindestens 3:1",
    (foreground, background) => {
      expect(ratio(foreground, background)).toBeGreaterThanOrEqual(3);
    },
  );
});

describe("N8 Farbschema", () => {
  it("N8 „Automatisch“ auf einem dunklen Gerät und „Dunkel“ nutzen dieselben Werte", () => {
    expect(darkAuto).toEqual(darkChosen);
  });

  it("N8 Das dunkle Farbschema setzt jede Farbe neu, die sich laut DESIGN.md ändert", () => {
    for (const token of ["--bg", "--surface", "--surface-2", "--text", "--accent", "--inverse"]) {
      expect(dark[token], token).not.toBe(light[token]);
    }
  });

  it("N2 Der Rechner für Kontraste stimmt (Schwarz auf Weiß 21:1)", () => {
    expect(contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrast("#ffffff", "#ffffff")).toBe(1);
  });
});
