// Draws the PNG app icons in public/ (`npm run icons`). Only needed when the icon changes; the
// PNGs are committed. The picture is the same as public/icon.svg: the blue tile of the app with a
// white house (Lucide "house", ISC). Chromium (from Playwright) does the drawing.
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const BLUE = "#1f47d6";
const HOUSE = `
  <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
  <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />`;

/**
 * `radius`: corner radius of the tile in 512ths (0 = full bleed, for icons the system masks itself).
 * `scale`: size of the house (24 units wide) in 512ths of the icon.
 */
function svg({ radius, scale }) {
  const offset = (512 - 24 * scale) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
    <rect width="512" height="512" rx="${radius}" fill="${BLUE}" />
    <g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="#fff"
       stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${HOUSE}</g>
  </svg>`;
}

const icons = [
  // Shown as they are (Android home screen, browser): rounded tile on a transparent ground.
  { file: "icon-192.png", size: 192, radius: 112, scale: 14 },
  { file: "icon-512.png", size: 512, radius: 112, scale: 14 },
  // Android masks it (circle, squircle …): full bleed, the house inside the safe zone (80 %).
  { file: "icon-maskable-512.png", size: 512, radius: 0, scale: 11 },
  // iPhone rounds it itself and wants no transparency.
  { file: "apple-touch-icon.png", size: 180, radius: 0, scale: 11 },
];

const publicDir = fileURLToPath(new URL("../public/", import.meta.url));
const browser = await chromium.launch();
try {
  for (const { file, size, radius, scale } of icons) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    await page.setContent(
      `<body style="margin:0;background:transparent">${svg({ radius, scale })}</body>`,
    );
    await page.screenshot({ path: `${publicDir}${file}`, omitBackground: true });
    await page.close();
    console.log(`✔ public/${file} (${size} × ${size})`);
  }
} finally {
  await browser.close();
}
