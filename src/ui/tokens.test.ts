import { describe, expect, it } from "vitest";
import { SYMBOL_TONES, TASK_SYMBOLS } from "../domain/taskSymbols";
import tokensCss from "./tokens.css?raw";

// N2 and DESIGN.md section 2: every combination of colours the app uses is checked here, in both
// themes. Text needs 4.5:1 (large bold text 3:1), borders, focus rings and symbols need 3:1
// (WCAG 1.4.3, 1.4.11). The glass surfaces of the dark theme are see-through: they are mixed onto
// what lies below them, down to the page background, and checked against its darkest and its
// brightest point (the glow at the top), whichever is worse.

type Rgba = readonly [number, number, number, number];
type Palette = Record<string, string>;

/** The `--name: #hex` and `--name: rgba(…)` values of the first block that follows `selector`. */
function block(selector: string): Palette {
  const start = tokensCss.indexOf(`${selector} {`);
  expect(start, `Block ${selector} fehlt`).toBeGreaterThanOrEqual(0);
  const body = tokensCss.slice(start, tokensCss.indexOf("}", start));
  return Object.fromEntries(
    [...body.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6}|rgba\([^)]*\))\s*;/gi)].map(
      ([, name, value]) => [name as string, (value as string).toLowerCase()],
    ),
  );
}

const light = block(":root");
const darkAuto = block(':root:not([data-theme="light"])');
const darkChosen = block(':root[data-theme="dark"]');
const dark = { ...light, ...darkChosen };

function parse(value: string): Rgba {
  if (value.startsWith("#")) {
    const channel = (offset: number) => Number.parseInt(value.slice(offset, offset + 2), 16);
    return [channel(1), channel(3), channel(5), 1];
  }
  const [r, g, b, a] = (value.match(/[\d.]+/g) ?? []).map(Number) as [
    number,
    number,
    number,
    number,
  ];
  return [r, g, b, a];
}

/** `top` laid over the opaque `below`. */
function mix(top: Rgba, below: Rgba): Rgba {
  const [r, g, b, a] = top;
  return [r * a + below[0] * (1 - a), g * a + below[1] * (1 - a), b * a + below[2] * (1 - a), 1];
}

function linear(value: number): number {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function luminance([r, g, b]: Rgba): number {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrast(a: Rgba, b: Rgba): number {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (high + 0.05) / (low + 0.05);
}

/** What a see-through surface lies on: glass on glass on the page. Everything else lies on `--bg`. */
const BELOW: Record<string, string> = {
  "--surface-2": "--surface",
};

/** The colour a token shows when it lies (through its stack of surfaces) on `page`. */
function shown(palette: Palette, token: string, page: Rgba): Rgba {
  const value = palette[token];
  expect(value, token).toBeDefined();
  const colour = parse(value as string);
  if (colour[3] === 1 || token === "--bg" || token === "--bg-glow") {
    return colour;
  }
  return mix(colour, shown(palette, BELOW[token] ?? "--bg", page));
}

/** The worse contrast of the two, on the darkest and on the brightest point of the page. */
function ratio(palette: Palette, foreground: string, background: string): number {
  return Math.min(
    ...["--bg", "--bg-glow"].map((pageToken) => {
      const page = parse(palette[pageToken] as string);
      return contrast(shown(palette, foreground, page), shown(palette, background, page));
    }),
  );
}

/** Foreground token, background token. */
const TEXT_PAIRS: readonly [string, string][] = [
  ...["--bg", "--surface", "--surface-2", "--surface-solid", "--accent-soft"].flatMap(
    (background) =>
      ["--text", "--text-muted", "--accent", "--warn-text"].map((text): [string, string] => [
        text,
        background,
      ]),
  ),
  ["--on-accent-tile", "--accent-tile"],
  ["--on-warn-tile", "--warn-tile"],
  ["--on-warn-tile-action", "--warn-tile-action"],
  ["--on-inverse", "--inverse"],
  // Navigation: the labels on the bar and in the pill of the current page.
  ["--on-nav", "--nav"],
  ["--nav", "--on-nav"],
  // Demo hint and success messages.
  ["--text", "--tone-blue-bg"],
  ["--accent", "--tone-blue-bg"],
  ["--text", "--tone-green-bg"],
];

/** Bold text of at least 18.7 px (the initial in the avatar). */
const LARGE_TEXT_PAIRS: readonly [string, string][] = [
  ["--on-person", "--person-a"],
  ["--on-person", "--person-b"],
];

const NON_TEXT_PAIRS: readonly [string, string][] = [
  // Tick buttons, dashed day circles and fields, and the focus ring, wherever they sit.
  ...["--bg", "--surface", "--surface-2", "--surface-solid", "--accent-soft"].flatMap(
    (background) =>
      ["--control-border", "--accent"].map((control): [string, string] => [control, background]),
  ),
  // Done circles and the "Gemeinsam" tile; the tick and the ring on them.
  ["--accent-tile", "--surface"],
  ["--accent-tile", "--accent-soft"],
  ["--on-accent-tile", "--accent-tile"],
  // Focus ring and button edge on the warn tile.
  ["--on-warn-tile", "--warn-tile"],
  ["--warn-tile-action", "--warn-tile"],
  // Selected filter and day against the tile they sit on.
  ["--inverse", "--surface"],
  ["--inverse", "--surface-2"],
  ["--inverse", "--bg"],
  // Navigation: symbols on the bar, the plus on its button.
  ["--on-nav", "--nav"],
  ["--on-accent-tile", "--accent-strong"],
  // The two people in the statistics (bars, avatars) on the page and on tiles.
  ...["--person-a", "--person-b"].flatMap((person) =>
    ["--bg", "--surface"].map((background): [string, string] => [person, background]),
  ),
  // Symbol tiles (F8): the picture on its tone, ...
  ...SYMBOL_TONES.map((tone): [string, string] => [`--tone-${tone}-fg`, `--tone-${tone}-bg`]),
  // ... the small picture on the chips of the week, ...
  ...SYMBOL_TONES.map((tone): [string, string] => [`--tone-${tone}-fg`, "--surface-2"]),
  // ... and the frame of the chosen symbol in the form, against the tile and the page.
  ...SYMBOL_TONES.map((tone): [string, string] => ["--accent", `--tone-${tone}-bg`]),
  // The QR code (N3, "Auf anderem Gerät öffnen").
  ["--qr-dark", "--qr-light"],
];

describe.each([
  ["hell", light],
  ["dunkel", dark],
])("N2 Kontraste im Farbschema %s", (_name, palette: Palette) => {
  it.each(TEXT_PAIRS)("N2 Text %s auf %s erreicht mindestens 4,5:1", (foreground, background) => {
    expect(ratio(palette, foreground, background)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(LARGE_TEXT_PAIRS)(
    "N2 Große fette Schrift %s auf %s erreicht mindestens 3:1",
    (foreground, background) => {
      expect(ratio(palette, foreground, background)).toBeGreaterThanOrEqual(3);
    },
  );

  it.each(NON_TEXT_PAIRS)(
    "N2 Bedienelement %s auf %s erreicht mindestens 3:1",
    (foreground, background) => {
      expect(ratio(palette, foreground, background)).toBeGreaterThanOrEqual(3);
    },
  );
});

describe("F8 Farbtöne der Symbole", () => {
  it.each(SYMBOL_TONES)(
    "F8 Der Ton %s hat Hintergrund und Symbolfarbe in beiden Themes",
    (tone) => {
      for (const palette of [light, darkChosen]) {
        expect(palette[`--tone-${tone}-bg`]).toBeDefined();
        expect(palette[`--tone-${tone}-fg`]).toBeDefined();
      }
    },
  );

  it("F8 Jeder Ton der Symbol-Liste ist ein bekannter Ton", () => {
    for (const symbol of TASK_SYMBOLS) {
      expect(SYMBOL_TONES).toContain(symbol.tone);
    }
  });
});

describe("N8 Farbschema", () => {
  it("N8 „Automatisch“ auf einem dunklen Gerät und „Dunkel“ nutzen dieselben Werte", () => {
    expect(darkAuto).toEqual(darkChosen);
    const gradient = (selector: string) =>
      tokensCss.slice(tokensCss.indexOf(`${selector} {`)).match(/--bg-image:\s*([^;]+);/)?.[1];
    expect(gradient(':root:not([data-theme="light"])')).toBe(gradient(':root[data-theme="dark"]'));
  });

  it("N8 Das dunkle Farbschema setzt jede Farbe neu, die sich laut DESIGN.md ändert", () => {
    for (const token of ["--bg", "--surface", "--surface-2", "--text", "--accent", "--inverse"]) {
      expect(dark[token], token).not.toBe(light[token]);
    }
  });

  it("N1 Das Leuchten im Dark Mode läuft vom Leuchtpunkt in den Seitenhintergrund (Werte wie geprüft)", () => {
    const start = tokensCss.indexOf(':root[data-theme="dark"] {');
    const image = tokensCss.slice(start).match(/--bg-image:\s*([^;]+);/)?.[1] ?? "";
    expect(image).toContain(dark["--bg-glow"]);
    expect(image).toContain(dark["--bg"]);
  });

  it("N2 Der Rechner für Kontraste stimmt (Schwarz auf Weiß 21:1, Glas wird gemischt)", () => {
    expect(contrast(parse("#000000"), parse("#ffffff"))).toBeCloseTo(21, 5);
    expect(contrast(parse("#ffffff"), parse("#ffffff"))).toBe(1);
    expect(mix(parse("rgba(255, 255, 255, 0.5)"), parse("#000000"))).toEqual([
      127.5, 127.5, 127.5, 1,
    ]);
  });
});
