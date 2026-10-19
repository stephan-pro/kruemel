import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";

/** Files from `public/` that the page needs; they are not part of the bundle, so they are listed. */
const PUBLIC_FILES = [
  "manifest.webmanifest",
  "icon.svg",
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-512.png",
  "apple-touch-icon.png",
];

/** A small string hash (cyrb53) for the version of the service worker; not for security. */
function hash(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Builds `src/sw.ts` as `sw.js` next to the page and tells it which files the build consists of
 * (all hashed assets plus the page and the files of `public/`). The version changes with the
 * files, so every new build makes browsers install the new worker. Only in the build; the
 * development server and the demo run without a service worker.
 */
function serviceWorker(): Plugin {
  return {
    name: "putzplan-service-worker",
    apply: "build",
    buildStart() {
      this.emitFile({ type: "chunk", id: "./src/sw.ts", fileName: "sw.js" });
    },
    generateBundle: {
      // After Vite's own plugins, which add the page (index.html) to the bundle.
      order: "post",
      handler(_options, bundle) {
        const page = bundle["index.html"];
        if (page?.type !== "asset") {
          throw new Error("index.html fehlt im Build");
        }
        const files = [...Object.keys(bundle).filter((name) => name !== "sw.js"), ...PUBLIC_FILES];
        files.sort();
        // The page is part of the version: a change to it alone must reach the devices too.
        const version = hash(files.join("\n") + String(page.source));
        const worker = bundle["sw.js"];
        if (worker?.type !== "chunk") {
          throw new Error("sw.js fehlt im Build");
        }
        const placeholder = /(["'`])__BUILD_INFO__\1/;
        if (!placeholder.test(worker.code)) {
          throw new Error("Platzhalter __BUILD_INFO__ fehlt in sw.js");
        }
        // The info is JSON inside a string literal of the worker, which `JSON.parse`s it.
        const info = JSON.stringify({ version, files });
        worker.code = worker.code.replace(placeholder, () => JSON.stringify(info));
      },
    },
  };
}

export default defineConfig({
  // GitHub Pages serves the app under /<repo-name>/.
  base: "/putzplan/",
  plugins: [serviceWorker()],
  test: {
    include: ["src/**/*.test.ts"],
    // `tokens.test.ts` reads the design tokens; other CSS stays empty in unit tests.
    css: { include: [/tokens\.css/] },
    // No `passWithNoTests`: `npm run check` must fail if no unit tests are found.
    coverage: {
      provider: "v8",
      include: ["src/domain/**/*.ts", "src/storage/**/*.ts", "src/demo/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/*.fixtures.ts"],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    },
  },
});
