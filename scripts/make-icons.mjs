// Draws the PNG app icons in public/ (`npm run icons`) from public/icon.svg (the Krümel template,
// docs/design/kruemel-icon.svg). Only needed when the icon changes; the PNGs are committed.
// Chromium (from Playwright) does the drawing. Icons the system masks itself (maskable, iPhone) get
// a full-bleed tile and the picture scaled down around the centre, so that every part of it lies in
// the safe zone (circle of 80 % of the size); the script checks that pixel by pixel and fails if not.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const publicDir = fileURLToPath(new URL("../public/", import.meta.url));
const source = readFileSync(`${publicDir}icon.svg`, "utf8");
const tile = source.match(/<rect\b[^>]*\/>/)?.[0];
const fill = tile?.match(/fill="([^"]+)"/)?.[1];
if (tile === undefined || fill === undefined) {
  throw new Error("public/icon.svg: the first <rect> (the tile) is missing");
}
// Everything after the tile up to the closing tag is the picture.
const picture = source.slice(source.indexOf(tile) + tile.length, source.lastIndexOf("</svg>"));

/** The picture scaled by `scale` around the centre of the 512 × 512 icon. */
function scaled(scale) {
  const offset = 256 * (1 - scale);
  return `<g transform="translate(${offset} ${offset}) scale(${scale})">${picture}</g>`;
}

/** `bleed`: square tile without rounded corners (the system masks it). */
function svg({ bleed, scale, withTile = true }) {
  const background = withTile
    ? bleed
      ? `<rect width="512" height="512" fill="${fill}"/>`
      : tile
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">${background}${scaled(scale)}</svg>`;
}

// Largest scale at which the picture still fits into the safe zone; measured by `check` below.
const MASKED_SCALE = 0.78;

const icons = [
  // Shown as they are (Android home screen, browser): the template with its rounded tile.
  { file: "icon-192.png", size: 192, bleed: false, scale: 1 },
  { file: "icon-512.png", size: 512, bleed: false, scale: 1 },
  // Android masks it (circle, squircle …): full bleed, the picture inside the safe zone.
  { file: "icon-maskable-512.png", size: 512, bleed: true, scale: MASKED_SCALE },
  // iPhone rounds it itself and wants no transparency.
  { file: "apple-touch-icon.png", size: 180, bleed: true, scale: MASKED_SCALE },
];

const browser = await chromium.launch();
try {
  // Safe zone: draw the scaled picture alone and find its farthest pixel from the centre.
  const page = await browser.newPage({ viewport: { width: 512, height: 512 } });
  await page.setContent(
    `<body style="margin:0;background:transparent">${svg({ bleed: true, scale: MASKED_SCALE, withTile: false })}</body>`,
  );
  const shot = await page.screenshot({ omitBackground: true });
  const farthest = await page.evaluate(async (base64) => {
    const bitmap = await createImageBitmap(
      await fetch(`data:image/png;base64,${base64}`).then((response) => response.blob()),
    );
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");
    context.drawImage(bitmap, 0, 0);
    const { data, width, height } = context.getImageData(0, 0, bitmap.width, bitmap.height);
    let max = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (data[(y * width + x) * 4 + 3] > 0) {
          max = Math.max(max, Math.hypot(x + 0.5 - width / 2, y + 0.5 - height / 2));
        }
      }
    }
    return max / width;
  }, shot.toString("base64"));
  await page.close();
  console.log(
    `Sichere Zone: Motiv reicht bis ${(farthest * 200).toFixed(1)} % des Durchmessers (erlaubt 80 %)`,
  );
  if (farthest > 0.4) {
    throw new Error(`MASKED_SCALE ${MASKED_SCALE} is too big for the safe zone`);
  }

  for (const { file, size, bleed, scale } of icons) {
    const iconPage = await browser.newPage({ viewport: { width: size, height: size } });
    await iconPage.setContent(
      `<body style="margin:0;background:transparent">${svg({ bleed, scale })}</body>`,
    );
    await iconPage.screenshot({ path: `${publicDir}${file}`, omitBackground: true });
    await iconPage.close();
    console.log(`✔ public/${file} (${size} × ${size})`);
  }
} finally {
  await browser.close();
}
