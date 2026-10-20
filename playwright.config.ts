import { defineConfig, devices } from "@playwright/test";

// Minimal Node typing instead of @types/node (N7: avoid a dependency for one line).
declare const process: { env: Record<string, string | undefined> };

const port = 4173;
const demoPort = 4174;
// The app in the mode `e2e` (shared storage) and the fake server it talks to (stage 2); the tests
// know the addresses from `tests/e2e/shared.ts`.
const e2ePort = 4175;
const fakeServerPort = 4180;

// What the extra browsers and sizes of `check:full` run (see `projects`).
const CROSS_BROWSER_SPECS = /(smoke|phone|pwa|install|design|accessibility)\.spec\.ts$/;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // Short console output (see scripts/short-reporter.mjs); the HTML report only goes to disk.
  reporter: process.env.CI
    ? [["./scripts/short-reporter.mjs"], ["html", { open: "never" }]]
    : [["./scripts/short-reporter.mjs"]],
  use: {
    baseURL: `http://localhost:${port}/putzplan/`,
    locale: "de-DE",
    trace: "on-first-retry",
  },
  // Runs against the production build; `npm run check` builds before this step.
  webServer: [
    {
      command: `npx vite preview --port ${port} --strictPort`,
      url: `http://localhost:${port}/putzplan/`,
      reuseExistingServer: !process.env.CI,
    },
    {
      // The same server as `npm run demo` (without opening a browser window).
      command: `npx vite --mode demo --port ${demoPort} --strictPort`,
      url: `http://localhost:${demoPort}/putzplan/`,
      reuseExistingServer: !process.env.CI,
    },
    {
      // The fake server (built by `npm run build:e2e` into dist-fake).
      command: "node dist-fake/fake-server.js",
      url: `http://localhost:${fakeServerPort}/health`,
      env: { FAKE_SERVER_PORT: String(fakeServerPort) },
      reuseExistingServer: !process.env.CI,
    },
    {
      // The app in the mode `e2e`, built by `npm run build:e2e` into dist-e2e.
      command: `npx vite preview --outDir dist-e2e --port ${e2ePort} --strictPort`,
      url: `http://localhost:${e2ePort}/putzplan/`,
      reuseExistingServer: !process.env.CI,
    },
  ],
  // `npm run check` (every commit): all tests in Chromium on the desktop. `npm run check:full`
  // (E2E_FULL=1: nightly and before a release) adds the other browsers and sizes, which run only
  // what depends on them: the smoke test with axe on the main pages, the layout at phone sizes, the
  // PWA, the installation help and the design (colour scheme, focus, touch targets).
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    ...(process.env.E2E_FULL
      ? [
          { name: "chromium-mobile", use: { ...devices["Pixel 7"] } },
          { name: "webkit-desktop", use: { ...devices["Desktop Safari"] } },
          { name: "webkit-mobile", use: { ...devices["iPhone 15"] } },
        ].map((project) => ({ ...project, testMatch: CROSS_BROWSER_SPECS }))
      : []),
  ],
});
