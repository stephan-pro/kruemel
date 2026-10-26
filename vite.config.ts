import { loadEnv, type Plugin } from "vite";
import { defineConfig } from "vitest/config";
import { backendMode, checkPublishableKey } from "./src/backend.ts";
import { contentSecurityPolicy, scriptHash, supabaseSources } from "./src/csp.ts";

// Minimal Node typing instead of @types/node (N7), as in playwright.config.ts.
declare const process: { env: Record<string, string | undefined> };

/**
 * What "Einstellungen → Version" shows: when this build was made and from which commit (set by
 * the workflow `pages`; missing in local builds). Every build differs, so every deployment is a
 * new version for the service worker.
 */
const BUILD = {
  time: new Date().toISOString(),
  commit: process.env.APP_COMMIT?.slice(0, 7) ?? null,
};

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
    name: "kruemel-service-worker",
    // Not for the fake server (an SSR build without a page).
    apply: (config, { command }) => command === "build" && !config.build?.ssr,
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
        // A classic service worker cannot import: a file it shares with the page would become a
        // chunk of its own and the worker would not start at all (no offline use, no pushes).
        if (worker.imports.length > 0 || worker.dynamicImports.length > 0) {
          throw new Error(
            `sw.js importiert ${[...worker.imports, ...worker.dynamicImports].join(", ")}: Dateien des Service Workers dürfen nicht auch von der Seite genutzt werden`,
          );
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

/**
 * Puts the Content Security Policy (`src/csp.ts`) into the built page, with the hashes of its
 * inline scripts (the colour scheme script in index.html). Only in the build: the development
 * server and the demo inject scripts of their own.
 */
function securityPolicy(connectTo: readonly string[]): Plugin {
  return {
    name: "kruemel-csp",
    apply: (config, { command }) => command === "build" && !config.build?.ssr,
    transformIndexHtml: {
      // After Vite has filled in %MODE% and the like, so the hashes match the final page.
      order: "post",
      async handler(html) {
        const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
        const hashes = await Promise.all(inline.map((match) => scriptHash(match[1] ?? "")));
        const policy = contentSecurityPolicy(hashes, connectTo);
        return [
          {
            tag: "meta",
            attrs: { "http-equiv": "Content-Security-Policy", content: policy },
            injectTo: "head-prepend",
          },
        ];
      },
    },
  };
}

/** Where the app finds the fake server in the mode `e2e` (`scripts/fake-server.ts`). */
const FAKE_SERVER = process.env.FAKE_SERVER_URL ?? "http://localhost:4180";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "VITE_");
  // The test build (`e2e`) never reads the setting from an .env file: a `.env.local` made for
  // trying the real project (`VITE_BACKEND=local`) must not turn the tests' fake backend off.
  const backend = backendMode(mode, mode === "e2e" ? process.env.VITE_BACKEND : env.VITE_BACKEND);
  if (backend === "supabase") {
    checkPublishableKey(env.VITE_SUPABASE_PUBLISHABLE_KEY);
  }
  const connectTo =
    backend === "fake"
      ? [new URL(FAKE_SERVER).origin]
      : backend === "supabase"
        ? supabaseSources(env.VITE_SUPABASE_URL)
        : [];
  return {
    // GitHub Pages serves the app under /<repo-name>/.
    base: "/kruemel/",
    plugins: [serviceWorker(), securityPolicy(connectTo)],
    define: {
      __APP_BUILD__: JSON.stringify(BUILD),
      // Which storage the app uses (stage 2), fixed at build time so the code of the other
      // storages is left out of the build. `VITE_BACKEND` from the environment or an .env file.
      __BACKEND__: JSON.stringify(backend),
      __FAKE_SERVER__: JSON.stringify(FAKE_SERVER),
    },
    test: {
      // `supabase/functions/`: the core of the Edge Functions (NT-a), tested without Deno.
      include: ["src/**/*.test.ts", "supabase/functions/**/*.test.ts"],
      // `tokens.test.ts` reads the design tokens; other CSS stays empty in unit tests.
      css: { include: [/tokens\.css/] },
      // No `passWithNoTests`: `npm run check` must fail if no unit tests are found.
      coverage: {
        provider: "v8",
        include: [
          "src/domain/**/*.ts",
          "src/storage/**/*.ts",
          "src/demo/**/*.ts",
          "src/sync/**/*.ts",
          "src/auth/**/*.ts",
          "src/push/**/*.ts",
          "src/i18n/**/*.ts",
          "src/backend.ts",
          "supabase/functions/**/*.ts",
        ],
        // `browserFake.ts`, `browserShared.ts` and `browserPush.ts` only connect parts that have
        // their own tests (and need the browser); `index.ts` of an Edge Function only connects its
        // core to Deno.
        exclude: [
          "src/**/*.test.ts",
          "src/**/*.fixtures.ts",
          "src/**/*.contract.ts",
          "src/sync/browserFake.ts",
          "src/sync/browserShared.ts",
          "src/push/browserPush.ts",
          // The language files are texts; their shape is checked by the type checker and by
          // `i18n.test.ts`, their small rules by the tests of `format.ts` in both languages.
          // `useLanguage.ts` is a hook of the page (E2E).
          "src/i18n/de.ts",
          "src/i18n/en.ts",
          "src/i18n/useLanguage.ts",
          "supabase/functions/**/*.test.ts",
          "supabase/functions/**/*.cases.ts",
          "supabase/functions/*/index.ts",
        ],
        thresholds: {
          lines: 90,
          functions: 90,
          branches: 90,
          statements: 90,
        },
      },
    },
  };
});
