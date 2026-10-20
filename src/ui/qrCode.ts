import { encode } from "uqr";

/** A QR code as one SVG path: `size` × `size` modules, each dark module a 1 × 1 square. */
export interface QrPicture {
  readonly size: number;
  readonly path: string;
}

/**
 * The QR code of `text` (error correction M: still readable with 15 % damaged, e.g. a reflection
 * on a screen) without the quiet zone; the page draws that as a light margin around it. Dark
 * modules next to each other in a row become one rectangle, which keeps the path short.
 */
export function qrPicture(text: string): QrPicture {
  const { size, data } = encode(text, { ecc: "M", border: 0 });
  let path = "";
  data.forEach((row, y) => {
    let x = 0;
    while (x < size) {
      if (!row[x]) {
        x++;
        continue;
      }
      let end = x;
      while (end < size && row[end]) {
        end++;
      }
      path += `M${x} ${y}h${end - x}v1h-${end - x}z`;
      x = end;
    }
  });
  return { size, path };
}
