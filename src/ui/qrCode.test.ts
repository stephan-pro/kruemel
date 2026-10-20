import { encode } from "uqr";
import { describe, expect, it } from "vitest";
import { qrPicture } from "./qrCode";

const ADDRESS = "https://stephan-pro.github.io/kruemel/";

/** The modules a path paints, as "x,y" (the path is made of `M x y h w v1 h-w z` rows). */
function painted(path: string): Set<string> {
  const cells = new Set<string>();
  for (const [, x, y, width] of path.matchAll(/M(\d+) (\d+)h(\d+)v1h-\d+z/g)) {
    for (let column = Number(x); column < Number(x) + Number(width); column++) {
      cells.add(`${column},${y}`);
    }
  }
  return cells;
}

/** The finder pattern of a QR code: a dark 7 × 7 ring, a light ring, a dark 3 × 3 centre. */
function hasFinder(cells: Set<string>, left: number, top: number): boolean {
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      const ring = Math.max(Math.abs(x - 3), Math.abs(y - 3));
      const dark = ring !== 2;
      if (cells.has(`${left + x},${top + y}`) !== dark) {
        return false;
      }
    }
  }
  return true;
}

describe("N3 QR-Code „Auf anderem Gerät öffnen“", () => {
  it("N3 Der Code der Adresse ist ein QR-Code Version 3 (29 × 29) mit den drei Suchmustern", () => {
    const { size, path } = qrPicture(ADDRESS);
    const cells = painted(path);

    expect(size).toBe(29);
    expect(hasFinder(cells, 0, 0)).toBe(true);
    expect(hasFinder(cells, size - 7, 0)).toBe(true);
    expect(hasFinder(cells, 0, size - 7)).toBe(true);
    expect(hasFinder(cells, size - 7, size - 7)).toBe(false);
  });

  it("N3 Das Bild malt genau die dunklen Module des Codes (Fehlerkorrektur M, ohne Rand)", () => {
    const { size, data } = encode(ADDRESS, { ecc: "M", border: 0 });
    const expected = new Set<string>();
    data.forEach((row, y) => {
      row.forEach((dark, x) => {
        if (dark) {
          expected.add(`${x},${y}`);
        }
      });
    });

    const picture = qrPicture(ADDRESS);

    expect(picture.size).toBe(size);
    expect(painted(picture.path)).toEqual(expected);
  });

  it("N3 Eine längere Adresse ergibt einen größeren Code", () => {
    expect(qrPicture(`${ADDRESS}#/einstellungen/${"x".repeat(60)}`).size).toBeGreaterThan(29);
  });
});
